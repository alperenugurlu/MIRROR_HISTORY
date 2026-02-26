/**
 * Inconsistency Engine — The grain catches contradictions.
 *
 * Like Liam catching Ffion's story changing from "1 week" to "6 months."
 * Cross-domain contradiction detector. Scans across location, calendar, mood,
 * spending, health, and time data to find things that don't add up.
 *
 * 7 rule-based detection patterns:
 * 1. Location Mismatch — Calendar says X, location says Y
 * 2. Schedule Conflict — Overlapping calendar events
 * 3. Mood-Behavior Disconnect — High mood but negative patterns, or vice versa
 * 4. Pattern Break — Regular routine disrupted
 * 5. Spending-Mood Correlation — Spending spikes on low-mood days
 * 6. Time Gap — Hours with no data (suspicious silence)
 * 7. Visual Mood Mismatch — Photo expression contradicts reported mood
 */

import * as db from '../database';
import { detectVisualMoodMismatches } from './visual-comparison-engine';
import type {
  InconsistencyType, Inconsistency, InconsistencyScanResult,
  CalendarEvent, Location, MoodEntry, MoneyTransaction, HealthEntry,
} from '../types';

/**
 * Scan a date range for inconsistencies. Iterates day by day,
 * running all 6 detection patterns. Results are stored in the DB
 * and also returned.
 */
export function scanForInconsistencies(startDate: string, endDate: string): InconsistencyScanResult {
  const found: Inconsistency[] = [];
  const start = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T23:59:59Z');

  let scannedDays = 0;
  const current = new Date(start);

  while (current <= end) {
    const dateStr = current.toISOString().slice(0, 10);
    const dayStart = dateStr + 'T00:00:00.000Z';
    const dayEnd = dateStr + 'T23:59:59.999Z';

    // Clear previous findings for this day (re-scan is idempotent)
    db.clearInconsistenciesForDate(dateStr);

    // Run all detectors for this day
    const dayFindings = [
      ...detectLocationMismatches(dateStr, dayStart, dayEnd),
      ...detectScheduleConflicts(dateStr, dayStart, dayEnd),
      ...detectMoodBehaviorDisconnect(dateStr, dayStart, dayEnd),
      ...detectPatternBreaks(dateStr),
      ...detectSpendingMoodCorrelation(dateStr, dayStart, dayEnd),
      ...detectTimeGaps(dateStr, dayStart, dayEnd),
      ...detectVisualMoodMismatchFindings(dateStr, dayStart, dayEnd),
    ];

    // Store each finding
    for (const f of dayFindings) {
      const stored = db.insertInconsistency(
        f.type, f.severity, f.title, f.description,
        f.evidenceEventIds, f.suggestedQuestion, f.date,
      );
      found.push(stored);
    }

    scannedDays++;
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return { scannedDays, found };
}

// ── Helper type for pre-insert findings ──

interface Finding {
  type: InconsistencyType;
  severity: number;
  title: string;
  description: string;
  evidenceEventIds: string[];
  suggestedQuestion: string;
  date: string;
}

// ── Pattern 1: Location Mismatch ──
// Calendar says "Meeting at Office" but location says you were elsewhere

function detectLocationMismatches(date: string, dayStart: string, dayEnd: string): Finding[] {
  const findings: Finding[] = [];

  const calEvents = db.getCalendarEventsInWindow(dayStart, dayEnd);
  const locations = db.getLocationsInWindow(dayStart, dayEnd);

  if (calEvents.length === 0 || locations.length === 0) return findings;

  for (const cal of calEvents) {
    if (!cal.location || cal.location.trim().length === 0) continue;

    // Find locations during this calendar event's time window
    const locsDuring = locations.filter(loc => {
      return loc.timestamp >= cal.start_time && loc.timestamp <= cal.end_time;
    });

    if (locsDuring.length === 0) continue;

    // Check if any recorded location matches the calendar event location
    const calLocLower = cal.location.toLowerCase();
    const allMismatch = locsDuring.every(loc => {
      const addrLower = loc.address.toLowerCase();
      // Simple substring matching — "office" in "Istanbul Office" etc.
      return !addrLower.includes(calLocLower) && !calLocLower.includes(addrLower);
    });

    if (allMismatch) {
      const actualLoc = locsDuring[0];
      findings.push({
        type: 'location_mismatch',
        severity: 0.7,
        title: `You weren't where you said you'd be`,
        description: `Calendar event "${cal.title}" was at "${cal.location}", but your location data shows you were at "${actualLoc.address}" during that time.`,
        evidenceEventIds: [cal.event_id, actualLoc.event_id],
        suggestedQuestion: `Why were you at ${actualLoc.address} instead of ${cal.location}?`,
        date,
      });
    }
  }

  return findings;
}

// ── Pattern 2: Schedule Conflict ──
// Overlapping calendar events — you can't be in two places at once

function detectScheduleConflicts(date: string, dayStart: string, dayEnd: string): Finding[] {
  const findings: Finding[] = [];

  const calEvents = db.getCalendarEventsInWindow(dayStart, dayEnd);
  if (calEvents.length < 2) return findings;

  // Sort by start time
  const sorted = [...calEvents].sort((a, b) => a.start_time.localeCompare(b.start_time));

  for (let i = 0; i < sorted.length - 1; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];

      // Check overlap: a.end > b.start AND b.end > a.start
      if (a.end_time > b.start_time && b.end_time > a.start_time) {
        // Calculate overlap duration in minutes
        const overlapStart = a.start_time > b.start_time ? a.start_time : b.start_time;
        const overlapEnd = a.end_time < b.end_time ? a.end_time : b.end_time;
        const overlapMs = new Date(overlapEnd).getTime() - new Date(overlapStart).getTime();
        const overlapMin = Math.round(overlapMs / 60000);

        if (overlapMin < 5) continue; // ignore trivial overlaps

        findings.push({
          type: 'schedule_conflict',
          severity: Math.min(0.5 + (overlapMin / 120), 0.9), // scales with overlap duration
          title: `Double-booked: ${overlapMin}min overlap`,
          description: `"${a.title}" and "${b.title}" overlap by ${overlapMin} minutes. You agreed to be in two places at once.`,
          evidenceEventIds: [a.event_id, b.event_id],
          suggestedQuestion: `Which one did you actually attend — "${a.title}" or "${b.title}"?`,
          date,
        });
      }
    }
  }

  return findings;
}

