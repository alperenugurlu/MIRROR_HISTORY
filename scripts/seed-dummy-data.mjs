/**
 * Seed script — populates Mirror History database with realistic dummy transaction data.
 *
 * Covers all detection scenarios:
 *   - Subscriptions (Netflix, Spotify, iCloud, ChatGPT Plus)
 *   - Price increase (Netflix went from $15.99 → $17.99)
 *   - Anomaly (Starbucks unusually large charge)
 *   - Pending refund (large Apple Store purchase, no refund)
 *   - Regular spending (groceries, transport, shopping)
 *
 * Usage:  node scripts/seed-dummy-data.mjs
 */

import Database from 'better-sqlite3';
import crypto from 'crypto';
import path from 'path';
import os from 'os';
import fs from 'fs';

// ── Database Path ──
// Electron uses ~/Library/Application Support/mirror-history/mirror-history.db on macOS
// Core uses ~/.mirror-history/mirror-history.db
// We write to BOTH so it works regardless of how the app is started.

const electronDbPath = path.join(os.homedir(), 'Library', 'Application Support', 'mirror-history', 'mirror-history.db');
const coreDbPath = path.join(os.homedir(), '.mirror-history', 'mirror-history.db');

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function hashRow(date, merchant, amount, currency) {
  return crypto.createHash('sha256')
    .update(`${date}|${merchant}|${amount}|${currency}`)
    .digest('hex');
}

function uuid() {
  return crypto.randomUUID();
}

// ── Transaction Data ──

