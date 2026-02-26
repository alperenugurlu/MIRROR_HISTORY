import * as db from '../database';
import { chat, isAIConfigured } from './ai-engine';
import type { MemorySearchResult, SemanticSearchResult, TimelineEntry, Event, EventType, DailyNarrative } from '../types';

// ── Shared enrichment helper ──

function enrichSearchResult(result: MemorySearchResult, event: Event): void {
  if (event.type === 'note' || event.type === 'thought' || event.type === 'decision' || event.type === 'observation') {
    result.note = db.getNoteByEvent(event.id);
  } else if (event.type === 'voice_memo') {
    result.voice_memo = db.getVoiceMemoByEvent(event.id);
  } else if (event.type === 'money_transaction') {
    const txs = db.getTransactions();
    result.transaction = txs.find(t => t.event_id === event.id);
  } else if (event.type === 'location') {
    result.location = db.getLocationByEvent(event.id);
  } else if (event.type === 'calendar_event') {
    result.calendar_event = db.getCalendarEventByEvent(event.id);
  } else if (event.type === 'health_entry') {
    result.health_entry = db.getHealthEntryByEvent(event.id);
  } else if (event.type === 'mood') {
    result.mood = db.getMoodByEvent(event.id);
  }
}

// ── FTS5 Keyword Search ──

export function searchMemories(query: string, limit = 50): MemorySearchResult[] {
  const ftsResults = db.searchFTS(query, limit);

  const results: MemorySearchResult[] = [];
  for (const fts of ftsResults) {
    const event = db.getEvent(fts.event_id);
    if (!event) continue;

    const result: MemorySearchResult = {
      event,
      snippet: fts.snippet,
      rank: fts.rank,
    };

    enrichSearchResult(result, event);
    results.push(result);
  }

  return results;
}

// ── Hybrid Semantic Search (FTS5 + Vector Cosine Similarity) ──

export async function semanticSearch(query: string, limit = 20): Promise<SemanticSearchResult[]> {
  const { isEmbeddingConfigured, embedText, vectorSearch } = await import('./embedding-engine');

  // Always get FTS5 results
  const ftsResults = db.searchFTS(query, limit * 2);

  // Try vector search if configured and embeddings exist
  let vectorResults: { event_id: string; score: number }[] = [];
  if (isEmbeddingConfigured() && db.getEmbeddingCount() > 0) {
    try {
      const queryEmbedding = await embedText(query);
      vectorResults = vectorSearch(queryEmbedding, limit * 2);
    } catch (err) {
      console.error('Vector search failed, falling back to FTS:', err);
    }
  }

  // Merge results with weighted scoring
  const scoreMap = new Map<string, { fts: number; vector: number }>();

  // Normalize FTS scores (position-based: best = 1.0, worst = ~0)
  for (let i = 0; i < ftsResults.length; i++) {
    const score = 1 - (i / Math.max(ftsResults.length, 1));
    scoreMap.set(ftsResults[i].event_id, { fts: score, vector: 0 });
  }

  // Add vector scores
  for (const v of vectorResults) {
    const existing = scoreMap.get(v.event_id);
    if (existing) {
      existing.vector = v.score;
    } else {
      scoreMap.set(v.event_id, { fts: 0, vector: v.score });
    }
  }

  // Combine: vector captures semantics, FTS captures keywords
  const combined = [...scoreMap.entries()].map(([eventId, scores]) => {
    const hasVector = scores.vector > 0;
    const hasFts = scores.fts > 0;

    let combinedScore: number;
    if (hasVector && hasFts) {
      combinedScore = scores.vector * 0.6 + scores.fts * 0.4;
    } else if (hasVector) {
      combinedScore = scores.vector * 0.8;
    } else {
      combinedScore = scores.fts * 0.8;
    }

    return { eventId, score: combinedScore };
  });

  combined.sort((a, b) => b.score - a.score);

  // Enrich top results
  const results: SemanticSearchResult[] = [];
  for (const item of combined.slice(0, limit)) {
    const event = db.getEvent(item.eventId);
    if (!event) continue;

    const ftsMatch = ftsResults.find(f => f.event_id === item.eventId);
    const snippet = ftsMatch?.snippet || event.summary.slice(0, 150);

    const result: SemanticSearchResult = {
      event,
      snippet,
      rank: ftsMatch?.rank || 0,
      score: item.score,
    };

    enrichSearchResult(result, event);
    results.push(result);
  }

  return results;
}

