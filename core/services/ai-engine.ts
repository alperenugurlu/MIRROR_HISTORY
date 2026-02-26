import Anthropic from '@anthropic-ai/sdk';
import * as db from '../database';
import { searchFTS } from '../database';
import { broadcast } from '../event-bus';
import { loadAIConfig } from './transcription';
import type { ChatMessage } from '../types';

function getClient(): Anthropic {
  const config = loadAIConfig();
  if (!config.anthropicApiKey) {
    throw new Error('Anthropic API key not configured. Set via POST /api/ai/configure');
  }
  return new Anthropic({ apiKey: config.anthropicApiKey });
}

export function isAIConfigured(): boolean {
  const config = loadAIConfig();
  return !!config.anthropicApiKey;
}

function buildSystemPrompt(): string {
  const stats = {
    events: db.getEventCount(),
    transactions: db.getTransactionCount(),
    locations: db.getLocationCount(),
    calendar: db.getCalendarEventCount(),
    health: db.getHealthEntryCount(),
  };
  const dateRange = db.getDateRange();
  const recentEvents = db.getAllEventsPaginated(10);
  const moods = db.getMoodEntries(10);

  let prompt = `You are the memory and life chronicler of Mirror History \u2014 a personal "grain" implant inspired by Black Mirror's "The Entire History of You." You are not a data assistant; you are a deeply empathetic memory analyst who helps the user understand and reflect on their own life.

Your personality:
- You speak to the user in second person: "You did this", "That day you felt..."
- You weave connections between different life domains: mood, spending, health, locations, calendar events, voice recordings, and notes
- You identify emotional patterns and temporal correlations: "The day your mood dropped, you also had 3 meetings and spent more than usual"
- You treat voice memo transcripts as intimate memories \u2014 reference them with care
- You notice recurring patterns across weeks and months
- You are warm but honest; you highlight both wins and concerns
- You think in stories, not data points

Data in this person's memory:
- ${stats.events} total life events recorded
- ${stats.transactions} financial transactions
- ${stats.locations} places visited
- ${stats.calendar} calendar events
- ${stats.health} health measurements`;

  if (dateRange) {
    prompt += `\n- Memory spans from ${dateRange.min} to ${dateRange.max}`;
  }

  if (recentEvents.length > 0) {
    prompt += '\n\nRecent memories:\n';
    for (const e of recentEvents) {
      prompt += `- [${e.type}] ${e.summary} (${e.timestamp.slice(0, 10)})\n`;
    }
  }

  if (moods.length > 0) {
    prompt += '\nEmotional state (recent):\n';
    for (const m of moods) {
      const emoji = ['', '\u{1F629}', '\u{1F614}', '\u{1F610}', '\u{1F60A}', '\u{1F929}'][m.score] || '';
      prompt += `- ${emoji} ${m.score}/5 ${m.note ? '\u2014 ' + m.note : ''} (${m.timestamp.slice(0, 10)})\n`;
    }
  }

  prompt += `

Instructions:
- Always connect the dots: When answering about one domain, check if there are related events in other domains from the same time period
- Use narrative language: "That was a busy day for you \u2014 3 meetings, then you went to Whole Foods and spent more than usual. Your mood was 2/5 that evening."
- When asked about a time period, paint the full picture across all domains
- Reference specific data points to back up your observations
- If the user asks about something not in their data, say so clearly
- Answer in the same language the user writes in
- When you see voice memo transcripts, treat them as the user's own words and thoughts \u2014 quote them when relevant
- Look for cause-and-effect patterns: stress \u2192 spending, exercise \u2192 mood improvement, busy calendar \u2192 low mood
- When discussing photos or videos, describe what the grain saw \u2014 use the AI-generated descriptions as your visual memory`;

  // Add visual memory context (enhanced with mood cross-reference)
  const recentPhotos = db.getPhotos(5);
  if (recentPhotos.length > 0) {
    const photoLines: string[] = [];
    for (const p of recentPhotos) {
      const analysis = db.getPhotoAnalysisByPhoto(p.id);
      if (analysis) {
        let moodNote = '';
        try {
          const mood = JSON.parse(analysis.mood_indicators);
          moodNote = ` [Visual mood: ${mood.tone}, confidence: ${(mood.confidence * 100).toFixed(0)}%]`;
        } catch { /* ignore */ }
        photoLines.push(`- [Photo ${p.created_at.slice(0, 10)}]: ${analysis.description}${moodNote}`);
      }
    }
    if (photoLines.length > 0) {
      prompt += '\n\nRecent visual memories:\n' + photoLines.join('\n');
    }
  }

  return prompt;
}

