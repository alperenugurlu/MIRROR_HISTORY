import { Bot, Context } from 'grammy';
import fs from 'fs';
import path from 'path';
import os from 'os';
import * as db from '../core/database';
import { generateDiff } from '../core/services/diff-engine';
import { createNote, createVoiceMemo } from '../core/services/note-engine';
import { searchMemories, getMemoryStats } from '../core/services/memory-engine';
import { transcribeAudio, isTranscriptionConfigured } from '../core/services/transcription';
import { chat, isAIConfigured } from '../core/services/ai-engine';
import { recordMood } from '../core/services/mood-engine';
import { generateDigest } from '../core/services/digest-engine';
import { savePhoto } from '../core/services/photo-engine';
import { eventBus, type MirrorHistoryEvent } from '../core/event-bus';
import { loadTelegramConfig, type TelegramConfig } from './telegram-config';

let bot: Bot | null = null;
let config: TelegramConfig | null = null;
let scheduledIntervals: ReturnType<typeof setInterval>[] = [];

const VOICE_DIR = path.join(os.homedir(), '.mirror-history', 'voice');
const PHOTO_DIR = path.join(os.homedir(), '.mirror-history', 'photos');

function isAllowed(ctx: Context): boolean {
  if (!config || config.allowedChatIds.length === 0) return false;
  const chatId = ctx.chat?.id;
  return chatId !== undefined && config.allowedChatIds.includes(chatId);
}