// ── Pattern 3: Mood-Behavior Disconnect ──
// High mood but negative actions (big spending, poor sleep), or vice versa

function detectMoodBehaviorDisconnect(date: string, dayStart: string, dayEnd: string): Finding[] {
  const findings: Finding[] = [];

  const moods = db.getMoodEntriesInWindow(dayStart, dayEnd);
  if (moods.length === 0) return findings;

  const avgMood = moods.reduce((sum, m) => sum + m.score, 0) / moods.length;
  const transactions = db.getTransactionsInWindow(dayStart, dayEnd);
  const healthEntries = db.getHealthEntriesInWindow(dayStart, dayEnd);
  const sleepEntries = healthEntries.filter(h => h.metric_type === 'sleep_hours');

  // High mood (4+) but high spending (big negative amounts)
  if (avgMood >= 4) {
    const totalSpent = transactions
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    if (totalSpent > 100) {
      findings.push({
        type: 'mood_behavior_disconnect',
        severity: 0.5,
        title: `Happy and spending: $${totalSpent.toFixed(0)} on a great day`,
        description: `Your mood averaged ${avgMood.toFixed(1)}/5 — great day. But you spent $${totalSpent.toFixed(2)} across ${transactions.filter(t => t.amount < 0).length} transactions. Euphoric spending?`,
        evidenceEventIds: [
          ...moods.map(m => m.event_id),
          ...transactions.slice(0, 3).map(t => t.event_id),
        ],
        suggestedQuestion: `Were these purchases planned, or did the good mood drive spending?`,
        date,
      });
    }
  }

  // Low mood (<=2) but reporting good health / doing activities
  if (avgMood <= 2) {
    const workouts = healthEntries.filter(h => h.metric_type === 'workout');
    if (workouts.length > 0) {
      findings.push({
        type: 'mood_behavior_disconnect',
        severity: 0.4,
        title: `Low mood but you still worked out`,
        description: `Mood was ${avgMood.toFixed(1)}/5 — rough day. But you logged ${workouts.length} workout(s). Pushing through or masking something?`,
        evidenceEventIds: [
          ...moods.map(m => m.event_id),
          ...workouts.map(w => w.event_id),
        ],
        suggestedQuestion: `Was the workout an attempt to feel better, or were things not as bad as the mood score says?`,
        date,
      });
    }

    // Low mood but high social (many calendar events)
    const calEvents = db.getCalendarEventsInWindow(dayStart, dayEnd);
    if (calEvents.length >= 3) {
      findings.push({
        type: 'mood_behavior_disconnect',
        severity: 0.6,
        title: `Miserable but social: ${calEvents.length} events`,
        description: `Your mood was ${avgMood.toFixed(1)}/5 but you had ${calEvents.length} calendar events. Performing happiness for others?`,
        evidenceEventIds: [
          ...moods.map(m => m.event_id),
          ...calEvents.slice(0, 3).map(c => c.event_id),
        ],
        suggestedQuestion: `Were you putting on a face for the ${calEvents.length} events, or did something happen between them?`,
        date,
      });
    }
  }

  // Mood swings within the same day (high variance)
  if (moods.length >= 3) {
    const maxMood = Math.max(...moods.map(m => m.score));
    const minMood = Math.min(...moods.map(m => m.score));
    const swing = maxMood - minMood;

    if (swing >= 3) {
      const highMood = moods.find(m => m.score === maxMood)!;
      const lowMood = moods.find(m => m.score === minMood)!;
      findings.push({
        type: 'mood_behavior_disconnect',
        severity: 0.7,
        title: `Emotional rollercoaster: ${minMood}/5 → ${maxMood}/5`,
        description: `Your mood swung ${swing} points in one day. From ${minMood}/5 at ${lowMood.timestamp.slice(11, 16)} to ${maxMood}/5 at ${highMood.timestamp.slice(11, 16)}. What happened in between?`,
        evidenceEventIds: moods.map(m => m.event_id),
        suggestedQuestion: `What caused the shift from ${minMood}/5 to ${maxMood}/5?`,
        date,
      });
    }
  }

  return findings;
}