export function getTimeline(startDate: string, endDate: string): TimelineEntry[] {
  const events = db.getEventsByDateRange(startDate, endDate);

  // Group by date
  const byDate = new Map<string, Event[]>();
  for (const event of events) {
    const date = event.timestamp.slice(0, 10);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(event);
  }

  const timeline: TimelineEntry[] = [];
  for (const [date, dateEvents] of byDate) {
    const enrichedEvents = dateEvents.map(event => {
      const enriched: TimelineEntry['events'][0] = { ...event };

      if (event.type === 'note' || event.type === 'thought' || event.type === 'decision' || event.type === 'observation') {
        enriched.note = db.getNoteByEvent(event.id);
      } else if (event.type === 'voice_memo') {
        enriched.voice_memo = db.getVoiceMemoByEvent(event.id);
      } else if (event.type === 'money_transaction') {
        const txs = db.getTransactions();
        enriched.transaction = txs.find(t => t.event_id === event.id);
      } else if (event.type === 'location') {
        enriched.location = db.getLocationByEvent(event.id);
      } else if (event.type === 'calendar_event') {
        enriched.calendar_event = db.getCalendarEventByEvent(event.id);
      } else if (event.type === 'health_entry') {
        enriched.health_entry = db.getHealthEntryByEvent(event.id);
      } else if (event.type === 'mood') {
        enriched.mood = db.getMoodByEvent(event.id);
      }

      return enriched;
    });

    timeline.push({ date, events: enrichedEvents });
  }

  // Sort by date descending
  timeline.sort((a, b) => b.date.localeCompare(a.date));
  return timeline;
}

export function remember(query: string): MemorySearchResult[] {
  return searchMemories(query);
}

export function getRecentMemories(limit = 20): Event[] {
  return db.getAllEventsPaginated(limit, 0);
}

export function getFilteredTimeline(
  startDate: string, endDate: string, types?: EventType[],
): TimelineEntry[] {
  let events = db.getEventsByDateRange(startDate, endDate);
  if (types && types.length > 0) {
    events = events.filter(e => (types as string[]).includes(e.type));
  }

  const byDate = new Map<string, Event[]>();
  for (const event of events) {
    const date = event.timestamp.slice(0, 10);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(event);
  }

  const timeline: TimelineEntry[] = [];
  for (const [date, dateEvents] of byDate) {
    const enrichedEvents = dateEvents.map(event => {
      const enriched: TimelineEntry['events'][0] = { ...event };
      if (event.type === 'note' || event.type === 'thought' || event.type === 'decision' || event.type === 'observation') {
        enriched.note = db.getNoteByEvent(event.id);
      } else if (event.type === 'voice_memo') {
        enriched.voice_memo = db.getVoiceMemoByEvent(event.id);
      } else if (event.type === 'money_transaction') {
        const txs = db.getTransactions();
        enriched.transaction = txs.find(t => t.event_id === event.id);
      } else if (event.type === 'location') {
        enriched.location = db.getLocationByEvent(event.id);
      } else if (event.type === 'calendar_event') {
        enriched.calendar_event = db.getCalendarEventByEvent(event.id);
      } else if (event.type === 'health_entry') {
        enriched.health_entry = db.getHealthEntryByEvent(event.id);
      } else if (event.type === 'mood') {
        enriched.mood = db.getMoodByEvent(event.id);
      }
      return enriched;
    });
    timeline.push({ date, events: enrichedEvents });
  }

  timeline.sort((a, b) => b.date.localeCompare(a.date));
  return timeline;
}

export function getMemoryStats(): {
  totalEvents: number;
  notes: number;
  voiceMemos: number;
  transactions: number;
  locations: number;
  calendarEvents: number;
  healthEntries: number;
  moods: number;
} {
  return {
    totalEvents: db.getEventCount(),
    notes: db.getNotes(999999).length,
    voiceMemos: db.getVoiceMemos(999999).length,
    transactions: db.getTransactionCount(),
    locations: db.getLocationCount(),
    calendarEvents: db.getCalendarEventCount(),
    healthEntries: db.getHealthEntryCount(),
    moods: db.getMoodEntries(999999).length,
  };
}