export async function startTelegramBot(): Promise<Bot | null> {
  config = loadTelegramConfig();
  if (!config || !config.botToken) {
    console.log('[Telegram] No bot token configured. Skipping bot startup.');
    console.log('[Telegram] Configure via POST /api/telegram/configure');
    return null;
  }

  if (config.allowedChatIds.length === 0) {
    console.warn('[Telegram] WARNING: No allowedChatIds configured. Bot will reject all messages.');
    console.warn('[Telegram] Configure chat IDs via POST /api/telegram/configure');
  }

  bot = new Bot(config.botToken);

  // ── /start ──
  bot.command('start', async (ctx) => {
    if (!isAllowed(ctx)) return;
    const chatId = ctx.chat?.id;
    await ctx.reply(
      `Welcome to Mirror History \u{1F9E0}\n\n` +
      `Your chat ID: ${chatId}\n\n` +
      `*Money:*\n` +
      `/diff \u2014 Monthly spending diff\n` +
      `/status \u2014 System status\n\n` +
      `*Memory:*\n` +
      `/note <text> \u2014 Save a note\n` +
      `/thought <text> \u2014 Record a thought\n` +
      `/decision <text> \u2014 Log a decision\n` +
      `/remember <query> \u2014 Search your memories\n\n` +
      `*AI:*\n` +
      `/ask <question> \u2014 Ask about your life (AI)\n` +
      `/weekly \u2014 AI weekly digest\n\n` +
      `*Tracking:*\n` +
      `/mood <1-5> [note] \u2014 Record your mood\n\n` +
      `*Capture:*\n` +
      `\u{1F3A4} Voice messages \u2014 Transcribed & saved\n` +
      `\u{1F4CD} Location share \u2014 Saved as location event\n` +
      `\u{1F4F7} Photos \u2014 Saved with optional caption\n` +
      `\u{1F4DD} Plain text \u2014 Saved as quick note`,
      { parse_mode: 'Markdown' }
    );
  });

  // ── /note <text> ──
  bot.command('note', async (ctx) => {
    if (!isAllowed(ctx)) return;
    const text = ctx.match?.trim();
    if (!text) {
      await ctx.reply('Usage: /note <your note text>');
      return;
    }
    const { note } = createNote(text, 'telegram');
    await ctx.reply(`\u{1F4DD} Note saved.\n\n_"${text.length > 100 ? text.slice(0, 100) + '...' : text}"_`, { parse_mode: 'Markdown' });
  });

  // ── /thought <text> ──
  bot.command('thought', async (ctx) => {
    if (!isAllowed(ctx)) return;
    const text = ctx.match?.trim();
    if (!text) {
      await ctx.reply('Usage: /thought <your thought>');
      return;
    }
    createNote(text, 'telegram', ['thought']);
    await ctx.reply(`\u{1F4AD} Thought recorded.`);
  });

  // ── /decision <text> ──
  bot.command('decision', async (ctx) => {
    if (!isAllowed(ctx)) return;
    const text = ctx.match?.trim();
    if (!text) {
      await ctx.reply('Usage: /decision <your decision>');
      return;
    }
    createNote(text, 'telegram', ['decision']);
    await ctx.reply(`\u{2696}\u{FE0F} Decision logged.`);
  });

  // ── /remember <query> ──
  bot.command('remember', async (ctx) => {
    if (!isAllowed(ctx)) return;
    const query = ctx.match?.trim();
    if (!query) {
      await ctx.reply('Usage: /remember <search query>');
      return;
    }

    const results = searchMemories(query, 10);
    if (results.length === 0) {
      await ctx.reply(`No memories found for "${query}".`);
      return;
    }

    let message = `\u{1F50D} *Found ${results.length} memories:*\n\n`;
    for (const r of results.slice(0, 10)) {
      const date = r.event.timestamp.slice(0, 10);
      const icon = memoryIcon(r.event.type);
      message += `${icon} *${date}*: ${r.snippet}\n\n`;
    }

    await ctx.reply(message, { parse_mode: 'Markdown' });
  });

  // ── /ask <question> (AI-powered) ──
  bot.command('ask', async (ctx) => {
    if (!isAllowed(ctx)) return;
    const question = ctx.match?.trim();
    if (!question) {
      await ctx.reply('Usage: /ask <your question about your life>');
      return;
    }

    if (!isAIConfigured()) {
      // Fallback to search
      const results = searchMemories(question, 5);
      if (results.length === 0) {
        await ctx.reply('AI not configured and no matching data found. Set your Anthropic API key via /api/ai/configure');
        return;
      }
      let message = `\u{1F50D} (AI not configured, showing search results):\n\n`;
      for (const r of results.slice(0, 5)) {
        message += `\u{2022} *${r.event.timestamp.slice(0, 10)}*: ${r.snippet}\n`;
      }
      await ctx.reply(message, { parse_mode: 'Markdown' });
      return;
    }

    await ctx.reply('Thinking...');
    try {
      const { assistantMsg } = await chat(question);
      await ctx.reply(assistantMsg.content, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('[Telegram] AI chat error:', err);
      await ctx.reply('Error processing your question. Check server logs.');
    }
  });

  // ── /mood <1-5> [note] ──
  bot.command('mood', async (ctx) => {
    if (!isAllowed(ctx)) return;
    const input = ctx.match?.trim();
    if (!input) {
      await ctx.reply('Usage: /mood <1-5> [optional note]\nExample: /mood 4 Productive day');
      return;
    }
    const parts = input.split(/\s+/);
    const score = parseInt(parts[0], 10);
    if (isNaN(score) || score < 1 || score > 5) {
      await ctx.reply('Score must be 1-5. Example: /mood 3 Feeling okay');
      return;
    }
    const note = parts.slice(1).join(' ');
    recordMood(score, note);
    const moodEmoji = ['', '\u{1F629}', '\u{1F614}', '\u{1F610}', '\u{1F60A}', '\u{1F929}'];
    await ctx.reply(`${moodEmoji[score]} Mood recorded: ${score}/5${note ? '\n' + note : ''}`);
  });

  // ── /weekly ──
  bot.command('weekly', async (ctx) => {
    if (!isAllowed(ctx)) return;
    if (!isAIConfigured()) {
      await ctx.reply('AI not configured. Set your Anthropic API key first.');
      return;
    }
    await ctx.reply('Generating weekly digest...');
    try {
      const digest = await generateDigest('weekly');
      await ctx.reply(digest.content, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('[Telegram] Digest error:', err);
      await ctx.reply('Error generating digest. Check server logs.');
    }
  });

  // ── /diff ──
  bot.command('diff', async (ctx) => {
    if (!isAllowed(ctx)) return;

    try {
      const txCount = db.getTransactionCount();
      if (txCount === 0) {
        await ctx.reply('No transactions imported yet. Import a CSV first.');
        return;
      }

      await ctx.reply('Generating monthly diff...');

      const refDate = new Date().toISOString().slice(0, 10);
      const result = generateDiff('monthly', refDate);

      let message = `*${result.summary}*\n\n`;
      message += `Total: $${result.total_spent.toFixed(2)}`;
      if (result.baseline_spent > 0) {
        message += ` (${result.change_pct >= 0 ? '+' : ''}${result.change_pct}% vs prev)`;
      }
      message += '\n\n';

      for (const card of result.cards) {
        if (card.type === 'spending_summary') continue;
        const icon = cardIcon(card.type);
        message += `${icon} *${card.title}*\n${card.summary}\n\n`;
      }

      if (result.cards.length <= 1) {
        message += 'No significant findings this period.';
      }

      await ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('[Telegram] Error generating diff:', err);
      await ctx.reply('Error generating diff. Check server logs.');
    }
  });

  // ── /status ──
  bot.command('status', async (ctx) => {
    if (!isAllowed(ctx)) return;

    const stats = getMemoryStats();
    const txCount = db.getTransactionCount();
    const dateRange = db.getDateRange();
    const subs = db.getSubscriptions();

    let message = `*Mirror History Status* \u{1F9E0}\n\n`;
    message += `*Memory:*\n`;
    message += `  Total events: ${stats.totalEvents}\n`;
    message += `  Notes: ${stats.notes}\n`;
    message += `  Voice memos: ${stats.voiceMemos}\n`;
    message += `  Transactions: ${stats.transactions}\n\n`;
    message += `*Money:*\n`;
    message += `  Transactions: ${txCount}\n`;
    if (dateRange) {
      message += `  Date range: ${dateRange.min} \u2192 ${dateRange.max}\n`;
    }
    message += `  Subscriptions: ${subs.length}\n\n`;
    message += `*Services:*\n`;
    message += `  Transcription: ${isTranscriptionConfigured() ? '\u2705' : '\u274C'}\n`;
    message += `  AI: ${isAIConfigured() ? '\u2705' : '\u274C'}\n`;
    message += `  API: \u2705 running`;

    await ctx.reply(message, { parse_mode: 'Markdown' });
  });

  // ── Voice message handler ──
  bot.on('message:voice', async (ctx) => {
    if (!isAllowed(ctx)) return;

    const voice = ctx.message.voice;
    const duration = voice.duration;

    await ctx.reply(`\u{1F3A4} Received voice memo (${duration}s). Processing...`);

    try {
      // Download voice file
      if (!fs.existsSync(VOICE_DIR)) fs.mkdirSync(VOICE_DIR, { recursive: true });

      const file = await ctx.getFile();
      const filePath = path.join(VOICE_DIR, `voice-${Date.now()}.ogg`);
      const fileUrl = `https://api.telegram.org/file/bot${config!.botToken}/${file.file_path}`;

      const response = await fetch(fileUrl);
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(filePath, buffer);

      // Transcribe if configured
      let transcript = '';
      if (isTranscriptionConfigured()) {
        try {
          transcript = await transcribeAudio(filePath);
          await ctx.reply(`\u{1F4AC} Transcript: _"${transcript}"_`, { parse_mode: 'Markdown' });
        } catch (err) {
          console.error('[Telegram] Transcription error:', err);
          await ctx.reply('Transcription failed. Saving audio without transcript.');
        }
      }

      // Save voice memo
      createVoiceMemo(transcript, duration, filePath, 'telegram');
      await ctx.reply(`\u{2705} Voice memo saved${transcript ? ' with transcript' : ''}.`);
    } catch (err) {
      console.error('[Telegram] Voice processing error:', err);
      await ctx.reply('Error processing voice memo. Check server logs.');
    }
  });

  // ── Location message handler ──
  bot.on('message:location', async (ctx) => {
    if (!isAllowed(ctx)) return;

    const location = ctx.message.location;
    const lat = location.latitude;
    const lng = location.longitude;
    const timestamp = new Date().toISOString();

    try {
      // Attempt reverse geocoding (simple approach)
      let address = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      try {
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`,
          { headers: { 'User-Agent': 'MirrorHistory/1.0' } }
        );
        if (geoRes.ok) {
          const geoData = await geoRes.json() as { display_name?: string };
          if (geoData.display_name) {
            address = geoData.display_name;
          }
        }
      } catch {
        // Geocoding failed, use coordinates
      }

      const summary = `Location: ${address.length > 80 ? address.slice(0, 80) + '...' : address}`;

      const event = db.insertEvent(
        'location',
        timestamp,
        summary,
        { source: 'telegram', lat, lng, address },
        1.0,
        'local_private',
      );

      db.insertLocation(event.id, lat, lng, address, timestamp, 'telegram');

      // Index for search
      db.indexForSearch(event.id, `location ${address}`);
      db.logActivity('location_shared', summary, { event_id: event.id, lat, lng });

      await ctx.reply(
        `\u{1F4CD} Location saved!\n\n` +
        `*Lat:* ${lat.toFixed(6)}\n` +
        `*Lng:* ${lng.toFixed(6)}\n` +
        `*Address:* ${address.length > 120 ? address.slice(0, 120) + '...' : address}`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      console.error('[Telegram] Location processing error:', err);
      await ctx.reply('Error saving location. Check server logs.');
    }
  });

  // ── Photo message handler ──
  bot.on('message:photo', async (ctx) => {
    if (!isAllowed(ctx)) return;

    try {
      // Get the largest photo (last in array)
      const photos = ctx.message.photo;
      const photo = photos[photos.length - 1];
      const caption = ctx.message.caption || '';

      await ctx.reply(`\u{1F4F7} Photo received. Saving...`);

      // Download photo
      if (!fs.existsSync(PHOTO_DIR)) fs.mkdirSync(PHOTO_DIR, { recursive: true });

      const file = await ctx.getFile();
      const ext = file.file_path?.split('.').pop() || 'jpg';
      const fileUrl = `https://api.telegram.org/file/bot${config!.botToken}/${file.file_path}`;

      const response = await fetch(fileUrl);
      const buffer = Buffer.from(await response.arrayBuffer());

      const filename = `telegram-${Date.now()}.${ext}`;
      const { event_id } = savePhoto(buffer, filename, caption, 'telegram');

      let replyMsg = `\u{2705} Photo saved.`;
      if (caption) {
        replyMsg += `\n_Caption: "${caption.length > 80 ? caption.slice(0, 80) + '...' : caption}"_`;
      }
      await ctx.reply(replyMsg, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('[Telegram] Photo processing error:', err);
      await ctx.reply('Error saving photo. Check server logs.');
    }
  });

  // ── Plain text as quick note ──
  bot.on('message:text', async (ctx) => {
    if (!isAllowed(ctx)) return;
    // Only treat as quick note if not a command
    const text = ctx.message.text;
    if (text.startsWith('/')) return;

    createNote(text, 'telegram');
    await ctx.reply(`\u{1F4DD} Saved.`);
  });

  // Subscribe to event bus for push notifications
  eventBus.on('mirror-history', async (payload: MirrorHistoryEvent) => {
    if (!config || !bot) return;
    if (!['diff_generated', 'csv_imported', 'note_created', 'voice_memo_created'].includes(payload.type)) return;

    const message = formatPushNotification(payload);
    if (!message) return;

    for (const chatId of config.allowedChatIds) {
      try {
        await bot.api.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      } catch (err) {
        console.error(`[Telegram] Failed to push to chat ${chatId}:`, err);
      }
    }
  });

  // ── Scheduled Push Notifications ──
  setupScheduledPush();

  // Start long-polling
  bot.start({
    onStart: () => console.log('[Telegram] Bot started (long-polling)'),
  });

  return bot;
}

// ── Scheduled Push: Mood prompt + Daily summary ──

function setupScheduledPush(): void {
  // Clear any existing intervals
  for (const interval of scheduledIntervals) {
    clearInterval(interval);
  }
  scheduledIntervals = [];

  // Check every 30 minutes for scheduled tasks
  const CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes
  let lastMoodPromptHour = -1;
  let lastDailySummaryDate = '';

  const interval = setInterval(async () => {
    if (!config || !bot || config.allowedChatIds.length === 0) return;

    const now = new Date();
    const hour = now.getHours();
    const todayStr = now.toISOString().slice(0, 10);

    // ── Mood Prompt: 10:00 and 19:00 ──
    if ((hour === 10 || hour === 19) && lastMoodPromptHour !== hour) {
      lastMoodPromptHour = hour;
      const greeting = hour === 10 ? 'Good morning' : 'Good evening';
      const message =
        `${greeting}! \u{1F60A} How are you feeling right now?\n\n` +
        `Reply with: /mood <1-5> [optional note]\n\n` +
        `1 = \u{1F629} Terrible\n` +
        `2 = \u{1F614} Bad\n` +
        `3 = \u{1F610} Okay\n` +
        `4 = \u{1F60A} Good\n` +
        `5 = \u{1F929} Great`;

      for (const chatId of config.allowedChatIds) {
        try {
          await bot.api.sendMessage(chatId, message);
        } catch (err) {
          console.error(`[Telegram] Failed to send mood prompt to ${chatId}:`, err);
        }
      }
    }

    // Reset mood prompt tracker at new hour
    if (hour !== 10 && hour !== 19) {
      lastMoodPromptHour = -1;
    }

    // ── Daily Summary: 22:00 ──
    if (hour === 22 && lastDailySummaryDate !== todayStr) {
      lastDailySummaryDate = todayStr;

      if (!isAIConfigured()) return;

      try {
        const { getDailyNarrative } = await import('../core/services/memory-engine');
        const narrative = await getDailyNarrative(todayStr);

        if (narrative && narrative.narrative && narrative.eventCount > 0) {
          const moodStr = narrative.moodAvg
            ? `\nMood avg: ${narrative.moodAvg.toFixed(1)}/5`
            : '';

          const message =
            `\u{1F319} *Your Day — ${todayStr}*\n` +
            `${narrative.eventCount} events recorded${moodStr}\n\n` +
            `${narrative.narrative}`;

          for (const chatId of config!.allowedChatIds) {
            try {
              await bot!.api.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            } catch (err) {
              console.error(`[Telegram] Failed to send daily summary to ${chatId}:`, err);
            }
          }
        }
      } catch (err) {
        console.error('[Telegram] Daily summary generation error:', err);
      }
    }
  }, CHECK_INTERVAL);

  scheduledIntervals.push(interval);
  console.log('[Telegram] Scheduled push notifications active (mood prompt + daily summary)');
}

export function stopTelegramBot(): void {
  // Clear scheduled intervals
  for (const interval of scheduledIntervals) {
    clearInterval(interval);
  }
  scheduledIntervals = [];

  if (bot) {
    bot.stop();
    bot = null;
  }
}

export function getTelegramBotStatus(): { running: boolean; botUsername?: string } {
  if (!bot) return { running: false };
  const info = bot.botInfo;
  return { running: true, botUsername: info?.username || undefined };
}

function cardIcon(type: string): string {
  switch (type) {
    case 'subscription': return '\u{1F504}';
    case 'price_increase': return '\u{1F4C8}';
    case 'refund_pending': return '\u{1F4B8}';
    case 'anomaly': return '\u{26A0}\u{FE0F}';
    default: return '\u{1F4CC}';
  }
}

function memoryIcon(type: string): string {
  switch (type) {
    case 'note': return '\u{1F4DD}';
    case 'voice_memo': return '\u{1F3A4}';
    case 'thought': return '\u{1F4AD}';
    case 'decision': return '\u{2696}\u{FE0F}';
    case 'money_transaction': return '\u{1F4B0}';
    case 'location': return '\u{1F4CD}';
    case 'calendar_event': return '\u{1F4C5}';
    case 'health_entry': return '\u{1F3CB}\u{FE0F}';
    case 'mood': return '\u{1F60A}';
    case 'ai_digest': return '\u{1F9E0}';
    default: return '\u{1F4CC}';
  }
}

function formatPushNotification(payload: MirrorHistoryEvent): string | null {
  switch (payload.type) {
    case 'diff_generated':
      return `*New Diff Generated*\n${payload.data.summary || 'Check your dashboard'}`;
    case 'csv_imported':
      return `*CSV Imported*\n${payload.data.imported} transactions imported`;
    case 'digest_generated':
      return `*AI Digest Ready*\n${payload.data.period} digest for ${payload.data.start} \u2014 ${payload.data.end}`;
    case 'mood_recorded':
      return null; // Don't push mood back to the user who just recorded it
    default:
      return null;
  }
}
