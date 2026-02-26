import { describe, it, expect, beforeEach } from 'vitest';
import { initDatabase } from '../core/database';
import * as db from '../core/database';
import { scanForInconsistencies } from '../core/services/inconsistency-engine';

beforeEach(() => {
  initDatabase(':memory:');
});

describe('Inconsistency Engine', () => {
  describe('scanForInconsistencies', () => {
    it('returns empty for a day with no data', () => {
      const result = scanForInconsistencies('2026-02-20', '2026-02-20');
      expect(result.scannedDays).toBe(1);
      expect(result.found).toHaveLength(0);
    });

    it('scans multiple days', () => {
      const result = scanForInconsistencies('2026-02-18', '2026-02-20');
      expect(result.scannedDays).toBe(3);
    });

    it('stores findings in the database', () => {
      // Create overlapping calendar events
      const e1 = db.insertEvent('calendar_event', '2026-02-20T10:00:00.000Z', 'Meeting A');
      db.insertCalendarEvent(e1.id, 'Meeting A', '2026-02-20T10:00:00.000Z', '2026-02-20T11:30:00.000Z');

      const e2 = db.insertEvent('calendar_event', '2026-02-20T11:00:00.000Z', 'Meeting B');
      db.insertCalendarEvent(e2.id, 'Meeting B', '2026-02-20T11:00:00.000Z', '2026-02-20T12:00:00.000Z');

      scanForInconsistencies('2026-02-20', '2026-02-20');

      const stored = db.getInconsistencies();
      expect(stored.length).toBeGreaterThan(0);
    });

    it('re-scan is idempotent (clears previous findings)', () => {
      const e1 = db.insertEvent('calendar_event', '2026-02-20T10:00:00.000Z', 'Meeting A');
      db.insertCalendarEvent(e1.id, 'Meeting A', '2026-02-20T10:00:00.000Z', '2026-02-20T11:30:00.000Z');

      const e2 = db.insertEvent('calendar_event', '2026-02-20T11:00:00.000Z', 'Meeting B');
      db.insertCalendarEvent(e2.id, 'Meeting B', '2026-02-20T11:00:00.000Z', '2026-02-20T12:00:00.000Z');

      scanForInconsistencies('2026-02-20', '2026-02-20');
      scanForInconsistencies('2026-02-20', '2026-02-20');

      const stored = db.getInconsistencies();
      // Should not double up
      const scheduleConflicts = stored.filter(i => i.type === 'schedule_conflict');
      expect(scheduleConflicts).toHaveLength(1);
    });
  });

  describe('location_mismatch', () => {
    it('detects when location differs from calendar event', () => {
      // Calendar says "Office"
      const eCal = db.insertEvent('calendar_event', '2026-02-20T10:00:00.000Z', 'Team Standup');
      db.insertCalendarEvent(eCal.id, 'Team Standup', '2026-02-20T10:00:00.000Z', '2026-02-20T11:00:00.000Z', 'Istanbul Office');

      // Location says "Kadikoy Waterfront"
      const eLoc = db.insertEvent('location', '2026-02-20T10:30:00.000Z', 'Kadikoy');
      db.insertLocation(eLoc.id, 40.99, 29.03, 'Kadikoy Waterfront', '2026-02-20T10:30:00.000Z');

      const result = scanForInconsistencies('2026-02-20', '2026-02-20');

      const mismatch = result.found.find(f => f.type === 'location_mismatch');
      expect(mismatch).toBeDefined();
      expect(mismatch!.title).toContain("weren't where");
      expect(mismatch!.description).toContain('Kadikoy Waterfront');
      expect(mismatch!.description).toContain('Istanbul Office');
    });

    it('does NOT flag when location matches calendar', () => {
      const eCal = db.insertEvent('calendar_event', '2026-02-20T10:00:00.000Z', 'Standup');
      db.insertCalendarEvent(eCal.id, 'Standup', '2026-02-20T10:00:00.000Z', '2026-02-20T11:00:00.000Z', 'Office');

      const eLoc = db.insertEvent('location', '2026-02-20T10:30:00.000Z', 'Office');
      db.insertLocation(eLoc.id, 41.0, 28.9, 'Office', '2026-02-20T10:30:00.000Z');

      const result = scanForInconsistencies('2026-02-20', '2026-02-20');

      const mismatch = result.found.find(f => f.type === 'location_mismatch');
      expect(mismatch).toBeUndefined();
    });

    it('skips calendar events without location', () => {
      const eCal = db.insertEvent('calendar_event', '2026-02-20T10:00:00.000Z', 'Standup');
      db.insertCalendarEvent(eCal.id, 'Standup', '2026-02-20T10:00:00.000Z', '2026-02-20T11:00:00.000Z', '');

      const eLoc = db.insertEvent('location', '2026-02-20T10:30:00.000Z', 'Somewhere');
      db.insertLocation(eLoc.id, 41.0, 28.9, 'Somewhere', '2026-02-20T10:30:00.000Z');

      const result = scanForInconsistencies('2026-02-20', '2026-02-20');

      const mismatch = result.found.find(f => f.type === 'location_mismatch');
      expect(mismatch).toBeUndefined();
    });
  });

  describe('schedule_conflict', () => {
    it('detects overlapping calendar events', () => {
      const e1 = db.insertEvent('calendar_event', '2026-02-20T10:00:00.000Z', 'Meeting A');
      db.insertCalendarEvent(e1.id, 'Meeting A', '2026-02-20T10:00:00.000Z', '2026-02-20T11:30:00.000Z');

      const e2 = db.insertEvent('calendar_event', '2026-02-20T11:00:00.000Z', 'Meeting B');
      db.insertCalendarEvent(e2.id, 'Meeting B', '2026-02-20T11:00:00.000Z', '2026-02-20T12:00:00.000Z');

      const result = scanForInconsistencies('2026-02-20', '2026-02-20');

      const conflict = result.found.find(f => f.type === 'schedule_conflict');
      expect(conflict).toBeDefined();
      expect(conflict!.title).toContain('overlap');
      expect(conflict!.description).toContain('Meeting A');
      expect(conflict!.description).toContain('Meeting B');
    });

    it('does NOT flag non-overlapping events', () => {
      const e1 = db.insertEvent('calendar_event', '2026-02-20T10:00:00.000Z', 'Meeting A');
      db.insertCalendarEvent(e1.id, 'Meeting A', '2026-02-20T10:00:00.000Z', '2026-02-20T11:00:00.000Z');

      const e2 = db.insertEvent('calendar_event', '2026-02-20T11:30:00.000Z', 'Meeting B');
      db.insertCalendarEvent(e2.id, 'Meeting B', '2026-02-20T11:30:00.000Z', '2026-02-20T12:30:00.000Z');

      const result = scanForInconsistencies('2026-02-20', '2026-02-20');

      const conflict = result.found.find(f => f.type === 'schedule_conflict');
      expect(conflict).toBeUndefined();
    });

    it('ignores trivial overlaps under 5 minutes', () => {
      const e1 = db.insertEvent('calendar_event', '2026-02-20T10:00:00.000Z', 'Meeting A');
      db.insertCalendarEvent(e1.id, 'Meeting A', '2026-02-20T10:00:00.000Z', '2026-02-20T11:03:00.000Z');

      const e2 = db.insertEvent('calendar_event', '2026-02-20T11:00:00.000Z', 'Meeting B');
      db.insertCalendarEvent(e2.id, 'Meeting B', '2026-02-20T11:00:00.000Z', '2026-02-20T12:00:00.000Z');

      const result = scanForInconsistencies('2026-02-20', '2026-02-20');

      const conflict = result.found.find(f => f.type === 'schedule_conflict');
      expect(conflict).toBeUndefined();
    });
  });

  describe('mood_behavior_disconnect', () => {
    it('detects high mood + high spending', () => {
      // Mood: 5/5
      const eMood = db.insertEvent('mood', '2026-02-20T12:00:00.000Z', 'Mood 5');
      db.insertMoodEntry(eMood.id, 5, 'Great!', '2026-02-20T12:00:00.000Z');

      // Spend $150
      const eTx = db.insertEvent('money_transaction', '2026-02-20T14:00:00.000Z', 'Shopping');
      db.insertTransaction(eTx.id, '2026-02-20', 'Amazon', -150.00, 'USD', 'h1');

      const result = scanForInconsistencies('2026-02-20', '2026-02-20');

      const disconnect = result.found.find(f => f.type === 'mood_behavior_disconnect');
      expect(disconnect).toBeDefined();
      expect(disconnect!.description).toContain('$150.00');
    });

    it('detects mood swings within a day', () => {
      const e1 = db.insertEvent('mood', '2026-02-20T08:00:00.000Z', 'Mood 1');
      db.insertMoodEntry(e1.id, 1, 'Terrible morning', '2026-02-20T08:00:00.000Z');

      const e2 = db.insertEvent('mood', '2026-02-20T12:00:00.000Z', 'Mood 3');
      db.insertMoodEntry(e2.id, 3, 'OK now', '2026-02-20T12:00:00.000Z');

      const e3 = db.insertEvent('mood', '2026-02-20T18:00:00.000Z', 'Mood 5');
      db.insertMoodEntry(e3.id, 5, 'Amazing evening', '2026-02-20T18:00:00.000Z');

      const result = scanForInconsistencies('2026-02-20', '2026-02-20');

      const swing = result.found.find(f =>
        f.type === 'mood_behavior_disconnect' && f.title.includes('rollercoaster')
      );
      expect(swing).toBeDefined();
      expect(swing!.severity).toBeGreaterThanOrEqual(0.7);
    });

    it('does NOT flag stable mood days', () => {
      const e1 = db.insertEvent('mood', '2026-02-20T08:00:00.000Z', 'Mood 3');
      db.insertMoodEntry(e1.id, 3, '', '2026-02-20T08:00:00.000Z');

      const e2 = db.insertEvent('mood', '2026-02-20T12:00:00.000Z', 'Mood 4');
      db.insertMoodEntry(e2.id, 4, '', '2026-02-20T12:00:00.000Z');

      const e3 = db.insertEvent('mood', '2026-02-20T18:00:00.000Z', 'Mood 3');
      db.insertMoodEntry(e3.id, 3, '', '2026-02-20T18:00:00.000Z');

      const result = scanForInconsistencies('2026-02-20', '2026-02-20');

      const swing = result.found.find(f =>
        f.type === 'mood_behavior_disconnect' && f.title.includes('rollercoaster')
      );
      expect(swing).toBeUndefined();
    });
  });

  describe('spending_mood_correlation', () => {
    it('detects elevated spending on low-mood days', () => {
      // Build baseline: 2 normal days with ~$30 each
      for (let d = 6; d <= 7; d++) {
        const day = `2026-02-0${d}`;
        const eMood = db.insertEvent('mood', `${day}T12:00:00.000Z`, 'Mood 3');
        db.insertMoodEntry(eMood.id, 3, '', `${day}T12:00:00.000Z`);
        const eTx = db.insertEvent('money_transaction', `${day}T14:00:00.000Z`, 'Lunch');
        db.insertTransaction(eTx.id, day, 'Restaurant', -30, 'USD', `hash-${d}`);
      }

      // Low mood day with high spending
      const eMood = db.insertEvent('mood', '2026-02-20T12:00:00.000Z', 'Mood 2');
      db.insertMoodEntry(eMood.id, 2, 'Bad day', '2026-02-20T12:00:00.000Z');

      const eTx = db.insertEvent('money_transaction', '2026-02-20T14:00:00.000Z', 'Shopping');
      db.insertTransaction(eTx.id, '2026-02-20', 'Amazon', -120, 'USD', 'hash-20');

      const result = scanForInconsistencies('2026-02-20', '2026-02-20');

      const correlation = result.found.find(f => f.type === 'spending_mood_correlation');
      expect(correlation).toBeDefined();
      expect(correlation!.title).toContain('Emotional spending');
    });

    it('does NOT flag normal spending on low-mood days', () => {
      // Baseline: $30/day
      for (let d = 6; d <= 7; d++) {
        const day = `2026-02-0${d}`;
        const eMood = db.insertEvent('mood', `${day}T12:00:00.000Z`, 'Mood 3');
        db.insertMoodEntry(eMood.id, 3, '', `${day}T12:00:00.000Z`);
        const eTx = db.insertEvent('money_transaction', `${day}T14:00:00.000Z`, 'Lunch');
        db.insertTransaction(eTx.id, day, 'Restaurant', -30, 'USD', `hash-n${d}`);
      }

      // Low mood but normal spending
      const eMood = db.insertEvent('mood', '2026-02-20T12:00:00.000Z', 'Mood 2');
      db.insertMoodEntry(eMood.id, 2, '', '2026-02-20T12:00:00.000Z');

      const eTx = db.insertEvent('money_transaction', '2026-02-20T14:00:00.000Z', 'Lunch');
      db.insertTransaction(eTx.id, '2026-02-20', 'Restaurant', -25, 'USD', 'hash-20n');

      const result = scanForInconsistencies('2026-02-20', '2026-02-20');

      const correlation = result.found.find(f => f.type === 'spending_mood_correlation');
      expect(correlation).toBeUndefined();
    });
  });

  describe('time_gap', () => {
    it('detects gaps of 2+ hours in an active day', () => {
      // Events at 8, 9, 14, 15 — gap from 10-13
      db.insertEvent('note', '2026-02-20T08:00:00.000Z', 'Morning');
      db.insertEvent('mood', '2026-02-20T09:00:00.000Z', 'Mood');
      db.insertEvent('note', '2026-02-20T14:00:00.000Z', 'Afternoon');
      db.insertEvent('mood', '2026-02-20T15:00:00.000Z', 'Evening mood');

      const result = scanForInconsistencies('2026-02-20', '2026-02-20');

      const gap = result.found.find(f => f.type === 'time_gap');
      expect(gap).toBeDefined();
      expect(gap!.title).toContain('silence');
      expect(gap!.description).toContain('10:00');
    });

    it('does NOT flag gaps in sparse data days', () => {
      // Only 2 events — too little data to judge
      db.insertEvent('note', '2026-02-20T08:00:00.000Z', 'Morning');
      db.insertEvent('note', '2026-02-20T18:00:00.000Z', 'Evening');

      const result = scanForInconsistencies('2026-02-20', '2026-02-20');

      const gap = result.found.find(f => f.type === 'time_gap');
      expect(gap).toBeUndefined();
    });

    it('does NOT flag 1-hour gaps', () => {
      // Events at 8, 9, 11, 12 — only 1h gap at 10
      db.insertEvent('note', '2026-02-20T08:00:00.000Z', 'a');
      db.insertEvent('note', '2026-02-20T09:00:00.000Z', 'b');
      db.insertEvent('note', '2026-02-20T11:00:00.000Z', 'c');
      db.insertEvent('note', '2026-02-20T12:00:00.000Z', 'd');

      const result = scanForInconsistencies('2026-02-20', '2026-02-20');

      const gap = result.found.find(f => f.type === 'time_gap');
      expect(gap).toBeUndefined();
    });
  });

  describe('pattern_break', () => {
    it('detects broken routine when same-weekday events are missing', () => {
      // 2026-02-20 is a Friday. Create health entries on previous 3 Fridays.
      const fridays = ['2026-01-30', '2026-02-06', '2026-02-13'];
      for (const d of fridays) {
        const e = db.insertEvent('health_entry', `${d}T10:00:00.000Z`, 'Workout');
        db.insertHealthEntry(e.id, 'workout', 1, 'session', `${d}T10:00:00.000Z`);
      }

      // Feb 20 (Friday) has NO health_entry events
      const result = scanForInconsistencies('2026-02-20', '2026-02-20');

      const patternBreak = result.found.find(f => f.type === 'pattern_break');
      expect(patternBreak).toBeDefined();
      expect(patternBreak!.title).toContain('routine');
    });

    it('does NOT flag when pattern continues', () => {
      // Previous 3 Fridays + today
      const fridays = ['2026-01-30', '2026-02-06', '2026-02-13', '2026-02-20'];
      for (const d of fridays) {
        const e = db.insertEvent('health_entry', `${d}T10:00:00.000Z`, 'Workout');
        db.insertHealthEntry(e.id, 'workout', 1, 'session', `${d}T10:00:00.000Z`);
      }

      const result = scanForInconsistencies('2026-02-20', '2026-02-20');

      const patternBreak = result.found.find(f =>
        f.type === 'pattern_break' && f.description.includes('health entry')
      );
      expect(patternBreak).toBeUndefined();
    });
  });

  describe('severity and evidence', () => {
    it('includes evidence event IDs for location mismatches', () => {
      const eCal = db.insertEvent('calendar_event', '2026-02-20T10:00:00.000Z', 'Meeting');
      db.insertCalendarEvent(eCal.id, 'Meeting', '2026-02-20T10:00:00.000Z', '2026-02-20T11:00:00.000Z', 'Office');

      const eLoc = db.insertEvent('location', '2026-02-20T10:30:00.000Z', 'Beach');
      db.insertLocation(eLoc.id, 40.0, 29.0, 'Antalya Beach', '2026-02-20T10:30:00.000Z');

      const result = scanForInconsistencies('2026-02-20', '2026-02-20');

      const mismatch = result.found.find(f => f.type === 'location_mismatch');
      expect(mismatch).toBeDefined();
      expect(mismatch!.evidenceEventIds).toContain(eCal.id);
      expect(mismatch!.evidenceEventIds).toContain(eLoc.id);
    });

    it('schedule conflict severity scales with overlap duration', () => {
      // 30min overlap
      const e1 = db.insertEvent('calendar_event', '2026-02-20T10:00:00.000Z', 'A');
      db.insertCalendarEvent(e1.id, 'A', '2026-02-20T10:00:00.000Z', '2026-02-20T11:30:00.000Z');

      const e2 = db.insertEvent('calendar_event', '2026-02-20T11:00:00.000Z', 'B');
      db.insertCalendarEvent(e2.id, 'B', '2026-02-20T11:00:00.000Z', '2026-02-20T12:00:00.000Z');

      const result = scanForInconsistencies('2026-02-20', '2026-02-20');

      const conflict = result.found.find(f => f.type === 'schedule_conflict');
      expect(conflict).toBeDefined();
      expect(conflict!.severity).toBeGreaterThan(0.5);
      expect(conflict!.severity).toBeLessThanOrEqual(0.9);
    });

    it('all findings have suggested questions', () => {
      // Create multiple inconsistency types
      const e1 = db.insertEvent('calendar_event', '2026-02-20T10:00:00.000Z', 'A');
      db.insertCalendarEvent(e1.id, 'A', '2026-02-20T10:00:00.000Z', '2026-02-20T11:30:00.000Z');
      const e2 = db.insertEvent('calendar_event', '2026-02-20T11:00:00.000Z', 'B');
      db.insertCalendarEvent(e2.id, 'B', '2026-02-20T11:00:00.000Z', '2026-02-20T12:00:00.000Z');

      const result = scanForInconsistencies('2026-02-20', '2026-02-20');

      for (const finding of result.found) {
        expect(finding.suggestedQuestion.length).toBeGreaterThan(0);
      }
    });
  });
});