// ── Pattern 4: Pattern Break ──
// Regular routine disrupted (e.g., usually gym on Mondays, skipped recently)

function detectPatternBreaks(date: string): Finding[] {
  const findings: Finding[] = [];

  const currentDate = new Date(date + 'T12:00:00Z');
  const dayOfWeek = currentDate.getUTCDay(); // 0=Sun, 1=Mon, ...

  // Look at the last 4 weeks on the same day of week for patterns
  const sameDayDates: string[] = [];
  for (let w = 1; w <= 4; w++) {
    const pastDate = new Date(currentDate);
    pastDate.setUTCDate(pastDate.getUTCDate() - (w * 7));
    sameDayDates.push(pastDate.toISOString().slice(0, 10));
  }

  // Check: Did events typically happen on this weekday that didn't today?
  const dayStart = date + 'T00:00:00.000Z';
  const dayEnd = date + 'T23:59:59.999Z';
  const todayEvents = db.getEventsInWindow(dayStart, dayEnd);
  const todayTypes = new Set(todayEvents.map(e => e.type));

  // Check each past same-weekday for consistent patterns
  const typeCountByPastDay: Map<string, number> = new Map();

  for (const pastDate of sameDayDates) {
    const pStart = pastDate + 'T00:00:00.000Z';
    const pEnd = pastDate + 'T23:59:59.999Z';
    const pastEvents = db.getEventsInWindow(pStart, pEnd);

    for (const e of pastEvents) {
      typeCountByPastDay.set(e.type, (typeCountByPastDay.get(e.type) || 0) + 1);
    }
  }

  // If a type appeared on 3+ of last 4 same weekdays but not today — pattern break
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  for (const [type, count] of typeCountByPastDay.entries()) {
    if (count >= 3 && !todayTypes.has(type as any)) {
      const readableType = type.replace(/_/g, ' ');
      findings.push({
        type: 'pattern_break',
        severity: 0.4 + (count / 10), // higher if more consistent
        title: `Broke your ${dayNames[dayOfWeek]} routine`,
        description: `You had "${readableType}" events on ${count} of the last 4 ${dayNames[dayOfWeek]}s, but not today. Routine broken.`,
        evidenceEventIds: [],
        suggestedQuestion: `Why did you skip ${readableType} this ${dayNames[dayOfWeek]}?`,
        date,
      });
    }
  }

  // Check workout frequency drop
  const healthToday = db.getHealthEntriesInWindow(dayStart, dayEnd);
  const workoutsToday = healthToday.filter(h => h.metric_type === 'workout').length;

  // Check last 2 weeks of workouts
  const twoWeeksAgo = new Date(currentDate);
  twoWeeksAgo.setUTCDate(twoWeeksAgo.getUTCDate() - 14);
  const recentHealth = db.getHealthEntriesByType(
    'workout',
    twoWeeksAgo.toISOString().slice(0, 10) + 'T00:00:00.000Z',
    dayEnd,
  );

  // Split into first week and second week
  const oneWeekAgo = new Date(currentDate);
  oneWeekAgo.setUTCDate(oneWeekAgo.getUTCDate() - 7);
  const week1Workouts = recentHealth.filter(h =>
    h.timestamp >= twoWeeksAgo.toISOString() && h.timestamp < oneWeekAgo.toISOString()
  ).length;
  const week2Workouts = recentHealth.filter(h =>
    h.timestamp >= oneWeekAgo.toISOString()
  ).length;

  if (week1Workouts >= 3 && week2Workouts <= 1) {
    findings.push({
      type: 'pattern_break',
      severity: 0.6,
      title: `Exercise dropped: ${week1Workouts}→${week2Workouts} workouts`,
      description: `You went from ${week1Workouts} workouts two weeks ago to ${week2Workouts} this past week. The decline is significant.`,
      evidenceEventIds: recentHealth.map(h => h.event_id),
      suggestedQuestion: `What made you stop working out? Was it a choice or did something get in the way?`,
      date,
    });
  }

  return findings;
}

