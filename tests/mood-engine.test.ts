import { describe, it, expect, beforeEach } from 'vitest';
import { initDatabase } from '../core/database';
import * as db from '../core/database';
import { recordMood } from '../core/services/mood-engine';

beforeEach(() => {
  initDatabase(':memory:');
});

describe('Mood Engine', () => {
  it('records a mood with event and mood entry', () => {
    const result = recordMood(4, 'Great day');

    expect(result.event_id).toBeDefined();
    expect(result.mood.score).toBe(4);
    expect(result.mood.note).toBe('Great day');
  });

  it('records mood without note', () => {
    const result = recordMood(2);

    expect(result.mood.score).toBe(2);
    expect(result.mood.note).toBe('');
  });

  it('creates an event of type mood', () => {
    const result = recordMood(5, 'Amazing');
    const event = db.getEvent(result.event_id);

    expect(event).toBeDefined();
    expect(event!.type).toBe('mood');
    expect(event!.summary).toContain('5/5');
  });

  it('indexes mood for FTS search', () => {
    recordMood(3, 'feeling tired after workout');

    const results = db.searchFTS('workout', 10);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].snippet).toContain('workout');
  });

  it('retrieves mood entries in order', () => {
    recordMood(3, 'okay');
    recordMood(5, 'great');
    recordMood(1, 'bad');

    const moods = db.getMoodEntries(10);
    expect(moods.length).toBe(3);
    // Most recent first
    expect(moods[0].score).toBe(1);
    expect(moods[2].score).toBe(3);
  });

  it('logs activity on mood recording', () => {
    recordMood(4, 'productive');

    const log = db.getActivityLog();
    expect(log.length).toBeGreaterThan(0);
    expect(log[0].entry_type).toBe('mood_recorded');
  });
});
