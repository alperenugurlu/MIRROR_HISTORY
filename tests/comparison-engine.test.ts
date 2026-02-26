import { describe, it, expect, beforeEach } from 'vitest';
import { initDatabase } from '../core/database';
import * as db from '../core/database';
import { comparePeriods } from '../core/services/comparison-engine';

beforeEach(() => {
  initDatabase(':memory:');
});

// Helpers
function mood(date: string, score: number) {
  const ts = `${date}T12:00:00.000Z`;
  const e = db.insertEvent('mood', ts, `Mood ${score}`);
  db.insertMoodEntry(e.id, score, '', ts);
}

function tx(date: string, merchant: string, amount: number) {
  const ts = `${date}T14:00:00.000Z`;
  const e = db.insertEvent('money_transaction', ts, merchant);
  db.insertTransaction(e.id, date, merchant, -Math.abs(amount), 'USD', `h-${date}-${merchant}`);
}

function cal(date: string, title: string, startHour: number, endHour: number) {
  const start = `${date}T${startHour.toString().padStart(2, '0')}:00:00.000Z`;
  const end = `${date}T${endHour.toString().padStart(2, '0')}:00:00.000Z`;
  const e = db.insertEvent('calendar_event', start, title);
  db.insertCalendarEvent(e.id, title, start, end);
}

function health(date: string, type: string, value: number, unit: string) {
  const ts = `${date}T10:00:00.000Z`;
  const e = db.insertEvent('health_entry', ts, `${type}: ${value}`);
  db.insertHealthEntry(e.id, type, value, unit, ts);
}

function loc(date: string, address: string) {
  const ts = `${date}T12:00:00.000Z`;
  const e = db.insertEvent('location', ts, address);
  db.insertLocation(e.id, 41.0, 29.0, address, ts);
}

function note(date: string, content: string) {
  const ts = `${date}T15:00:00.000Z`;
  const e = db.insertEvent('note', ts, content.slice(0, 50));
  db.insertNote(e.id, content, 'manual', []);
}

