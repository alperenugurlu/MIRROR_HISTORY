/**
 * Moment Detection Engine — Pattern-based significant moment identification
 *
 * Detects notable patterns across life domains:
 * - Mood drops/spikes relative to recent average
 * - Unusual spending + new locations → "Discovery moment"
 * - High meeting density + low mood → "Stressful day"
 * - High activity + high mood → "Active & happy"
 * - Streak detection (consecutive same patterns)
 *
 * Rule-based (no AI required), with optional AI enrichment.
 */

import * as db from '../database';
import type { MoodEntry } from '../types';

export interface DetectedMoment {
  id: string;
  type: MomentType;
  date: string;
  title: string;
  description: string;
  icon: string;
  score: number; // 0-1 significance score
  relatedEventIds: string[];
}

export type MomentType =
  | 'mood_drop'
  | 'mood_spike'
  | 'stressful_day'
  | 'active_happy'
  | 'discovery'
  | 'productive_day'
  | 'quiet_day'
  | 'social_day';

/**
 * Detect significant moments for a given date range.
 * Typically called for the past 7 days to show "This week's highlights" on LifePulse.
 */
export function detectMoments(startDate: string, endDate: string): DetectedMoment[] {
  const moments: DetectedMoment[] = [];

  // Get all events in range
  const events = db.getEventsByDateRange(startDate, endDate);
  if (events.length === 0) return [];

  // Group events by date
  const byDate = new Map<string, typeof events>();
  for (const ev of events) {
    const date = ev.timestamp.slice(0, 10);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(ev);
  }

  // Get mood entries in range + preceding period for baseline
  const baselineStart = getDateBefore(startDate, 14); // 2 weeks before for baseline
  const allMoods = db.getMoodByDateRange(baselineStart, endDate);
  const periodMoods = allMoods.filter(m => m.timestamp.slice(0, 10) >= startDate);
  const baselineMoods = allMoods.filter(m => m.timestamp.slice(0, 10) < startDate);

  const baselineAvg = baselineMoods.length > 0
    ? baselineMoods.reduce((s, m) => s + m.score, 0) / baselineMoods.length
    : 3; // default to neutral

  // Group moods by date
  const moodsByDate = new Map<string, MoodEntry[]>();
  for (const m of periodMoods) {
    const date = m.timestamp.slice(0, 10);
    if (!moodsByDate.has(date)) moodsByDate.set(date, []);
    moodsByDate.get(date)!.push(m);
  }

  // Analyze each date
  for (const [date, dayEvents] of byDate) {
    const dayMoods = moodsByDate.get(date) || [];
    const avgMood = dayMoods.length > 0
      ? dayMoods.reduce((s, m) => s + m.score, 0) / dayMoods.length
      : null;

    const eventTypes = new Map<string, number>();
    for (const ev of dayEvents) {
      eventTypes.set(ev.type, (eventTypes.get(ev.type) || 0) + 1);
    }

    const noteCount = eventTypes.get('note') || 0;
    const calendarCount = eventTypes.get('calendar_event') || 0;
    const locationCount = eventTypes.get('location') || 0;
    const voiceCount = eventTypes.get('voice_memo') || 0;
    const txCount = eventTypes.get('money_transaction') || 0;
    const healthCount = eventTypes.get('health_entry') || 0;

    const eventIds = dayEvents.map(e => e.id);

    // ── Pattern: Mood Drop ──
    if (avgMood !== null && avgMood <= baselineAvg - 1.0 && avgMood <= 2.5) {
      moments.push({
        id: `mood_drop_${date}`,
        type: 'mood_drop',
        date,
        title: 'Tough day',
        description: `Your mood averaged ${avgMood.toFixed(1)}/5, below your typical ${baselineAvg.toFixed(1)}`,
        icon: '\u{1F614}',
        score: Math.min(1, (baselineAvg - avgMood) / 3),
        relatedEventIds: dayMoods.map(m => m.event_id),
      });
    }

    // ── Pattern: Mood Spike ──
    if (avgMood !== null && avgMood >= baselineAvg + 1.0 && avgMood >= 4.0) {
      moments.push({
        id: `mood_spike_${date}`,
        type: 'mood_spike',
        date,
        title: 'Great day!',
        description: `Your mood hit ${avgMood.toFixed(1)}/5, well above your average ${baselineAvg.toFixed(1)}`,
        icon: '\u{1F929}',
        score: Math.min(1, (avgMood - baselineAvg) / 3),
        relatedEventIds: dayMoods.map(m => m.event_id),
      });
    }

    // ── Pattern: Stressful Day (many meetings + low/no mood) ──
    if (calendarCount >= 3 && (avgMood === null || avgMood <= 3)) {
      moments.push({
        id: `stressful_${date}`,
        type: 'stressful_day',
        date,
        title: 'Packed schedule',
        description: `${calendarCount} calendar events${avgMood !== null ? `, mood ${avgMood.toFixed(1)}/5` : ''}`,
        icon: '\u{1F4C5}',
        score: 0.6 + (calendarCount - 3) * 0.1,
        relatedEventIds: eventIds,
      });
    }

    // ── Pattern: Active & Happy (health + high mood) ──
    if (healthCount >= 1 && avgMood !== null && avgMood >= 4) {
      moments.push({
        id: `active_happy_${date}`,
        type: 'active_happy',
        date,
        title: 'Active & happy',
        description: `${healthCount} health entries recorded with mood ${avgMood.toFixed(1)}/5`,
        icon: '\u{1F3CB}\u{FE0F}',
        score: 0.7 + avgMood * 0.05,
        relatedEventIds: eventIds,
      });
    }

    // ── Pattern: Discovery (location + spending) ──
    if (locationCount >= 1 && txCount >= 2) {
      moments.push({
        id: `discovery_${date}`,
        type: 'discovery',
        date,
        title: 'Exploration day',
        description: `${locationCount} location(s) visited, ${txCount} transactions made`,
        icon: '\u{1F30D}',
        score: 0.65,
        relatedEventIds: eventIds,
      });
    }

    // ── Pattern: Productive Day (many notes + voice memos) ──
    if (noteCount + voiceCount >= 4) {
      moments.push({
        id: `productive_${date}`,
        type: 'productive_day',
        date,
        title: 'Productive day',
        description: `Captured ${noteCount} notes and ${voiceCount} voice memos`,
        icon: '\u{1F4DD}',
        score: 0.5 + (noteCount + voiceCount) * 0.05,
        relatedEventIds: eventIds,
      });
    }

    // ── Pattern: Quiet Day (very few events) ──
    if (dayEvents.length <= 1 && dayEvents.length > 0) {
      moments.push({
        id: `quiet_${date}`,
        type: 'quiet_day',
        date,
        title: 'Quiet day',
        description: `Only ${dayEvents.length} event recorded — a calm day`,
        icon: '\u{1F54A}\u{FE0F}',
        score: 0.3,
        relatedEventIds: eventIds,
      });
    }
  }

  // Sort by score (most significant first), then by date (most recent first)
  moments.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.date.localeCompare(a.date);
  });

  // Deduplicate: keep at most 1 moment per date (the highest-scoring one)
  const seenDates = new Set<string>();
  const deduped: DetectedMoment[] = [];
  for (const m of moments) {
    if (!seenDates.has(m.date)) {
      seenDates.add(m.date);
      deduped.push(m);
    }
  }

  return deduped.slice(0, 7); // Max 7 moments
}

/**
 * Get highlights for the current week (shortcut for LifePulse).
 */
export function getWeeklyHighlights(): DetectedMoment[] {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);

  return detectMoments(
    weekAgo.toISOString().slice(0, 10),
    today.toISOString().slice(0, 10),
  );
}

function getDateBefore(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