// ── Pattern 5: Spending-Mood Correlation ──
// Spending spikes on low-mood days (emotional spending)

function detectSpendingMoodCorrelation(date: string, dayStart: string, dayEnd: string): Finding[] {
  const findings: Finding[] = [];

  const moods = db.getMoodEntriesInWindow(dayStart, dayEnd);
  const transactions = db.getTransactionsInWindow(dayStart, dayEnd);

  if (moods.length === 0 || transactions.length === 0) return findings;

  const avgMood = moods.reduce((sum, m) => sum + m.score, 0) / moods.length;
  const spending = transactions.filter(t => t.amount < 0);
  const totalSpent = spending.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  if (avgMood > 2.5 || totalSpent < 20) return findings; // not low enough mood or not much spending

  // Look at average spending on "normal mood" days in the last 2 weeks for baseline
  const twoWeeksAgo = new Date(date + 'T00:00:00Z');
  twoWeeksAgo.setUTCDate(twoWeeksAgo.getUTCDate() - 14);

  let normalDaySpending: number[] = [];
  const cursor = new Date(twoWeeksAgo);
  while (cursor.toISOString().slice(0, 10) < date) {
    const d = cursor.toISOString().slice(0, 10);
    const dStart = d + 'T00:00:00.000Z';
    const dEnd = d + 'T23:59:59.999Z';
    const dMoods = db.getMoodEntriesInWindow(dStart, dEnd);
    const dAvgMood = dMoods.length > 0
      ? dMoods.reduce((s, m) => s + m.score, 0) / dMoods.length
      : 3; // assume neutral if no mood data

    if (dAvgMood >= 3) {
      const dTx = db.getTransactionsInWindow(dStart, dEnd);
      const dSpent = dTx.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
      if (dSpent > 0) normalDaySpending.push(dSpent); // only count days with actual spending
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  if (normalDaySpending.length === 0) return findings;

  const avgNormalSpending = normalDaySpending.reduce((a, b) => a + b, 0) / normalDaySpending.length;

  // Spending is 50%+ more than normal-mood days
  if (avgNormalSpending > 0 && totalSpent > avgNormalSpending * 1.5) {
    const pctMore = Math.round(((totalSpent / avgNormalSpending) - 1) * 100);
    const topMerchant = spending.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))[0];

    findings.push({
      type: 'spending_mood_correlation',
      severity: Math.min(0.5 + (pctMore / 200), 0.9),
      title: `Emotional spending: ${pctMore}% above normal`,
      description: `On a ${avgMood.toFixed(1)}/5 mood day, you spent $${totalSpent.toFixed(2)} — ${pctMore}% more than your average $${avgNormalSpending.toFixed(2)} on normal-mood days. Biggest: $${Math.abs(topMerchant.amount).toFixed(2)} at ${topMerchant.merchant}.`,
      evidenceEventIds: [
        ...moods.map(m => m.event_id),
        ...spending.slice(0, 3).map(t => t.event_id),
      ],
      suggestedQuestion: `Did spending at ${topMerchant.merchant} make you feel better or worse?`,
      date,
    });
  }

  return findings;
}

