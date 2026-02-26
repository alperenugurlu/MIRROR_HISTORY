import { describe, it, expect, beforeEach } from 'vitest';
import { initDatabase, getDb } from '../core/database';
import { createNote, createVoiceMemo, createThought, createDecision, createObservation } from '../core/services/note-engine';
import * as db from '../core/database';

beforeEach(() => {
  initDatabase(':memory:');
});

describe('Note Engine', () => {
  it('creates a note with event and FTS index', () => {
    const result = createNote('Buy milk and eggs', 'manual', ['shopping']);

    expect(result.event_id).toBeDefined();
    expect(result.note.content).toBe('Buy milk and eggs');
    expect(result.note.source).toBe('manual');
    expect(JSON.parse(result.note.tags)).toEqual(['shopping']);

    // Event should exist
    const event = db.getEvent(result.event_id);
    expect(event).toBeDefined();
    expect(event!.type).toBe('note');

    // FTS should find it
    const ftsResults = db.searchFTS('milk');
    expect(ftsResults.length).toBe(1);
    expect(ftsResults[0].event_id).toBe(result.event_id);
  });

  it('truncates long notes in event summary', () => {
    const longContent = 'A'.repeat(200);
    const result = createNote(longContent);

    const event = db.getEvent(result.event_id);
    expect(event!.summary.length).toBeLessThanOrEqual(104); // 100 + "..."
  });

  it('creates a voice memo with transcript indexed', () => {
    const result = createVoiceMemo(
      'Remember to call the dentist tomorrow',
      45,
      '/tmp/voice-001.ogg',
      'telegram',
    );

    expect(result.event_id).toBeDefined();
    expect(result.voice_memo.transcript).toBe('Remember to call the dentist tomorrow');
    expect(result.voice_memo.duration_seconds).toBe(45);
    expect(result.voice_memo.file_path).toBe('/tmp/voice-001.ogg');
    expect(result.voice_memo.source).toBe('telegram');

    const event = db.getEvent(result.event_id);
    expect(event!.type).toBe('voice_memo');

    // FTS should find it
    const ftsResults = db.searchFTS('dentist');
    expect(ftsResults.length).toBe(1);
  });

  it('creates voice memo without transcript', () => {
    const result = createVoiceMemo('', 30, '/tmp/voice-002.ogg');

    const event = db.getEvent(result.event_id);
    expect(event!.summary).toContain('30s');

    // No FTS entry for empty transcript
    const ftsResults = db.searchFTS('voice');
    expect(ftsResults.length).toBe(0);
  });

  it('createThought tags with "thought"', () => {
    const result = createThought('I should learn Rust');
    expect(JSON.parse(result.note.tags)).toEqual(['thought']);
    expect(result.note.content).toBe('I should learn Rust');
  });

  it('createDecision tags with "decision"', () => {
    const result = createDecision('Switching to Fastify from Express');
    expect(JSON.parse(result.note.tags)).toEqual(['decision']);
  });

  it('createObservation tags with "observation"', () => {
    const result = createObservation('Coffee prices went up at the corner shop');
    expect(JSON.parse(result.note.tags)).toEqual(['observation']);
  });

  it('logs activity for created notes', () => {
    createNote('Test activity log');
    const log = db.getActivityLog();
    const noteEntry = log.find(e => e.entry_type === 'note_created');
    expect(noteEntry).toBeDefined();
    expect(noteEntry!.description).toContain('Test activity log');
  });

  it('logs activity for created voice memos', () => {
    createVoiceMemo('Test memo transcript', 10, '/tmp/test.ogg');
    const log = db.getActivityLog();
    const memoEntry = log.find(e => e.entry_type === 'voice_memo_created');
    expect(memoEntry).toBeDefined();
  });

  it('can retrieve notes from database', () => {
    createNote('First note');
    createNote('Second note');
    createNote('Third note');

    const notes = db.getNotes(10);
    expect(notes.length).toBe(3);
  });

  it('can retrieve voice memos from database', () => {
    createVoiceMemo('Memo one', 10, '/tmp/m1.ogg');
    createVoiceMemo('Memo two', 20, '/tmp/m2.ogg');

    const memos = db.getVoiceMemos(10);
    expect(memos.length).toBe(2);
  });
});