describe('Comparison Engine', () => {
  describe('comparePeriods', () => {
    it('returns empty metrics for empty periods', async () => {
      const result = await comparePeriods('2026-02-01', '2026-02-07', '2026-02-08', '2026-02-14');
      expect(result.period1.start).toBe('2026-02-01');
      expect(result.period1.end).toBe('2026-02-07');
      expect(result.period2.start).toBe('2026-02-08');
      expect(result.period2.end).toBe('2026-02-14');
      expect(result.period1.metrics.mood.count).toBe(0);
      expect(result.period2.metrics.mood.count).toBe(0);
    });

    it('returns correct structure', async () => {
      const result = await comparePeriods('2026-02-01', '2026-02-07', '2026-02-08', '2026-02-14');
      expect(result).toHaveProperty('period1');
      expect(result).toHaveProperty('period2');
      expect(result).toHaveProperty('changes');
      expect(Array.isArray(result.changes)).toBe(true);
    });
  });

  describe('mood metrics', () => {
    it('calculates mood averages per period', async () => {
      mood('2026-02-03', 4);
      mood('2026-02-04', 5);
      mood('2026-02-10', 2);
      mood('2026-02-11', 3);

      const result = await comparePeriods('2026-02-01', '2026-02-07', '2026-02-08', '2026-02-14');

      expect(result.period1.metrics.mood.avg).toBe(4.5);
      expect(result.period1.metrics.mood.min).toBe(4);
      expect(result.period1.metrics.mood.max).toBe(5);
      expect(result.period1.metrics.mood.count).toBe(2);

      expect(result.period2.metrics.mood.avg).toBe(2.5);
      expect(result.period2.metrics.mood.count).toBe(2);
    });

    it('generates mood change entry', async () => {
      mood('2026-02-03', 4);
      mood('2026-02-10', 2);

      const result = await comparePeriods('2026-02-01', '2026-02-07', '2026-02-08', '2026-02-14');
      const moodChange = result.changes.find(c => c.domain === 'mood' && c.metric === 'Average Mood');
      expect(moodChange).toBeDefined();
      expect(moodChange!.direction).toBe('down');
      expect(moodChange!.changePct).toBeLessThan(0);
    });
  });

  describe('spending metrics', () => {
    it('calculates total and daily average spending', async () => {
      tx('2026-02-03', 'Cafe', 20);
      tx('2026-02-05', 'Grocery', 80);

      tx('2026-02-10', 'Amazon', 200);

      const result = await comparePeriods('2026-02-01', '2026-02-07', '2026-02-08', '2026-02-14');

      expect(result.period1.metrics.spending.total).toBe(100);
      expect(result.period2.metrics.spending.total).toBe(200);
    });

    it('identifies top merchants', async () => {
      tx('2026-02-03', 'Cafe', 20);
      tx('2026-02-04', 'Cafe', 30);
      tx('2026-02-05', 'Grocery', 80);

      const result = await comparePeriods('2026-02-01', '2026-02-07', '2026-02-08', '2026-02-14');

      expect(result.period1.metrics.spending.topMerchants.length).toBe(2);
      // Grocery $80 should be first
      expect(result.period1.metrics.spending.topMerchants[0].name).toBe('Grocery');
    });

    it('generates spending increase change', async () => {
      tx('2026-02-03', 'Cafe', 50);
      tx('2026-02-10', 'Cafe', 100);

      const result = await comparePeriods('2026-02-01', '2026-02-07', '2026-02-08', '2026-02-14');
      const spendChange = result.changes.find(c => c.domain === 'spending' && c.metric === 'Total Spending');
      expect(spendChange).toBeDefined();
      expect(spendChange!.direction).toBe('up');
      expect(spendChange!.changePct).toBe(100);
    });
  });

  describe('health metrics', () => {
    it('calculates average steps', async () => {
      health('2026-02-03', 'steps', 8000, 'count');
      health('2026-02-04', 'steps', 10000, 'count');

      health('2026-02-10', 'steps', 5000, 'count');

      const result = await comparePeriods('2026-02-01', '2026-02-07', '2026-02-08', '2026-02-14');

      expect(result.period1.metrics.health.avgSteps).toBe(9000);
      expect(result.period2.metrics.health.avgSteps).toBe(5000);
    });

    it('counts workouts', async () => {
      health('2026-02-03', 'workout', 1, 'session');
      health('2026-02-04', 'workout', 1, 'session');
      health('2026-02-05', 'workout', 1, 'session');

      health('2026-02-10', 'workout', 1, 'session');

      const result = await comparePeriods('2026-02-01', '2026-02-07', '2026-02-08', '2026-02-14');

      expect(result.period1.metrics.health.workoutCount).toBe(3);
      expect(result.period2.metrics.health.workoutCount).toBe(1);
    });
  });

  describe('calendar metrics', () => {
    it('counts events and computes daily average', async () => {
      cal('2026-02-03', 'Standup', 9, 10);
      cal('2026-02-03', 'Review', 14, 15);
      cal('2026-02-04', '1:1', 10, 11);

      const result = await comparePeriods('2026-02-01', '2026-02-07', '2026-02-08', '2026-02-14');

      expect(result.period1.metrics.calendar.eventCount).toBe(3);
      // 7 days in period, 3 events => 3/7 ≈ 0.43
      expect(result.period1.metrics.calendar.avgPerDay).toBeCloseTo(3 / 7, 1);
    });
  });

  describe('notes metrics', () => {
    it('counts notes', async () => {
      note('2026-02-03', 'First thought');
      note('2026-02-05', 'Second thought');

      note('2026-02-10', 'Later thought');

      const result = await comparePeriods('2026-02-01', '2026-02-07', '2026-02-08', '2026-02-14');

      expect(result.period1.metrics.notes.count).toBe(2);
      expect(result.period2.metrics.notes.count).toBe(1);
    });
  });

  describe('location metrics', () => {
    it('counts unique places', async () => {
      loc('2026-02-03', 'Office');
      loc('2026-02-04', 'Office');
      loc('2026-02-05', 'Cafe');

      loc('2026-02-10', 'Home');

      const result = await comparePeriods('2026-02-01', '2026-02-07', '2026-02-08', '2026-02-14');

      expect(result.period1.metrics.locations.uniquePlaces).toBe(2); // Office, Cafe
      expect(result.period2.metrics.locations.uniquePlaces).toBe(1); // Home
    });
  });

  describe('changes computation', () => {
    it('marks stable changes when delta is under 5%', async () => {
      mood('2026-02-03', 3);
      mood('2026-02-10', 3);

      const result = await comparePeriods('2026-02-01', '2026-02-07', '2026-02-08', '2026-02-14');
      const moodChange = result.changes.find(c => c.domain === 'mood' && c.metric === 'Average Mood');
      expect(moodChange).toBeDefined();
      expect(moodChange!.direction).toBe('stable');
    });

    it('omits metrics that are zero in both periods', async () => {
      // No data at all
      const result = await comparePeriods('2026-02-01', '2026-02-07', '2026-02-08', '2026-02-14');
      // All zero changes should be omitted
      expect(result.changes.length).toBe(0);
    });

    it('includes all domains when data exists', async () => {
      mood('2026-02-03', 4);
      mood('2026-02-10', 2);
      tx('2026-02-03', 'Cafe', 20);
      tx('2026-02-10', 'Cafe', 40);
      health('2026-02-03', 'steps', 8000, 'count');
      health('2026-02-10', 'steps', 5000, 'count');
      cal('2026-02-03', 'Meeting', 9, 10);
      cal('2026-02-10', 'Meeting', 9, 10);
      note('2026-02-03', 'A thought');
      note('2026-02-10', 'Another thought');
      loc('2026-02-03', 'Office');
      loc('2026-02-10', 'Home');

      const result = await comparePeriods('2026-02-01', '2026-02-07', '2026-02-08', '2026-02-14');

      const domains = new Set(result.changes.map(c => c.domain));
      expect(domains.has('mood')).toBe(true);
      expect(domains.has('spending')).toBe(true);
      expect(domains.has('health')).toBe(true);
      expect(domains.has('calendar')).toBe(true);
      expect(domains.has('notes')).toBe(true);
      expect(domains.has('locations')).toBe(true);
    });
  });
});
