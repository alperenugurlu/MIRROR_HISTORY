/**
 * Confrontation Engine — Uncomfortable truths.
 *
 * Like Jonas at the dinner party revealing what nobody wanted to hear.
 * The grain doesn't just record — it confronts you with patterns
 * you'd rather not see.
 *
 * Generates data-driven confrontations:
 * - Correlation-based: "Your mood drops on days with 3+ meetings"
 * - Trend-based: "Your exercise has been declining for 3 weeks"
 * - Anomaly-based: "You've visited this place 12 times but never mentioned it"
 */

import * as db from '../database';
import type {
  Confrontation, ConfrontationCategory, ConfrontationResult,
  MoodEntry, MoneyTransaction, HealthEntry, CalendarEvent,
} from '../types';

/**
 * Generate confrontations for a period. Analyzes cross-domain data
 * and produces blunt, data-driven insights.
 */
export function generateConfrontations(period: 'weekly' | 'monthly'): ConfrontationResult {
  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  const start = new Date(now);

  if (period === 'weekly') {
    start.setDate(start.getDate() - 7);
  } else {
    start.setMonth(start.getMonth() - 1);
  }

  const startDate = start.toISOString().slice(0, 10);
  const startTs = startDate + 'T00:00:00.000Z';
  const endTs = end + 'T23:59:59.999Z';

  // Clear previous confrontations (fresh generation each time)
  db.clearConfrontations();

  const confrontations: Confrontation[] = [];

  // Run all generators
  confrontations.push(
    ...detectMoodMeetingCorrelation(startTs, endTs, period),
    ...detectSpendingMoodCorrelation(startTs, endTs),
    ...detectExerciseDecline(startTs, endTs),
    ...detectMoodTrend(startTs, endTs),
    ...detectSilentLocations(startTs, endTs),
    ...detectSpendingTrend(startTs, endTs),
    ...detectCalendarOverload(startTs, endTs),
  );

  // Store each
  for (const c of confrontations) {
    db.insertConfrontation(c.title, c.insight, c.severity, c.dataPoints, c.relatedEventIds, c.category);
  }

  return { generated: confrontations.length, confrontations };
}

// ── Confrontation generators ──

/**
 * Correlation: Mood drops on high-meeting days
 */
function detectMoodMeetingCorrelation(startTs: string, endTs: string, period: string): Confrontation[] {
  const results: Confrontation[] = [];
  const moods = db.getMoodEntriesInWindow(startTs, endTs);
  const calEvents = db.getCalendarEventsInWindow(startTs, endTs);

  if (moods.length < 3 || calEvents.length < 3) return results;

  // Group by date
  const moodByDate = groupByDate(moods, m => m.timestamp);
  const calByDate = groupByDate(calEvents, c => c.start_time);

  let busyDayMoods: number[] = [];
  let calmDayMoods: number[] = [];

  for (const [date, dayMoods] of Object.entries(moodByDate)) {
    const avgMood = avg(dayMoods.map(m => m.score));
    const meetingCount = (calByDate[date] || []).length;

    if (meetingCount >= 3) {
      busyDayMoods.push(avgMood);
    } else if (meetingCount <= 1) {
      calmDayMoods.push(avgMood);
    }
  }

  if (busyDayMoods.length >= 2 && calmDayMoods.length >= 2) {
    const busyAvg = avg(busyDayMoods);
    const calmAvg = avg(calmDayMoods);
    const diff = calmAvg - busyAvg;

    if (diff >= 0.5) {
      results.push({
        id: '', title: `Meetings kill your mood`,
        insight: `Your average mood on busy days (3+ meetings) is ${busyAvg.toFixed(1)}/5, but on calm days (0-1 meetings) it's ${calmAvg.toFixed(1)}/5. That's a ${diff.toFixed(1)}-point drop every time your calendar fills up.`,
        severity: Math.min(0.5 + diff / 3, 0.9),
        dataPoints: [
          { label: 'Busy day mood', value: `${busyAvg.toFixed(1)}/5` },
          { label: 'Calm day mood', value: `${calmAvg.toFixed(1)}/5` },
          { label: 'Drop', value: `${diff.toFixed(1)} points` },
        ],
        relatedEventIds: moods.slice(0, 3).map(m => m.event_id),
        category: 'correlation',
        generatedAt: '',
      });
    }
  }

  return results;
}

