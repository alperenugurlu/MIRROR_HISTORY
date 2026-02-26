import * as db from '../database';
import { broadcast } from '../event-bus';
import type { MoodEntry } from '../types';

const MOOD_LABELS = ['', 'Terrible', 'Bad', 'Okay', 'Good', 'Great'];

export function recordMood(score: number, note: string = ''): { event_id: string; mood: MoodEntry } {
  const clampedScore = Math.max(1, Math.min(5, Math.round(score)));
  const timestamp = new Date().toISOString();
  const summary = `Mood: ${MOOD_LABELS[clampedScore]} (${clampedScore}/5)${note ? ' — ' + note.slice(0, 80) : ''}`;

  const event = db.insertEvent(
    'mood', timestamp, summary,
    { score: clampedScore, note },
    1.0, 'local_private',
  );

  const mood = db.insertMoodEntry(event.id, clampedScore, note, timestamp);

  if (note) {
    db.indexForSearch(event.id, `mood ${MOOD_LABELS[clampedScore]} ${note}`);
  }

  db.logActivity('mood_recorded', summary, { event_id: event.id, score: clampedScore });
  broadcast('mood_recorded', { event_id: event.id, score: clampedScore });

  return { event_id: event.id, mood };
}