function generateTransactions() {
  const txs = [];

  // Helper: add a transaction
  const add = (date, merchant, amount, category, account = 'checking') => {
    txs.push({ date, merchant, amount, currency: 'USD', category, account });
  };

  // ─── Subscriptions (recurring monthly) ───

  // Netflix — 5 months at $15.99, then price increase to $17.99
  add('2025-08-15', 'Netflix', -15.99, 'entertainment');
  add('2025-09-15', 'Netflix', -15.99, 'entertainment');
  add('2025-10-15', 'Netflix', -15.99, 'entertainment');
  add('2025-11-15', 'Netflix', -15.99, 'entertainment');
  add('2025-12-15', 'Netflix', -15.99, 'entertainment');
  add('2026-01-15', 'Netflix', -17.99, 'entertainment'); // price increase!
  add('2026-02-15', 'Netflix', -17.99, 'entertainment');

  // Spotify
  add('2025-08-05', 'Spotify', -9.99, 'entertainment');
  add('2025-09-05', 'Spotify', -9.99, 'entertainment');
  add('2025-10-05', 'Spotify', -9.99, 'entertainment');
  add('2025-11-05', 'Spotify', -9.99, 'entertainment');
  add('2025-12-05', 'Spotify', -9.99, 'entertainment');
  add('2026-01-05', 'Spotify', -9.99, 'entertainment');
  add('2026-02-05', 'Spotify', -9.99, 'entertainment');

  // iCloud Storage
  add('2025-08-01', 'Apple iCloud', -2.99, 'cloud');
  add('2025-09-01', 'Apple iCloud', -2.99, 'cloud');
  add('2025-10-01', 'Apple iCloud', -2.99, 'cloud');
  add('2025-11-01', 'Apple iCloud', -2.99, 'cloud');
  add('2025-12-01', 'Apple iCloud', -2.99, 'cloud');
  add('2026-01-01', 'Apple iCloud', -2.99, 'cloud');
  add('2026-02-01', 'Apple iCloud', -2.99, 'cloud');

  // ChatGPT Plus
  add('2025-10-20', 'OpenAI ChatGPT', -20.00, 'software');
  add('2025-11-20', 'OpenAI ChatGPT', -20.00, 'software');
  add('2025-12-20', 'OpenAI ChatGPT', -20.00, 'software');
  add('2026-01-20', 'OpenAI ChatGPT', -20.00, 'software');
  add('2026-02-20', 'OpenAI ChatGPT', -20.00, 'software');

  // ─── Gym — price increase ───
  add('2025-08-01', 'FitLife Gym', -49.99, 'health');
  add('2025-09-01', 'FitLife Gym', -49.99, 'health');
  add('2025-10-01', 'FitLife Gym', -49.99, 'health');
  add('2025-11-01', 'FitLife Gym', -49.99, 'health');
  add('2025-12-01', 'FitLife Gym', -49.99, 'health');
  add('2026-01-01', 'FitLife Gym', -59.99, 'health'); // price jump!
  add('2026-02-01', 'FitLife Gym', -59.99, 'health');

  // ─── Starbucks — regular + anomaly ───
  add('2025-08-03', 'Starbucks', -5.45, 'coffee');
  add('2025-08-18', 'Starbucks', -6.20, 'coffee');
  add('2025-09-07', 'Starbucks', -5.95, 'coffee');
  add('2025-09-22', 'Starbucks', -4.80, 'coffee');
  add('2025-10-10', 'Starbucks', -6.10, 'coffee');
  add('2025-10-28', 'Starbucks', -5.50, 'coffee');
  add('2025-11-14', 'Starbucks', -5.75, 'coffee');
  add('2025-12-05', 'Starbucks', -6.30, 'coffee');
  add('2026-01-12', 'Starbucks', -5.60, 'coffee');
  add('2026-02-08', 'Starbucks', -47.50, 'coffee'); // anomaly! (office order?)

  // ─── Amazon — regular + anomaly ───
  add('2025-08-10', 'Amazon', -34.99, 'shopping');
  add('2025-09-02', 'Amazon', -22.50, 'shopping');
  add('2025-09-28', 'Amazon', -45.00, 'shopping');
  add('2025-10-15', 'Amazon', -38.75, 'shopping');
  add('2025-11-08', 'Amazon', -29.99, 'shopping');
  add('2025-12-12', 'Amazon', -55.20, 'shopping');
  add('2026-01-05', 'Amazon', -41.30, 'shopping');
  add('2026-02-10', 'Amazon', -349.99, 'shopping'); // anomaly!

  // ─── Apple Store — pending refund candidate ───
  add('2026-01-05', 'Apple Store', -999.00, 'electronics'); // large purchase 48 days ago

  // ─── Groceries ───
  add('2025-08-04', 'Whole Foods', -87.32, 'groceries');
  add('2025-08-20', 'Whole Foods', -62.15, 'groceries');
  add('2025-09-06', 'Trader Joes', -54.80, 'groceries');
  add('2025-09-19', 'Whole Foods', -98.44, 'groceries');
  add('2025-10-03', 'Whole Foods', -71.20, 'groceries');
  add('2025-10-18', 'Trader Joes', -48.90, 'groceries');
  add('2025-11-01', 'Whole Foods', -105.60, 'groceries');
  add('2025-11-22', 'Trader Joes', -67.30, 'groceries');
  add('2025-12-08', 'Whole Foods', -92.10, 'groceries');
  add('2025-12-23', 'Whole Foods', -142.55, 'groceries'); // holiday shopping
  add('2026-01-10', 'Whole Foods', -78.90, 'groceries');
  add('2026-01-25', 'Trader Joes', -55.40, 'groceries');
  add('2026-02-07', 'Whole Foods', -83.20, 'groceries');
  add('2026-02-18', 'Trader Joes', -61.75, 'groceries');

  // ─── Transport ───
  add('2025-08-12', 'Uber', -12.50, 'transport');
  add('2025-08-25', 'Uber', -8.75, 'transport');
  add('2025-09-10', 'Uber', -15.30, 'transport');
  add('2025-09-30', 'Uber', -22.00, 'transport');
  add('2025-10-14', 'Uber', -11.20, 'transport');
  add('2025-11-05', 'Uber', -18.40, 'transport');
  add('2025-11-28', 'Uber', -9.90, 'transport');
  add('2025-12-15', 'Uber', -25.60, 'transport');
  add('2026-01-08', 'Uber', -14.75, 'transport');
  add('2026-02-03', 'Uber', -16.80, 'transport');

  // ─── Restaurants ───
  add('2025-08-16', 'Chipotle', -14.25, 'dining');
  add('2025-09-12', 'Shake Shack', -18.90, 'dining');
  add('2025-10-05', 'Chipotle', -15.50, 'dining');
  add('2025-10-22', 'Sweetgreen', -16.75, 'dining');
  add('2025-11-09', 'Shake Shack', -22.30, 'dining');
  add('2025-12-01', 'Chipotle', -13.80, 'dining');
  add('2025-12-18', 'Nobu', -185.00, 'dining'); // nice dinner
  add('2026-01-14', 'Sweetgreen', -17.20, 'dining');
  add('2026-01-28', 'Chipotle', -14.90, 'dining');
  add('2026-02-12', 'Shake Shack', -19.50, 'dining');
  add('2026-02-14', 'Le Bernardin', -245.00, 'dining'); // Valentine's dinner

  // ─── Target ───
  add('2025-09-08', 'Target', -67.80, 'shopping');
  add('2025-10-20', 'Target', -45.30, 'shopping');
  add('2025-12-10', 'Target', -89.50, 'shopping');
  add('2026-01-18', 'Target', -52.40, 'shopping');
  add('2026-02-15', 'Target', -38.90, 'shopping');

  // ─── Utilities ───
  add('2025-08-28', 'Con Edison', -125.40, 'utilities');
  add('2025-09-28', 'Con Edison', -118.60, 'utilities');
  add('2025-10-28', 'Con Edison', -132.10, 'utilities');
  add('2025-11-28', 'Con Edison', -145.80, 'utilities');
  add('2025-12-28', 'Con Edison', -158.90, 'utilities'); // winter heating
  add('2026-01-28', 'Con Edison', -162.30, 'utilities');

  // ─── Income / Refunds ───
  add('2025-09-15', 'Amazon Refund', 22.50, 'refund');
  add('2025-11-20', 'Target Refund', 45.30, 'refund');
  add('2026-01-30', 'PayPal Transfer', 500.00, 'transfer');

  return txs;
}