// ── Pattern 6: Time Gap ──
// Hours with zero recorded events (suspicious silence)

function detectTimeGaps(date: string, dayStart: string, dayEnd: string): Finding[] {
  const findings: Finding[] = [];

  const allEvents = db.getEventsInWindow(dayStart, dayEnd);
  if (allEvents.length < 3) return findings; // not enough data to judge gaps

  // Map events to hours
  const activeHours = new Set<number>();
  for (const e of allEvents) {
    const hour = parseInt(e.timestamp.slice(11, 13) || '0', 10);
    activeHours.add(hour);
  }

  // Find the active range (first event to last event)
  const eventHours = [...activeHours].sort((a, b) => a - b);
  const firstHour = eventHours[0];
  const lastHour = eventHours[eventHours.length - 1];

  // Find consecutive gap blocks within the active range
  let gapStart: number | null = null;
  const gaps: { start: number; end: number; duration: number }[] = [];

  for (let h = firstHour; h <= lastHour; h++) {
    if (!activeHours.has(h)) {
      if (gapStart === null) gapStart = h;
    } else {
      if (gapStart !== null) {
        const duration = h - gapStart;
        if (duration >= 2) { // only flag gaps of 2+ hours
          gaps.push({ start: gapStart, end: h - 1, duration });
        }
        gapStart = null;
      }
    }
  }

  // Close trailing gap
  if (gapStart !== null) {
    const duration = lastHour - gapStart;
    if (duration >= 2) {
      gaps.push({ start: gapStart, end: lastHour - 1, duration });
    }
  }

  for (const gap of gaps) {
    const startLabel = `${gap.start.toString().padStart(2, '0')}:00`;
    const endLabel = `${(gap.end + 1).toString().padStart(2, '0')}:00`;

    findings.push({
      type: 'time_gap',
      severity: Math.min(0.3 + (gap.duration / 10), 0.8),
      title: `${gap.duration}h silence: ${startLabel}–${endLabel}`,
      description: `No recorded activity from ${startLabel} to ${endLabel} — ${gap.duration} hours of silence in the middle of an otherwise active day. What were you doing?`,
      evidenceEventIds: [],
      suggestedQuestion: `What happened between ${startLabel} and ${endLabel}? The grain was silent.`,
      date,
    });
  }

  return findings;
}

// ── Pattern 7: Visual Mood Mismatch ──
// Photo expression contradicts reported mood

function detectVisualMoodMismatchFindings(date: string, dayStart: string, dayEnd: string): Finding[] {
  const mismatches = detectVisualMoodMismatches(date, dayStart, dayEnd);
  return mismatches.map(m => ({
    type: 'visual_mood_mismatch' as InconsistencyType,
    severity: m.severity,
    title: 'Your face tells a different story',
    description: m.mismatchDescription,
    evidenceEventIds: [m.photoEventId],
    suggestedQuestion: `The photo shows ${m.photoMoodTone}, but you reported ${m.reportedMoodScore.toFixed(1)}/5. Which was true?`,
    date,
  }));
}
