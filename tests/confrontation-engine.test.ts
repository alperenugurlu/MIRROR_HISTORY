import { describe, it, expect, beforeEach } from 'vitest';
import { initDatabase } from '../core/database';
import * as db from '../core/database';
import { generateConfrontations } from '../core/services/confrontation-engine';

beforeEach(() => {
  initDatabase(':memory:');
});

// Helper: create a mood entry for a date
function mood(date: string, score: number, hour = 12) {
  const ts = `${date}T${hour.toString().padStart(2, '0')}:00:00.000Z`;
  const e = db.insertEvent('mood', ts, `Mood ${score}`);
  db.insertMoodEntry(e.id, score, '', ts);
  return e;
}

// Helper: create a transaction for a date
function tx(date: string, merchant: string, amount: number) {
  const ts = `${date}T14:00:00.000Z`;
  const e = db.insertEvent('money_transaction', ts, merchant);
  db.insertTransaction(e.id, date, merchant, -Math.abs(amount), 'USD', `hash-${date}-${merchant}`);
  return e;
}

// Helper: create a calendar event
function cal(date: string, title: string, startHour: number, endHour: number) {
  const start = `${date}T${startHour.toString().padStart(2, '0')}:00:00.000Z`;
  const end = `${date}T${endHour.toString().padStart(2, '0')}:00:00.000Z`;
  const e = db.insertEvent('calendar_event', start, title);
  db.insertCalendarEvent(e.id, title, start, end);
  return e;
}

// Helper: create a workout
function workout(date: string) {
  const ts = `${date}T10:00:00.000Z`;
  const e = db.insertEvent('health_entry', ts, 'Workout');
  db.insertHealthEntry(e.id, 'workout', 1, 'session', ts);
  return e;
}

// Helper: create a location visit
function location(date: string, address: string, hour = 12) {
  const ts = `${date}T${hour.toString().padStart(2, '0')}:00:00.000Z`;
  const e = db.insertEvent('location', ts, address);
  db.insertLocation(e.id, 41.0, 29.0, address, ts);
  return e;
}

// Helper: create a note
function note(date: string, content: string) {
  const ts = `${date}T15:00:00.000Z`;
  const e = db.insertEvent('note', ts, content.slice(0, 50));
  db.insertNote(e.id, content, 'manual', []);
  return e;
}

