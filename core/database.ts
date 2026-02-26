import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';
import crypto from 'crypto';
import type {
  Event, MoneyTransaction, Subscription, Diff, EvidenceRef,
  Rule, Action, ActivityLogEntry, EventType, Classification,
  TransactionSource, RuleType, ActionType, ActionStatus,
  Note, NoteSource, VoiceMemo, MemoSource, MemorySearchResult,
  TimelineEntry, Location, LocationSource, CalendarEvent,
  HealthEntry, HealthMetricType, HealthSource, MoodEntry,
  ChatMessage, ChatRole, AIDigest, DigestPeriod, ImportStats,
  EnrichedEvent, Inconsistency, InconsistencyType,
  Confrontation, ConfrontationCategory,
  PhotoRecord, PhotoAnalysis, Video, VideoFrame, VideoSource,
} from './types';

let db: Database.Database;

export function getDb(): Database.Database {
  return db;
}

export function initDatabase(dbPath?: string): void {
  const resolvedPath = dbPath || path.join(os.homedir(), '.mirror-history', 'mirror-history.db');

  // Ensure directory exists
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(resolvedPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  createTables();
}

function createTables(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      summary TEXT NOT NULL,
      details_json TEXT NOT NULL DEFAULT '{}',
      confidence REAL NOT NULL DEFAULT 1.0,
      classification TEXT NOT NULL DEFAULT 'local_private',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      content_hash TEXT
    );

    CREATE TABLE IF NOT EXISTS money_transactions (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id),
      date TEXT NOT NULL,
      merchant TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      category TEXT,
      account TEXT,
      raw_row_hash TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'csv_import',
      source_ref TEXT NOT NULL DEFAULT '',
      UNIQUE(raw_row_hash)
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      merchant TEXT NOT NULL,
      estimated_period TEXT NOT NULL DEFAULT 'monthly',
      first_seen_date TEXT NOT NULL,
      last_seen_date TEXT NOT NULL,
      typical_amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      confidence REAL NOT NULL DEFAULT 0.5
    );

    CREATE TABLE IF NOT EXISTS diffs (
      id TEXT PRIMARY KEY,
      period_type TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      diff_summary TEXT NOT NULL DEFAULT '',
      diff_json TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS evidence_refs (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id),
      evidence_type TEXT NOT NULL,
      pointer TEXT NOT NULL DEFAULT '',
      excerpt TEXT NOT NULL DEFAULT '',
      hash TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rules (
      id TEXT PRIMARY KEY,
      rule_type TEXT NOT NULL,
      rule_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      enabled INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS actions (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id),
      action_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      applied_at TEXT
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      entry_type TEXT NOT NULL,
      description TEXT NOT NULL,
      details_json TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id),
      content TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      tags TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS voice_memos (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id),
      transcript TEXT NOT NULL DEFAULT '',
      duration_seconds REAL NOT NULL DEFAULT 0,
      file_path TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'telegram',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_mt_date ON money_transactions(date);
    CREATE INDEX IF NOT EXISTS idx_mt_merchant ON money_transactions(merchant);
    CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
    CREATE INDEX IF NOT EXISTS idx_events_hash ON events(content_hash);
    CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
    CREATE INDEX IF NOT EXISTS idx_diffs_period ON diffs(period_type, period_start);
    CREATE INDEX IF NOT EXISTS idx_evidence_event ON evidence_refs(event_id);
    CREATE INDEX IF NOT EXISTS idx_actions_event ON actions(event_id);
    CREATE INDEX IF NOT EXISTS idx_notes_event ON notes(event_id);
    CREATE INDEX IF NOT EXISTS idx_voice_memos_event ON voice_memos(event_id);

    -- Phase 3: Multi-source life recording tables
    CREATE TABLE IF NOT EXISTS locations (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id),
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      address TEXT NOT NULL DEFAULT '',
      timestamp TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'google_takeout'
    );

    CREATE TABLE IF NOT EXISTS calendar_events (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id),
      title TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      location TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS health_entries (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id),
      metric_type TEXT NOT NULL,
      value REAL NOT NULL,
      unit TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'apple_health'
    );

    CREATE TABLE IF NOT EXISTS mood_entries (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id),
      score INTEGER NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      context_summary TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_digests (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id),
      period TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_locations_event ON locations(event_id);
    CREATE INDEX IF NOT EXISTS idx_locations_timestamp ON locations(timestamp);
    CREATE INDEX IF NOT EXISTS idx_calendar_event ON calendar_events(event_id);
    CREATE INDEX IF NOT EXISTS idx_calendar_start ON calendar_events(start_time);
    CREATE INDEX IF NOT EXISTS idx_health_event ON health_entries(event_id);
    CREATE INDEX IF NOT EXISTS idx_health_timestamp ON health_entries(timestamp);
    CREATE INDEX IF NOT EXISTS idx_health_metric ON health_entries(metric_type);
    CREATE INDEX IF NOT EXISTS idx_mood_event ON mood_entries(event_id);
    CREATE INDEX IF NOT EXISTS idx_mood_timestamp ON mood_entries(timestamp);
    CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_messages(created_at);
    CREATE INDEX IF NOT EXISTS idx_digests_event ON ai_digests(event_id);
    CREATE INDEX IF NOT EXISTS idx_digests_period ON ai_digests(period, period_start);

    -- Phase 5: Photos
    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id),
      file_path TEXT NOT NULL,
      caption TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'telegram',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_photos_event ON photos(event_id);

    -- Phase 7: Visual Memory — photo analyses
    CREATE TABLE IF NOT EXISTS photo_analyses (
      id TEXT PRIMARY KEY,
      photo_id TEXT NOT NULL REFERENCES photos(id),
      description TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      detected_text TEXT NOT NULL DEFAULT '',
      mood_indicators TEXT NOT NULL DEFAULT '{}',
      people_count INTEGER NOT NULL DEFAULT 0,
      analyzed_at TEXT NOT NULL DEFAULT (datetime('now')),
      model TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_photo_analyses_photo ON photo_analyses(photo_id);

    -- Phase 7: Visual Memory — videos
    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id),
      file_path TEXT NOT NULL,
      duration_seconds REAL NOT NULL DEFAULT 0,
      frame_count INTEGER NOT NULL DEFAULT 0,
      summary TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'import',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_videos_event ON videos(event_id);

    -- Phase 7: Visual Memory — video frames
    CREATE TABLE IF NOT EXISTS video_frames (
      id TEXT PRIMARY KEY,
      video_id TEXT NOT NULL REFERENCES videos(id),
      frame_path TEXT NOT NULL,
      timestamp_seconds REAL NOT NULL DEFAULT 0,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_video_frames_video ON video_frames(video_id);

    -- Phase 5: Semantic search embeddings
    CREATE TABLE IF NOT EXISTS memory_embeddings (
      event_id TEXT PRIMARY KEY REFERENCES events(id),
      embedding BLOB NOT NULL,
      model TEXT NOT NULL DEFAULT 'text-embedding-3-small',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Phase 6: Inconsistencies — the grain catches contradictions
  db.exec(`
    CREATE TABLE IF NOT EXISTS inconsistencies (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      severity REAL NOT NULL DEFAULT 0.5,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      evidence_event_ids TEXT NOT NULL DEFAULT '[]',
      suggested_question TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL,
      detected_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_inconsistencies_date ON inconsistencies(date);
    CREATE INDEX IF NOT EXISTS idx_inconsistencies_type ON inconsistencies(type);
  `);

  // Phase 6: Confrontations — uncomfortable truths the grain reveals
  db.exec(`
    CREATE TABLE IF NOT EXISTS confrontations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      insight TEXT NOT NULL,
      severity REAL NOT NULL DEFAULT 0.5,
      data_points TEXT NOT NULL DEFAULT '[]',
      related_event_ids TEXT NOT NULL DEFAULT '[]',
      category TEXT NOT NULL DEFAULT 'correlation',
      generated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_confrontations_severity ON confrontations(severity DESC);
    CREATE INDEX IF NOT EXISTS idx_confrontations_category ON confrontations(category);
  `);

  // FTS5 virtual table for full-text search across all memories
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS events_fts USING fts5(
        event_id,
        content,
        tokenize='porter unicode61'
      )
    `);
  } catch {
    // FTS5 might already exist or not be available
  }

  // Auth: Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      must_change_password INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migration: add content_hash column if missing (upgrade from v1)
  try {
    db.prepare('SELECT content_hash FROM events LIMIT 0').run();
  } catch {
    db.exec('ALTER TABLE events ADD COLUMN content_hash TEXT');
    db.exec('CREATE INDEX IF NOT EXISTS idx_events_hash ON events(content_hash)');
  }
}

// ── Helpers ──

function uuid(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

export function hashRow(row: Record<string, unknown>): string {
  return crypto.createHash('sha256').update(JSON.stringify(row)).digest('hex');
}

export function computeContentHash(parts: string[]): string {
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
}

// ── Events ──

export function insertEvent(
  type: EventType,
  timestamp: string,
  summary: string,
  detailsJson: Record<string, unknown> = {},
  confidence = 1.0,
  classification: Classification = 'local_private',
  contentHash?: string,
): Event {
  const id = uuid();
  const created_at = now();
  db.prepare(`
    INSERT INTO events (id, type, timestamp, summary, details_json, confidence, classification, created_at, content_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, type, timestamp, summary, JSON.stringify(detailsJson), confidence, classification, created_at, contentHash || null);
  return { id, type, timestamp, summary, details_json: JSON.stringify(detailsJson), confidence, classification, created_at, content_hash: contentHash };
}

export function findEventByHash(contentHash: string): Event | undefined {
  return db.prepare('SELECT * FROM events WHERE content_hash = ?').get(contentHash) as Event | undefined;
}

export function findOrInsertEvent(
  type: EventType,
  timestamp: string,
  summary: string,
  detailsJson: Record<string, unknown> = {},
  confidence = 1.0,
  classification: Classification = 'local_private',
  contentHash?: string,
): { event: Event; isNew: boolean } {
  if (contentHash) {
    const existing = findEventByHash(contentHash);
    if (existing) return { event: existing, isNew: false };
  }
  const event = insertEvent(type, timestamp, summary, detailsJson, confidence, classification, contentHash);
  return { event, isNew: true };
}

export function getEvent(id: string): Event | undefined {
  return db.prepare('SELECT * FROM events WHERE id = ?').get(id) as Event | undefined;
}

export function getEventsByType(type: EventType): Event[] {
  return db.prepare('SELECT * FROM events WHERE type = ? ORDER BY timestamp DESC').all(type) as Event[];
}

// ── Money Transactions ──

export function insertTransaction(
  eventId: string,
  date: string,
  merchant: string,
  amount: number,
  currency: string,
  rawRowHash: string,
  source: TransactionSource = 'csv_import',
  sourceRef = '',
  category: string | null = null,
  account: string | null = null,
): MoneyTransaction | null {
  const id = uuid();
  try {
    db.prepare(`
      INSERT INTO money_transactions (id, event_id, date, merchant, amount, currency, category, account, raw_row_hash, source, source_ref)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, eventId, date, merchant, amount, currency, category, account, rawRowHash, source, sourceRef);
    return { id, event_id: eventId, date, merchant, amount, currency, category, account, raw_row_hash: rawRowHash, source, source_ref: sourceRef };
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes('UNIQUE constraint')) return null;
    throw e;
  }
}

export function getTransactions(start?: string, end?: string): MoneyTransaction[] {
  if (start && end) {
    return db.prepare('SELECT * FROM money_transactions WHERE date >= ? AND date <= ? ORDER BY date DESC').all(start, end) as MoneyTransaction[];
  }
  return db.prepare('SELECT * FROM money_transactions ORDER BY date DESC').all() as MoneyTransaction[];
}

export function getTransactionsByMerchant(merchant: string): MoneyTransaction[] {
  return db.prepare('SELECT * FROM money_transactions WHERE merchant = ? ORDER BY date ASC').all(merchant) as MoneyTransaction[];
}

export function getTransactionCount(): number {
  const row = db.prepare('SELECT COUNT(*) as cnt FROM money_transactions').get() as { cnt: number };
  return row.cnt;
}

export function getDateRange(): { min: string; max: string } | null {
  const row = db.prepare('SELECT MIN(date) as min, MAX(date) as max FROM money_transactions').get() as { min: string | null; max: string | null };
  if (!row.min || !row.max) return null;
  return { min: row.min, max: row.max };
}

// ── Subscriptions ──

export function upsertSubscription(sub: Subscription): void {
  db.prepare(`
    INSERT INTO subscriptions (id, merchant, estimated_period, first_seen_date, last_seen_date, typical_amount, status, confidence)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      last_seen_date = excluded.last_seen_date,
      typical_amount = excluded.typical_amount,
      status = excluded.status,
      confidence = excluded.confidence
  `).run(sub.id, sub.merchant, sub.estimated_period, sub.first_seen_date, sub.last_seen_date, sub.typical_amount, sub.status, sub.confidence);
}

export function getSubscriptions(): Subscription[] {
  return db.prepare('SELECT * FROM subscriptions ORDER BY last_seen_date DESC').all() as Subscription[];
}

// ── Diffs ──

export function insertDiff(diff: Omit<Diff, 'id'>): Diff {
  const id = uuid();
  db.prepare(`
    INSERT INTO diffs (id, period_type, period_start, period_end, diff_summary, diff_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, diff.period_type, diff.period_start, diff.period_end, diff.diff_summary, diff.diff_json);
  return { id, ...diff };
}

export function getDiffs(periodType?: string): Diff[] {
  if (periodType) {
    return db.prepare('SELECT * FROM diffs WHERE period_type = ? ORDER BY period_start DESC').all(periodType) as Diff[];
  }
  return db.prepare('SELECT * FROM diffs ORDER BY period_start DESC').all() as Diff[];
}

export function getDiff(id: string): Diff | undefined {
  return db.prepare('SELECT * FROM diffs WHERE id = ?').get(id) as Diff | undefined;
}

// ── Evidence ──

export function insertEvidence(
  eventId: string,
  evidenceType: string,
  pointer: string,
  excerpt: string,
  hash: string,
): EvidenceRef {
  const id = uuid();
  const created_at = now();
  db.prepare(`
    INSERT INTO evidence_refs (id, event_id, evidence_type, pointer, excerpt, hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, eventId, evidenceType, pointer, excerpt, hash, created_at);
  return { id, event_id: eventId, evidence_type: evidenceType as EvidenceRef['evidence_type'], pointer, excerpt, hash, created_at };
}

export function getEvidenceByEvent(eventId: string): EvidenceRef[] {
  return db.prepare('SELECT * FROM evidence_refs WHERE event_id = ? ORDER BY created_at ASC').all(eventId) as EvidenceRef[];
}

// ── Rules ──

export function insertRule(ruleType: RuleType, ruleJson: string): Rule {
  const id = uuid();
  const created_at = now();
  db.prepare('INSERT INTO rules (id, rule_type, rule_json, created_at, enabled) VALUES (?, ?, ?, ?, 1)')
    .run(id, ruleType, ruleJson, created_at);
  return { id, rule_type: ruleType, rule_json: ruleJson, created_at, enabled: 1 };
}

export function getRules(): Rule[] {
  return db.prepare('SELECT * FROM rules ORDER BY created_at DESC').all() as Rule[];
}

export function updateRule(id: string, enabled: number): void {
  db.prepare('UPDATE rules SET enabled = ? WHERE id = ?').run(enabled, id);
}

export function deleteRule(id: string): void {
  db.prepare('DELETE FROM rules WHERE id = ?').run(id);
}

export function getActiveRules(): Rule[] {
  return db.prepare('SELECT * FROM rules WHERE enabled = 1').all() as Rule[];
}

// ── Actions ──

export function insertAction(eventId: string, actionType: ActionType, payloadJson: string): Action {
  const id = uuid();
  const created_at = now();
  db.prepare(`
    INSERT INTO actions (id, event_id, action_type, status, payload_json, created_at)
    VALUES (?, ?, ?, 'draft', ?, ?)
  `).run(id, eventId, actionType, payloadJson, created_at);
  return { id, event_id: eventId, action_type: actionType, status: 'draft', payload_json: payloadJson, created_at, applied_at: null };
}

export function updateActionStatus(id: string, status: ActionStatus): void {
  const applied_at = status === 'applied' ? now() : null;
  db.prepare('UPDATE actions SET status = ?, applied_at = ? WHERE id = ?').run(status, applied_at, id);
}

export function getActions(): Action[] {
  return db.prepare('SELECT * FROM actions ORDER BY created_at DESC').all() as Action[];
}

// ── Notes ──

export function insertNote(
  eventId: string,
  content: string,
  source: NoteSource = 'manual',
  tags: string[] = [],
): Note {
  const id = uuid();
  const created_at = now();
  const tagsJson = JSON.stringify(tags);
  db.prepare('INSERT INTO notes (id, event_id, content, source, tags, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, eventId, content, source, tagsJson, created_at);
  return { id, event_id: eventId, content, source, tags: tagsJson, created_at };
}

export function getNoteByEvent(eventId: string): Note | undefined {
  return db.prepare('SELECT * FROM notes WHERE event_id = ?').get(eventId) as Note | undefined;
}

export function getNotes(limit = 100): Note[] {
  return db.prepare('SELECT * FROM notes ORDER BY created_at DESC LIMIT ?').all(limit) as Note[];
}

export function getNotesByDateRange(start: string, end: string): Note[] {
  return db.prepare(
    'SELECT n.* FROM notes n JOIN events e ON n.event_id = e.id WHERE e.timestamp >= ? AND e.timestamp < ? ORDER BY n.created_at DESC'
  ).all(start, end) as Note[];
}

// ── Voice Memos ──

export function insertVoiceMemo(
  eventId: string,
  transcript: string,
  durationSeconds: number,
  filePath: string,
  source: MemoSource = 'telegram',
): VoiceMemo {
  const id = uuid();
  const created_at = now();
  db.prepare('INSERT INTO voice_memos (id, event_id, transcript, duration_seconds, file_path, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, eventId, transcript, durationSeconds, filePath, source, created_at);
  return { id, event_id: eventId, transcript, duration_seconds: durationSeconds, file_path: filePath, source, created_at };
}

export function getVoiceMemoByEvent(eventId: string): VoiceMemo | undefined {
  return db.prepare('SELECT * FROM voice_memos WHERE event_id = ?').get(eventId) as VoiceMemo | undefined;
}

export function getVoiceMemos(limit = 100): VoiceMemo[] {
  return db.prepare('SELECT * FROM voice_memos ORDER BY created_at DESC LIMIT ?').all(limit) as VoiceMemo[];
}

export function getVoiceMemosByDateRange(start: string, end: string): VoiceMemo[] {
  return db.prepare(
    'SELECT v.* FROM voice_memos v JOIN events e ON v.event_id = e.id WHERE e.timestamp >= ? AND e.timestamp < ? ORDER BY v.created_at DESC'
  ).all(start, end) as VoiceMemo[];
}

// ── FTS (Full-Text Search) ──

export function indexForSearch(eventId: string, content: string): void {
  try {
    db.prepare('INSERT INTO events_fts (event_id, content) VALUES (?, ?)').run(eventId, content);
  } catch {
    // Ignore FTS errors (table might not exist)
  }
}

export function removeFromSearch(eventId: string): void {
  try {
    db.prepare('DELETE FROM events_fts WHERE event_id = ?').run(eventId);
  } catch {
    // Ignore
  }
}

export function searchFTS(query: string, limit = 50): { event_id: string; snippet: string; rank: number }[] {
  try {
    return db.prepare(`
      SELECT event_id, snippet(events_fts, 1, '**', '**', '...', 32) as snippet, rank
      FROM events_fts
      WHERE events_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(query, limit) as { event_id: string; snippet: string; rank: number }[];
  } catch {
    return [];
  }
}

// ── Timeline ──

export function getEventsByDateRange(startDate: string, endDate: string): Event[] {
  return db.prepare(
    'SELECT * FROM events WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC'
  ).all(startDate, endDate + 'T23:59:59') as Event[];
}

export function getAllEventsPaginated(limit = 100, offset = 0): Event[] {
  return db.prepare(
    'SELECT * FROM events ORDER BY timestamp DESC LIMIT ? OFFSET ?'
  ).all(limit, offset) as Event[];
}

export function getEventCount(): number {
  const row = db.prepare('SELECT COUNT(*) as cnt FROM events').get() as { cnt: number };
  return row.cnt;
}

// ── Activity Log ──

export function logActivity(entryType: string, description: string, details: Record<string, unknown> = {}): void {
  const id = uuid();
  const timestamp = now();
  db.prepare('INSERT INTO activity_log (id, timestamp, entry_type, description, details_json) VALUES (?, ?, ?, ?, ?)')
    .run(id, timestamp, entryType, description, JSON.stringify(details));
}

export function getActivityLog(): ActivityLogEntry[] {
  return db.prepare('SELECT * FROM activity_log ORDER BY timestamp DESC LIMIT 500').all() as ActivityLogEntry[];
}

// ── Locations ──

export function insertLocation(
  eventId: string, lat: number, lng: number, address: string,
  timestamp: string, source: LocationSource = 'google_takeout',
): Location {
  const id = uuid();
  db.prepare('INSERT INTO locations (id, event_id, lat, lng, address, timestamp, source) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, eventId, lat, lng, address, timestamp, source);
  return { id, event_id: eventId, lat, lng, address, timestamp, source };
}

export function getLocationByEvent(eventId: string): Location | undefined {
  return db.prepare('SELECT * FROM locations WHERE event_id = ?').get(eventId) as Location | undefined;
}

export function getLocationsByDateRange(start: string, end: string): Location[] {
  return db.prepare('SELECT * FROM locations WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC')
    .all(start, end + 'T23:59:59') as Location[];
}

export function getLocationCount(): number {
  return (db.prepare('SELECT COUNT(*) as cnt FROM locations').get() as { cnt: number }).cnt;
}

// ── Calendar Events ──

export function insertCalendarEvent(
  eventId: string, title: string, startTime: string, endTime: string,
  location: string = '', description: string = '',
): CalendarEvent {
  const id = uuid();
  db.prepare('INSERT INTO calendar_events (id, event_id, title, start_time, end_time, location, description) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, eventId, title, startTime, endTime, location, description);
  return { id, event_id: eventId, title, start_time: startTime, end_time: endTime, location, description };
}

export function getCalendarEventByEvent(eventId: string): CalendarEvent | undefined {
  return db.prepare('SELECT * FROM calendar_events WHERE event_id = ?').get(eventId) as CalendarEvent | undefined;
}

export function getCalendarEventsByDateRange(start: string, end: string): CalendarEvent[] {
  return db.prepare('SELECT * FROM calendar_events WHERE start_time >= ? AND start_time <= ? ORDER BY start_time DESC')
    .all(start, end + 'T23:59:59') as CalendarEvent[];
}

export function getCalendarEventCount(): number {
  return (db.prepare('SELECT COUNT(*) as cnt FROM calendar_events').get() as { cnt: number }).cnt;
}

// ── Health Entries ──

export function insertHealthEntry(
  eventId: string, metricType: HealthMetricType, value: number,
  unit: string, timestamp: string, source: HealthSource = 'apple_health',
): HealthEntry {
  const id = uuid();
  db.prepare('INSERT INTO health_entries (id, event_id, metric_type, value, unit, timestamp, source) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, eventId, metricType, value, unit, timestamp, source);
  return { id, event_id: eventId, metric_type: metricType, value, unit, timestamp, source };
}

export function getHealthEntryByEvent(eventId: string): HealthEntry | undefined {
  return db.prepare('SELECT * FROM health_entries WHERE event_id = ?').get(eventId) as HealthEntry | undefined;
}

export function getHealthEntriesByType(metricType: HealthMetricType, start?: string, end?: string): HealthEntry[] {
  if (start && end) {
    return db.prepare('SELECT * FROM health_entries WHERE metric_type = ? AND timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC')
      .all(metricType, start, end + 'T23:59:59') as HealthEntry[];
  }
  return db.prepare('SELECT * FROM health_entries WHERE metric_type = ? ORDER BY timestamp DESC').all(metricType) as HealthEntry[];
}

export function getHealthEntriesByDateRange(start: string, end: string): HealthEntry[] {
  return db.prepare('SELECT * FROM health_entries WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC')
    .all(start, end + 'T23:59:59') as HealthEntry[];
}

export function getHealthEntryCount(): number {
  return (db.prepare('SELECT COUNT(*) as cnt FROM health_entries').get() as { cnt: number }).cnt;
}

// ── Mood Entries ──

export function insertMoodEntry(
  eventId: string, score: number, note: string, timestamp: string,
): MoodEntry {
  const id = uuid();
  db.prepare('INSERT INTO mood_entries (id, event_id, score, note, timestamp) VALUES (?, ?, ?, ?, ?)')
    .run(id, eventId, score, note, timestamp);
  return { id, event_id: eventId, score, note, timestamp };
}

export function getMoodByEvent(eventId: string): MoodEntry | undefined {
  return db.prepare('SELECT * FROM mood_entries WHERE event_id = ?').get(eventId) as MoodEntry | undefined;
}

export function getMoodEntries(limit = 100): MoodEntry[] {
  return db.prepare('SELECT * FROM mood_entries ORDER BY timestamp DESC LIMIT ?').all(limit) as MoodEntry[];
}

export function getMoodByDateRange(start: string, end: string): MoodEntry[] {
  return db.prepare('SELECT * FROM mood_entries WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC')
    .all(start, end + 'T23:59:59') as MoodEntry[];
}

// ── Chat Messages ──

export function insertChatMessage(role: ChatRole, content: string, contextSummary: string = ''): ChatMessage {
  const id = uuid();
  const created_at = now();
  db.prepare('INSERT INTO chat_messages (id, role, content, context_summary, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, role, content, contextSummary, created_at);
  return { id, role, content, context_summary: contextSummary, created_at };
}

export function getChatMessages(limit = 50): ChatMessage[] {
  return db.prepare('SELECT * FROM chat_messages ORDER BY created_at ASC LIMIT ?').all(limit) as ChatMessage[];
}

export function clearChatMessages(): void {
  db.prepare('DELETE FROM chat_messages').run();
}

// ── AI Digests ──

export function insertAIDigest(
  eventId: string, period: DigestPeriod, periodStart: string,
  periodEnd: string, content: string,
): AIDigest {
  const id = uuid();
  const created_at = now();
  db.prepare('INSERT INTO ai_digests (id, event_id, period, period_start, period_end, content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, eventId, period, periodStart, periodEnd, content, created_at);
  return { id, event_id: eventId, period, period_start: periodStart, period_end: periodEnd, content, created_at };
}

export function getAIDigests(limit = 20): AIDigest[] {
  return db.prepare('SELECT * FROM ai_digests ORDER BY created_at DESC LIMIT ?').all(limit) as AIDigest[];
}

export function getLastDigest(period: DigestPeriod): AIDigest | undefined {
  return db.prepare('SELECT * FROM ai_digests WHERE period = ? ORDER BY created_at DESC LIMIT 1').get(period) as AIDigest | undefined;
}

// ── Import Stats ──

export function getImportStats(): ImportStats {
  const txCount = getTransactionCount();
  const txLastImport = db.prepare("SELECT MAX(timestamp) as ts FROM activity_log WHERE entry_type = 'csv_import'").get() as { ts: string | null };
  const locCount = getLocationCount();
  const locLastImport = db.prepare("SELECT MAX(timestamp) as ts FROM activity_log WHERE entry_type = 'import_location'").get() as { ts: string | null };
  const calCount = getCalendarEventCount();
  const calLastImport = db.prepare("SELECT MAX(timestamp) as ts FROM activity_log WHERE entry_type = 'import_calendar'").get() as { ts: string | null };
  const healthCount = getHealthEntryCount();
  const healthLastImport = db.prepare("SELECT MAX(timestamp) as ts FROM activity_log WHERE entry_type = 'import_health'").get() as { ts: string | null };

  const photoCount = getPhotoCount();
  const analyzedPhotoCount = getAnalyzedPhotoCount();
  const photoLastImport = db.prepare("SELECT MAX(timestamp) as ts FROM activity_log WHERE entry_type = 'photo_saved'").get() as { ts: string | null };
  const videoCount = getVideoCount();
  const videoLastImport = db.prepare("SELECT MAX(timestamp) as ts FROM activity_log WHERE entry_type = 'video_imported'").get() as { ts: string | null };

  return {
    transactions: { count: txCount, lastImport: txLastImport.ts },
    locations: { count: locCount, lastImport: locLastImport.ts },
    calendar: { count: calCount, lastImport: calLastImport.ts },
    health: { count: healthCount, lastImport: healthLastImport.ts },
    photos: { count: photoCount, analyzed: analyzedPhotoCount, lastImport: photoLastImport.ts },
    videos: { count: videoCount, lastImport: videoLastImport.ts },
  };
}

// ── Event counts by type ──

export function getEventCountsByType(): Record<string, number> {
  const rows = db.prepare('SELECT type, COUNT(*) as cnt FROM events GROUP BY type').all() as { type: string; cnt: number }[];
  const result: Record<string, number> = {};
  for (const row of rows) result[row.type] = row.cnt;
  return result;
}

// ── Photos (Phase 5) ──

export function insertPhoto(
  eventId: string, filePath: string, caption: string = '', source: string = 'telegram',
): { id: string; event_id: string; file_path: string; caption: string; source: string; created_at: string } {
  const id = uuid();
  const created_at = now();
  db.prepare('INSERT INTO photos (id, event_id, file_path, caption, source, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, eventId, filePath, caption, source, created_at);
  return { id, event_id: eventId, file_path: filePath, caption, source, created_at };
}

export function getPhotoByEvent(eventId: string): { id: string; event_id: string; file_path: string; caption: string; source: string; created_at: string } | undefined {
  return db.prepare('SELECT * FROM photos WHERE event_id = ?').get(eventId) as any;
}

export function getPhotoCount(): number {
  return (db.prepare('SELECT COUNT(*) as cnt FROM photos').get() as { cnt: number }).cnt;
}

export function getPhotos(limit = 100): PhotoRecord[] {
  return db.prepare('SELECT * FROM photos ORDER BY created_at DESC LIMIT ?').all(limit) as any[];
}

// ── Photo Analyses (Phase 7: Visual Memory) ──

export function insertPhotoAnalysis(
  photoId: string,
  description: string,
  tags: string[],
  detectedText: string,
  moodIndicators: { tone: string; confidence: number },
  peopleCount: number,
  model: string,
): PhotoAnalysis {
  const id = uuid();
  const analyzed_at = now();
  db.prepare(`
    INSERT INTO photo_analyses (id, photo_id, description, tags, detected_text, mood_indicators, people_count, analyzed_at, model)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, photoId, description, JSON.stringify(tags), detectedText, JSON.stringify(moodIndicators), peopleCount, analyzed_at, model);
  return {
    id, photo_id: photoId, description, tags: JSON.stringify(tags),
    detected_text: detectedText, mood_indicators: JSON.stringify(moodIndicators),
    people_count: peopleCount, analyzed_at, model,
  };
}

export function getPhotoAnalysisByPhoto(photoId: string): PhotoAnalysis | undefined {
  return db.prepare('SELECT * FROM photo_analyses WHERE photo_id = ?').get(photoId) as PhotoAnalysis | undefined;
}

export function getAnalyzedPhotoCount(): number {
  return (db.prepare('SELECT COUNT(*) as cnt FROM photo_analyses').get() as { cnt: number }).cnt;
}

// ── Videos (Phase 7: Visual Memory) ──

export function insertVideo(
  eventId: string,
  filePath: string,
  durationSeconds: number,
  frameCount: number,
  summary: string,
  source: VideoSource = 'import',
): Video {
  const id = uuid();
  const created_at = now();
  db.prepare(`
    INSERT INTO videos (id, event_id, file_path, duration_seconds, frame_count, summary, source, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, eventId, filePath, durationSeconds, frameCount, summary, source, created_at);
  return { id, event_id: eventId, file_path: filePath, duration_seconds: durationSeconds, frame_count: frameCount, summary, source, created_at };
}

export function getVideoByEvent(eventId: string): Video | undefined {
  return db.prepare('SELECT * FROM videos WHERE event_id = ?').get(eventId) as Video | undefined;
}

export function getVideoCount(): number {
  return (db.prepare('SELECT COUNT(*) as cnt FROM videos').get() as { cnt: number }).cnt;
}

export function getVideos(limit = 50): Video[] {
  return db.prepare('SELECT * FROM videos ORDER BY created_at DESC LIMIT ?').all(limit) as Video[];
}

export function insertVideoFrame(
  videoId: string,
  framePath: string,
  timestampSeconds: number,
  description: string,
): VideoFrame {
  const id = uuid();
  db.prepare(`
    INSERT INTO video_frames (id, video_id, frame_path, timestamp_seconds, description)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, videoId, framePath, timestampSeconds, description);
  return { id, video_id: videoId, frame_path: framePath, timestamp_seconds: timestampSeconds, description };
}

export function getVideoFrames(videoId: string): VideoFrame[] {
  return db.prepare('SELECT * FROM video_frames WHERE video_id = ? ORDER BY timestamp_seconds ASC').all(videoId) as VideoFrame[];
}

// ── Phase 8: Visual Comparison helpers ──

export function getPhotosInWindow(tsStart: string, tsEnd: string): (PhotoRecord & { analysis?: PhotoAnalysis })[] {
  const photos = db.prepare(`
    SELECT p.* FROM photos p
    JOIN events e ON p.event_id = e.id
    WHERE e.timestamp >= ? AND e.timestamp <= ?
    ORDER BY e.timestamp ASC
  `).all(tsStart, tsEnd) as PhotoRecord[];

  return photos.map(p => {
    const analysis = getPhotoAnalysisByPhoto(p.id);
    return analysis ? { ...p, analysis } : p;
  });
}

export function getVideosInWindow(tsStart: string, tsEnd: string): Video[] {
  return db.prepare(`
    SELECT v.* FROM videos v
    JOIN events e ON v.event_id = e.id
    WHERE e.timestamp >= ? AND e.timestamp <= ?
    ORDER BY e.timestamp ASC
  `).all(tsStart, tsEnd) as Video[];
}

// ── Embeddings (Phase 5: Semantic Search) ──

export function upsertEmbedding(eventId: string, embedding: number[], model: string): void {
  const blob = Buffer.from(new Float32Array(embedding).buffer);
  db.prepare(`
    INSERT INTO memory_embeddings (event_id, embedding, model)
    VALUES (?, ?, ?)
    ON CONFLICT(event_id) DO UPDATE SET
      embedding = excluded.embedding,
      model = excluded.model,
      created_at = datetime('now')
  `).run(eventId, blob, model);
}

export function getEmbedding(eventId: string): { event_id: string; embedding: Buffer; model: string } | undefined {
  return db.prepare('SELECT * FROM memory_embeddings WHERE event_id = ?').get(eventId) as
    { event_id: string; embedding: Buffer; model: string } | undefined;
}

export function getAllEmbeddings(): { event_id: string; embedding: Buffer }[] {
  return db.prepare('SELECT event_id, embedding FROM memory_embeddings').all() as
    { event_id: string; embedding: Buffer }[];
}

export function getEmbeddingCount(): number {
  return (db.prepare('SELECT COUNT(*) as cnt FROM memory_embeddings').get() as { cnt: number }).cnt;
}

export function getUnembeddedEventIds(): string[] {
  return (db.prepare(`
    SELECT e.id FROM events e
    LEFT JOIN memory_embeddings me ON e.id = me.event_id
    WHERE me.event_id IS NULL
    ORDER BY e.timestamp DESC
  `).all() as { id: string }[]).map(r => r.id);
}

export function deleteEmbedding(eventId: string): void {
  db.prepare('DELETE FROM memory_embeddings WHERE event_id = ?').run(eventId);
}

export function deleteAllEmbeddings(): void {
  db.prepare('DELETE FROM memory_embeddings').run();
}

// ── Phase 6: Dark Grain — Re-do & Forensic queries ──

/**
 * Get all events within a precise timestamp window (ISO strings).
 * Unlike getEventsByDateRange which works at date level, this is timestamp-precise.
 */
export function getEventsInWindow(tsStart: string, tsEnd: string): Event[] {
  return db.prepare(
    'SELECT * FROM events WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC'
  ).all(tsStart, tsEnd) as Event[];
}

/**
 * Get transactions within a precise timestamp window.
 * Joins with events table for timestamp precision (money_transactions.date is date-only).
 */
export function getTransactionsInWindow(tsStart: string, tsEnd: string): MoneyTransaction[] {
  return db.prepare(`
    SELECT mt.* FROM money_transactions mt
    JOIN events e ON mt.event_id = e.id
    WHERE e.timestamp >= ? AND e.timestamp <= ?
    ORDER BY e.timestamp ASC
  `).all(tsStart, tsEnd) as MoneyTransaction[];
}

/** Get locations within a precise timestamp window. */
export function getLocationsInWindow(tsStart: string, tsEnd: string): Location[] {
  return db.prepare(
    'SELECT * FROM locations WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC'
  ).all(tsStart, tsEnd) as Location[];
}

/** Get calendar events that overlap with a timestamp window. */
export function getCalendarEventsInWindow(tsStart: string, tsEnd: string): CalendarEvent[] {
  return db.prepare(
    'SELECT * FROM calendar_events WHERE start_time <= ? AND end_time >= ? ORDER BY start_time ASC'
  ).all(tsEnd, tsStart) as CalendarEvent[];
}

/** Get health entries within a precise timestamp window. */
export function getHealthEntriesInWindow(tsStart: string, tsEnd: string): HealthEntry[] {
  return db.prepare(
    'SELECT * FROM health_entries WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC'
  ).all(tsStart, tsEnd) as HealthEntry[];
}

/** Get mood entries within a precise timestamp window. */
export function getMoodEntriesInWindow(tsStart: string, tsEnd: string): MoodEntry[] {
  return db.prepare(
    'SELECT * FROM mood_entries WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC'
  ).all(tsStart, tsEnd) as MoodEntry[];
}

/** Get notes within a precise timestamp window (via events table join). */
export function getNotesInWindow(tsStart: string, tsEnd: string): Note[] {
  return db.prepare(`
    SELECT n.* FROM notes n
    JOIN events e ON n.event_id = e.id
    WHERE e.timestamp >= ? AND e.timestamp <= ?
    ORDER BY e.timestamp ASC
  `).all(tsStart, tsEnd) as Note[];
}

/** Get voice memos within a precise timestamp window (via events table join). */
export function getVoiceMemosInWindow(tsStart: string, tsEnd: string): VoiceMemo[] {
  return db.prepare(`
    SELECT v.* FROM voice_memos v
    JOIN events e ON v.event_id = e.id
    WHERE e.timestamp >= ? AND e.timestamp <= ?
    ORDER BY e.timestamp ASC
  `).all(tsStart, tsEnd) as VoiceMemo[];
}

/**
 * Enrich an event with its domain-specific data.
 * Returns the event plus any related note, voice_memo, transaction, location, etc.
 */
export function enrichEvent(event: Event): EnrichedEvent {
  const enriched: EnrichedEvent = { ...event };

  switch (event.type) {
    case 'note':
    case 'thought':
    case 'decision':
    case 'observation':
      enriched.note = getNoteByEvent(event.id);
      break;
    case 'voice_memo':
      enriched.voice_memo = getVoiceMemoByEvent(event.id);
      break;
    case 'money_transaction':
      enriched.transaction = db.prepare('SELECT * FROM money_transactions WHERE event_id = ?').get(event.id) as MoneyTransaction | undefined;
      break;
    case 'location':
      enriched.location = getLocationByEvent(event.id);
      break;
    case 'calendar_event':
      enriched.calendar_event = getCalendarEventByEvent(event.id);
      break;
    case 'health_entry':
      enriched.health_entry = getHealthEntryByEvent(event.id);
      break;
    case 'mood':
      enriched.mood = getMoodByEvent(event.id);
      break;
    case 'photo': {
      const photo = getPhotoByEvent(event.id);
      if (photo) {
        const analysis = getPhotoAnalysisByPhoto(photo.id);
        enriched.photo = analysis ? { ...photo, analysis } : photo;
      }
      break;
    }
    case 'video': {
      const video = getVideoByEvent(event.id);
      if (video) {
        const frames = getVideoFrames(video.id);
        enriched.video = { ...video, frames };
      }
      break;
    }
  }

  return enriched;
}

/**
 * Get enriched events surrounding a timestamp within a window (in minutes).
 * Used by Forensic Zoom to show "what was happening before/after."
 */
export function getEnrichedEventsInWindow(tsStart: string, tsEnd: string): EnrichedEvent[] {
  const events = getEventsInWindow(tsStart, tsEnd);
  return events.map(enrichEvent);
}

// ── Phase 6: Inconsistencies — the grain catches contradictions ──

export function insertInconsistency(
  type: InconsistencyType,
  severity: number,
  title: string,
  description: string,
  evidenceEventIds: string[],
  suggestedQuestion: string,
  date: string,
): Inconsistency {
  const id = uuid();
  const detected_at = now();
  db.prepare(`
    INSERT INTO inconsistencies (id, type, severity, title, description, evidence_event_ids, suggested_question, date, detected_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, type, severity, title, description, JSON.stringify(evidenceEventIds), suggestedQuestion, date, detected_at);
  return { id, type, severity, title, description, evidenceEventIds, suggestedQuestion, date, detectedAt: detected_at };
}

export function getInconsistencies(limit = 50): Inconsistency[] {
  const rows = db.prepare(
    'SELECT * FROM inconsistencies ORDER BY severity DESC, detected_at DESC LIMIT ?'
  ).all(limit) as any[];
  return rows.map(r => ({
    id: r.id,
    type: r.type as InconsistencyType,
    severity: r.severity,
    title: r.title,
    description: r.description,
    evidenceEventIds: JSON.parse(r.evidence_event_ids),
    suggestedQuestion: r.suggested_question,
    date: r.date,
    detectedAt: r.detected_at,
  }));
}

export function getInconsistenciesByDate(date: string): Inconsistency[] {
  const rows = db.prepare(
    'SELECT * FROM inconsistencies WHERE date = ? ORDER BY severity DESC'
  ).all(date) as any[];
  return rows.map(r => ({
    id: r.id,
    type: r.type as InconsistencyType,
    severity: r.severity,
    title: r.title,
    description: r.description,
    evidenceEventIds: JSON.parse(r.evidence_event_ids),
    suggestedQuestion: r.suggested_question,
    date: r.date,
    detectedAt: r.detected_at,
  }));
}

export function clearInconsistenciesForDate(date: string): void {
  db.prepare('DELETE FROM inconsistencies WHERE date = ?').run(date);
}

export function dismissInconsistency(id: string): void {
  db.prepare('DELETE FROM inconsistencies WHERE id = ?').run(id);
}

// ── Phase 6: Confrontations — uncomfortable truths ──

export function insertConfrontation(
  title: string,
  insight: string,
  severity: number,
  dataPoints: { label: string; value: string }[],
  relatedEventIds: string[],
  category: ConfrontationCategory,
): Confrontation {
  const id = uuid();
  const generated_at = now();
  db.prepare(`
    INSERT INTO confrontations (id, title, insight, severity, data_points, related_event_ids, category, generated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, title, insight, severity, JSON.stringify(dataPoints), JSON.stringify(relatedEventIds), category, generated_at);
  return { id, title, insight, severity, dataPoints, relatedEventIds, category, generatedAt: generated_at };
}

export function getConfrontations(limit = 20): Confrontation[] {
  const rows = db.prepare(
    'SELECT * FROM confrontations ORDER BY severity DESC, generated_at DESC LIMIT ?'
  ).all(limit) as any[];
  return rows.map(r => ({
    id: r.id,
    title: r.title,
    insight: r.insight,
    severity: r.severity,
    dataPoints: JSON.parse(r.data_points),
    relatedEventIds: JSON.parse(r.related_event_ids),
    category: r.category as ConfrontationCategory,
    generatedAt: r.generated_at,
  }));
}

export function clearConfrontations(): void {
  db.prepare('DELETE FROM confrontations').run();
}

export function acknowledgeConfrontation(id: string): void {
  db.prepare('DELETE FROM confrontations WHERE id = ?').run(id);
}

// ── Users (Auth) ──

export interface DbUser {
  id: string;
  username: string;
  password_hash: string;
  must_change_password: number;
  created_at: string;
  updated_at: string;
}

export function getUserByUsername(username: string): DbUser | undefined {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username) as DbUser | undefined;
}

export function getUserById(id: string): DbUser | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as DbUser | undefined;
}

export function createUser(username: string, passwordHash: string, mustChangePassword = true): DbUser {
  const id = uuid();
  const created_at = now();
  db.prepare(
    'INSERT INTO users (id, username, password_hash, must_change_password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, username, passwordHash, mustChangePassword ? 1 : 0, created_at, created_at);
  return { id, username, password_hash: passwordHash, must_change_password: mustChangePassword ? 1 : 0, created_at, updated_at: created_at };
}

export function updateUserPassword(id: string, newHash: string): void {
  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?')
    .run(newHash, now(), id);
}

export function getUserCount(): number {
  return (db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number }).cnt;
}
