/**
 * Forensic Engine — The deep-dive mechanic.
 *
 * Like Liam zooming into Ffion's facial expressions, then comparing timestamps.
 * Every click leads deeper. Every detail reveals more context.
 *
 * Takes any event and returns:
 * - What happened before (enriched events)
 * - What happened after (enriched events)
 * - Cross-domain snapshot of that moment
 * - Historically similar moments
 * - Suggested questions to dig deeper
 */

import * as db from '../database';
import { getMomentData } from './redo-engine';
import type {
  ForensicContext, EnrichedEvent, Event, MomentSnapshot,
} from '../types';

/**
 * Get full forensic context for any event.
 * Returns surrounding events, cross-domain snapshot, similar moments, and follow-up questions.
 */
export function getForensicContext(eventId: string, windowMinutes = 30): ForensicContext {
  const event = db.getEvent(eventId);
  if (!event) {
    throw new Error(`Event not found: ${eventId}`);
  }

  const center = new Date(event.timestamp);
  const windowMs = windowMinutes * 60 * 1000;

  // Get events before and after (excluding the target event itself)
  const beforeStart = new Date(center.getTime() - windowMs).toISOString();
  const afterEnd = new Date(center.getTime() + windowMs).toISOString();

  const allEnriched = db.getEnrichedEventsInWindow(beforeStart, afterEnd);

  const before: EnrichedEvent[] = [];
  const after: EnrichedEvent[] = [];

  for (const e of allEnriched) {
    if (e.id === event.id) continue;
    if (new Date(e.timestamp).getTime() <= center.getTime()) {
      before.push(e);
    } else {
      after.push(e);
    }
  }

  // Reverse before so most recent is first (closest to the event)
  before.reverse();

  // Cross-domain snapshot at the moment of the event
  const crossDomain = getMomentData(event.timestamp, windowMinutes);

  // Find historically similar moments
  const similarMoments = findSimilarMoments(event, 5);

  // Generate suggested questions based on context
  const suggestedQuestions = generateQuestions(event, db.enrichEvent(event), before, after, crossDomain);

  // Visual comparison: if target event is a photo, find similar moment photos to compare
  let visualComparison: ForensicContext['visualComparison'] | undefined;
  const enrichedTarget = db.enrichEvent(event);
  if (enrichedTarget.photo?.file_path) {
    const targetPhotoPath = enrichedTarget.photo.file_path;
    const similarPhotoPaths: { path: string; date: string; similarity: number }[] = [];

    for (const sm of similarMoments.slice(0, 3)) {
      const smStart = sm.date + 'T00:00:00.000Z';
      const smEnd = sm.date + 'T23:59:59.999Z';
      const smPhotos = db.getPhotosInWindow(smStart, smEnd);
      if (smPhotos.length > 0) {
        similarPhotoPaths.push({
          path: smPhotos[0].file_path,
          date: sm.date,
          similarity: sm.similarity,
        });
      }
    }

    if (similarPhotoPaths.length > 0) {
      visualComparison = { targetPhotoPath, similarPhotoPaths };
    }
  }

  return {
    event,
    before,
    after,
    crossDomain,
    similarMoments,
    suggestedQuestions,
    visualComparison,
  };
}

/**
 * Find historically similar moments — same location, same merchant,
 * same mood range, same event type.
 */
function findSimilarMoments(
  event: Event,
  limit: number,
): { date: string; similarity: number; summary: string }[] {
  const results: { date: string; similarity: number; summary: string }[] = [];

  // Strategy 1: Same event type on different days
  const sameType = db.getEventsByType(event.type);
  const eventDate = event.timestamp.slice(0, 10);

  for (const e of sameType) {
    if (e.id === event.id) continue;
    const eDate = e.timestamp.slice(0, 10);
    if (eDate === eventDate) continue; // skip same day

    let similarity = 0.3; // base similarity for same type

    // Boost similarity based on domain-specific matching
    const enriched = db.enrichEvent(e);
    const original = db.enrichEvent(event);

    // Same merchant for transactions
    if (enriched.transaction && original.transaction) {
      if (enriched.transaction.merchant === original.transaction.merchant) {
        similarity += 0.4;
      }
      // Similar amount range (within 20%)
      const ratio = Math.abs(enriched.transaction.amount) / Math.max(Math.abs(original.transaction.amount), 0.01);
      if (ratio >= 0.8 && ratio <= 1.2) {
        similarity += 0.1;
      }
    }

    // Same mood range (within 1 point)
    if (enriched.mood && original.mood) {
      if (Math.abs(enriched.mood.score - original.mood.score) <= 1) {
        similarity += 0.3;
      }
    }

    // Same location (within ~500m ≈ 0.005 degrees)
    if (enriched.location && original.location) {
      const latDiff = Math.abs(enriched.location.lat - original.location.lat);
      const lngDiff = Math.abs(enriched.location.lng - original.location.lng);
      if (latDiff < 0.005 && lngDiff < 0.005) {
        similarity += 0.4;
      }
    }

    // Same calendar event title
    if (enriched.calendar_event && original.calendar_event) {
      if (enriched.calendar_event.title === original.calendar_event.title) {
        similarity += 0.4;
      }
    }

    // Same time of day (within 2 hours)
    const eventHour = parseInt(event.timestamp.slice(11, 13) || '12', 10);
    const eHour = parseInt(e.timestamp.slice(11, 13) || '12', 10);
    if (Math.abs(eventHour - eHour) <= 2) {
      similarity += 0.1;
    }

    if (similarity > 0.3) {
      results.push({
        date: eDate,
        similarity: Math.min(similarity, 1),
        summary: e.summary,
      });
    }
  }

  // Sort by similarity descending, take top N
  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, limit);
}

