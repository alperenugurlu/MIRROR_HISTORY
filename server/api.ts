import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import path, { resolve, normalize, isAbsolute } from 'path';
import os from 'os';
import * as db from '../core/database';
import { generateDiff, getTimeMachine, getMonthlyAudit } from '../core/services/diff-engine';
import { previewCsv, importCsv } from '../core/services/csv-importer';
import { createRule, toggleRule, removeRule } from '../core/services/rule-engine';
import { createAction, updateStatus } from '../core/services/action-engine';
import { createNote, createVoiceMemo, createThought, createDecision, createObservation } from '../core/services/note-engine';
import { searchMemories, getTimeline, getFilteredTimeline, getRecentMemories, getMemoryStats } from '../core/services/memory-engine';
import { saveAIConfig, isTranscriptionConfigured } from '../core/services/transcription';
import { chat, isAIConfigured } from '../core/services/ai-engine';
import { importLocationHistory } from '../core/services/location-importer';
import { importCalendarICS } from '../core/services/calendar-importer';
import { importAppleHealth } from '../core/services/health-importer';
import { recordMood } from '../core/services/mood-engine';
import { generateDigest, getDigests } from '../core/services/digest-engine';
import { login, getUserFromToken, changePassword } from '../core/services/auth-service';
import { authHook, initAuth } from './auth';
import { handleSSE, initSSE, getClientCount } from './sse';
import { saveTelegramConfig } from './telegram-config';
import { startTelegramBot, stopTelegramBot } from './telegram';

// ── Security helpers ──

const MAX_LIMIT = 500;

function clampLimit(raw: string | undefined, defaultVal: number): number {
  if (!raw) return defaultVal;
  const n = parseInt(raw, 10);
  if (isNaN(n) || n < 1) return defaultVal;
  return Math.min(n, MAX_LIMIT);
}

function validateDateParam(date: string | undefined, paramName: string): void {
  if (!date) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw { statusCode: 400, message: `Invalid ${paramName}: expected YYYY-MM-DD format` };
  }
}

const ALLOWED_IMPORT_DIRS = [
  os.homedir(),
  '/tmp',
  os.tmpdir(),
];

function validateFilePath(filePath: string): string {
  if (!filePath || typeof filePath !== 'string') {
    throw { statusCode: 400, message: 'File path is required' };
  }
  if (filePath.includes('..')) {
    throw { statusCode: 400, message: 'Invalid file path: path traversal not allowed' };
  }
  const normalized = normalize(resolve(filePath));
  if (!isAbsolute(normalized)) {
    throw { statusCode: 400, message: 'Invalid file path: must be absolute' };
  }
  const allowed = ALLOWED_IMPORT_DIRS.some(dir => normalized.startsWith(dir));
  if (!allowed) {
    throw { statusCode: 400, message: 'Invalid file path: outside allowed directories' };
  }
  return normalized;
}

// ── Server ──

