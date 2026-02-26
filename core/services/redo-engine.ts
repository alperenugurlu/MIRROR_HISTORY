/**
 * Re-do Engine — The core grain mechanic.
 *
 * Like Liam replaying moments in the taxi. Reconstructs any moment
 * with ALL data streams overlaid: location, mood, spending, health,
 * notes, voice memos, calendar events.
 *
 * Returns MomentSnapshot (a single point in time) or RedoDay
 * (24 hourly slices of an entire day).
 */

import * as db from '../database';
import type {
  MomentSnapshot, HourlySlice, RedoDay, EventType,
  Location, MoodEntry, MoneyTransaction, CalendarEvent,
  HealthEntry, Note, VoiceMemo,
} from '../types';

/**
 * Get a snapshot of all data streams at a point in time.
 * @param centerTimestamp ISO timestamp to center on
 * @param windowMinutes Minutes before/after to include (default 30)
 */
export function getMomentData(centerTimestamp: string, windowMinutes = 30): MomentSnapshot {
  const center = new Date(centerTimestamp);
  const start = new Date(center.getTime() - windowMinutes * 60 * 1000);
  const end = new Date(center.getTime() + windowMinutes * 60 * 1000);

  const tsStart = start.toISOString();
  const tsEnd = end.toISOString();

  const locations = db.getLocationsInWindow(tsStart, tsEnd);
  const moods = db.getMoodEntriesInWindow(tsStart, tsEnd);
  const transactions = db.getTransactionsInWindow(tsStart, tsEnd);
  const calendarEvents = db.getCalendarEventsInWindow(tsStart, tsEnd);
  const healthEntries = db.getHealthEntriesInWindow(tsStart, tsEnd);
  const notes = db.getNotesInWindow(tsStart, tsEnd);
  const voiceMemos = db.getVoiceMemosInWindow(tsStart, tsEnd);

  // Pick the closest location and mood to the center timestamp
  const closestLocation = findClosest(locations, centerTimestamp, l => l.timestamp);
  const closestMood = findClosest(moods, centerTimestamp, m => m.timestamp);

  return {
    timestamp: centerTimestamp,
    location: closestLocation,
    mood: closestMood,
    transactions,
    calendarEvents,
    healthEntries,
    notes,
    voiceMemos,
  };
}

/**
 * Reconstruct a full day as 24 hourly slices.
 * Each slice contains all data streams active during that hour.
 */
export function getHourlyReconstruction(date: string): RedoDay {
  const slices: HourlySlice[] = [];
  const moodArc: { hour: number; score: number }[] = [];
  let totalEvents = 0;

  for (let hour = 0; hour < 24; hour++) {
    const hourStart = `${date}T${pad(hour)}:00:00.000Z`;
    const hourEnd = `${date}T${pad(hour)}:59:59.999Z`;

    const events = db.getEventsInWindow(hourStart, hourEnd);
    const snapshot = buildSnapshotForWindow(hourStart, hourEnd);

    // Count events per type to find dominant
    const typeCounts = new Map<EventType, number>();
    for (const ev of events) {
      typeCounts.set(ev.type, (typeCounts.get(ev.type) || 0) + 1);
    }

    let dominantType: EventType | null = null;
    let maxCount = 0;
    for (const [type, count] of typeCounts) {
      if (count > maxCount) {
        dominantType = type;
        maxCount = count;
      }
    }

    // Track mood arc
    if (snapshot.mood) {
      moodArc.push({ hour, score: snapshot.mood.score });
    }

    totalEvents += events.length;

    slices.push({
      hour,
      label: `${pad(hour)}:00`,
      snapshot,
      eventCount: events.length,
      dominantType,
    });
  }

  return {
    date,
    slices,
    moodArc,
    totalEvents,
  };
}

// ── Internal helpers ──

function buildSnapshotForWindow(tsStart: string, tsEnd: string): MomentSnapshot {
  const midpoint = new Date(
    (new Date(tsStart).getTime() + new Date(tsEnd).getTime()) / 2
  ).toISOString();

  const locations = db.getLocationsInWindow(tsStart, tsEnd);
  const moods = db.getMoodEntriesInWindow(tsStart, tsEnd);
  const transactions = db.getTransactionsInWindow(tsStart, tsEnd);
  const calendarEvents = db.getCalendarEventsInWindow(tsStart, tsEnd);
  const healthEntries = db.getHealthEntriesInWindow(tsStart, tsEnd);
  const notes = db.getNotesInWindow(tsStart, tsEnd);
  const voiceMemos = db.getVoiceMemosInWindow(tsStart, tsEnd);

  return {
    timestamp: midpoint,
    location: locations[0],
    mood: moods[0],
    transactions,
    calendarEvents,
    healthEntries,
    notes,
    voiceMemos,
  };
}

function findClosest<T>(items: T[], target: string, getTs: (item: T) => string): T | undefined {
  if (items.length === 0) return undefined;
  const targetMs = new Date(target).getTime();
  let closest = items[0];
  let minDiff = Math.abs(new Date(getTs(closest)).getTime() - targetMs);

  for (let i = 1; i < items.length; i++) {
    const diff = Math.abs(new Date(getTs(items[i])).getTime() - targetMs);
    if (diff < minDiff) {
      closest = items[i];
      minDiff = diff;
    }
  }
  return closest;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}