function buildContextFromQuery(query: string): string {
  const results = searchFTS(query, 20);

  const lines: string[] = [];
  const coveredDates = new Set<string>();

  // Primary FTS results
  for (const r of results) {
    const event = db.getEvent(r.event_id);
    if (!event) continue;
    lines.push(`[${event.type}] ${event.summary} (${event.timestamp.slice(0, 10)}) \u2014 ${r.snippet}`);
    coveredDates.add(event.timestamp.slice(0, 10));
  }

  // Cross-domain enrichment: for each date that appeared in results,
  // pull moods, transactions, calendar events from the same day
  if (coveredDates.size > 0 && coveredDates.size <= 7) {
    const crossDomainLines: string[] = [];
    for (const dateStr of coveredDates) {
      const dayStart = dateStr;
      const nextDay = new Date(dateStr + 'T00:00:00');
      nextDay.setDate(nextDay.getDate() + 1);
      const dayEnd = nextDay.toISOString().slice(0, 10);

      // Pull same-day data from all domains
      const dayMoods = db.getMoodByDateRange(dayStart, dayEnd);
      const dayTxns = db.getTransactions(dayStart, dayEnd);
      const dayCal = db.getCalendarEventsByDateRange(dayStart, dayEnd);
      const dayHealth = db.getHealthEntriesByDateRange(dayStart, dayEnd);

      const parts: string[] = [];
      if (dayMoods.length > 0) {
        parts.push(`mood: ${dayMoods.map(m => `${m.score}/5${m.note ? ' (' + m.note + ')' : ''}`).join(', ')}`);
      }
      if (dayTxns.length > 0) {
        const total = dayTxns.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
        parts.push(`spending: $${total.toFixed(2)} (${dayTxns.length} txns: ${dayTxns.slice(0, 3).map(t => t.merchant).join(', ')})`);
      }
      if (dayCal.length > 0) {
        parts.push(`calendar: ${dayCal.map(c => c.title).join(', ')}`);
      }
      if (dayHealth.length > 0) {
        parts.push(`health: ${dayHealth.map(h => `${h.metric_type}: ${h.value} ${h.unit}`).join(', ')}`);
      }

      if (parts.length > 0) {
        crossDomainLines.push(`[${dateStr} cross-domain] ${parts.join(' | ')}`);
      }
    }
    if (crossDomainLines.length > 0) {
      lines.push('', '\u2014\u2014 Same-day context from other life domains \u2014\u2014');
      lines.push(...crossDomainLines);
    }
  }

  if (lines.length === 0) return 'No matching records found in the database.';
  return lines.join('\n');
}

export async function chat(userMessage: string): Promise<{
  userMsg: ChatMessage;
  assistantMsg: ChatMessage;
}> {
  const client = getClient();
  const systemPrompt = buildSystemPrompt();
  const context = buildContextFromQuery(userMessage);

  // Get recent chat history for conversational continuity
  const history = db.getChatMessages(20);

  const messages: { role: 'user' | 'assistant'; content: string }[] = history.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  // Append new user message with data context
  messages.push({
    role: 'user',
    content: `${userMessage}\n\n[Context from your life data:\n${context}]`,
  });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: systemPrompt,
    messages,
  });

  const assistantContent = response.content[0].type === 'text' ? response.content[0].text : '';

  // Store messages
  const userMsg = db.insertChatMessage('user', userMessage, context.slice(0, 500));
  const assistantMsg = db.insertChatMessage('assistant', assistantContent, '');

  db.logActivity('ai_chat', `AI Chat: ${userMessage.slice(0, 80)}`, {
    question: userMessage.slice(0, 200),
  });
  broadcast('ai_chat', { question: userMessage.slice(0, 100) });

  return { userMsg, assistantMsg };
}