export async function createServer(port = 31072, host = '127.0.0.1', serveStatic = false) {
  const app = Fastify({
    logger: false,
    bodyLimit: 1_048_576, // 1MB explicit limit
  });

  // Security headers
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind needs inline styles
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });

  // CORS — restrictive
  await app.register(cors, {
    origin: serveStatic
      ? false // Standalone/Docker: same-origin, no CORS needed
      : ['http://localhost:5173', 'http://127.0.0.1:5173'], // Vite dev server only
    credentials: true,
  });

  // Rate limiting (global: false — applied per-route)
  await app.register(rateLimit, { global: false });

  // Serve static frontend files (standalone/Docker mode)
  if (serveStatic) {
    const distPath = path.resolve(process.cwd(), 'dist');
    await app.register(fastifyStatic, {
      root: distPath,
      prefix: '/',
      wildcard: false,
    });
  }

  // Auth middleware
  const token = initAuth();
  app.addHook('onRequest', authHook);

  // Enforce mustChangePassword server-side
  app.addHook('onRequest', async (request, reply) => {
    const userId = (request as any).userId;
    if (
      !userId ||
      userId === 'api-token' ||
      !request.url.startsWith('/api/') ||
      request.url.startsWith('/api/auth/')
    ) {
      return;
    }
    const dbUser = db.getUserById(userId);
    if (dbUser && dbUser.must_change_password === 1) {
      reply.code(403).send({ error: 'Password change required', code: 'MUST_CHANGE_PASSWORD' });
    }
  });

  // SSE
  initSSE();

  // ── Health ──
  app.get('/health', async () => ({
    status: 'ok',
    version: '0.2.0',
    sse_clients: getClientCount(),
  }));

  // ── SSE Stream ──
  app.get('/api/events', (request, reply) => {
    handleSSE(request, reply);
  });

  // ── Auth ──
  app.post('/api/auth/login', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '15 minutes',
      },
    },
  }, async (request) => {
    const { username, password } = request.body as { username: string; password: string };
    try {
      return login(username, password);
    } catch {
      throw { statusCode: 401, message: 'Invalid username or password' };
    }
  });

  app.post('/api/auth/change-password', async (request) => {
    const userId = (request as any).userId;
    if (!userId || userId === 'api-token') {
      throw { statusCode: 401, message: 'Authentication required' };
    }
    const { oldPassword, newPassword } = request.body as { oldPassword: string; newPassword: string };
    const result = changePassword(userId, oldPassword, newPassword);
    if (!result.success) {
      throw { statusCode: 400, message: result.error };
    }
    return { success: true };
  });

  app.get('/api/auth/me', async (request) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw { statusCode: 401, message: 'Not authenticated' };
    }
    const token = authHeader.slice(7);
    const user = getUserFromToken(token);
    if (!user) throw { statusCode: 401, message: 'Invalid token' };
    return user;
  });

  // ── Transactions ──
  app.get('/api/transactions', async (request) => {
    const { start, end } = request.query as { start?: string; end?: string };
    validateDateParam(start, 'start');
    validateDateParam(end, 'end');
    return db.getTransactions(start, end);
  });

  app.get('/api/transactions/count', async () => ({
    count: db.getTransactionCount(),
  }));

  app.get('/api/has-data', async () => ({
    hasData: db.getTransactionCount() > 0,
  }));

  // ── CSV Import ──
  app.post('/api/csv/preview', async (request) => {
    const { filePath } = request.body as { filePath: string };
    return previewCsv(validateFilePath(filePath));
  });

  app.post('/api/csv/import', async (request) => {
    const { filePath, mapping } = request.body as { filePath: string; mapping: any };
    return importCsv(validateFilePath(filePath), mapping);
  });

  // ── Diffs ──
  app.post('/api/diff/generate', async (request) => {
    const { periodType, refDate } = request.body as { periodType: string; refDate: string };
    validateDateParam(refDate, 'refDate');
    return generateDiff(periodType as any, refDate);
  });

  app.get('/api/diffs', async (request) => {
    const { periodType } = request.query as { periodType?: string };
    return db.getDiffs(periodType);
  });

  // ── Time Machine ──
  app.get('/api/time-machine/:eventId', async (request) => {
    const { eventId } = request.params as { eventId: string };
    const result = getTimeMachine(eventId);
    if (!result) return { error: 'Event not found' };
    return result;
  });

  // ── Subscriptions ──
  app.get('/api/subscriptions', async () => db.getSubscriptions());

  // ── Monthly Audit ──
  app.get('/api/audit/:month', async (request) => {
    const { month } = request.params as { month: string };
    return getMonthlyAudit(month);
  });

  // ── Rules ──
  app.get('/api/rules', async () => db.getRules());

  app.post('/api/rules', async (request) => {
    const { ruleType, ruleJson } = request.body as { ruleType: string; ruleJson: string };
    return createRule(ruleType as any, ruleJson);
  });

  app.patch('/api/rules/:id', async (request) => {
    const { id } = request.params as { id: string };
    const { enabled } = request.body as { enabled: number };
    toggleRule(id, enabled);
    return { ok: true };
  });

  app.delete('/api/rules/:id', async (request) => {
    const { id } = request.params as { id: string };
    removeRule(id);
    return { ok: true };
  });

  // ── Actions ──
  app.get('/api/actions', async () => db.getActions());

  app.post('/api/actions', async (request) => {
    const { eventId, actionType, payloadJson } = request.body as {
      eventId: string; actionType: string; payloadJson: string;
    };
    return createAction(eventId, actionType as any, payloadJson);
  });

  app.patch('/api/actions/:id', async (request) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: string };
    updateStatus(id, status as any);
    return { ok: true };
  });

  // ── Activity Log ──
  app.get('/api/activity-log', async () => db.getActivityLog());

  // ── Notes ──
  app.post('/api/notes', async (request) => {
    const { content, source, tags } = request.body as {
      content: string; source?: string; tags?: string[];
    };
    return createNote(content, (source as any) || 'api', tags || []);
  });

  app.get('/api/notes', async (request) => {
    const { limit } = request.query as { limit?: string };
    return db.getNotes(clampLimit(limit, 100));
  });

  app.post('/api/notes/thought', async (request) => {
    const { content } = request.body as { content: string };
    return createThought(content);
  });

  app.post('/api/notes/decision', async (request) => {
    const { content } = request.body as { content: string };
    return createDecision(content);
  });

  app.post('/api/notes/observation', async (request) => {
    const { content } = request.body as { content: string };
    return createObservation(content);
  });

  // ── Voice Memos ──
  app.get('/api/voice-memos', async (request) => {
    const { limit } = request.query as { limit?: string };
    return db.getVoiceMemos(clampLimit(limit, 100));
  });

  // ── Memory Search ──
  app.get('/api/search', async (request) => {
    const { q, limit } = request.query as { q: string; limit?: string };
    if (!q) return { error: 'Query parameter "q" is required' };
    return searchMemories(q, clampLimit(limit, 50));
  });

  // ── Timeline ──
  app.get('/api/timeline', async (request) => {
    const { start, end } = request.query as { start: string; end: string };
    if (!start || !end) return { error: 'Both "start" and "end" date parameters are required' };
    validateDateParam(start, 'start');
    validateDateParam(end, 'end');
    return getTimeline(start, end);
  });

  // ── Recent Memories ──
  app.get('/api/memories/recent', async (request) => {
    const { limit } = request.query as { limit?: string };
    return getRecentMemories(clampLimit(limit, 20));
  });

  // ── Memory Stats ──
  app.get('/api/memories/stats', async () => getMemoryStats());

  // ── AI Configuration ──
  app.post('/api/ai/configure', async (request) => {
    const config = request.body as { whisperApiKey?: string; anthropicApiKey?: string; privacyLevel?: 'strict' | 'balanced' };
    saveAIConfig(config);
    return { ok: true, message: 'AI configuration saved' };
  });

  app.get('/api/ai/status', async () => ({
    configured: isAIConfigured(),
    transcription: isTranscriptionConfigured(),
  }));

  // ── AI Chat ──
  app.post('/api/ai/chat', async (request) => {
    const { message } = request.body as { message: string };
    if (!message) return { error: 'Message is required' };
    return chat(message);
  });

  app.get('/api/ai/chat/history', async (request) => {
    const { limit } = request.query as { limit?: string };
    return db.getChatMessages(clampLimit(limit, 50));
  });

  app.delete('/api/ai/chat/history', async () => {
    db.clearChatMessages();
    return { ok: true };
  });

  // ── AI Digest ──
  app.post('/api/ai/digest', async (request) => {
    const { period } = request.body as { period: string };
    return generateDigest(period as any);
  });

  app.get('/api/ai/digests', async (request) => {
    const { limit } = request.query as { limit?: string };
    return getDigests(clampLimit(limit, 20));
  });

  // ── Import Hub ──
  app.post('/api/import/location', async (request) => {
    const { filePath } = request.body as { filePath: string };
    return importLocationHistory(validateFilePath(filePath));
  });

  app.post('/api/import/calendar', async (request) => {
    const { filePath } = request.body as { filePath: string };
    return importCalendarICS(validateFilePath(filePath));
  });

  app.post('/api/import/health', async (request) => {
    const { filePath } = request.body as { filePath: string };
    return importAppleHealth(validateFilePath(filePath));
  });

  app.get('/api/import/stats', async () => db.getImportStats());

  // ── Mood ──
  app.post('/api/mood', async (request) => {
    const { score, note } = request.body as { score: number; note?: string };
    return recordMood(score, note);
  });

  app.get('/api/moods', async (request) => {
    const { limit } = request.query as { limit?: string };
    return db.getMoodEntries(clampLimit(limit, 100));
  });

  // ── Enhanced Timeline ──
  app.get('/api/timeline/enhanced', async (request) => {
    const { start, end, types } = request.query as { start: string; end: string; types?: string };
    if (!start || !end) return { error: 'start and end required' };
    validateDateParam(start, 'start');
    validateDateParam(end, 'end');
    const typeFilter = types ? types.split(',') as any[] : undefined;
    return getFilteredTimeline(start, end, typeFilter);
  });

  app.get('/api/timeline/stats', async () => ({
    totalEvents: db.getEventCount(),
    byType: db.getEventCountsByType(),
    dateRange: db.getDateRange(),
  }));

  // ── Phase 6: Dark Grain — Re-do ──
  app.get('/api/redo/:date', async (request) => {
    const { date } = request.params as { date: string };
    validateDateParam(date, 'date');
    const { getHourlyReconstruction } = await import('../core/services/redo-engine');
    return getHourlyReconstruction(date);
  });

  app.get('/api/redo/moment', async (request) => {
    const { ts, window } = request.query as { ts: string; window?: string };
    const { getMomentData } = await import('../core/services/redo-engine');
    return getMomentData(ts, window ? parseInt(window, 10) : 30);
  });

  // ── Phase 6: Forensic Zoom ──
  app.get('/api/forensic/:eventId', async (request) => {
    const { eventId } = request.params as { eventId: string };
    const { window } = request.query as { window?: string };
    const { getForensicContext } = await import('../core/services/forensic-engine');
    return getForensicContext(eventId, window ? parseInt(window, 10) : 30);
  });

  // ── Phase 6: Dark Grain — Inconsistency Engine ──
  app.post('/api/inconsistencies/scan', async (request) => {
    const { startDate, endDate } = request.body as { startDate: string; endDate: string };
    validateDateParam(startDate, 'startDate');
    validateDateParam(endDate, 'endDate');
    const { scanForInconsistencies } = await import('../core/services/inconsistency-engine');
    return scanForInconsistencies(startDate, endDate);
  });

  app.get('/api/inconsistencies', async (request) => {
    const { limit } = request.query as { limit?: string };
    return db.getInconsistencies(clampLimit(limit, 50));
  });

  app.delete('/api/inconsistencies/:id', async (request) => {
    const { id } = request.params as { id: string };
    db.dismissInconsistency(id);
    db.logActivity('inconsistency_dismissed', `Dismissed inconsistency ${id}`);
    return { ok: true };
  });

  // ── Phase 6: Dark Grain — Confrontation Engine ──
  app.post('/api/confrontations/generate', async (request) => {
    const { period } = request.body as { period: 'weekly' | 'monthly' };
    const { generateConfrontations } = await import('../core/services/confrontation-engine');
    return generateConfrontations(period || 'weekly');
  });

  app.get('/api/confrontations', async (request) => {
    const { limit } = request.query as { limit?: string };
    return db.getConfrontations(clampLimit(limit, 20));
  });

  app.delete('/api/confrontations/:id', async (request) => {
    const { id } = request.params as { id: string };
    db.acknowledgeConfrontation(id);
    db.logActivity('confrontation_acknowledged', `Acknowledged confrontation ${id}`);
    return { ok: true };
  });

  // ── Phase 6: Dark Grain — Comparison Engine ──
  app.post('/api/compare', async (request) => {
    const { p1Start, p1End, p2Start, p2End } = request.body as {
      p1Start: string; p1End: string; p2Start: string; p2End: string;
    };
    validateDateParam(p1Start, 'p1Start');
    validateDateParam(p1End, 'p1End');
    validateDateParam(p2Start, 'p2Start');
    validateDateParam(p2End, 'p2End');
    const { comparePeriods } = await import('../core/services/comparison-engine');
    return comparePeriods(p1Start, p1End, p2Start, p2End);
  });

  // ── Phase 6b: Visual Comparison ──
  app.post('/api/visual/compare-sets', async (request) => {
    const { p1Start, p1End, p2Start, p2End } = request.body as {
      p1Start: string; p1End: string; p2Start: string; p2End: string;
    };
    validateDateParam(p1Start, 'p1Start');
    validateDateParam(p1End, 'p1End');
    validateDateParam(p2Start, 'p2Start');
    validateDateParam(p2End, 'p2End');
    const { comparePhotoSets } = await import('../core/services/visual-comparison-engine');
    return comparePhotoSets(p1Start, p1End, p2Start, p2End);
  });

  // ── Phase 7: Photo File Serving ──
  app.get('/api/photos/file', async (request, reply) => {
    const { path: filePath } = request.query as { path?: string };
    if (!filePath) {
      reply.code(400);
      return { error: 'Missing path parameter' };
    }
    const photoDir = resolve(os.homedir(), '.mirror-history', 'photos');
    const frameDir = resolve(os.homedir(), '.mirror-history', 'video-frames');
    const resolved = resolve(filePath);
    if (!resolved.startsWith(photoDir) && !resolved.startsWith(frameDir)) {
      reply.code(403);
      return { error: 'Access denied: photos must be in ~/.mirror-history/photos/' };
    }
    try {
      const fs = await import('fs');
      const data = fs.readFileSync(resolved);
      return data.toString('base64');
    } catch {
      reply.code(404);
      return { error: 'Photo not found' };
    }
  });

  // ── Telegram Configuration ──
  app.post('/api/telegram/configure', async (request) => {
    const { botToken, allowedChatIds } = request.body as {
      botToken: string; allowedChatIds?: number[];
    };
    saveTelegramConfig({ botToken, allowedChatIds: allowedChatIds || [] });
    // Restart bot
    stopTelegramBot();
    await startTelegramBot();
    return { ok: true, message: 'Telegram bot configured and started' };
  });

  // SPA fallback — serve index.html for non-API routes (standalone/Docker mode)
  if (serveStatic) {
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/')) {
        reply.code(404).send({ error: 'Not found' });
      } else {
        reply.sendFile('index.html');
      }
    });
  }

  await app.listen({ port, host });
  console.log(`[API] Server listening on http://${host}:${port}`);
  console.log(`[API] Auth token: ${token.slice(0, 8)}... (see ~/.mirror-history/api-token.txt)`);

  return app;
}
