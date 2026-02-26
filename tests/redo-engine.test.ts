import { describe, it, expect, beforeEach } from 'vitest';
import { initDatabase } from '../core/database';
import * as db from '../core/database';
import { getMomentData, getHourlyReconstruction } from '../core/services/redo-engine';

beforeEach(() => {
  initDatabase(':memory:');
});

describe('Re-do Engine', () => {
  describe('getMomentData', () => {
    it('returns empty snapshot when no data exists', () => {
      const snapshot = getMomentData('2026-02-20T12:00:00.000Z', 30);

      expect(snapshot.timestamp).toBe('2026-02-20T12:00:00.000Z');
      expect(snapshot.transactions).toEqual([]);
      expect(snapshot.calendarEvents).toEqual([]);
      expect(snapshot.healthEntries).toEqual([]);
      expect(snapshot.notes).toEqual([]);
      expect(snapshot.voiceMemos).toEqual([]);
      expect(snapshot.location).toBeUndefined();
      expect(snapshot.mood).toBeUndefined();
    });

    it('returns data within the time window', () => {
      // Insert events at different times
      const e1 = db.insertEvent('mood', '2026-02-20T12:00:00.000Z', 'Mood: 4/5');
      db.insertMoodEntry(e1.id, 4, 'Feeling good', '2026-02-20T12:00:00.000Z');

      const e2 = db.insertEvent('location', '2026-02-20T12:10:00.000Z', 'Location: Office');
      db.insertLocation(e2.id, 41.0082, 28.9784, 'Office, Istanbul', '2026-02-20T12:10:00.000Z');

      const e3 = db.insertEvent('money_transaction', '2026-02-20T12:15:00.000Z', 'Starbucks -$5.50');
      db.insertTransaction(e3.id, '2026-02-20', 'Starbucks', -5.50, 'USD', 'hash1');

      // This event is outside the window (2 hours later)
      const e4 = db.insertEvent('mood', '2026-02-20T14:30:00.000Z', 'Mood: 2/5');
      db.insertMoodEntry(e4.id, 2, 'Tired', '2026-02-20T14:30:00.000Z');

      const snapshot = getMomentData('2026-02-20T12:10:00.000Z', 30);

      expect(snapshot.mood).toBeDefined();
      expect(snapshot.mood!.score).toBe(4);
      expect(snapshot.location).toBeDefined();
      expect(snapshot.location!.address).toBe('Office, Istanbul');
      expect(snapshot.transactions).toHaveLength(1);
      expect(snapshot.transactions[0].merchant).toBe('Starbucks');
    });

    it('excludes data outside the window', () => {
      // Insert event 3 hours before center
      const e1 = db.insertEvent('mood', '2026-02-20T09:00:00.000Z', 'Mood: 5/5');
      db.insertMoodEntry(e1.id, 5, 'Great morning', '2026-02-20T09:00:00.000Z');

      const snapshot = getMomentData('2026-02-20T12:00:00.000Z', 30);

      expect(snapshot.mood).toBeUndefined();
    });

    it('picks the closest location to center', () => {
      const e1 = db.insertEvent('location', '2026-02-20T11:40:00.000Z', 'Far location');
      db.insertLocation(e1.id, 40.0, 29.0, 'Far away', '2026-02-20T11:40:00.000Z');

      const e2 = db.insertEvent('location', '2026-02-20T12:05:00.000Z', 'Close location');
      db.insertLocation(e2.id, 41.0, 28.9, 'Nearby', '2026-02-20T12:05:00.000Z');

      const snapshot = getMomentData('2026-02-20T12:00:00.000Z', 30);

      expect(snapshot.location).toBeDefined();
      expect(snapshot.location!.address).toBe('Nearby');
    });
  });

  describe('getHourlyReconstruction', () => {
    it('returns 24 hourly slices', () => {
      const day = getHourlyReconstruction('2026-02-20');

      expect(day.date).toBe('2026-02-20');
      expect(day.slices).toHaveLength(24);
      expect(day.slices[0].hour).toBe(0);
      expect(day.slices[23].hour).toBe(23);
      expect(day.slices[0].label).toBe('00:00');
      expect(day.slices[23].label).toBe('23:00');
    });

    it('returns empty day when no data', () => {
      const day = getHourlyReconstruction('2026-02-20');

      expect(day.totalEvents).toBe(0);
      expect(day.moodArc).toHaveLength(0);
      expect(day.slices.every(s => s.eventCount === 0)).toBe(true);
    });

    it('populates slices with events at correct hours', () => {
      // Add event at 14:00
      const e1 = db.insertEvent('note', '2026-02-20T14:30:00.000Z', 'Afternoon note');
      db.insertNote(e1.id, 'Working on the project', 'manual', []);

      // Add event at 14:45
      const e2 = db.insertEvent('mood', '2026-02-20T14:45:00.000Z', 'Mood 4');
      db.insertMoodEntry(e2.id, 4, 'Productive', '2026-02-20T14:45:00.000Z');

      const day = getHourlyReconstruction('2026-02-20');

      expect(day.totalEvents).toBe(2);
      expect(day.slices[14].eventCount).toBe(2);
      expect(day.slices[14].snapshot.notes).toHaveLength(1);
      expect(day.slices[14].snapshot.mood).toBeDefined();
      expect(day.slices[14].snapshot.mood!.score).toBe(4);

      // Other hours should be empty
      expect(day.slices[13].eventCount).toBe(0);
      expect(day.slices[15].eventCount).toBe(0);
    });

    it('builds mood arc from mood entries', () => {
      const e1 = db.insertEvent('mood', '2026-02-20T08:00:00.000Z', 'Mood 3');
      db.insertMoodEntry(e1.id, 3, '', '2026-02-20T08:00:00.000Z');

      const e2 = db.insertEvent('mood', '2026-02-20T14:00:00.000Z', 'Mood 5');
      db.insertMoodEntry(e2.id, 5, '', '2026-02-20T14:00:00.000Z');

      const e3 = db.insertEvent('mood', '2026-02-20T20:00:00.000Z', 'Mood 2');
      db.insertMoodEntry(e3.id, 2, '', '2026-02-20T20:00:00.000Z');

      const day = getHourlyReconstruction('2026-02-20');

      expect(day.moodArc).toHaveLength(3);
      expect(day.moodArc[0]).toEqual({ hour: 8, score: 3 });
      expect(day.moodArc[1]).toEqual({ hour: 14, score: 5 });
      expect(day.moodArc[2]).toEqual({ hour: 20, score: 2 });
    });

    it('identifies dominant event type per hour', () => {
      // Add 2 transactions and 1 note at hour 10
      const e1 = db.insertEvent('money_transaction', '2026-02-20T10:00:00.000Z', 'Coffee');
      db.insertTransaction(e1.id, '2026-02-20', 'Starbucks', -5.50, 'USD', 'h1');

      const e2 = db.insertEvent('money_transaction', '2026-02-20T10:30:00.000Z', 'Lunch');
      db.insertTransaction(e2.id, '2026-02-20', 'Subway', -12.00, 'USD', 'h2');

      const e3 = db.insertEvent('note', '2026-02-20T10:45:00.000Z', 'Quick note');
      db.insertNote(e3.id, 'Quick thought', 'manual', []);

      const day = getHourlyReconstruction('2026-02-20');

      expect(day.slices[10].dominantType).toBe('money_transaction');
      expect(day.slices[10].eventCount).toBe(3);
    });
  });

  describe('database window queries', () => {
    it('getCalendarEventsInWindow returns overlapping events', () => {
      const e1 = db.insertEvent('calendar_event', '2026-02-20T14:00:00.000Z', 'Meeting');
      db.insertCalendarEvent(e1.id, 'Long Meeting', '2026-02-20T14:00:00', '2026-02-20T16:00:00');

      // Query a window that overlaps with the meeting
      const results = db.getCalendarEventsInWindow('2026-02-20T15:00:00', '2026-02-20T15:59:59');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Long Meeting');
    });

    it('enrichEvent adds domain-specific data', () => {
      const e1 = db.insertEvent('note', '2026-02-20T10:00:00.000Z', 'Test note');
      db.insertNote(e1.id, 'My note content', 'manual', []);

      const enriched = db.enrichEvent(e1);
      expect(enriched.note).toBeDefined();
      expect(enriched.note!.content).toBe('My note content');
    });
  });
});