// ── Phase 4: Daily Narrative ──

export async function getDailyNarrative(date: string): Promise<DailyNarrative> {
  const nextDay = new Date(date + 'T00:00:00');
  nextDay.setDate(nextDay.getDate() + 1);
  const endDate = nextDay.toISOString().slice(0, 10);

  // Gather all data for this day
  const events = db.getEventsByDateRange(date, endDate);
  const moods = db.getMoodByDateRange(date, endDate);
  const transactions = db.getTransactions(date, endDate);
  const calendarEvents = db.getCalendarEventsByDateRange(date, endDate);
  const healthEntries = db.getHealthEntriesByDateRange(date, endDate);
  const notes = db.getNotesByDateRange(date, endDate);
  const voiceMemos = db.getVoiceMemosByDateRange(date, endDate);

  const eventCount = events.length;
  const moodAvg = moods.length > 0
    ? moods.reduce((s, m) => s + m.score, 0) / moods.length
    : null;

  // Count dominant types
  const typeCounts = new Map<string, number>();
  for (const e of events) {
    typeCounts.set(e.type, (typeCounts.get(e.type) || 0) + 1);
  }
  const dominantTypes = [...typeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => t);

  // If no events, return empty narrative
  if (eventCount === 0) {
    return { date, narrative: 'No recorded memories for this day.', moodAvg, eventCount, dominantTypes };
  }

  // If AI not configured, build a simple summary
  if (!isAIConfigured()) {
    const parts: string[] = [];
    if (moods.length > 0) parts.push(`Mood: ${moods.map(m => `${m.score}/5`).join(', ')}`);
    if (transactions.length > 0) {
      const total = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
      parts.push(`$${total.toFixed(2)} spent`);
    }
    if (calendarEvents.length > 0) parts.push(`${calendarEvents.length} calendar events`);
    if (healthEntries.length > 0) parts.push(`${healthEntries.length} health entries`);
    if (notes.length > 0) parts.push(`${notes.length} notes`);
    if (voiceMemos.length > 0) parts.push(`${voiceMemos.length} voice memos`);
    return { date, narrative: parts.join(' \u2022 '), moodAvg, eventCount, dominantTypes };
  }

  // Build prompt for AI narrative
  let prompt = `Write a 2-3 sentence narrative summary of this day (${date}). Speak in second person. Be warm and observational. Connect dots between different events.\n\n`;

  if (moods.length > 0) {
    prompt += `Mood: ${moods.map(m => `${m.score}/5${m.note ? ' (' + m.note + ')' : ''}`).join(', ')}\n`;
  }
  if (transactions.length > 0) {
    const total = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    prompt += `Spending: $${total.toFixed(2)} at ${transactions.map(t => t.merchant).join(', ')}\n`;
  }
  if (calendarEvents.length > 0) {
    prompt += `Calendar: ${calendarEvents.map(c => c.title).join(', ')}\n`;
  }
  if (healthEntries.length > 0) {
    prompt += `Health: ${healthEntries.map(h => `${h.metric_type}: ${h.value} ${h.unit}`).join(', ')}\n`;
  }
  if (notes.length > 0) {
    prompt += `Notes: ${notes.map(n => '"' + n.content.slice(0, 80) + '"').join(', ')}\n`;
  }
  if (voiceMemos.length > 0) {
    for (const v of voiceMemos) {
      if (v.transcript) {
        prompt += `Voice memo: "${v.transcript.slice(0, 120)}"\n`;
      }
    }
  }

  prompt += `\nKeep it to 2-3 sentences maximum. No headers, no bullet points \u2014 just a flowing narrative.`;

  try {
    const { assistantMsg } = await chat(prompt);
    return { date, narrative: assistantMsg.content, moodAvg, eventCount, dominantTypes };
  } catch {
    // Fallback if AI fails
    return { date, narrative: `${eventCount} events recorded.`, moodAvg, eventCount, dominantTypes };
  }
}