/**
 * Correlation: Spending spikes on low-mood days
 */
function detectSpendingMoodCorrelation(startTs: string, endTs: string): Confrontation[] {
  const results: Confrontation[] = [];
  const moods = db.getMoodEntriesInWindow(startTs, endTs);
  const transactions = db.getTransactionsInWindow(startTs, endTs);

  if (moods.length < 3 || transactions.length < 5) return results;

  const moodByDate = groupByDate(moods, m => m.timestamp);
  const txByDate = groupByDate(transactions.filter(t => t.amount < 0), t => {
    // Transactions have date field, use it
    return t.date;
  });

  let lowMoodSpending: number[] = [];
  let highMoodSpending: number[] = [];

  for (const [date, dayMoods] of Object.entries(moodByDate)) {
    const avgMood = avg(dayMoods.map(m => m.score));
    const dayTxs = txByDate[date] || [];
    const daySpent = dayTxs.reduce((s, t) => s + Math.abs(t.amount), 0);
    if (daySpent === 0) continue;

    if (avgMood <= 2.5) {
      lowMoodSpending.push(daySpent);
    } else if (avgMood >= 3.5) {
      highMoodSpending.push(daySpent);
    }
  }

  if (lowMoodSpending.length >= 2 && highMoodSpending.length >= 2) {
    const lowAvg = avg(lowMoodSpending);
    const highAvg = avg(highMoodSpending);

    if (lowAvg > highAvg * 1.3) {
      const pctMore = Math.round(((lowAvg / highAvg) - 1) * 100);
      results.push({
        id: '', title: `You spend more when you're sad`,
        insight: `On low-mood days (≤2.5/5), you spend an average of $${lowAvg.toFixed(0)} — ${pctMore}% more than the $${highAvg.toFixed(0)} you spend on good days. The worse you feel, the more you buy.`,
        severity: Math.min(0.5 + pctMore / 200, 0.9),
        dataPoints: [
          { label: 'Low-mood spending', value: `$${lowAvg.toFixed(0)}/day` },
          { label: 'Good-mood spending', value: `$${highAvg.toFixed(0)}/day` },
          { label: 'Difference', value: `+${pctMore}%` },
        ],
        relatedEventIds: moods.filter(m => m.score <= 2.5).slice(0, 3).map(m => m.event_id),
        category: 'correlation',
        generatedAt: '',
      });
    }
  }

  return results;
}

/**
 * Trend: Exercise frequency declining
 */
function detectExerciseDecline(startTs: string, endTs: string): Confrontation[] {
  const results: Confrontation[] = [];
  const health = db.getHealthEntriesInWindow(startTs, endTs);
  const workouts = health.filter(h => h.metric_type === 'workout');

  if (workouts.length < 2) return results;

  // Split into two halves
  const mid = new Date((new Date(startTs).getTime() + new Date(endTs).getTime()) / 2).toISOString();
  const firstHalf = workouts.filter(w => w.timestamp < mid).length;
  const secondHalf = workouts.filter(w => w.timestamp >= mid).length;

  if (firstHalf >= 3 && secondHalf <= Math.max(1, firstHalf * 0.5)) {
    results.push({
      id: '', title: `You stopped working out`,
      insight: `First half: ${firstHalf} workouts. Second half: ${secondHalf}. That's a ${Math.round((1 - secondHalf / firstHalf) * 100)}% decline. Your body notices even if you pretend it doesn't.`,
      severity: Math.min(0.5 + (firstHalf - secondHalf) / 10, 0.85),
      dataPoints: [
        { label: 'First half', value: `${firstHalf} workouts` },
        { label: 'Second half', value: `${secondHalf} workouts` },
        { label: 'Decline', value: `${Math.round((1 - secondHalf / firstHalf) * 100)}%` },
      ],
      relatedEventIds: workouts.slice(0, 3).map(w => w.event_id),
      category: 'trend',
      generatedAt: '',
    });
  }

  return results;
}

