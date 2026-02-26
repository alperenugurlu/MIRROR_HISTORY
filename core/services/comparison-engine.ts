/**
 * Comparison Engine — Before/After.
 *
 * Like Liam and Ffion replaying better times. Seeing how things used to be
 * compared to now. Every metric, side by side, with nowhere to hide.
 */

import * as db from '../database';
import { gatherVisualMetrics, comparePhotoSets } from './visual-comparison-engine';
import type { PeriodMetrics, MetricChange, ComparisonResult } from '../types';

/**
 * Compare two time periods across all domains.
 * Returns normalized metrics, changes, and an optional AI narrative.
 */
export async function comparePeriods(
  p1Start: string,
  p1End: string,
  p2Start: string,
  p2End: string,
): Promise<ComparisonResult> {
  const m1 = gatherMetrics(p1Start, p1End);
  const m2 = gatherMetrics(p2Start, p2End);

  const changes = computeChanges(m1, m2);

  // Visual comparison narrative (if photos exist in both periods)
  let narrative: string | undefined;
  if (m1.visual.photoCount > 0 && m2.visual.photoCount > 0) {
    try {
      const visualResult = await comparePhotoSets(p1Start, p1End, p2Start, p2End);
      if (visualResult.narrative) {
        narrative = visualResult.narrative;
      }
    } catch { /* non-fatal — no API key or no photos */ }
  }

  return {
    period1: { start: p1Start, end: p1End, metrics: m1 },
    period2: { start: p2Start, end: p2End, metrics: m2 },
    changes,
    narrative,
  };
}

/**
 * Gather all domain metrics for a date range.
 */
function gatherMetrics(startDate: string, endDate: string): PeriodMetrics {
  const startTs = startDate + 'T00:00:00.000Z';
  const endTs = endDate + 'T23:59:59.999Z';

  const dayCount = Math.max(1, daysBetween(startDate, endDate));

  // Mood
  const moods = db.getMoodEntriesInWindow(startTs, endTs);
  const moodScores = moods.map(m => m.score);
  const moodMetrics = moodScores.length > 0
    ? {
        avg: avg(moodScores),
        min: Math.min(...moodScores),
        max: Math.max(...moodScores),
        count: moodScores.length,
      }
    : { avg: 0, min: 0, max: 0, count: 0 };

  // Spending
  const transactions = db.getTransactionsInWindow(startTs, endTs).filter(t => t.amount < 0);
  const totalSpent = transactions.reduce((s, t) => s + Math.abs(t.amount), 0);
  const merchantTotals = new Map<string, number>();
  for (const t of transactions) {
    const name = t.merchant || 'Unknown';
    merchantTotals.set(name, (merchantTotals.get(name) || 0) + Math.abs(t.amount));
  }
  const topMerchants = [...merchantTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, total]) => ({ name, total }));

  // Health
  const health = db.getHealthEntriesInWindow(startTs, endTs);
  const steps = health.filter(h => h.metric_type === 'steps').map(h => h.value);
  const sleep = health.filter(h => h.metric_type === 'sleep').map(h => h.value);
  const workouts = health.filter(h => h.metric_type === 'workout').length;

  // Calendar
  const calEvents = db.getCalendarEventsInWindow(startTs, endTs);

  // Notes & Voice
  const notes = db.getNotesInWindow(startTs, endTs);
  const voiceMemos = db.getVoiceMemosInWindow(startTs, endTs);

  // Locations
  const locations = db.getLocationsInWindow(startTs, endTs);
  const uniquePlaces = new Set(
    locations.map(l => l.address?.toLowerCase()).filter(Boolean)
  ).size;

  // Visual memories
  const visual = gatherVisualMetrics(startTs, endTs);

  return {
    mood: moodMetrics,
    spending: {
      total: totalSpent,
      avgDaily: totalSpent / dayCount,
      topMerchants,
    },
    health: {
      avgSteps: steps.length > 0 ? avg(steps) : 0,
      avgSleep: sleep.length > 0 ? avg(sleep) : 0,
      workoutCount: workouts,
    },
    calendar: {
      eventCount: calEvents.length,
      avgPerDay: calEvents.length / dayCount,
    },
    notes: {
      count: notes.length,
      voiceCount: voiceMemos.length,
    },
    locations: {
      uniquePlaces,
    },
    visual,
  };
}

/**
 * Compute changes between two period metrics.
 */
function computeChanges(m1: PeriodMetrics, m2: PeriodMetrics): MetricChange[] {
  const changes: MetricChange[] = [];

  function add(domain: string, metric: string, p1: number, p2: number) {
    if (p1 === 0 && p2 === 0) return;
    const changePct = p1 !== 0 ? ((p2 - p1) / p1) * 100 : (p2 > 0 ? 100 : 0);
    const direction: 'up' | 'down' | 'stable' =
      Math.abs(changePct) < 5 ? 'stable' : changePct > 0 ? 'up' : 'down';
    changes.push({ domain, metric, p1, p2, changePct: Math.round(changePct * 10) / 10, direction });
  }

  // Mood
  add('mood', 'Average Mood', m1.mood.avg, m2.mood.avg);
  add('mood', 'Mood Entries', m1.mood.count, m2.mood.count);

  // Spending
  add('spending', 'Total Spending', m1.spending.total, m2.spending.total);
  add('spending', 'Daily Average', m1.spending.avgDaily, m2.spending.avgDaily);

  // Health
  add('health', 'Average Steps', m1.health.avgSteps, m2.health.avgSteps);
  add('health', 'Average Sleep', m1.health.avgSleep, m2.health.avgSleep);
  add('health', 'Workouts', m1.health.workoutCount, m2.health.workoutCount);

  // Calendar
  add('calendar', 'Calendar Events', m1.calendar.eventCount, m2.calendar.eventCount);
  add('calendar', 'Events Per Day', m1.calendar.avgPerDay, m2.calendar.avgPerDay);

  // Notes
  add('notes', 'Notes Written', m1.notes.count, m2.notes.count);
  add('notes', 'Voice Memos', m1.notes.voiceCount, m2.notes.voiceCount);

  // Locations
  add('locations', 'Unique Places', m1.locations.uniquePlaces, m2.locations.uniquePlaces);

  // Visual
  add('visual', 'Photos', m1.visual.photoCount, m2.visual.photoCount);
  add('visual', 'Videos', m1.visual.videoCount, m2.visual.videoCount);
  add('visual', 'Avg People in Photos', m1.visual.avgPeopleCount, m2.visual.avgPeopleCount);

  return changes;
}

// ── Helpers ──

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function daysBetween(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24)) + 1;
}
