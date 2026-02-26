import * as db from '../database';
import { broadcast } from '../event-bus';
import type { Note, VoiceMemo, NoteSource, MemoSource } from '../types';

export function createNote(
  content: string,
  source: NoteSource = 'manual',
  tags: string[] = [],
): { event_id: string; note: Note } {
  // Create event
  const summary = content.length > 100 ? content.slice(0, 100) + '...' : content;
  const event = db.insertEvent(
    'note',
    new Date().toISOString(),
    summary,
    { source, tags },
    1.0,
    'local_private',
  );

  // Create note record
  const note = db.insertNote(event.id, content, source, tags);

  // Index for full-text search
  const searchContent = [content, ...tags].join(' ');
  db.indexForSearch(event.id, searchContent);

  // Log activity
  db.logActivity('note_created', `Note: ${summary}`, {
    event_id: event.id,
    source,
    tags,
  });

  broadcast('note_created', { event_id: event.id, source, preview: summary });

  return { event_id: event.id, note };
}

export function createVoiceMemo(
  transcript: string,
  durationSeconds: number,
  filePath: string,
  source: MemoSource = 'telegram',
): { event_id: string; voice_memo: VoiceMemo } {
  const summary = transcript
    ? (transcript.length > 100 ? transcript.slice(0, 100) + '...' : transcript)
    : `Voice memo (${Math.round(durationSeconds)}s)`;

  const event = db.insertEvent(
    'voice_memo',
    new Date().toISOString(),
    summary,
    { source, duration_seconds: durationSeconds, has_transcript: !!transcript },
    1.0,
    'local_private',
  );

  const voiceMemo = db.insertVoiceMemo(event.id, transcript, durationSeconds, filePath, source);

  // Index transcript for search
  if (transcript) {
    db.indexForSearch(event.id, transcript);
  }

  db.logActivity('voice_memo_created', `Voice memo: ${summary}`, {
    event_id: event.id,
    source,
    duration_seconds: durationSeconds,
    has_transcript: !!transcript,
  });

  broadcast('voice_memo_created', { event_id: event.id, source, duration: durationSeconds });

  return { event_id: event.id, voice_memo: voiceMemo };
}

export function createThought(content: string): { event_id: string; note: Note } {
  return createNote(content, 'manual', ['thought']);
}

export function createDecision(content: string): { event_id: string; note: Note } {
  return createNote(content, 'manual', ['decision']);
}

export function createObservation(content: string): { event_id: string; note: Note } {
  return createNote(content, 'manual', ['observation']);
}