/**
 * Trend: Mood has been declining over the period
 */
function detectMoodTrend(startTs: string, endTs: string): Confrontation[] {
  const results: Confrontation[] = [];
  const moods = db.getMoodEntriesInWindow(startTs, endTs);

  if (moods.length < 6) return results;

  // Split into two halves
  const mid = Math.floor(moods.length / 2);
  const firstHalf = moods.slice(0, mid);
  const secondHalf = moods.slice(mid);

  const firstAvg = avg(firstHalf.map(m => m.score));
  const secondAvg = avg(secondHalf.map(m => m.score));
  const decline = firstAvg - secondAvg;

  if (decline >= 0.5) {
    results.push({
      id: '', title: `Your mood is declining`,
      insight: `Your average mood went from ${firstAvg.toFixed(1)}/5 to ${secondAvg.toFixed(1)}/5 — a steady ${decline.toFixed(1)}-point decline. This isn't a bad day. It's a trend.`,
      severity: Math.min(0.5 + decline / 3, 0.9),
      dataPoints: [
        { label: 'Earlier average', value: `${firstAvg.toFixed(1)}/5` },
        { label: 'Recent average', value: `${secondAvg.toFixed(1)}/5` },
        { label: 'Decline', value: `${decline.toFixed(1)} points` },
      ],
      relatedEventIds: secondHalf.slice(0, 3).map(m => m.event_id),
      category: 'trend',
      generatedAt: '',
    });
  }

  return results;
}

/**
 * Anomaly: Frequently visited locations never mentioned in notes
 */
function detectSilentLocations(startTs: string, endTs: string): Confrontation[] {
  const results: Confrontation[] = [];
  const locations = db.getLocationsInWindow(startTs, endTs);
  const notes = db.getNotesInWindow(startTs, endTs);

  if (locations.length < 3) return results;

  // Count location visits by address
  const locCounts = new Map<string, number>();
  for (const loc of locations) {
    if (!loc.address || loc.address.length < 3) continue;
    const key = loc.address.toLowerCase();
    locCounts.set(key, (locCounts.get(key) || 0) + 1);
  }

  // Check if any frequent location is never mentioned in notes
  const noteContent = notes.map(n => n.content.toLowerCase()).join(' ');

  for (const [address, count] of locCounts.entries()) {
    if (count < 3) continue;

    // Check if any word from the address appears in notes
    const addressWords = address.split(/\s+/).filter(w => w.length > 3);
    const mentioned = addressWords.some(w => noteContent.includes(w));

    if (!mentioned) {
      const displayAddr = locations.find(l => l.address.toLowerCase() === address)?.address || address;
      results.push({
        id: '', title: `You keep going to ${displayAddr}`,
        insight: `You've been to "${displayAddr}" ${count} times but never mentioned it in any note or voice memo. What happens there that you don't want to record?`,
        severity: Math.min(0.3 + count / 15, 0.7),
        dataPoints: [
          { label: 'Visits', value: `${count} times` },
          { label: 'Mentioned', value: 'Never' },
        ],
        relatedEventIds: locations.filter(l => l.address.toLowerCase() === address).slice(0, 3).map(l => l.event_id),
        category: 'anomaly',
        generatedAt: '',
      });
    }
  }

  return results.slice(0, 2); // max 2 silent locations
}

/**
 * Trend: Spending has been increasing
 */