/**
 * Generate follow-up questions based on the forensic context.
 * These are the "dig deeper" prompts that create the rabbit hole.
 */
function generateQuestions(
  event: Event,
  enriched: EnrichedEvent,
  before: EnrichedEvent[],
  after: EnrichedEvent[],
  crossDomain: MomentSnapshot,
): string[] {
  const questions: string[] = [];
  const time = event.timestamp.slice(11, 16);
  const date = event.timestamp.slice(0, 10);

  // Transaction-specific questions
  if (enriched.transaction) {
    const tx = enriched.transaction;
    questions.push(`What were you doing before spending $${Math.abs(tx.amount).toFixed(2)} at ${tx.merchant}?`);
    questions.push(`How many times have you been to ${tx.merchant} this month?`);
    if (crossDomain.mood) {
      questions.push(`Your mood was ${crossDomain.mood.score}/5 when you spent at ${tx.merchant}. Is there a pattern?`);
    }
  }

  // Mood-specific questions
  if (enriched.mood) {
    const m = enriched.mood;
    if (m.score <= 2) {
      questions.push(`What happened before your mood dropped to ${m.score}/5 at ${time}?`);
      if (crossDomain.transactions.length > 0) {
        questions.push(`You spent money around the same time your mood was low. Emotional spending?`);
      }
    }
    if (m.score >= 4) {
      questions.push(`What made ${time} a good moment? Can you recreate it?`);
    }
  }

  // Location questions
  if (enriched.location) {
    questions.push(`What else happened at ${enriched.location.address || 'this location'}?`);
    questions.push(`How often do you visit this place?`);
  }

  // Calendar questions
  if (enriched.calendar_event) {
    const ce = enriched.calendar_event;
    questions.push(`How did "${ce.title}" affect the rest of your day?`);
    if (crossDomain.mood) {
      questions.push(`Your mood was ${crossDomain.mood.score}/5 during "${ce.title}". Normal?`);
    }
  }

  // Note/voice questions
  if (enriched.note) {
    questions.push(`What prompted this note at ${time}?`);
  }
  if (enriched.voice_memo) {
    questions.push(`What were you feeling when you recorded this at ${time}?`);
  }

  // Photo-specific questions
  if (enriched.photo) {
    questions.push(`What was happening when this photo was taken at ${time}?`);
    if (enriched.photo.analysis?.mood_indicators) {
      try {
        const mood = JSON.parse(enriched.photo.analysis.mood_indicators);
        if (mood.tone && crossDomain.mood) {
          questions.push(`The photo looks ${mood.tone}, but your mood was ${crossDomain.mood.score}/5. Which was real?`);
        }
      } catch { /* ignore */ }
    }
  }

  // Cross-domain context questions
  if (before.length > 0 && after.length > 0) {
    const beforeTypes = new Set(before.map(e => e.type));
    const afterTypes = new Set(after.map(e => e.type));
    if (beforeTypes.has('mood') || afterTypes.has('mood')) {
      questions.push(`Did your mood change after this event?`);
    }
  }

  // Time gap detection
  if (before.length === 0 && time !== '00:00') {
    questions.push(`There's no recorded activity before ${time}. What were you doing?`);
  }

  // General contextual question
  questions.push(`What else was happening on ${date} around ${time}?`);

  // Deduplicate and limit
  const unique = [...new Set(questions)];
  return unique.slice(0, 6);
}
