import { describe, it, expect, beforeEach } from 'vitest';
import { initDatabase } from '../core/database';
import * as db from '../core/database';
import { isAIConfigured } from '../core/services/ai-engine';

beforeEach(() => {
  initDatabase(':memory:');
});

describe('AI Engine', () => {
  it('reports AI as not configured when no key is set', () => {
    expect(isAIConfigured()).toBe(false);
  });

  it('stores and retrieves chat messages', () => {
    const msg1 = db.insertChatMessage('user', 'Hello', 'some context');
    const msg2 = db.insertChatMessage('assistant', 'Hi there!', '');

    expect(msg1.role).toBe('user');
    expect(msg1.content).toBe('Hello');
    expect(msg2.role).toBe('assistant');

    const history = db.getChatMessages(10);
    expect(history.length).toBe(2);
    expect(history[0].role).toBe('user');
    expect(history[1].role).toBe('assistant');
  });

  it('clears chat history', () => {
    db.insertChatMessage('user', 'Test', '');
    db.insertChatMessage('assistant', 'Response', '');

    db.clearChatMessages();
    const history = db.getChatMessages(10);
    expect(history.length).toBe(0);
  });

  it('stores and retrieves AI digests', () => {
    const event = db.insertEvent(
      'ai_digest', new Date().toISOString(),
      'Weekly digest', {}, 1.0, 'local_private',
    );

    const digest = db.insertAIDigest(event.id, 'weekly', '2026-02-15', '2026-02-22', 'Test digest content');

    expect(digest.period).toBe('weekly');
    expect(digest.content).toBe('Test digest content');
    expect(digest.event_id).toBe(event.id);

    const digests = db.getAIDigests(10);
    expect(digests.length).toBe(1);
    expect(digests[0].period_start).toBe('2026-02-15');
  });

  it('tracks import stats', () => {
    const stats = db.getImportStats();

    expect(stats.transactions.count).toBe(0);
    expect(stats.locations.count).toBe(0);
    expect(stats.calendar.count).toBe(0);
    expect(stats.health.count).toBe(0);
  });

  it('counts events by type', () => {
    db.insertEvent('note', new Date().toISOString(), 'Note 1', {}, 1.0, 'local_private');
    db.insertEvent('note', new Date().toISOString(), 'Note 2', {}, 1.0, 'local_private');
    db.insertEvent('mood', new Date().toISOString(), 'Mood', {}, 1.0, 'local_private');

    const counts = db.getEventCountsByType();
    expect(counts['note']).toBe(2);
    expect(counts['mood']).toBe(1);
  });
});