function detectSpendingTrend(startTs: string, endTs: string): Confrontation[] {
  const results: Confrontation[] = [];
  const transactions = db.getTransactionsInWindow(startTs, endTs).filter(t => t.amount < 0);

  if (transactions.length < 6) return results;

  // Split into two halves by date
  const mid = new Date((new Date(startTs).getTime() + new Date(endTs).getTime()) / 2).toISOString();
  const firstHalf = transactions.filter(t => {
    const e = db.getEvent(t.event_id);
    return e && e.timestamp < mid;
  });
  const secondHalf = transactions.filter(t => {
    const e = db.getEvent(t.event_id);
    return e && e.timestamp >= mid;
  });

  const firstTotal = firstHalf.reduce((s, t) => s + Math.abs(t.amount), 0);
  const secondTotal = secondHalf.reduce((s, t) => s + Math.abs(t.amount), 0);

  if (firstTotal > 0 && secondTotal > firstTotal * 1.3) {
    const pctIncrease = Math.round(((secondTotal / firstTotal) - 1) * 100);

    // Find biggest category
    const catTotals = new Map<string, number>();
    for (const t of secondHalf) {
      const cat = t.category || 'Uncategorized';
      catTotals.set(cat, (catTotals.get(cat) || 0) + Math.abs(t.amount));
    }
    const topCat = [...catTotals.entries()].sort((a, b) => b[1] - a[1])[0];

    results.push({
      id: '', title: `Spending up ${pctIncrease}%`,
      insight: `Your spending increased from $${firstTotal.toFixed(0)} to $${secondTotal.toFixed(0)} — up ${pctIncrease}%. ${topCat ? `Biggest driver: ${topCat[0]} ($${topCat[1].toFixed(0)}).` : ''} At this rate, next month will be worse.`,
      severity: Math.min(0.4 + pctIncrease / 200, 0.8),
      dataPoints: [
        { label: 'Earlier spending', value: `$${firstTotal.toFixed(0)}` },
        { label: 'Recent spending', value: `$${secondTotal.toFixed(0)}` },
        { label: 'Increase', value: `+${pctIncrease}%` },
      ],
      relatedEventIds: secondHalf.slice(0, 3).map(t => t.event_id),
      category: 'trend',
      generatedAt: '',
    });
  }

  return results;
}

/**
 * Correlation: Calendar overload — too many events, happiness suffers
 */
function detectCalendarOverload(startTs: string, endTs: string): Confrontation[] {
  const results: Confrontation[] = [];
  const calEvents = db.getCalendarEventsInWindow(startTs, endTs);

  if (calEvents.length < 10) return results;

  // Count events per day
  const calByDate = groupByDate(calEvents, c => c.start_time);
  const dailyCounts = Object.values(calByDate).map(events => events.length);
  const avgDaily = avg(dailyCounts);
  const maxDay = Math.max(...dailyCounts);

  if (avgDaily >= 3 || maxDay >= 6) {
    const moods = db.getMoodEntriesInWindow(startTs, endTs);
    const avgMood = moods.length > 0 ? avg(moods.map(m => m.score)) : null;

    const moodNote = avgMood !== null && avgMood < 3.5
      ? ` Meanwhile, your mood averaged ${avgMood.toFixed(1)}/5. Coincidence?`
      : '';

    results.push({
      id: '', title: `Your calendar owns you`,
      insight: `${calEvents.length} calendar events with an average of ${avgDaily.toFixed(1)} per day. Peak day had ${maxDay} events.${moodNote} When do you have time to think?`,
      severity: Math.min(0.3 + avgDaily / 8, 0.75),
      dataPoints: [
        { label: 'Total events', value: `${calEvents.length}` },
        { label: 'Average/day', value: avgDaily.toFixed(1) },
        { label: 'Busiest day', value: `${maxDay} events` },
      ],
      relatedEventIds: calEvents.slice(0, 3).map(c => c.event_id),
      category: 'correlation',
      generatedAt: '',
    });
  }

  return results;
}

// ── Helpers ──

function groupByDate<T>(items: T[], getTimestamp: (item: T) => string): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const date = getTimestamp(item).slice(0, 10);
    if (!groups[date]) groups[date] = [];
    groups[date].push(item);
  }
  return groups;
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