// ── Seed a single database ──

function seedDatabase(dbPath) {
  ensureDir(dbPath);

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create tables if they don't exist
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
  `);

  // Check if seed data already exists
  const count = db.prepare('SELECT COUNT(*) as n FROM money_transactions').get();
  if (count.n > 0) {
    console.log(`  [skip] ${dbPath} already has ${count.n} transactions`);
    db.close();
    return;
  }

  const txs = generateTransactions();

  const insertEvent = db.prepare(`
    INSERT INTO events (id, type, timestamp, summary, details_json, confidence, classification, content_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertTx = db.prepare(`
    INSERT OR IGNORE INTO money_transactions (id, event_id, date, merchant, amount, currency, category, account, raw_row_hash, source, source_ref)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertEvidence = db.prepare(`
    INSERT INTO evidence_refs (id, event_id, evidence_type, pointer, excerpt, hash)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertActivity = db.prepare(`
    INSERT INTO activity_log (id, entry_type, description, details_json)
    VALUES (?, ?, ?, ?)
  `);

  const insertAll = db.transaction(() => {
    let imported = 0;

    for (const tx of txs) {
      const eventId = uuid();
      const txId = uuid();
      const rawHash = hashRow(tx.date, tx.merchant, tx.amount, tx.currency);
      const contentHash = crypto.createHash('sha256')
        .update(`money_transaction|${tx.date}|${tx.merchant}|${tx.amount}`)
        .digest('hex');

      const amountStr = tx.amount < 0
        ? `-$${Math.abs(tx.amount).toFixed(2)}`
        : `+$${tx.amount.toFixed(2)}`;
      const summary = `${tx.merchant} ${amountStr} on ${tx.date}`;

      const detailsJson = JSON.stringify({
        merchant: tx.merchant,
        amount: tx.amount,
        currency: tx.currency,
        category: tx.category,
        account: tx.account,
      });

      insertEvent.run(
        eventId, 'money_transaction', `${tx.date}T12:00:00.000Z`,
        summary, detailsJson, 1.0, 'local_private', contentHash
      );

      insertTx.run(
        txId, eventId, tx.date, tx.merchant, tx.amount,
        tx.currency, tx.category, tx.account, rawHash,
        'csv_import', 'seed-data'
      );

      insertEvidence.run(
        uuid(), eventId, 'csv_row', 'seed-data',
        `${tx.date}, ${tx.merchant}, ${tx.amount}`, rawHash
      );

      imported++;
    }

    // Log the import activity
    insertActivity.run(
      uuid(), 'csv_import',
      `Seeded ${imported} dummy transactions (Aug 2025 — Feb 2026)`,
      JSON.stringify({ imported, source: 'seed-script' })
    );

    return imported;
  });

  const count2 = insertAll();
  console.log(`  [done] Inserted ${count2} transactions into ${dbPath}`);
  db.close();
}

// ── Main ──

console.log('\n🌱 Mirror History — Seeding dummy data...\n');

seedDatabase(electronDbPath);
seedDatabase(coreDbPath);

console.log('\n✅ Done! Restart the Electron app and open the Dashboard.\n');
console.log('   The diff engine will auto-detect:');
console.log('   • Subscriptions: Netflix, Spotify, iCloud, ChatGPT Plus, FitLife Gym');
console.log('   • Price increases: Netflix ($15.99 → $17.99), FitLife Gym ($49.99 → $59.99)');
console.log('   • Anomalies: Starbucks $47.50 (usual ~$6), Amazon $349.99 (usual ~$38)');
console.log('   • Pending refund: Apple Store $999.00 (48 days ago)\n');
