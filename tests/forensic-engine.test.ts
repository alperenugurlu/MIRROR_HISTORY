import { describe, it, expect, beforeEach } from 'vitest';
import { initDatabase } from '../core/database';
import * as db from '../core/database';
import { getForensicContext } from '../core/services/forensic-engine';

beforeEach(() => {
  initDatabase(':memory:');
});

describe('Forensic Engine', () => {
  describe('getForensicContext', () => {
    it('throws when event not found', () => {
      expect(() => getForensicContext('nonexistent')).toThrow('Event not found');
    });

    it('returns context for a single event with no surrounding data', () => {
      const e = db.insertEvent('note', '2026-02-20T12:00:00.000Z', 'Lonely note');
      db.insertNote(e.id, 'Just a thought', 'manual', []);

      const ctx = getForensicContext(e.id, 30);

      expect(ctx.event.id).toBe(e.id);
      expect(ctx.before).toHaveLength(0);
      expect(ctx.after).toHaveLength(0);
      expect(ctx.crossDomain.timestamp).toBe('2026-02-20T12:00:00.000Z');
      expect(ctx.suggestedQuestions.length).toBeGreaterThan(0);
    });

    it('separates events into before and after', () => {
      // Before: 11:30
      const eBefore = db.insertEvent('mood', '2026-02-20T11:30:00.000Z', 'Mood 4');
      db.insertMoodEntry(eBefore.id, 4, 'Good', '2026-02-20T11:30:00.000Z');

      // Center: 12:00
      const eCenter = db.insertEvent('money_transaction', '2026-02-20T12:00:00.000Z', 'Coffee');
      db.insertTransaction(eCenter.id, '2026-02-20', 'Starbucks', -5.50, 'USD', 'h1');

      // After: 12:30
      const eAfter = db.insertEvent('note', '2026-02-20T12:30:00.000Z', 'Afternoon note');
      db.insertNote(eAfter.id, 'Reflecting on coffee', 'manual', []);

      const ctx = getForensicContext(eCenter.id, 60);

      expect(ctx.event.id).toBe(eCenter.id);
      expect(ctx.before).toHaveLength(1);
      expect(ctx.before[0].id).toBe(eBefore.id);
      expect(ctx.after).toHaveLength(1);
      expect(ctx.after[0].id).toBe(eAfter.id);
    });

    it('enriches before/after events with domain data', () => {
      const eBefore = db.insertEvent('mood', '2026-02-20T11:50:00.000Z', 'Mood');
      db.insertMoodEntry(eBefore.id, 3, 'Meh', '2026-02-20T11:50:00.000Z');

      const eCenter = db.insertEvent('note', '2026-02-20T12:00:00.000Z', 'Center');
      db.insertNote(eCenter.id, 'Center note', 'manual', []);

      const ctx = getForensicContext(eCenter.id, 30);

      expect(ctx.before[0].mood).toBeDefined();
      expect(ctx.before[0].mood!.score).toBe(3);
    });

    it('excludes events outside the window', () => {
      // Far away: 3 hours before
      db.insertEvent('mood', '2026-02-20T09:00:00.000Z', 'Far away');

      const eCenter = db.insertEvent('note', '2026-02-20T12:00:00.000Z', 'Center');
      db.insertNote(eCenter.id, 'Content', 'manual', []);

      const ctx = getForensicContext(eCenter.id, 30);

      expect(ctx.before).toHaveLength(0);
    });

    it('returns cross-domain snapshot at the event moment', () => {
      const eCenter = db.insertEvent('money_transaction', '2026-02-20T12:00:00.000Z', 'Coffee');
      db.insertTransaction(eCenter.id, '2026-02-20', 'Starbucks', -5.50, 'USD', 'h1');

      const eLoc = db.insertEvent('location', '2026-02-20T12:05:00.000Z', 'Office');
      db.insertLocation(eLoc.id, 41.0, 28.9, 'Istanbul Office', '2026-02-20T12:05:00.000Z');

      const eMood = db.insertEvent('mood', '2026-02-20T11:55:00.000Z', 'Mood');
      db.insertMoodEntry(eMood.id, 4, 'Good', '2026-02-20T11:55:00.000Z');

      const ctx = getForensicContext(eCenter.id, 30);

      expect(ctx.crossDomain.transactions).toHaveLength(1);
      expect(ctx.crossDomain.location).toBeDefined();
      expect(ctx.crossDomain.mood).toBeDefined();
    });

    it('orders before events with most recent first', () => {
      const e1 = db.insertEvent('note', '2026-02-20T11:00:00.000Z', 'Early');
      db.insertNote(e1.id, 'Early note', 'manual', []);

      const e2 = db.insertEvent('mood', '2026-02-20T11:30:00.000Z', 'Middle');
      db.insertMoodEntry(e2.id, 3, '', '2026-02-20T11:30:00.000Z');

      const e3 = db.insertEvent('location', '2026-02-20T11:50:00.000Z', 'Recent');
      db.insertLocation(e3.id, 41.0, 28.9, 'Office', '2026-02-20T11:50:00.000Z');

      const eCenter = db.insertEvent('note', '2026-02-20T12:00:00.000Z', 'Center');
      db.insertNote(eCenter.id, 'Center', 'manual', []);

      const ctx = getForensicContext(eCenter.id, 120);

      // Most recent before event should be first
      expect(ctx.before[0].id).toBe(e3.id);
      expect(ctx.before[1].id).toBe(e2.id);
      expect(ctx.before[2].id).toBe(e1.id);
    });
  });

  describe('similar moments', () => {
    it('finds similar transactions by merchant', () => {
      // Past transaction at same merchant
      const ePast = db.insertEvent('money_transaction', '2026-02-18T12:00:00.000Z', 'Starbucks');
      db.insertTransaction(ePast.id, '2026-02-18', 'Starbucks', -5.00, 'USD', 'h-past');

      // Current transaction
      const eCurrent = db.insertEvent('money_transaction', '2026-02-20T12:00:00.000Z', 'Starbucks');
      db.insertTransaction(eCurrent.id, '2026-02-20', 'Starbucks', -5.50, 'USD', 'h-current');

      const ctx = getForensicContext(eCurrent.id, 30);

      expect(ctx.similarMoments.length).toBeGreaterThan(0);
      expect(ctx.similarMoments[0].date).toBe('2026-02-18');
      expect(ctx.similarMoments[0].similarity).toBeGreaterThan(0.5);
    });

    it('excludes same-day events from similar moments', () => {
      const e1 = db.insertEvent('note', '2026-02-20T10:00:00.000Z', 'Note 1');
      db.insertNote(e1.id, 'First note', 'manual', []);

      const e2 = db.insertEvent('note', '2026-02-20T14:00:00.000Z', 'Note 2');
      db.insertNote(e2.id, 'Second note', 'manual', []);

      const ctx = getForensicContext(e1.id, 30);

      const sameDayMatch = ctx.similarMoments.find(sm => sm.date === '2026-02-20');
      expect(sameDayMatch).toBeUndefined();
    });
  });

  describe('suggested questions', () => {
    it('generates transaction-specific questions', () => {
      const e = db.insertEvent('money_transaction', '2026-02-20T12:00:00.000Z', 'Coffee');
      db.insertTransaction(e.id, '2026-02-20', 'Starbucks', -5.50, 'USD', 'h1');

      const ctx = getForensicContext(e.id, 30);

      const hasStarbucksQuestion = ctx.suggestedQuestions.some(q => q.includes('Starbucks'));
      expect(hasStarbucksQuestion).toBe(true);
    });

    it('generates mood-specific questions for low mood', () => {
      const e = db.insertEvent('mood', '2026-02-20T12:00:00.000Z', 'Mood 2');
      db.insertMoodEntry(e.id, 2, 'Not great', '2026-02-20T12:00:00.000Z');

      const ctx = getForensicContext(e.id, 30);

      const hasDropQuestion = ctx.suggestedQuestions.some(q => q.includes('dropped') || q.includes('2/5'));
      expect(hasDropQuestion).toBe(true);
    });

    it('generates location-specific questions', () => {
      const e = db.insertEvent('location', '2026-02-20T12:00:00.000Z', 'Office');
      db.insertLocation(e.id, 41.0, 28.9, 'Istanbul Office', '2026-02-20T12:00:00.000Z');

      const ctx = getForensicContext(e.id, 30);

      const hasLocationQuestion = ctx.suggestedQuestions.some(q => q.includes('Istanbul Office') || q.includes('location'));
      expect(hasLocationQuestion).toBe(true);
    });

    it('always includes a general context question', () => {
      const e = db.insertEvent('note', '2026-02-20T12:00:00.000Z', 'Test');
      db.insertNote(e.id, 'Content', 'manual', []);

      const ctx = getForensicContext(e.id, 30);

      const hasGeneralQuestion = ctx.suggestedQuestions.some(q => q.includes('2026-02-20'));
      expect(hasGeneralQuestion).toBe(true);
    });

    it('limits questions to 6', () => {
      // Create event with lots of cross-domain data to generate many questions
      const e = db.insertEvent('money_transaction', '2026-02-20T12:00:00.000Z', 'Big purchase');
      db.insertTransaction(e.id, '2026-02-20', 'Amazon', -150.00, 'USD', 'h1');

      const eMood = db.insertEvent('mood', '2026-02-20T12:05:00.000Z', 'Mood');
      db.insertMoodEntry(eMood.id, 2, 'Stressed', '2026-02-20T12:05:00.000Z');

      const eLoc = db.insertEvent('location', '2026-02-20T12:10:00.000Z', 'Home');
      db.insertLocation(eLoc.id, 41.0, 28.9, 'Home', '2026-02-20T12:10:00.000Z');

      const ctx = getForensicContext(e.id, 30);

      expect(ctx.suggestedQuestions.length).toBeLessThanOrEqual(6);
    });
  });
});
