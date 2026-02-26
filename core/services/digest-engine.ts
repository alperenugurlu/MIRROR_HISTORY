import { chat, isAIConfigured } from './ai-engine';
import * as db from '../database';
import { broadcast } from '../event-bus';
import { subDays, format } from 'date-fns';
import type { AIDigest, DigestPeriod } from '../types';

function buildDigestPrompt(
  period: DigestPeriod,
  startStr: string,
  endStr: string,
): string {
  const transactions = db.getTransactions(startStr, endStr);
  const moods = db.getMoodByDateRange(startStr, endStr);
  const locations = db.getLocationsByDateRange(startStr, endStr);
  const calendarEvents = db.getCalendarEventsByDateRange(startStr, endStr);
  const healthEntries = db.getHealthEntriesByDateRange(startStr, endStr);
  const notes = db.getNotesByDateRange ? db.getNotesByDateRange(startStr, endStr) : [];
  const voiceMemos = db.getVoiceMemosByDateRange ? db.getVoiceMemosByDateRange(startStr, endStr) : [];

  const totalSpent = transactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const periodLabel = period === 'weekly' ? 'week' : 'month';

  let prompt = `You are writing a ${periodLabel}ly life story for ${startStr} to ${endStr}. This is NOT a data report \u2014 it's a personal narrative that helps the user understand how their ${periodLabel} went.

Write it as a story with these sections:
1. **How your ${periodLabel} went** \u2014 A 2-3 sentence opening that captures the overall feel
2. **Key moments** \u2014 The most significant events, decisions, or experiences
3. **Emotional arc** \u2014 How mood changed throughout the period and what might have caused it
4. **Patterns I noticed** \u2014 Cross-domain connections (mood vs spending, health vs calendar, etc.)
5. **Looking ahead** \u2014 One or two observations to keep in mind

Use second person ("you"). Be warm and insightful. Connect dots across domains.

Here is the raw data from their life:\n\n`;

  if (transactions.length > 0) {
    prompt += `SPENDING: $${totalSpent.toFixed(2)} across ${transactions.length} transactions.\n`;
    const merchants = new Map<string, number>();
    for (const t of transactions) {
      if (t.amount < 0) {
        merchants.set(t.merchant, (merchants.get(t.merchant) || 0) + Math.abs(t.amount));
      }
    }
    const topMerchants = [...merchants.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    prompt += `Top merchants: ${topMerchants.map(([m, a]) => `${m} ($${a.toFixed(2)})`).join(', ')}\n`;
    // Daily spending pattern
    const dailySpend = new Map<string, number>();
    for (const t of transactions) {
      if (t.amount < 0) {
        const day = t.date.slice(0, 10);
        dailySpend.set(day, (dailySpend.get(day) || 0) + Math.abs(t.amount));
      }
    }
    const sortedDays = [...dailySpend.entries()].sort((a, b) => b[1] - a[1]);
    if (sortedDays.length > 0) {
      prompt += `Highest spending day: ${sortedDays[0][0]} ($${sortedDays[0][1].toFixed(2)})\n`;
    }
    prompt += '\n';
  }

  if (moods.length > 0) {
    const avgMood = moods.reduce((s, m) => s + m.score, 0) / moods.length;
    const minMood = Math.min(...moods.map(m => m.score));
    const maxMood = Math.max(...moods.map(m => m.score));
    prompt += `MOOD: ${moods.length} entries, average ${avgMood.toFixed(1)}/5 (range: ${minMood}\u2013${maxMood})\n`;
    prompt += moods.map(m => `- ${m.score}/5 ${m.note || ''} (${m.timestamp.slice(0, 10)})`).join('\n') + '\n\n';
  }

  if (locations.length > 0) {
    const uniqueAddresses = [...new Set(locations.map(l => l.address).filter(Boolean))];
    prompt += `PLACES VISITED: ${uniqueAddresses.length} unique places from ${locations.length} records\n`;
    if (uniqueAddresses.length > 0) {
      prompt += `${uniqueAddresses.slice(0, 10).join(', ')}\n\n`;
    }
  }

  if (calendarEvents.length > 0) {
    prompt += `CALENDAR: ${calendarEvents.length} events\n`;
    prompt += calendarEvents.slice(0, 15).map(c => `- ${c.title}${c.location ? ' @ ' + c.location : ''} (${c.start_time.slice(0, 10)})`).join('\n') + '\n\n';
  }

  if (healthEntries.length > 0) {
    const byType = new Map<string, number[]>();
    for (const h of healthEntries) {
      if (!byType.has(h.metric_type)) byType.set(h.metric_type, []);
      byType.get(h.metric_type)!.push(h.value);
    }
    prompt += `HEALTH:\n`;
    for (const [type, values] of byType) {
      const avg = values.reduce((s, v) => s + v, 0) / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);
      prompt += `- ${type}: avg ${avg.toFixed(1)} (range: ${min}\u2013${max}), ${values.length} entries\n`;
    }
    prompt += '\n';
  }

  if (notes.length > 0) {
    prompt += `NOTES & THOUGHTS: ${notes.length} entries\n`;
    for (const n of notes.slice(0, 10)) {
      prompt += `- "${n.content.slice(0, 100)}" (${n.created_at.slice(0, 10)})\n`;
    }
    prompt += '\n';
  }

  if (voiceMemos.length > 0) {
    prompt += `VOICE MEMOS: ${voiceMemos.length} recordings\n`;
    for (const v of voiceMemos.slice(0, 5)) {
      if (v.transcript) {
        prompt += `- "${v.transcript.slice(0, 100)}" (${v.created_at.slice(0, 10)}, ${v.duration_seconds}s)\n`;
      }
    }
    prompt += '\n';
  }

  prompt += `Use the same language as the user's previous messages, or English by default.`;

  return prompt;
}

export async function generateDigest(period: DigestPeriod): Promise<AIDigest> {
  if (!isAIConfigured()) {
    throw new Error('AI not configured. Set your Anthropic API key first.');
  }

  const now = new Date();
  const days = period === 'weekly' ? 7 : 30;
  const start = subDays(now, days);
  const startStr = format(start, 'yyyy-MM-dd');
  const endStr = format(now, 'yyyy-MM-dd');

  const prompt = buildDigestPrompt(period, startStr, endStr);
  const { assistantMsg } = await chat(prompt);

  const event = db.insertEvent(
    'ai_digest', now.toISOString(),
    `${period} digest: ${startStr} to ${endStr}`,
    { period, startStr, endStr },
    1.0, 'local_private',
  );

  const digest = db.insertAIDigest(event.id, period, startStr, endStr, assistantMsg.content);

  db.logActivity('digest_generated', `${period} digest generated for ${startStr} — ${endStr}`, {
    period, start: startStr, end: endStr,
  });
  broadcast('digest_generated', { period, start: startStr, end: endStr });

  return digest;
}

export function getDigests(limit = 20): AIDigest[] {
  return db.getAIDigests(limit);
}