describe('Confrontation Engine', () => {
  describe('generateConfrontations', () => {
    it('returns empty for no data', () => {
      const result = generateConfrontations('weekly');
      expect(result.generated).toBe(0);
      expect(result.confrontations).toHaveLength(0);
    });

    it('clears previous confrontations (idempotent)', () => {
      // Create enough data for at least one confrontation
      // 6 moods declining
      const dates = ['2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20', '2026-02-21', '2026-02-22'];
      dates.slice(0, 3).forEach(d => mood(d, 4));
      dates.slice(3).forEach(d => mood(d, 2));

      generateConfrontations('weekly');
      generateConfrontations('weekly');

      const stored = db.getConfrontations();
      // Should not double up — count mood_trend confrontations
      const moodDecline = stored.filter(c => c.title.includes('declining'));
      expect(moodDecline.length).toBeLessThanOrEqual(1);
    });

    it('stores confrontations in the database', () => {
      const dates = ['2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20', '2026-02-21', '2026-02-22'];
      dates.slice(0, 3).forEach(d => mood(d, 5));
      dates.slice(3).forEach(d => mood(d, 2));

      generateConfrontations('weekly');

      const stored = db.getConfrontations();
      expect(stored.length).toBeGreaterThan(0);
      expect(stored[0].title).toBeTruthy();
      expect(stored[0].insight).toBeTruthy();
    });
  });

  describe('mood-meeting correlation', () => {
    it('detects mood drops on busy meeting days', () => {
      // Need at least 3 moods and 3 calendar events
      // Busy days (3+ meetings): low mood
      for (const d of ['2026-02-18', '2026-02-19']) {
        mood(d, 2);
        cal(d, 'Meeting A', 9, 10);
        cal(d, 'Meeting B', 11, 12);
        cal(d, 'Meeting C', 14, 15);
      }
      // Calm days (0-1 meetings): high mood
      for (const d of ['2026-02-20', '2026-02-21']) {
        mood(d, 4.5);
        cal(d, 'Standup', 9, 10);
      }

      const result = generateConfrontations('weekly');
      const found = result.confrontations.find(c => c.title.toLowerCase().includes('meeting'));
      expect(found).toBeDefined();
      expect(found!.category).toBe('correlation');
      expect(found!.dataPoints.length).toBeGreaterThanOrEqual(2);
    });

    it('does NOT fire when mood is similar on busy vs calm days', () => {
      for (const d of ['2026-02-18', '2026-02-19']) {
        mood(d, 3.5);
        cal(d, 'A', 9, 10);
        cal(d, 'B', 11, 12);
        cal(d, 'C', 14, 15);
      }
      for (const d of ['2026-02-20', '2026-02-21']) {
        mood(d, 3.7);
      }

      const result = generateConfrontations('weekly');
      const found = result.confrontations.find(c => c.title.toLowerCase().includes('meeting'));
      expect(found).toBeUndefined();
    });

    it('does NOT fire with insufficient data', () => {
      mood('2026-02-20', 2);
      cal('2026-02-20', 'Meeting', 9, 10);

      const result = generateConfrontations('weekly');
      const found = result.confrontations.find(c => c.title.toLowerCase().includes('meeting'));
      expect(found).toBeUndefined();
    });
  });

  describe('spending-mood correlation', () => {
    it('detects higher spending on low-mood days', () => {
      // Low mood, high spending
      for (const d of ['2026-02-18', '2026-02-19']) {
        mood(d, 2);
        tx(d, 'Amazon', 150);
      }
      // High mood, normal spending
      for (const d of ['2026-02-20', '2026-02-21']) {
        mood(d, 4);
        tx(d, 'Cafe', 15);
      }
      // Need 5+ transactions
      tx('2026-02-22', 'Grocery', 30);

      const result = generateConfrontations('weekly');
      const found = result.confrontations.find(c => c.title.toLowerCase().includes('spend'));
      expect(found).toBeDefined();
      expect(found!.category).toBe('correlation');
    });

    it('does NOT fire when spending is similar across moods', () => {
      for (const d of ['2026-02-18', '2026-02-19']) {
        mood(d, 2);
        tx(d, 'Cafe', 20);
      }
      for (const d of ['2026-02-20', '2026-02-21']) {
        mood(d, 4);
        tx(d, 'Cafe', 18);
      }
      tx('2026-02-22', 'Grocery', 25);

      const result = generateConfrontations('weekly');
      const found = result.confrontations.find(c => c.title.toLowerCase().includes("spend more when"));
      expect(found).toBeUndefined();
    });
  });

  describe('exercise decline', () => {
    it('detects declining workout frequency', () => {
      // First half (before midpoint ~Feb 20): 3 workouts
      for (const d of ['2026-02-17', '2026-02-18', '2026-02-19']) {
        workout(d);
      }
      // Second half: 1 workout
      workout('2026-02-23');

      const result = generateConfrontations('weekly');
      const found = result.confrontations.find(c => c.title.toLowerCase().includes('working out') || c.title.toLowerCase().includes('stopped'));
      expect(found).toBeDefined();
      expect(found!.category).toBe('trend');
    });

    it('does NOT fire when exercise is stable', () => {
      for (const d of ['2026-02-17', '2026-02-18', '2026-02-21', '2026-02-22']) {
        workout(d);
      }

      const result = generateConfrontations('weekly');
      const found = result.confrontations.find(c => c.title.toLowerCase().includes('working out') || c.title.toLowerCase().includes('stopped'));
      expect(found).toBeUndefined();
    });

    it('does NOT fire with too few workouts', () => {
      workout('2026-02-20');

      const result = generateConfrontations('weekly');
      const found = result.confrontations.find(c => c.title.toLowerCase().includes('working out') || c.title.toLowerCase().includes('stopped'));
      expect(found).toBeUndefined();
    });
  });

  describe('mood trend', () => {
    it('detects declining mood over the period', () => {
      // First half high, second half low
      const dates = ['2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20', '2026-02-21', '2026-02-22'];
      dates.slice(0, 3).forEach(d => mood(d, 4.5));
      dates.slice(3).forEach(d => mood(d, 2));

      const result = generateConfrontations('weekly');
      const found = result.confrontations.find(c => c.title.toLowerCase().includes('declining'));
      expect(found).toBeDefined();
      expect(found!.category).toBe('trend');
      expect(found!.severity).toBeGreaterThanOrEqual(0.5);
    });

    it('does NOT fire when mood is stable', () => {
      const dates = ['2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20', '2026-02-21', '2026-02-22'];
      dates.forEach(d => mood(d, 3.5));

      const result = generateConfrontations('weekly');
      const found = result.confrontations.find(c => c.title.toLowerCase().includes('declining'));
      expect(found).toBeUndefined();
    });

    it('does NOT fire with too few moods', () => {
      mood('2026-02-20', 5);
      mood('2026-02-21', 1);

      const result = generateConfrontations('weekly');
      const found = result.confrontations.find(c => c.title.toLowerCase().includes('declining'));
      expect(found).toBeUndefined();
    });
  });

  describe('silent locations', () => {
    it('detects frequently visited locations not mentioned in notes', () => {
      // Visit "Kadikoy Sahil" 4 times
      for (const d of ['2026-02-19', '2026-02-20', '2026-02-21', '2026-02-22']) {
        location(d, 'Kadikoy Sahil');
      }
      // Notes exist but never mention Kadikoy
      note('2026-02-20', 'Had a productive day at the office');
      note('2026-02-21', 'Worked on the new feature');

      const result = generateConfrontations('weekly');
      const found = result.confrontations.find(c => c.title.includes('Kadikoy'));
      expect(found).toBeDefined();
      expect(found!.category).toBe('anomaly');
    });

    it('does NOT fire when location is mentioned in notes', () => {
      for (const d of ['2026-02-19', '2026-02-20', '2026-02-21', '2026-02-22']) {
        location(d, 'Kadikoy Sahil');
      }
      note('2026-02-20', 'Walked along Kadikoy waterfront today');

      const result = generateConfrontations('weekly');
      const found = result.confrontations.find(c => c.title.includes('Kadikoy'));
      expect(found).toBeUndefined();
    });

    it('does NOT fire for infrequent locations', () => {
      location('2026-02-20', 'Airport');
      location('2026-02-21', 'Airport');
      // Only 2 visits — below threshold

      const result = generateConfrontations('weekly');
      const found = result.confrontations.find(c => c.category === 'anomaly' && c.title.includes('Airport'));
      expect(found).toBeUndefined();
    });
  });

  describe('spending trend', () => {
    it('detects increasing spending over the period', () => {
      // First half (before midpoint ~Feb 20): low spending
      tx('2026-02-17', 'Cafe', 10);
      tx('2026-02-18', 'Lunch', 15);
      tx('2026-02-19', 'Grocery', 20);

      // Second half: high spending (must be 6+ total, and > 1.3x first half)
      tx('2026-02-21', 'Shopping', 80);
      tx('2026-02-22', 'Electronics', 120);
      tx('2026-02-23', 'Dinner', 60);

      const result = generateConfrontations('weekly');
      const found = result.confrontations.find(c => c.title.toLowerCase().includes('spending up'));
      expect(found).toBeDefined();
      expect(found!.category).toBe('trend');
    });

    it('does NOT fire when spending is stable', () => {
      tx('2026-02-17', 'Cafe', 30);
      tx('2026-02-18', 'Lunch', 25);
      tx('2026-02-19', 'Grocery', 35);

      tx('2026-02-21', 'Cafe', 28);
      tx('2026-02-22', 'Lunch', 32);
      tx('2026-02-23', 'Dinner', 30);

      const result = generateConfrontations('weekly');
      const found = result.confrontations.find(c => c.title.toLowerCase().includes('spending up'));
      expect(found).toBeUndefined();
    });
  });

  describe('calendar overload', () => {
    it('detects high event density', () => {
      // 12+ events over a few days (avg ~4/day)
      for (const d of ['2026-02-19', '2026-02-20', '2026-02-21']) {
        cal(d, 'Meeting 1', 9, 10);
        cal(d, 'Meeting 2', 10, 11);
        cal(d, 'Meeting 3', 11, 12);
        cal(d, 'Meeting 4', 14, 15);
      }

      const result = generateConfrontations('weekly');
      const found = result.confrontations.find(c => c.title.toLowerCase().includes('calendar'));
      expect(found).toBeDefined();
      expect(found!.category).toBe('correlation');
    });

    it('does NOT fire with few events', () => {
      cal('2026-02-20', 'Standup', 9, 10);
      cal('2026-02-21', 'Standup', 9, 10);

      const result = generateConfrontations('weekly');
      const found = result.confrontations.find(c => c.title.toLowerCase().includes('calendar'));
      expect(found).toBeUndefined();
    });
  });

  describe('confrontation structure', () => {
    it('all confrontations have required fields', () => {
      // Generate data that triggers multiple confrontations
      const dates = ['2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20', '2026-02-21', '2026-02-22'];
      dates.slice(0, 3).forEach(d => mood(d, 5));
      dates.slice(3).forEach(d => mood(d, 2));

      const result = generateConfrontations('weekly');

      for (const c of result.confrontations) {
        expect(c.title).toBeTruthy();
        expect(c.insight).toBeTruthy();
        expect(c.severity).toBeGreaterThanOrEqual(0);
        expect(c.severity).toBeLessThanOrEqual(1);
        expect(['correlation', 'trend', 'anomaly']).toContain(c.category);
        expect(Array.isArray(c.dataPoints)).toBe(true);
        expect(Array.isArray(c.relatedEventIds)).toBe(true);
      }
    });

    it('severity scales with magnitude', () => {
      // Big mood decline should have higher severity
      const dates = ['2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20', '2026-02-21', '2026-02-22'];
      dates.slice(0, 3).forEach(d => mood(d, 5));
      dates.slice(3).forEach(d => mood(d, 1));

      const result = generateConfrontations('weekly');
      const found = result.confrontations.find(c => c.title.toLowerCase().includes('declining'));
      expect(found).toBeDefined();
      expect(found!.severity).toBeGreaterThanOrEqual(0.7);
    });
  });
});
