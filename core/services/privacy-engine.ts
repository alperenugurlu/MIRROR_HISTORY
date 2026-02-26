/**
 * Privacy Engine — GDPR-compliant data management
 *
 * Features:
 * - Retention policies (auto-delete old data)
 * - Full data export (right to portability)
 * - Panic wipe (delete everything)
 * - Per-source classification filtering
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import * as db from '../database';

export type RetentionPeriod = '30d' | '90d' | '1y' | 'forever';

interface PrivacyConfig {
  retentionPeriod: RetentionPeriod;
}

const PRIVACY_CONFIG_PATH = path.join(os.homedir(), '.mirror-history', 'privacy-config.json');

// ── Config ──

export function loadPrivacyConfig(): PrivacyConfig {
  try {
    if (fs.existsSync(PRIVACY_CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(PRIVACY_CONFIG_PATH, 'utf-8'));
    }
  } catch {
    // ignore
  }
  return { retentionPeriod: 'forever' };
}

export function savePrivacyConfig(config: Partial<PrivacyConfig>): void {
  const existing = loadPrivacyConfig();
  const merged = { ...existing, ...config };
  const dir = path.dirname(PRIVACY_CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PRIVACY_CONFIG_PATH, JSON.stringify(merged, null, 2), { mode: 0o600 });
}

// ── Retention ──

function getRetentionCutoffDate(period: RetentionPeriod): string | null {
  if (period === 'forever') return null;

  const now = new Date();
  switch (period) {
    case '30d': now.setDate(now.getDate() - 30); break;
    case '90d': now.setDate(now.getDate() - 90); break;
    case '1y': now.setFullYear(now.getFullYear() - 1); break;
  }
  return now.toISOString().slice(0, 10);
}

export function applyRetentionPolicy(): { deleted: number } {
  const config = loadPrivacyConfig();
  const cutoff = getRetentionCutoffDate(config.retentionPeriod);
  if (!cutoff) return { deleted: 0 };

  return deleteEventsOlderThan(cutoff);
}

export function deleteEventsOlderThan(cutoffDate: string): { deleted: number } {
  const database = db.getDb();

  // Find events to delete
  const events = database.prepare(
    'SELECT id FROM events WHERE timestamp < ?',
  ).all(cutoffDate + 'T00:00:00') as { id: string }[];

  if (events.length === 0) return { deleted: 0 };

  const eventIds = events.map(e => e.id);

  // Delete related data (in order to respect FK constraints)
  const placeholders = eventIds.map(() => '?').join(',');

  // Delete voice memo files
  const voiceMemos = database.prepare(
    `SELECT file_path FROM voice_memos WHERE event_id IN (${placeholders})`,
  ).all(...eventIds) as { file_path: string }[];

  for (const vm of voiceMemos) {
    try {
      if (vm.file_path && fs.existsSync(vm.file_path)) {
        fs.unlinkSync(vm.file_path);
      }
    } catch {
      // ignore file deletion errors
    }
  }

  // Delete photo files
  const photos = database.prepare(
    `SELECT file_path FROM photos WHERE event_id IN (${placeholders})`,
  ).all(...eventIds) as { file_path: string }[];

  for (const p of photos) {
    try {
      if (p.file_path && fs.existsSync(p.file_path)) {
        fs.unlinkSync(p.file_path);
      }
    } catch {
      // ignore file deletion errors
    }
  }

  // Delete from all related tables
  database.prepare(`DELETE FROM memory_embeddings WHERE event_id IN (${placeholders})`).run(...eventIds);
  database.prepare(`DELETE FROM photos WHERE event_id IN (${placeholders})`).run(...eventIds);
  database.prepare(`DELETE FROM voice_memos WHERE event_id IN (${placeholders})`).run(...eventIds);
  database.prepare(`DELETE FROM notes WHERE event_id IN (${placeholders})`).run(...eventIds);
  database.prepare(`DELETE FROM money_transactions WHERE event_id IN (${placeholders})`).run(...eventIds);
  database.prepare(`DELETE FROM locations WHERE event_id IN (${placeholders})`).run(...eventIds);
  database.prepare(`DELETE FROM calendar_events WHERE event_id IN (${placeholders})`).run(...eventIds);
  database.prepare(`DELETE FROM health_entries WHERE event_id IN (${placeholders})`).run(...eventIds);
  database.prepare(`DELETE FROM mood_entries WHERE event_id IN (${placeholders})`).run(...eventIds);
  database.prepare(`DELETE FROM ai_digests WHERE event_id IN (${placeholders})`).run(...eventIds);
  database.prepare(`DELETE FROM evidence_refs WHERE event_id IN (${placeholders})`).run(...eventIds);
  database.prepare(`DELETE FROM actions WHERE event_id IN (${placeholders})`).run(...eventIds);

  // Remove from FTS index
  for (const id of eventIds) {
    db.removeFromSearch(id);
  }

  // Finally delete events
  database.prepare(`DELETE FROM events WHERE id IN (${placeholders})`).run(...eventIds);

  return { deleted: events.length };
}

// ── Full Data Export (GDPR Right to Portability) ──

export interface DataExport {
  exportDate: string;
  version: string;
  events: unknown[];
  notes: unknown[];
  voiceMemos: unknown[];
  photos: unknown[];
  transactions: unknown[];
  locations: unknown[];
  calendarEvents: unknown[];
  healthEntries: unknown[];
  moodEntries: unknown[];
  chatMessages: unknown[];
  subscriptions: unknown[];
  digests: unknown[];
  rules: unknown[];
}

export function exportAllData(excludeSensitive = false): DataExport {
  const database = db.getDb();

  let eventsQuery = 'SELECT * FROM events ORDER BY timestamp DESC';
  if (excludeSensitive) {
    eventsQuery = "SELECT * FROM events WHERE classification != 'local_sensitive' ORDER BY timestamp DESC";
  }

  const events = database.prepare(eventsQuery).all();
  const eventIds = (events as { id: string }[]).map(e => e.id);

  // If excluding sensitive, filter related data too
  let filter = '';
  if (excludeSensitive && eventIds.length > 0) {
    const placeholders = eventIds.map(() => '?').join(',');
    filter = ` WHERE event_id IN (${placeholders})`;
  }

  return {
    exportDate: new Date().toISOString(),
    version: '1.0',
    events,
    notes: database.prepare(`SELECT * FROM notes${filter || ''} ORDER BY created_at DESC`).all(
      ...(excludeSensitive ? eventIds : []),
    ),
    voiceMemos: database.prepare(
      `SELECT id, event_id, transcript, duration_seconds, source, created_at FROM voice_memos${filter || ''} ORDER BY created_at DESC`,
    ).all(...(excludeSensitive ? eventIds : [])),
    photos: database.prepare(`SELECT * FROM photos${filter || ''} ORDER BY created_at DESC`).all(
      ...(excludeSensitive ? eventIds : []),
    ),
    transactions: database.prepare(`SELECT * FROM money_transactions${filter || ''} ORDER BY date DESC`).all(
      ...(excludeSensitive ? eventIds : []),
    ),
    locations: database.prepare(`SELECT * FROM locations${filter || ''} ORDER BY timestamp DESC`).all(
      ...(excludeSensitive ? eventIds : []),
    ),
    calendarEvents: database.prepare(`SELECT * FROM calendar_events${filter || ''} ORDER BY start_time DESC`).all(
      ...(excludeSensitive ? eventIds : []),
    ),
    healthEntries: database.prepare(`SELECT * FROM health_entries${filter || ''} ORDER BY timestamp DESC`).all(
      ...(excludeSensitive ? eventIds : []),
    ),
    moodEntries: database.prepare(`SELECT * FROM mood_entries${filter || ''} ORDER BY timestamp DESC`).all(
      ...(excludeSensitive ? eventIds : []),
    ),
    chatMessages: database.prepare('SELECT * FROM chat_messages ORDER BY created_at ASC').all(),
    subscriptions: database.prepare('SELECT * FROM subscriptions ORDER BY last_seen_date DESC').all(),
    digests: database.prepare('SELECT * FROM ai_digests ORDER BY created_at DESC').all(),
    rules: database.prepare('SELECT * FROM rules ORDER BY created_at DESC').all(),
  };
}

export function exportToFile(excludeSensitive = false): string {
  const data = exportAllData(excludeSensitive);
  const exportDir = path.join(os.homedir(), '.mirror-history', 'exports');
  if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

  const filename = `mirror-history-export-${new Date().toISOString().slice(0, 10)}.json`;
  const filePath = path.join(exportDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

  return filePath;
}

// ── Panic Wipe (delete everything) ──

export function panicWipe(): { success: boolean; message: string } {
  const database = db.getDb();

  try {
    // Delete all voice files
    const voiceDir = path.join(os.homedir(), '.mirror-history', 'voice');
    if (fs.existsSync(voiceDir)) {
      const files = fs.readdirSync(voiceDir);
      for (const file of files) {
        try {
          fs.unlinkSync(path.join(voiceDir, file));
        } catch {
          // continue
        }
      }
    }

    // Delete all photos
    const photoDir = path.join(os.homedir(), '.mirror-history', 'photos');
    if (fs.existsSync(photoDir)) {
      const files = fs.readdirSync(photoDir);
      for (const file of files) {
        try {
          fs.unlinkSync(path.join(photoDir, file));
        } catch {
          // continue
        }
      }
    }

    // Delete all data from all tables (order matters for FK constraints)
    database.exec(`
      DELETE FROM memory_embeddings;
      DELETE FROM photos;
      DELETE FROM evidence_refs;
      DELETE FROM actions;
      DELETE FROM voice_memos;
      DELETE FROM notes;
      DELETE FROM money_transactions;
      DELETE FROM locations;
      DELETE FROM calendar_events;
      DELETE FROM health_entries;
      DELETE FROM mood_entries;
      DELETE FROM ai_digests;
      DELETE FROM chat_messages;
      DELETE FROM subscriptions;
      DELETE FROM diffs;
      DELETE FROM activity_log;
      DELETE FROM rules;
      DELETE FROM events;
    `);

    // Clear FTS index
    try {
      database.exec('DELETE FROM events_fts');
    } catch {
      // FTS might not exist
    }

    // Delete config files (but keep the app itself functional)
    const configFiles = [
      path.join(os.homedir(), '.mirror-history', 'ai-config.json'),
      path.join(os.homedir(), '.mirror-history', 'privacy-config.json'),
      path.join(os.homedir(), '.mirror-history', 'transcription-config.json'),
      path.join(os.homedir(), '.mirror-history', 'telegram-config.json'),
    ];
    for (const f of configFiles) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch {
        // continue
      }
    }

    // Delete exports
    const exportDir = path.join(os.homedir(), '.mirror-history', 'exports');
    if (fs.existsSync(exportDir)) {
      const files = fs.readdirSync(exportDir);
      for (const file of files) {
        try {
          fs.unlinkSync(path.join(exportDir, file));
        } catch {
          // continue
        }
      }
    }

    return { success: true, message: 'All data has been permanently deleted.' };
  } catch (err) {
    return {
      success: false,
      message: `Wipe partially failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}

// ── Privacy Stats ──

export function getPrivacyStats(): {
  retentionPeriod: RetentionPeriod;
  totalEvents: number;
  sensitiveEvents: number;
  voiceFiles: number;
  dbSizeBytes: number;
} {
  const config = loadPrivacyConfig();
  const database = db.getDb();

  const totalEvents = db.getEventCount();
  const sensitiveCount = (database.prepare(
    "SELECT COUNT(*) as cnt FROM events WHERE classification = 'local_sensitive'",
  ).get() as { cnt: number }).cnt;

  // Count voice files
  const voiceDir = path.join(os.homedir(), '.mirror-history', 'voice');
  let voiceFiles = 0;
  try {
    if (fs.existsSync(voiceDir)) {
      voiceFiles = fs.readdirSync(voiceDir).length;
    }
  } catch {
    // ignore
  }

  // Get DB file size
  const dbPath = path.join(os.homedir(), '.mirror-history', 'mirror-history.db');
  let dbSizeBytes = 0;
  try {
    if (fs.existsSync(dbPath)) {
      dbSizeBytes = fs.statSync(dbPath).size;
    }
  } catch {
    // ignore
  }

  return {
    retentionPeriod: config.retentionPeriod,
    totalEvents,
    sensitiveEvents: sensitiveCount,
    voiceFiles,
    dbSizeBytes,
  };
}
