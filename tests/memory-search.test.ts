import { describe, it, expect, beforeEach } from 'vitest';
import { initDatabase } from '../core/database';
import { createNote, createVoiceMemo } from '../core/services/note-engine';
import { searchMemories, getTimeline, remember, getRecentMemories, getMemoryStats } from '../core/services/memory-engine';

beforeEach(() => {
  initDatabase(':memory:');
});

describe('Memory Search (FTS)', () => {
  it('finds notes by keyword', () => {
    createNote('Meeting with the product team about roadmap');
    createNote('Grocery list: apples, bananas, bread');
    createNote('Product launch scheduled for March');

    const results = searchMemories('product');
    expect(results.length).toBe(2);
    results.forEach(r => {
      expect(r.event).toBeDefined();
      expect(r.snippet).toBeDefined();
      expect(r.note).toBeDefined();
    });
  });

  it('finds voice memos by transcript keyword', () => {
    createVoiceMemo('Call the insurance company about the car accident', 30, '/tmp/v1.ogg');
    createNote('Unrelated note about cooking');

    const results = searchMemories('insurance');
    expect(results.length).toBe(1);
    expect(results[0].voice_memo).toBeDefined();
    expect(results[0].voice_memo!.transcript).toContain('insurance');
  });

  it('returns empty for non-matching query', () => {
    createNote('Nothing relevant here');
    const results = searchMemories('quantum physics');
    expect(results.length).toBe(0);
  });

  it('respects limit parameter', () => {
    for (let i = 0; i < 10; i++) {
      createNote(`Note about topic alpha number ${i}`);
    }

    const results = searchMemories('alpha', 3);
    expect(results.length).toBe(3);
  });

  it('remember() is an alias for searchMemories()', () => {
    createNote('Remember to buy concert tickets');
    const results = remember('concert');
    expect(results.length).toBe(1);
    expect(results[0].note).toBeDefined();
  });
});

describe('Timeline', () => {
  it('groups events by date', () => {
    // Create notes that produce events with specific timestamps
    const n1 = createNote('Morning meeting');
    const n2 = createNote('Afternoon workout');
    const n3 = createNote('Evening dinner');

    // All created within milliseconds, so same date
    const timeline = getTimeline('2020-01-01', '2030-12-31');
    expect(timeline.length).toBeGreaterThanOrEqual(1);

    // All events should be on today's date
    const today = new Date().toISOString().slice(0, 10);
    const todayEntry = timeline.find(t => t.date === today);
    expect(todayEntry).toBeDefined();
    expect(todayEntry!.events.length).toBe(3);
  });

  it('enriches timeline events with typed data', () => {
    createNote('A note for timeline');
    createVoiceMemo('A voice memo for timeline', 15, '/tmp/tl.ogg');

    const timeline = getTimeline('2020-01-01', '2030-12-31');
    const todayEntry = timeline[0];

    const noteEvent = todayEntry.events.find(e => e.type === 'note');
    expect(noteEvent?.note).toBeDefined();

    const memoEvent = todayEntry.events.find(e => e.type === 'voice_memo');
    expect(memoEvent?.voice_memo).toBeDefined();
  });

  it('returns empty for date range with no events', () => {
    createNote('Outside range');
    const timeline = getTimeline('2020-01-01', '2020-01-31');
    expect(timeline.length).toBe(0);
  });
});

describe('Recent Memories', () => {
  it('returns most recent events', () => {
    createNote('First');
    createNote('Second');
    createNote('Third');

    const recent = getRecentMemories(2);
    expect(recent.length).toBe(2);
  });

  it('returns events in descending order', () => {
    createNote('Older note');
    createNote('Newer note');

    const recent = getRecentMemories(10);
    expect(recent.length).toBe(2);
    // Most recent first
    expect(recent[0].summary).toContain('Newer');
  });
});

describe('Memory Stats', () => {
  it('returns correct counts', () => {
    createNote('Note 1');
    createNote('Note 2');
    createVoiceMemo('Memo', 10, '/tmp/m.ogg');

    const stats = getMemoryStats();
    expect(stats.totalEvents).toBe(3);
    expect(stats.notes).toBe(2);
    expect(stats.voiceMemos).toBe(1);
    expect(stats.transactions).toBe(0);
  });

  it('returns zeros when empty', () => {
    const stats = getMemoryStats();
    expect(stats.totalEvents).toBe(0);
    expect(stats.notes).toBe(0);
    expect(stats.voiceMemos).toBe(0);
    expect(stats.transactions).toBe(0);
  });
});
