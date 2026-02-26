/**
 * Mirror History — Comprehensive Demo Seed
 *
 * Populates ALL modules with realistic Istanbul-based data for demo recordings.
 * Writes to a separate database so end-users never see demo data.
 *
 * Usage:
 *   npm run seed:demo
 *   npm run demo          # seed + start server
 */

import Database from 'better-sqlite3';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import os from 'os';
import bcrypt from 'bcryptjs';

// ── Config ──
const DEMO_DB_PATH = '/tmp/mirror-history-demo/mirror-history.db';
const dir = path.dirname(DEMO_DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
if (fs.existsSync(DEMO_DB_PATH)) fs.unlinkSync(DEMO_DB_PATH);

const db = new Database(DEMO_DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Helpers ──
const uuid = () => crypto.randomUUID();
const hash = (...parts) => crypto.createHash('sha256').update(parts.join('|')).digest('hex');
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randf = (min, max) => +(Math.random() * (max - min) + min).toFixed(1);

function ts(dateStr, hour, minute) {
  const h = hour ?? rand(7, 21);
  const m = minute ?? rand(0, 59);
  return `${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`;
}

function dateRange(start, end) {
  const dates = [];
  const d = new Date(start);
  const e = new Date(end);
  while (d <= e) {
    dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

// ── Schema (from core/database.ts) ──
console.log('\n🪞 MIRROR HISTORY — Demo Seed\n');
console.log(`   DB: ${DEMO_DB_PATH}\n`);

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY, type TEXT NOT NULL, timestamp TEXT NOT NULL, summary TEXT NOT NULL,
    details_json TEXT NOT NULL DEFAULT '{}', confidence REAL NOT NULL DEFAULT 1.0,
    classification TEXT NOT NULL DEFAULT 'local_private',
    created_at TEXT NOT NULL DEFAULT (datetime('now')), content_hash TEXT
  );
  CREATE TABLE IF NOT EXISTS money_transactions (
    id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id),
    date TEXT NOT NULL, merchant TEXT NOT NULL, amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD', category TEXT, account TEXT,
    raw_row_hash TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'csv_import',
    source_ref TEXT NOT NULL DEFAULT '', UNIQUE(raw_row_hash)
  );
  CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY, merchant TEXT NOT NULL, estimated_period TEXT NOT NULL DEFAULT 'monthly',
    first_seen_date TEXT NOT NULL, last_seen_date TEXT NOT NULL,
    typical_amount REAL NOT NULL, status TEXT NOT NULL DEFAULT 'active',
    confidence REAL NOT NULL DEFAULT 0.5
  );
  CREATE TABLE IF NOT EXISTS diffs (
    id TEXT PRIMARY KEY, period_type TEXT NOT NULL, period_start TEXT NOT NULL,
    period_end TEXT NOT NULL, diff_summary TEXT NOT NULL DEFAULT '', diff_json TEXT NOT NULL DEFAULT '[]'
  );
  CREATE TABLE IF NOT EXISTS evidence_refs (
    id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id),
    evidence_type TEXT NOT NULL, pointer TEXT NOT NULL DEFAULT '',
    excerpt TEXT NOT NULL DEFAULT '', hash TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS rules (
    id TEXT PRIMARY KEY, rule_type TEXT NOT NULL, rule_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')), enabled INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS actions (
    id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id),
    action_type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft',
    payload_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')), applied_at TEXT
  );
  CREATE TABLE IF NOT EXISTS activity_log (
    id TEXT PRIMARY KEY, timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    entry_type TEXT NOT NULL, description TEXT NOT NULL, details_json TEXT NOT NULL DEFAULT '{}'
  );
  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id),
    content TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'manual',
    tags TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS voice_memos (
    id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id),
    transcript TEXT NOT NULL DEFAULT '', duration_seconds REAL NOT NULL DEFAULT 0,
    file_path TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT 'telegram',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS locations (
    id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id),
    lat REAL NOT NULL, lng REAL NOT NULL, address TEXT NOT NULL DEFAULT '',
    timestamp TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'google_takeout'
  );
  CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id),
    title TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL,
    location TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS health_entries (
    id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id),
    metric_type TEXT NOT NULL, value REAL NOT NULL, unit TEXT NOT NULL,
    timestamp TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'apple_health'
  );
  CREATE TABLE IF NOT EXISTS mood_entries (
    id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id),
    score INTEGER NOT NULL, note TEXT NOT NULL DEFAULT '', timestamp TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY, role TEXT NOT NULL, content TEXT NOT NULL,
    context_summary TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS ai_digests (
    id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id),
    period TEXT NOT NULL, period_start TEXT NOT NULL, period_end TEXT NOT NULL,
    content TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id),
    file_path TEXT NOT NULL, caption TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'telegram', created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS photo_analyses (
    id TEXT PRIMARY KEY, photo_id TEXT NOT NULL REFERENCES photos(id),
    description TEXT NOT NULL DEFAULT '', tags TEXT NOT NULL DEFAULT '[]',
    detected_text TEXT NOT NULL DEFAULT '', mood_indicators TEXT NOT NULL DEFAULT '{}',
    people_count INTEGER NOT NULL DEFAULT 0,
    analyzed_at TEXT NOT NULL DEFAULT (datetime('now')), model TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id),
    file_path TEXT NOT NULL, duration_seconds REAL NOT NULL DEFAULT 0,
    frame_count INTEGER NOT NULL DEFAULT 0, summary TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'import', created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS video_frames (
    id TEXT PRIMARY KEY, video_id TEXT NOT NULL REFERENCES videos(id),
    frame_path TEXT NOT NULL, timestamp_seconds REAL NOT NULL DEFAULT 0,
    description TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS memory_embeddings (
    event_id TEXT PRIMARY KEY REFERENCES events(id),
    embedding BLOB NOT NULL, model TEXT NOT NULL DEFAULT 'text-embedding-3-small',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS inconsistencies (
    id TEXT PRIMARY KEY, type TEXT NOT NULL, severity REAL NOT NULL DEFAULT 0.5,
    title TEXT NOT NULL, description TEXT NOT NULL,
    evidence_event_ids TEXT NOT NULL DEFAULT '[]',
    suggested_question TEXT NOT NULL DEFAULT '', date TEXT NOT NULL,
    detected_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS confrontations (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, insight TEXT NOT NULL,
    severity REAL NOT NULL DEFAULT 0.5, data_points TEXT NOT NULL DEFAULT '[]',
    related_event_ids TEXT NOT NULL DEFAULT '[]',
    category TEXT NOT NULL DEFAULT 'correlation',
    generated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL, must_change_password INTEGER NOT NULL DEFAULT 1
  );

  CREATE INDEX IF NOT EXISTS idx_mt_date ON money_transactions(date);
  CREATE INDEX IF NOT EXISTS idx_mt_merchant ON money_transactions(merchant);
  CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
  CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
  CREATE INDEX IF NOT EXISTS idx_events_hash ON events(content_hash);
  CREATE INDEX IF NOT EXISTS idx_notes_event ON notes(event_id);
  CREATE INDEX IF NOT EXISTS idx_voice_memos_event ON voice_memos(event_id);
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
  CREATE INDEX IF NOT EXISTS idx_photos_event ON photos(event_id);
  CREATE INDEX IF NOT EXISTS idx_photo_analyses_photo ON photo_analyses(photo_id);
  CREATE INDEX IF NOT EXISTS idx_videos_event ON videos(event_id);
  CREATE INDEX IF NOT EXISTS idx_video_frames_video ON video_frames(video_id);
  CREATE INDEX IF NOT EXISTS idx_inconsistencies_date ON inconsistencies(date);
  CREATE INDEX IF NOT EXISTS idx_inconsistencies_type ON inconsistencies(type);
  CREATE INDEX IF NOT EXISTS idx_confrontations_severity ON confrontations(severity DESC);
  CREATE INDEX IF NOT EXISTS idx_confrontations_category ON confrontations(category);
`);

try { db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS events_fts USING fts5(event_id, content, tokenize='porter unicode61')`); } catch {}

// ── Prepared Statements ──
const ins = {
  event: db.prepare(`INSERT INTO events (id, type, timestamp, summary, details_json, confidence, classification, created_at, content_hash) VALUES (?,?,?,?,?,?,?,?,?)`),
  tx: db.prepare(`INSERT OR IGNORE INTO money_transactions (id, event_id, date, merchant, amount, currency, category, account, raw_row_hash, source, source_ref) VALUES (?,?,?,?,?,?,?,?,?,?,?)`),
  sub: db.prepare(`INSERT INTO subscriptions (id, merchant, estimated_period, first_seen_date, last_seen_date, typical_amount, status, confidence) VALUES (?,?,?,?,?,?,?,?)`),
  diff: db.prepare(`INSERT INTO diffs (id, period_type, period_start, period_end, diff_summary, diff_json) VALUES (?,?,?,?,?,?)`),
  rule: db.prepare(`INSERT INTO rules (id, rule_type, rule_json, created_at, enabled) VALUES (?,?,?,?,?)`),
  action: db.prepare(`INSERT INTO actions (id, event_id, action_type, status, payload_json, created_at, applied_at) VALUES (?,?,?,?,?,?,?)`),
  activity: db.prepare(`INSERT INTO activity_log (id, timestamp, entry_type, description, details_json) VALUES (?,?,?,?,?)`),
  note: db.prepare(`INSERT INTO notes (id, event_id, content, source, tags, created_at) VALUES (?,?,?,?,?,?)`),
  voice: db.prepare(`INSERT INTO voice_memos (id, event_id, transcript, duration_seconds, file_path, source, created_at) VALUES (?,?,?,?,?,?,?)`),
  location: db.prepare(`INSERT INTO locations (id, event_id, lat, lng, address, timestamp, source) VALUES (?,?,?,?,?,?,?)`),
  calendar: db.prepare(`INSERT INTO calendar_events (id, event_id, title, start_time, end_time, location, description) VALUES (?,?,?,?,?,?,?)`),
  health: db.prepare(`INSERT INTO health_entries (id, event_id, metric_type, value, unit, timestamp, source) VALUES (?,?,?,?,?,?,?)`),
  mood: db.prepare(`INSERT INTO mood_entries (id, event_id, score, note, timestamp) VALUES (?,?,?,?,?)`),
  chat: db.prepare(`INSERT INTO chat_messages (id, role, content, context_summary, created_at) VALUES (?,?,?,?,?)`),
  digest: db.prepare(`INSERT INTO ai_digests (id, event_id, period, period_start, period_end, content, created_at) VALUES (?,?,?,?,?,?,?)`),
  photo: db.prepare(`INSERT INTO photos (id, event_id, file_path, caption, source, created_at) VALUES (?,?,?,?,?,?)`),
  photoAnalysis: db.prepare(`INSERT INTO photo_analyses (id, photo_id, description, tags, detected_text, mood_indicators, people_count, analyzed_at, model) VALUES (?,?,?,?,?,?,?,?,?)`),
  video: db.prepare(`INSERT INTO videos (id, event_id, file_path, duration_seconds, frame_count, summary, source, created_at) VALUES (?,?,?,?,?,?,?,?)`),
  videoFrame: db.prepare(`INSERT INTO video_frames (id, video_id, frame_path, timestamp_seconds, description, created_at) VALUES (?,?,?,?,?,?)`),
  inconsistency: db.prepare(`INSERT INTO inconsistencies (id, type, severity, title, description, evidence_event_ids, suggested_question, date, detected_at) VALUES (?,?,?,?,?,?,?,?,?)`),
  confrontation: db.prepare(`INSERT INTO confrontations (id, title, insight, severity, data_points, related_event_ids, category, generated_at) VALUES (?,?,?,?,?,?,?,?)`),
  user: db.prepare(`INSERT INTO users (id, username, password_hash, must_change_password) VALUES (?,?,?,?)`),
  fts: db.prepare(`INSERT INTO events_fts (event_id, content) VALUES (?,?)`),
};

// ── Cross-reference storage ──
const refs = { txEvents: [], moodEvents: [], noteEvents: [], locationEvents: [], calendarEvents: [], healthEvents: [], photoEvents: [] };

function addEvent(type, timestamp, summary, details = {}) {
  const id = uuid();
  ins.event.run(id, type, timestamp, summary, JSON.stringify(details), 1.0, 'local_private', timestamp, hash(type, timestamp, summary));
  try { ins.fts.run(id, summary); } catch {}
  return id;
}

// ══════════════════════════════════════════
//  SEED ALL DATA (single transaction)
// ══════════════════════════════════════════
const seedAll = db.transaction(() => {

  // ── AUTH USER ──
  const pwHash = bcrypt.hashSync('changeme', 10);
  ins.user.run(uuid(), 'admin', pwHash, 0);

  // ════════════════════════════
  //  1. TRANSACTIONS (~130)
  // ════════════════════════════
  let txCount = 0;
  function addTx(date, merchant, amount, currency, category, account = 'Garanti BBVA') {
    const eid = addEvent('money', ts(date, 12), `${merchant}: ${amount > 0 ? '+' : ''}${amount} ${currency}`, { merchant, amount, currency, category });
    ins.tx.run(uuid(), eid, date, merchant, amount, currency, category, account, hash(date, merchant, amount, currency), 'csv_import', '');
    refs.txEvents.push({ id: eid, date, merchant, amount });
    txCount++;
  }

  // Subscriptions (recurring)
  const subMonths = ['2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02'];
  subMonths.forEach((m, i) => {
    addTx(`${m}-15`, 'Netflix', i < 5 ? -15.99 : -17.99, 'USD', 'entertainment');
    addTx(`${m}-05`, 'Spotify', -9.99, 'USD', 'entertainment');
    addTx(`${m}-01`, 'Apple iCloud', -2.99, 'USD', 'cloud_storage');
    addTx(`${m}-20`, 'OpenAI ChatGPT Plus', -20.00, 'USD', 'software');
    if (i >= 2) addTx(`${m}-22`, 'YouTube Premium', -13.99, 'USD', 'entertainment');
    addTx(`${m}-10`, "Gold's Gym Istanbul", i < 5 ? -89 : -99, 'USD', 'health');
  });

  // Groceries (2-3x per week)
  const groceryMerchants = ['Migros', 'BIM', 'A101', 'Macrocenter', 'Carrefour SA'];
  const allDates = dateRange('2025-08-01', '2026-02-23');
  allDates.forEach(d => {
    const dow = new Date(d).getDay();
    if (dow === 2 || dow === 5 || (dow === 0 && Math.random() > 0.5)) {
      addTx(d, pick(groceryMerchants), -rand(15, 85), 'USD', 'groceries');
    }
  });

  // Coffee (3-4x per week)
  const coffeeMerchants = ['Kronotrop', 'Petra Roasting Co.', 'Starbucks', 'MOC Coffee'];
  allDates.forEach(d => {
    const dow = new Date(d).getDay();
    if (dow >= 1 && dow <= 5 && Math.random() > 0.35) {
      addTx(d, pick(coffeeMerchants), -rand(5, 15), 'USD', 'coffee');
    }
  });

  // Dining out (1-2x per week)
  const restaurants = ['Ciya Sofrasi', 'Karakoy Lokantasi', 'Mikla', 'Nusr-Et Burger', 'Meze by Lemon Tree', 'Kebapci Iskender'];
  allDates.forEach(d => {
    const dow = new Date(d).getDay();
    if ((dow === 5 || dow === 6) && Math.random() > 0.4) {
      addTx(d, pick(restaurants), -rand(35, 150), 'USD', 'dining');
    }
  });

  // Transport
  allDates.forEach(d => {
    const dow = new Date(d).getDay();
    if (dow >= 1 && dow <= 5 && Math.random() > 0.5) {
      addTx(d, pick(['Istanbulkart', 'BiTaksi', 'Uber']), -rand(3, 25), 'USD', 'transport');
    }
  });

  // Shopping (sporadic)
  addTx('2025-09-12', 'Hepsiburada', -120, 'USD', 'shopping');
  addTx('2025-10-22', 'Trendyol', -55, 'USD', 'shopping');
  addTx('2025-11-25', 'Grand Bazaar', -280, 'USD', 'shopping');
  addTx('2025-12-18', 'Mavi Jeans', -95, 'USD', 'shopping');
  addTx('2026-02-10', 'Hepsiburada', -1299, 'USD', 'shopping'); // ANOMALY — MacBook

  // Utilities (monthly)
  subMonths.forEach(m => {
    addTx(`${m}-25`, 'IGDAS', -rand(35, 75), 'USD', 'utilities');
    addTx(`${m}-26`, 'ISKI', -rand(15, 40), 'USD', 'utilities');
    addTx(`${m}-27`, 'CK Enerji', -rand(45, 95), 'USD', 'utilities');
  });

  // Starbucks anomaly
  addTx('2026-02-08', 'Starbucks', -85, 'USD', 'coffee'); // office order anomaly

  console.log(`   [+] ${txCount} transactions`);

  // ════════════════════════════
  //  2. SUBSCRIPTIONS (7)
  // ════════════════════════════
  ins.sub.run(uuid(), 'Netflix', 'monthly', '2025-08-15', '2026-02-15', 17.99, 'active', 0.95);
  ins.sub.run(uuid(), 'Spotify', 'monthly', '2025-08-05', '2026-02-05', 9.99, 'active', 0.95);
  ins.sub.run(uuid(), 'Apple iCloud', 'monthly', '2025-08-01', '2026-02-01', 2.99, 'active', 0.90);
  ins.sub.run(uuid(), 'OpenAI ChatGPT Plus', 'monthly', '2025-08-20', '2026-02-20', 20.00, 'active', 0.90);
  ins.sub.run(uuid(), 'YouTube Premium', 'monthly', '2025-10-22', '2026-02-22', 13.99, 'active', 0.85);
  ins.sub.run(uuid(), "Gold's Gym Istanbul", 'monthly', '2025-08-10', '2026-02-10', 1500, 'active', 0.80);
  ins.sub.run(uuid(), 'Tidal HiFi', 'monthly', '2025-08-18', '2025-11-18', 10.99, 'paused', 0.60);
  console.log('   [+] 7 subscriptions');

  // ════════════════════════════
  //  3. MOODS (70+)
  // ════════════════════════════
  let moodCount = 0;
  const moodNotes = [
    '', '', '', // 40% empty
    'Productive day at the office',
    'Great evening walk along the Bosphorus',
    'Stressed about project deadline',
    'Weekend brunch with friends in Kadikoy',
    'Exhausted after back-to-back meetings',
    'Feeling disconnected, not sure why',
    'Good coding session — flow state',
    'Rainy day, staying in with tea',
    'Enjoyed the ferry ride to work today',
    'Gym session boosted my energy',
    'Late night debugging, tired but satisfied',
    'Called family, feeling grateful',
    '',
  ];

  const burnoutStart = new Date('2025-11-10');
  const burnoutEnd = new Date('2025-11-20');
  const holidayStart = new Date('2025-12-20');
  const holidayEnd = new Date('2026-01-05');

  // Sample ~70 days (not every day)
  allDates.forEach(d => {
    if (Math.random() > 0.35) {
      const dt = new Date(d);
      const dow = dt.getDay();
      let score;
      if (dt >= burnoutStart && dt <= burnoutEnd) score = rand(1, 2);
      else if (dt >= holidayStart && dt <= holidayEnd) score = rand(4, 5);
      else if (dow === 0 || dow === 6) score = rand(3, 5);
      else if (dow === 1) score = rand(2, 4);
      else score = rand(3, 4);

      const eid = addEvent('mood', ts(d, rand(19, 22)), `Mood: ${score}/5`, { score });
      ins.mood.run(uuid(), eid, score, pick(moodNotes), ts(d, rand(19, 22)));
      refs.moodEvents.push({ id: eid, date: d, score });
      moodCount++;
    }
  });
  console.log(`   [+] ${moodCount} mood entries`);

  // ════════════════════════════
  //  4. NOTES (25)
  // ════════════════════════════
  const notesData = [
    { d: '2025-08-10', c: 'Finally set up the home office properly. The standing desk makes a real difference for productivity.', src: 'manual', tags: '["work"]', type: 'note' },
    { d: '2025-08-22', c: 'Been thinking about whether to switch from React to Next.js for the main project. The SSR benefits might justify the migration cost.', src: 'manual', tags: '["tech","work"]', type: 'thought' },
    { d: '2025-09-05', c: 'Decided to cancel the Tidal subscription. Spotify covers everything I need and the hi-fi quality difference is negligible.', src: 'manual', tags: '["finance"]', type: 'decision' },
    { d: '2025-09-14', c: 'Noticed I always spend more on food delivery when I score low on mood. Need to investigate this pattern further.', src: 'manual', tags: '["health","finance"]', type: 'observation' },
    { d: '2025-09-28', c: 'Meeting with the Besiktas team went well. They want to integrate our API by Q1 2026. This could be a major client.', src: 'manual', tags: '["work"]', type: 'note' },
    { d: '2025-10-05', c: 'Should I move to the Asian side? Kadikoy rent is 30% cheaper than Besiktas and the commute via ferry is actually pleasant.', src: 'manual', tags: '["personal","istanbul"]', type: 'thought' },
    { d: '2025-10-12', c: 'Going to start running along the Bosphorus 3x per week. Doctor recommended more cardio after the checkup.', src: 'manual', tags: '["health"]', type: 'decision' },
    { d: '2025-10-20', c: 'Quick reminder: dentist appointment Thursday at 2pm in Nisantasi', src: 'telegram', tags: '["health"]', type: 'note' },
    { d: '2025-10-30', c: 'The ferry commute from Kadikoy to Besiktas is actually faster than driving during rush hour. 25 min vs 50+ by car.', src: 'manual', tags: '["istanbul","transport"]', type: 'observation' },
    { d: '2025-11-05', c: 'Investing in a noise-canceling headset. The coworking space in Maslak is getting louder every week.', src: 'manual', tags: '["work"]', type: 'decision' },
    { d: '2025-11-12', c: 'Burnout is real. Three deadlines this week, barely sleeping. Need to talk to the team about workload distribution.', src: 'manual', tags: '["work","health"]', type: 'note' },
    { d: '2025-11-18', c: 'Tried that new coffee place in Cihangir — Petra Roasting Co. Their Ethiopian single origin is incredible.', src: 'manual', tags: '["istanbul","coffee"]', type: 'note' },
    { d: '2025-12-01', c: 'Quarterly review went better than expected. Revenue up 40% but I need to hire at least one more developer.', src: 'manual', tags: '["work"]', type: 'note' },
    { d: '2025-12-15', c: 'Grand Bazaar trip for holiday gifts. The ceramics shop near Gate 7 had the best prices. Total damage: $280.', src: 'manual', tags: '["shopping","istanbul"]', type: 'note' },
    { d: '2025-12-25', c: 'Reflecting on the year. Moved to Istanbul, started the company, built the product. Feels surreal.', src: 'manual', tags: '["personal"]', type: 'thought' },
    { d: '2026-01-05', c: 'New year resolution: better sleep hygiene. No screens after 10pm, morning light exposure, consistent wake time.', src: 'manual', tags: '["health"]', type: 'decision' },
    { d: '2026-01-15', c: 'The Netflix price increase from $15.99 to $17.99 is annoying. $2/month adds up. Should I switch to a cheaper tier?', src: 'manual', tags: '["finance"]', type: 'thought' },
    { d: '2026-01-22', c: 'Istanbul in January is underrated. The city is quieter, the light is beautiful, and the winter tulip gardens are spectacular.', src: 'manual', tags: '["istanbul","personal"]', type: 'observation' },
    { d: '2026-02-01', c: 'Hired a junior developer starting March. Finally some relief on the workload front.', src: 'manual', tags: '["work"]', type: 'note' },
    { d: '2026-02-08', c: 'Ordered coffee for the entire office from Starbucks. $85 for 12 drinks — that will look like an anomaly in the spending tracker.', src: 'manual', tags: '["work","coffee"]', type: 'note' },
    { d: '2026-02-12', c: 'The Hepsiburada order ($1,299) was the new MacBook Air for the hire. Business expense, not personal splurge.', src: 'manual', tags: '["work","finance"]', type: 'note' },
    { d: '2026-02-15', c: 'Running along the Bosphorus at sunrise is the best thing about living in Besiktas. The light on the water is unreal.', src: 'manual', tags: '["health","istanbul"]', type: 'observation' },
    { d: '2026-02-18', c: 'Maybe I should build a personal finance tracker that actually understands my life context. Wait...', src: 'manual', tags: '["tech","meta"]', type: 'thought' },
    { d: '2026-02-20', c: 'Gym attendance is terrible this month. Only 4 visits. The $99 subscription means I am paying $25 per visit.', src: 'manual', tags: '["health","finance"]', type: 'observation' },
    { d: '2026-02-23', c: 'Demo video prep: need to make sure all modules look full and realistic. The confrontations feature is the most impressive part.', src: 'manual', tags: '["work","meta"]', type: 'note' },
  ];

  notesData.forEach(n => {
    const eid = addEvent(n.type, ts(n.d, rand(9, 21)), n.c.slice(0, 80), { source: n.src });
    ins.note.run(uuid(), eid, n.c, n.src, n.tags, ts(n.d));
    refs.noteEvents.push({ id: eid, date: n.d });
  });
  console.log(`   [+] ${notesData.length} notes`);

  // ════════════════════════════
  //  5. VOICE MEMOS (10)
  // ════════════════════════════
  const voiceData = [
    { d: '2025-08-20', dur: 45, t: 'Just got out of the meeting with the Istanbul tech hub. They are really interested in what we are building. I need to prepare a proper demo for next week. The product is solid but the pitch needs work — focus on the privacy angle, that resonates here.' },
    { d: '2025-09-15', dur: 30, t: 'Walking home from Kadikoy ferry terminal. The sunset over the Bosphorus is incredible right now. Need to take more time to appreciate this city instead of always rushing to the next thing.' },
    { d: '2025-10-08', dur: 90, t: 'Debugging session notes. The SQLite connection pooling issue was caused by concurrent writes from the Telegram bot handler. Switched to WAL mode and it fixed everything. Also need to add proper error boundaries in the React components — the Oracle page crashes when AI is not configured.' },
    { d: '2025-10-25', dur: 20, t: 'Grocery list for the week: eggs, beyaz peynir from the local pazar, olives, fresh simit from the bakery, and that good Turkish coffee from Kurukahveci Mehmet Efendi.' },
    { d: '2025-11-14', dur: 60, t: 'End of quarter reflection. Revenue is up 40 percent but I am working 60-hour weeks. Something has to give. Need to hire at least one more developer before I burn out completely. The last two weeks have been brutal.' },
    { d: '2025-12-05', dur: 35, t: 'Had an interesting conversation with a VC at the tech meetup in Levent. They are looking at developer tools in the Turkish market. Could be a good fit but I am not sure I want outside funding yet.' },
    { d: '2025-12-28', dur: 25, t: 'Year-end thoughts. Best decision of 2025: moving to Istanbul. Worst decision: not taking enough breaks. Goal for 2026: sustainable pace, better health metrics, and shipping the mobile app.' },
    { d: '2026-01-10', dur: 40, t: 'The new standing desk is great but my back still hurts from the November crunch. Physical therapist recommended daily stretching and a proper ergonomic assessment. Booked an appointment for next week.' },
    { d: '2026-02-05', dur: 55, t: 'Product roadmap thoughts. Phase one is done — financial tracking works perfectly. Phase two, the memory recording system, is what makes this different. Nobody else is connecting spending patterns to mood and health data. That is our moat.' },
    { d: '2026-02-19', dur: 30, t: 'Quick note about the demo. The inconsistency detection is the killer feature — when it catches that your calendar says one thing but your location data says another, people always react. Need to make sure the demo database has good examples of this.' },
  ];

  voiceData.forEach(v => {
    const eid = addEvent('voice_memo', ts(v.d, rand(8, 20)), v.t.slice(0, 80), { duration: v.dur });
    ins.voice.run(uuid(), eid, v.t, v.dur, `/data/voice/memo_${v.d.replace(/-/g, '')}.webm`, 'manual', ts(v.d));
  });
  console.log(`   [+] ${voiceData.length} voice memos`);

  // ════════════════════════════
  //  6. LOCATIONS (50+)
  // ════════════════════════════
  let locCount = 0;
  const places = [
    { name: 'Besiktas, Istanbul', lat: 41.0422, lng: 29.0083 },
    { name: 'Levent Business District, Istanbul', lat: 41.0796, lng: 29.0114 },
    { name: 'Kadikoy Iskele, Istanbul', lat: 40.9913, lng: 29.0267 },
    { name: 'Taksim Meydani, Istanbul', lat: 41.0370, lng: 28.9850 },
    { name: 'Uskudar, Istanbul', lat: 41.0252, lng: 29.0151 },
    { name: 'Kapalicarsi (Grand Bazaar), Istanbul', lat: 41.0106, lng: 28.9680 },
    { name: 'Istiklal Caddesi, Beyoglu', lat: 41.0334, lng: 28.9768 },
    { name: 'Bebek Sahil, Istanbul', lat: 41.0768, lng: 29.0434 },
    { name: 'Maslak, Istanbul', lat: 41.1086, lng: 29.0203 },
    { name: 'Istanbul Airport (IST)', lat: 41.2608, lng: 28.7422 },
    { name: "Gold's Gym, Besiktas", lat: 41.0445, lng: 29.0090 },
    { name: 'Kronotrop, Cihangir', lat: 41.0312, lng: 28.9825 },
    { name: 'Galata Kulesi, Istanbul', lat: 41.0256, lng: 28.9742 },
  ];

  allDates.forEach(d => {
    const dow = new Date(d).getDay();
    if (dow >= 1 && dow <= 5) {
      // Weekday: home morning, office, maybe cafe
      if (Math.random() > 0.4) {
        const eid = addEvent('location', ts(d, 8, rand(0, 30)), `Location: ${places[0].name}`);
        ins.location.run(uuid(), eid, places[0].lat + randf(-0.002, 0.002), places[0].lng + randf(-0.002, 0.002), places[0].name, ts(d, 8), 'google_takeout');
        refs.locationEvents.push({ id: eid, date: d, place: places[0].name });
        locCount++;
      }
      if (Math.random() > 0.3) {
        const office = pick([places[1], places[8]]); // Levent or Maslak
        const eid = addEvent('location', ts(d, 10, rand(0, 30)), `Location: ${office.name}`);
        ins.location.run(uuid(), eid, office.lat + randf(-0.001, 0.001), office.lng + randf(-0.001, 0.001), office.name, ts(d, 10), 'google_takeout');
        refs.locationEvents.push({ id: eid, date: d, place: office.name });
        locCount++;
      }
    } else {
      // Weekend: various spots
      if (Math.random() > 0.5) {
        const spot = pick([places[2], places[3], places[5], places[6], places[7], places[12]]);
        const eid = addEvent('location', ts(d, rand(11, 17)), `Location: ${spot.name}`);
        ins.location.run(uuid(), eid, spot.lat + randf(-0.002, 0.002), spot.lng + randf(-0.002, 0.002), spot.name, ts(d, rand(11, 17)), 'google_takeout');
        refs.locationEvents.push({ id: eid, date: d, place: spot.name });
        locCount++;
      }
    }
  });

  // Airport trips
  ['2025-10-15', '2025-12-30', '2026-01-03'].forEach(d => {
    const eid = addEvent('location', ts(d, 6), `Location: ${places[9].name}`);
    ins.location.run(uuid(), eid, places[9].lat, places[9].lng, places[9].name, ts(d, 6), 'google_takeout');
    refs.locationEvents.push({ id: eid, date: d, place: places[9].name });
    locCount++;
  });

  console.log(`   [+] ${locCount} locations`);

  // ════════════════════════════
  //  7. CALENDAR EVENTS (40)
  // ════════════════════════════
  let calCount = 0;

  // Recurring: standups, sprint planning, gym
  const calMonths = ['2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02'];
  allDates.forEach(d => {
    const dow = new Date(d).getDay();
    // Standup (M-F)
    if (dow >= 1 && dow <= 5 && Math.random() > 0.15) {
      const eid = addEvent('calendar', ts(d, 9, 30), `Team Standup`);
      ins.calendar.run(uuid(), eid, 'Team Standup', ts(d, 9, 30), ts(d, 9, 45), 'Levent Office', 'Daily sync');
      refs.calendarEvents.push({ id: eid, date: d, title: 'Team Standup' });
      calCount++;
    }
    // Sprint Planning (Mondays)
    if (dow === 1 && Math.random() > 0.2) {
      const eid = addEvent('calendar', ts(d, 10, 0), `Sprint Planning`);
      ins.calendar.run(uuid(), eid, 'Sprint Planning', ts(d, 10, 0), ts(d, 11, 0), 'Levent Office', 'Weekly sprint planning and backlog grooming');
      refs.calendarEvents.push({ id: eid, date: d, title: 'Sprint Planning' });
      calCount++;
    }
    // Gym (MWF — drops off in Nov)
    const dt = new Date(d);
    if ((dow === 1 || dow === 3 || dow === 5) && !(dt >= burnoutStart && dt <= burnoutEnd) && Math.random() > 0.3) {
      const eid = addEvent('calendar', ts(d, 7, 0), `Gym Session`);
      ins.calendar.run(uuid(), eid, 'Gym Session', ts(d, 7, 0), ts(d, 8, 0), "Gold's Gym Besiktas", 'Weights + cardio');
      refs.calendarEvents.push({ id: eid, date: d, title: 'Gym Session' });
      calCount++;
    }
  });

  // One-off events
  const oneOffs = [
    { d: '2025-10-15', t: 'Flight to Ankara', s: '06:00', e: '08:00', loc: 'Istanbul Airport (IST)', desc: 'TK2120 to Esenboga' },
    { d: '2025-11-14', t: 'Dentist Appointment', s: '14:00', e: '15:00', loc: 'Nisantasi Dental Clinic', desc: 'Regular checkup + cleaning' },
    { d: '2025-11-28', t: 'Demo Day — Istanbul Tech Hub', s: '15:00', e: '17:00', loc: 'Istanbul Tech Hub, Levent', desc: 'Product demo for potential investors' },
    { d: '2025-12-20', t: 'Birthday Dinner — Elif', s: '20:00', e: '23:00', loc: 'Mikla Restaurant, Beyoglu', desc: "Elif's 30th birthday celebration" },
    { d: '2026-01-08', t: '1:1 with CTO', s: '14:00', e: '14:30', loc: 'Video Call', desc: 'Quarterly roadmap review' },
    { d: '2026-01-20', t: 'Coffee with Investor', s: '11:00', e: '12:00', loc: 'Kronotrop, Cihangir', desc: 'Follow-up on seed round discussion' },
    { d: '2026-02-14', t: "Valentine's Dinner", s: '19:30', e: '22:00', loc: 'Sunset Grill & Bar, Ulus', desc: 'Dinner with Bosphorus view' },
    { d: '2026-02-22', t: 'Barber Appointment', s: '11:00', e: '11:45', loc: 'Figaro Berber, Besiktas', desc: '' },
  ];

  oneOffs.forEach(o => {
    const eid = addEvent('calendar', ts(o.d, parseInt(o.s)), o.t);
    ins.calendar.run(uuid(), eid, o.t, ts(o.d, parseInt(o.s), parseInt(o.s.split(':')[1])), ts(o.d, parseInt(o.e), parseInt(o.e.split(':')[1])), o.loc, o.desc);
    refs.calendarEvents.push({ id: eid, date: o.d, title: o.t });
    calCount++;
  });

  console.log(`   [+] ${calCount} calendar events`);

  // ════════════════════════════
  //  8. HEALTH ENTRIES (140+)
  // ════════════════════════════
  let healthCount = 0;

  allDates.forEach(d => {
    const dt = new Date(d);
    const isBurnout = dt >= burnoutStart && dt <= burnoutEnd;

    // Steps (daily)
    const steps = isBurnout ? rand(2000, 4500) : rand(5000, 13000);
    const eid1 = addEvent('health', ts(d, 23), `Steps: ${steps}`, { metric: 'steps', value: steps });
    ins.health.run(uuid(), eid1, 'steps', steps, 'steps', ts(d, 23), 'apple_health');
    healthCount++;

    // Sleep (daily)
    const sleep = isBurnout ? randf(4.5, 5.8) : randf(6.0, 8.5);
    const eid2 = addEvent('health', ts(d, 7), `Sleep: ${sleep}h`, { metric: 'sleep_hours', value: sleep });
    ins.health.run(uuid(), eid2, 'sleep_hours', sleep, 'hours', ts(d, 7), 'apple_health');
    healthCount++;

    // Heart rate (most days)
    if (Math.random() > 0.2) {
      const hr = isBurnout ? rand(72, 82) : rand(58, 72);
      const eid3 = addEvent('health', ts(d, 8), `Resting HR: ${hr} bpm`);
      ins.health.run(uuid(), eid3, 'heart_rate', hr, 'bpm', ts(d, 8), 'apple_health');
      refs.healthEvents.push({ id: eid3, date: d });
      healthCount++;
    }
  });

  // Weight (weekly)
  let weight = 78.5;
  allDates.filter((_, i) => i % 7 === 0).forEach(d => {
    weight += randf(-0.3, 0.5);
    const eid = addEvent('health', ts(d, 7, 30), `Weight: ${weight.toFixed(1)} kg`);
    ins.health.run(uuid(), eid, 'weight', +weight.toFixed(1), 'kg', ts(d, 7, 30), 'apple_health');
    healthCount++;
  });

  console.log(`   [+] ${healthCount} health entries`);

  // ════════════════════════════
  //  9. PHOTOS (25) + ANALYSES
  // ════════════════════════════
  const photosData = [
    { d: '2025-08-15', f: 'bosphorus_sunset.jpg', cap: 'Sunset over the Bosphorus from Bebek shore', desc: 'Golden hour sunset reflecting on the Bosphorus strait. Silhouettes of mosques on the horizon. Calm water with ferry boats.', tags: '["sunset","bosphorus","outdoor","landscape"]', mood: '{"tone":"serene","confidence":0.9}', people: 0 },
    { d: '2025-08-22', f: 'office_desk.jpg', cap: 'Work setup at Levent coworking space', desc: 'Modern standing desk with dual monitors, mechanical keyboard, and coffee cup. Bright natural light from floor-to-ceiling windows.', tags: '["work","office","indoor","tech"]', mood: '{"tone":"focused","confidence":0.75}', people: 0 },
    { d: '2025-09-07', f: 'kadikoy_market.jpg', cap: 'Fresh produce at Kadikoy farmers market', desc: 'Colorful display of fresh vegetables, fruits, and spices at an outdoor market. Tomatoes, peppers, and eggplants in wooden crates.', tags: '["food","market","kadikoy","outdoor"]', mood: '{"tone":"lively","confidence":0.8}', people: 3 },
    { d: '2025-09-14', f: 'coffee_kronotrop.jpg', cap: 'V60 pour-over at Kronotrop Cihangir', desc: 'Specialty coffee in a ceramic cup next to a V60 dripper. Minimalist cafe interior with exposed brick walls.', tags: '["coffee","cafe","indoor"]', mood: '{"tone":"calm","confidence":0.85}', people: 0 },
    { d: '2025-09-28', f: 'galata_tower.jpg', cap: 'View from Galata Tower observation deck', desc: 'Panoramic view of Istanbul from Galata Tower. Golden Horn visible with bridges, mosques, and dense urban fabric.', tags: '["istanbul","landmark","panorama","outdoor"]', mood: '{"tone":"awe","confidence":0.9}', people: 0 },
    { d: '2025-10-10', f: 'team_dinner.jpg', cap: 'Team dinner at Karakoy Lokantasi', desc: 'Group of 5 people at a long dinner table with meze plates, grilled fish, and raki glasses. Warm restaurant lighting.', tags: '["dinner","team","social","food"]', mood: '{"tone":"joyful","confidence":0.85}', people: 5 },
    { d: '2025-10-20', f: 'running_bosphorus.jpg', cap: 'Morning run along the Bosphorus coast', desc: 'Coastal running path at dawn with the Bosphorus Bridge visible in the background. Dewy grass and orange sky.', tags: '["running","bosphorus","morning","outdoor"]', mood: '{"tone":"energetic","confidence":0.8}', people: 1 },
    { d: '2025-11-03', f: 'grand_bazaar.jpg', cap: 'Inside the Grand Bazaar', desc: 'Ornate ceiling of the Grand Bazaar with Turkish lanterns and ceramic tiles. Busy marketplace atmosphere.', tags: '["bazaar","istanbul","shopping","indoor"]', mood: '{"tone":"excited","confidence":0.7}', people: 6 },
    { d: '2025-11-18', f: 'late_night_coding.jpg', cap: 'Late night at the office — burnout mode', desc: 'Dark office lit only by monitor screens. Empty energy drink cans and a half-eaten sandwich. Person hunched over keyboard with visible fatigue.', tags: '["work","night","coding","indoor"]', mood: '{"tone":"exhausted","confidence":0.9}', people: 1 },
    { d: '2025-12-01', f: 'ferry_morning.jpg', cap: 'Morning ferry from Kadikoy', desc: 'Istanbul ferry on the Bosphorus in early morning mist. Passengers with tea glasses, city skyline emerging from fog.', tags: '["ferry","commute","bosphorus","morning"]', mood: '{"tone":"contemplative","confidence":0.8}', people: 4 },
    { d: '2025-12-15', f: 'bazaar_ceramics.jpg', cap: 'Holiday shopping in the Grand Bazaar', desc: 'Colorful Turkish ceramic plates and bowls displayed in a bazaar shop. Intricate blue and white Iznik patterns.', tags: '["shopping","bazaar","ceramics","istanbul"]', mood: '{"tone":"festive","confidence":0.75}', people: 0 },
    { d: '2025-12-20', f: 'birthday_mikla.jpg', cap: "Elif's birthday dinner at Mikla", desc: 'Elegant restaurant with city view at night. Birthday cake with candles, champagne glasses, and smiling group.', tags: '["birthday","dinner","social","night"]', mood: '{"tone":"celebratory","confidence":0.95}', people: 6 },
    { d: '2025-12-31', f: 'newyear_bosphorus.jpg', cap: 'New Year fireworks over the Bosphorus', desc: 'Spectacular fireworks display over the Bosphorus Bridge at midnight. Colorful explosions reflected in the water.', tags: '["newyear","fireworks","bosphorus","night"]', mood: '{"tone":"euphoric","confidence":0.9}', people: 0 },
    { d: '2026-01-08', f: 'winter_tulips.jpg', cap: 'Winter tulip garden in Emirgan', desc: 'Red and yellow tulips in a park setting with bare winter trees. Overcast sky with soft diffused light.', tags: '["garden","flowers","winter","outdoor"]', mood: '{"tone":"peaceful","confidence":0.8}', people: 0 },
    { d: '2026-01-22', f: 'snow_besiktas.jpg', cap: 'Rare snowfall in Besiktas', desc: 'Snow-covered streets of Besiktas with parked cars and bare trees. Quiet winter morning atmosphere.', tags: '["snow","winter","besiktas","street"]', mood: '{"tone":"wonder","confidence":0.85}', people: 0 },
    { d: '2026-02-02', f: 'coworking_maslak.jpg', cap: 'New coworking spot in Maslak', desc: 'Modern open-plan coworking space with people at desks. Large windows with city view, plants, and minimal furniture.', tags: '["work","coworking","maslak","indoor"]', mood: '{"tone":"productive","confidence":0.7}', people: 3 },
    { d: '2026-02-08', f: 'starbucks_order.jpg', cap: 'Office coffee order — 12 drinks', desc: 'Tray of 12 Starbucks cups on an office desk. Various drink labels visible. Group coffee order for the team.', tags: '["coffee","office","team"]', mood: '{"tone":"social","confidence":0.7}', people: 0, text: 'Starbucks - Grande Latte x4, Americano x3, Cappuccino x3, Chai x2' },
    { d: '2026-02-14', f: 'valentines_dinner.jpg', cap: "Valentine's dinner with Bosphorus view", desc: 'Candlelit table for two at Sunset Grill. Rose petals, wine glasses, and panoramic Bosphorus view at dusk.', tags: '["valentines","dinner","romantic","bosphorus"]', mood: '{"tone":"romantic","confidence":0.9}', people: 2 },
    { d: '2026-02-18', f: 'cat_besiktas.jpg', cap: 'Istanbul street cat demanding attention', desc: 'Orange tabby cat sitting on a cafe table next to a coffee cup, looking directly at the camera with an imperious expression.', tags: '["cat","istanbul","cafe","funny"]', mood: '{"tone":"amused","confidence":0.85}', people: 0 },
    { d: '2026-02-22', f: 'morning_run.jpg', cap: 'Saturday morning run — Bosphorus trail', desc: 'Running path along the waterfront with the sun rising over the Asian side. Calm sea and a lone runner.', tags: '["running","morning","bosphorus","outdoor"]', mood: '{"tone":"determined","confidence":0.8}', people: 1 },
  ];

  photosData.forEach(p => {
    const eid = addEvent('photo', ts(p.d, rand(8, 20)), p.cap);
    const photoId = uuid();
    ins.photo.run(photoId, eid, `/data/photos/${p.f}`, p.cap, 'import', ts(p.d));
    ins.photoAnalysis.run(uuid(), photoId, p.desc, p.tags, p.text || '', p.mood, p.people, ts(p.d), 'claude-sonnet-4-20250514');
    refs.photoEvents.push({ id: eid, date: p.d });
  });
  console.log(`   [+] ${photosData.length} photos + analyses`);

  // ════════════════════════════
  //  10. VIDEOS (3) + FRAMES
  // ════════════════════════════
  const videosData = [
    { d: '2025-09-20', f: 'bosphorus_ferry_ride.mp4', dur: 45, frames: 3, sum: 'Ferry crossing from Kadikoy to Eminonu at golden hour. Waves, seagulls, and skyline.', framesDesc: ['Ferry departing Kadikoy terminal, passengers on deck', 'Mid-crossing view of the Maiden Tower with golden sunlight', 'Approaching Eminonu with Suleymaniye Mosque in background'] },
    { d: '2025-11-05', f: 'office_timelapse.mp4', dur: 30, frames: 3, sum: 'Time-lapse of the Levent office view from morning to evening.', framesDesc: ['Morning light filling the office, people arriving', 'Midday bustle with full occupancy', 'Evening lights turning on across the Levent skyline'] },
    { d: '2025-12-10', f: 'bazaar_walk.mp4', dur: 60, frames: 4, sum: 'Walking through the Grand Bazaar corridors. Lively market atmosphere.', framesDesc: ['Entrance gate with ornate archway and crowd', 'Jewelry section with gold displays', 'Ceramic and lantern shop with colorful wares', 'Tea vendor serving cay in tulip glasses'] },
  ];

  videosData.forEach(v => {
    const eid = addEvent('video', ts(v.d, 14), v.sum.slice(0, 80));
    const videoId = uuid();
    ins.video.run(videoId, eid, `/data/videos/${v.f}`, v.dur, v.frames, v.sum, 'import', ts(v.d));
    v.framesDesc.forEach((desc, i) => {
      ins.videoFrame.run(uuid(), videoId, `/data/videos/frames/${v.f}_frame${i + 1}.jpg`, (v.dur / v.frames) * i, desc, ts(v.d));
    });
  });
  console.log(`   [+] ${videosData.length} videos + ${videosData.reduce((a, v) => a + v.frames, 0)} frames`);

  // ════════════════════════════
  //  11. CHAT HISTORY (18 messages)
  // ════════════════════════════
  const chatExchanges = [
    { d: '2026-02-20', u: 'What are my spending patterns this month?', a: 'Based on your February data, you have spent approximately $420 on groceries (Migros, BIM, A101), $380 on dining, $210 on coffee, and $76 on digital subscriptions. Your grocery spending is 15% higher than your November average. The biggest single expense was $1,299 at Hepsiburada on Feb 10. Your dining frequency has increased — you ate out 8 times versus your usual 5 per month.' },
    { d: '2026-02-20', u: 'Why was my mood so low in November?', a: 'Looking at your data from November 10-20, there is a clear pattern: your mood dropped to 1-2 out of 5 for 5 consecutive days. During this period, your sleep averaged only 5.1 hours (versus your usual 7.2), your step count dropped to 3,200 (versus 8,000), and you logged 3 late-night work sessions. You also recorded voice memos mentioning "deadline pressure" and "burnout." Your food delivery spending spiked 180% during this week, suggesting a comfort-eating pattern triggered by work stress.' },
    { d: '2026-02-21', u: 'Show me any contradictions you found in my data', a: 'I found several interesting contradictions: (1) On October 15, your calendar showed "Flight to Ankara" departing at 6am from IST Airport, but your location data placed you in Kadikoy at 10:30am — either the flight was missed or the location data is stale. (2) Your mood logged 5 out of 5 on November 18, but the photo analysis from that evening describes visible fatigue and dim lighting suggesting stress. (3) You have a gym membership at Gold\'s Gym costing $99 per month, but you only visited 4 times in February despite having sessions scheduled 3 times per week on your calendar.' },
    { d: '2026-02-21', u: 'How is my sleep trend looking?', a: 'Your sleep trend shows a concerning decline. In August, you averaged 7.8 hours per night. By November during the burnout period it dropped to 5.1 hours. There was a recovery in December (7.2 hours), likely due to the holiday break. However, January and February are averaging only 6.4 hours — still below your August baseline. At this rate, you could drop below 6 hours by April. Your heart rate data correlates: resting HR is 5 beats per minute higher on nights with less than 6 hours of sleep.' },
    { d: '2026-02-22', u: 'What about my gym attendance? Be honest.', a: 'Honestly? It is not great. You started strong: 12 sessions in September, 10 in October. Then the burnout hit and you had zero sessions November 10-20. Since then, attendance has been declining: 8 in December, 6 in January, and only 4 so far in February. At $99 per month, your cost per visit this month is $25 — that is more expensive than a personal training session. The pattern suggests gym attendance is the first thing you drop when work pressure increases.' },
    { d: '2026-02-22', u: 'Compare my November to December — what changed?', a: 'The contrast is stark. November was your lowest month across nearly every metric: mood averaged 2.3 out of 5, sleep was 5.6 hours, steps were 4,100 per day, and you spent 180% more on food delivery. December flipped almost completely: mood averaged 4.2, sleep recovered to 7.1 hours, steps jumped to 8,900. The trigger appears to be the end of the Q4 deadline combined with the holiday social calendar — you had 6 social events in December versus 1 in November. The data strongly suggests that social connection is your primary mood driver.' },
    { d: '2026-02-23', u: 'What should I focus on improving next week?', a: 'Based on your current data trends, I would prioritize three things: (1) Sleep hygiene — your last 5 nights averaged 6.1 hours, and your mood drops by 0.8 points on days following less than 6.5 hours of sleep. Try the 10pm screen cutoff you noted in January. (2) Gym consistency — you have 3 sessions scheduled next week. Even 2 out of 3 would be a significant improvement over this month\'s pace. (3) Coffee spending — at $210 per month, this is your third largest expense category. Consider brewing at home 2-3 days per week.' },
    { d: '2026-02-23', u: 'One more — any positive trends I should know about?', a: 'Absolutely. Several encouraging patterns: (1) Your note-taking frequency has increased 300% since August — you are capturing more thoughts and decisions, which shows growing self-awareness. (2) Weekend mood scores have been consistently 4+ since January, suggesting you have found a good weekend routine. (3) Your social spending correlates with your highest mood days, and you have been socializing more regularly since December. (4) The running data shows you are maintaining 2-3 runs per week even when gym attendance drops. (5) Your Kadikoy visits correlate with higher creativity — you write 2x more notes on days you visit the Asian side.' },
    { d: '2026-02-24', u: 'Summarize my life in one paragraph.', a: 'You are a tech founder living in Besiktas, Istanbul, who moved here in mid-2025 and is building a startup while navigating the intensity of solo entrepreneurship. Your data tells a story of cycles: periods of intense focus and burnout (especially November) followed by recovery through social connection, exercise, and the simple pleasures of Istanbul life — ferry rides, Bosphorus sunsets, and good coffee. Your mood is most influenced by sleep quality and social interaction, not by financial metrics. You spend roughly $2,800 per month with coffee as a surprisingly large category. The grain sees someone who is ambitious, occasionally overworks, and is slowly learning to prioritize well-being alongside achievement.' },
  ];

  chatExchanges.forEach((ex, i) => {
    const timestamp = ts(ex.d, 10 + i, rand(0, 59));
    ins.chat.run(uuid(), 'user', ex.u, '', timestamp);
    ins.chat.run(uuid(), 'assistant', ex.a, `Exchange ${i + 1}`, ts(ex.d, 10 + i, rand(0, 59)));
  });
  console.log(`   [+] ${chatExchanges.length * 2} chat messages`);

  // ════════════════════════════
  //  12. AI DIGESTS (8)
  // ════════════════════════════
  const digestsData = [
    { period: 'weekly', s: '2025-11-10', e: '2025-11-16', c: 'The Burnout Week. Mood averaged 1.8/5 — the lowest recorded week. Sleep dropped to 5.1 hours nightly. Step count fell to 3,200 (normally 8,000+). Zero gym sessions despite 3 scheduled. Food delivery spending spiked 180% with 3 late-night Yemeksepeti orders. Voice memos mention "deadline pressure" and "can\'t keep this up." The grain detects a clear stress-spending-sleep deterioration spiral. Recovery began around Nov 17 when a social dinner broke the cycle.' },
    { period: 'weekly', s: '2025-12-15', e: '2025-12-21', c: 'Holiday Week. Mood surged to 4.5/5 — the highest since August. Highlight: Elif\'s birthday dinner at Mikla on Dec 20 ($320 evening). Grand Bazaar shopping trip for gifts ($280). Social events: 4 in one week. Sleep averaged 7.5 hours. The grain notes a strong correlation between social density and mood recovery.' },
    { period: 'monthly', s: '2025-12-01', e: '2025-12-31', c: 'December was a month of recovery and celebration. After the November burnout, every metric improved: mood +2.0 points, sleep +1.5 hours, steps +4,700/day. Spending was the highest of any month ($3,400) driven by holiday gifts, social dining, and the New Year celebration. The grain notes that high spending in December correlated with high mood — the opposite of the stress-spending pattern seen in November.' },
    { period: 'monthly', s: '2026-01-01', e: '2026-01-31', c: 'January: New Year Reset. Mood stabilized at 3.8/5. New Year resolutions started strong — sleep improved to 7.0 hours, gym attendance at 6 sessions. The Netflix price increase ($15.99 → $17.99) was the only financial anomaly. A notable 3-day trip (Dec 30 - Jan 3, airport location data) created a brief activity gap. The grain observes the beginning of a sustainable routine after the holiday period.' },
    { period: 'weekly', s: '2026-02-10', e: '2026-02-16', c: 'Valentine\'s Week. A large Hepsiburada purchase ($1,299, MacBook for new hire) triggered the anomaly detector. Valentine\'s dinner at Sunset Grill was a highlight. Mood averaged 4.0/5. The grain notes that planned large purchases don\'t create the same stress response as impulse spending.' },
    { period: 'weekly', s: '2026-02-17', e: '2026-02-23', c: 'Current week. Mood: 3.8/5. Sleep: 6.4 hours (below target). 4 gym sessions scheduled, 2 completed. Productive demo meeting on Wednesday boosted mood to 5/5. Coffee spending continues at $55/week. The grain recommends prioritizing sleep and maintaining the Wednesday meeting momentum.' },
    { period: 'monthly', s: '2026-02-01', e: '2026-02-24', c: 'February so far: A productive but physically unbalanced month. Work is going well — new hire onboarding, successful demos, and strong product momentum. However, gym attendance is at its lowest (4 visits), sleep is declining (6.4 hours avg), and coffee spending is the highest ever ($210). The grain sees a familiar pattern: productivity gains at the cost of physical maintenance. Course correction recommended before another burnout cycle.' },
    { period: 'weekly', s: '2025-10-13', e: '2025-10-19', c: 'The Ankara Trip Week. Calendar showed a flight to Ankara on Oct 15 but location data placed you in Kadikoy at 10:30am — a notable inconsistency. Otherwise a balanced week: mood 3.5/5, sleep 7.2 hours, 3 gym sessions completed. The Saturday Bosphorus run was a highlight with a new personal best time.' },
  ];

  digestsData.forEach(d => {
    const eid = addEvent('digest', ts(d.e, 22), `${d.period} digest: ${d.s} to ${d.e}`);
    ins.digest.run(uuid(), eid, d.period, d.s, d.e, d.c, ts(d.e, 22));
  });
  console.log(`   [+] ${digestsData.length} AI digests`);

  // ════════════════════════════
  //  13. INCONSISTENCIES (12)
  // ════════════════════════════
  const inconsistenciesData = [
    { type: 'location_mismatch', sev: 0.8, title: 'Airport departure vs. Kadikoy location', desc: 'Your calendar shows a 6am flight to Ankara on Oct 15, but location data places you in Kadikoy at 10:30am. Either the flight was missed or the location data is stale.', q: 'Did you actually take the Ankara flight on October 15?', d: '2025-10-15' },
    { type: 'schedule_conflict', sev: 0.6, title: 'Double-booked afternoon', desc: 'Sprint Planning (14:00-15:00) and Dentist Appointment (14:00-15:00) overlap on Nov 14. Both events show as confirmed in your calendar.', q: 'Which appointment did you actually attend on November 14?', d: '2025-11-14' },
    { type: 'mood_behavior_disconnect', sev: 0.75, title: 'High mood, record spending', desc: "You reported mood 5/5 on Dec 20 (Elif's birthday) but spent $320 in a single evening. Historically, your highest-spend days correlate with mood scores below 3, not above.", q: 'Was the December 20 spending a conscious celebration or did the mood lead to overspending?', d: '2025-12-20' },
    { type: 'pattern_break', sev: 0.65, title: 'Gym routine collapsed', desc: 'You maintained 3x/week gym sessions from August to October (avg 11/month), then dropped to 0 sessions during Nov 10-20. No calendar cancellation was recorded.', q: 'What specifically caused you to stop going to the gym during the burnout period?', d: '2025-11-10' },
    { type: 'spending_mood_correlation', sev: 0.85, title: 'Burnout spending spike', desc: 'During your lowest-mood week (Nov 10-16, avg 1.8/5), food delivery spending increased 180% with 3 Yemeksepeti orders after midnight. You also made uncharacteristic online purchases totaling $350.', q: 'Were you aware of the late-night spending pattern during the burnout period?', d: '2025-11-15' },
    { type: 'time_gap', sev: 0.5, title: '8-hour data silence', desc: 'No data was recorded between 11pm Oct 27 and 7am Oct 28 — no location updates, no phone usage, no health metrics. All sensors went dark simultaneously.', q: 'What happened during the 8-hour gap on the night of October 27?', d: '2025-10-28' },
    { type: 'visual_mood_mismatch', sev: 0.7, title: 'Photo shows fatigue, mood says 5/5', desc: 'Photo analysis from Nov 18 evening shows a person with visible fatigue, dim lighting, and empty energy drink cans — classified as "exhausted" mood. But you logged mood 5/5 at 21:00 that same day.', q: 'Were you genuinely feeling great on November 18, or was the mood entry aspirational?', d: '2025-11-18' },
    { type: 'location_mismatch', sev: 0.55, title: 'Gym check-in without workout data', desc: 'Location data shows you at Gold\'s Gym on Feb 12 from 7:00-7:45, but Apple Health recorded zero workout minutes and only 800 steps during that window.', q: 'Did you go to the gym but skip the workout on February 12?', d: '2026-02-12' },
    { type: 'pattern_break', sev: 0.6, title: 'Sleep schedule shifted 2 hours', desc: 'Your typical sleep onset was 23:00 from Aug-Oct. Since December, it has shifted to 01:00 without any calendar or work pattern change to explain it.', q: 'What changed in December that pushed your bedtime 2 hours later?', d: '2025-12-15' },
    { type: 'mood_behavior_disconnect', sev: 0.5, title: 'Mood steady despite major purchase', desc: 'The $1,299 Hepsiburada purchase on Feb 10 (your largest single expense) had zero impact on mood, which stayed at 3/5 before and after. Historically, large purchases cause mood fluctuation.', q: 'Was the $1,299 purchase planned and budgeted, explaining the neutral mood reaction?', d: '2026-02-10' },
    { type: 'schedule_conflict', sev: 0.4, title: 'Meeting during reported gym time', desc: 'Calendar shows a "Gym Session" at 7:00 on Jan 20, but a "Coffee with Investor" was also logged at 7:30 at Kronotrop Cihangir — 4km from the gym.', q: 'Did you skip the gym for the investor coffee on January 20?', d: '2026-01-20' },
    { type: 'spending_mood_correlation', sev: 0.6, title: 'Weekend splurge pattern', desc: 'Your Saturday spending averages 2.3x weekday spending. On Saturdays with mood 4+, spending averages $180 vs. $65 on Saturdays with mood below 4.', q: 'Is your weekend spending driven by mood, social pressure, or simply having free time?', d: '2026-02-15' },
  ];

  inconsistenciesData.forEach(inc => {
    const evidenceIds = refs.txEvents.slice(0, 2).map(e => e.id);
    ins.inconsistency.run(uuid(), inc.type, inc.sev, inc.title, inc.desc, JSON.stringify(evidenceIds), inc.q, inc.d, ts('2026-02-23', 10));
  });
  console.log(`   [+] ${inconsistenciesData.length} inconsistencies`);

  // ════════════════════════════
  //  14. CONFRONTATIONS (10)
  // ════════════════════════════
  const confrontationsData = [
    { title: 'Stress Eating Pattern', insight: 'When your mood drops below 3, your food delivery spending increases by an average of 180%. This happened 4 times in the last 6 months. The pattern is consistent: low mood → skip cooking → order delivery → spend more → feel guilty → mood drops further.', sev: 0.85, dp: [{ label: 'Low mood days', value: '12' }, { label: 'Avg delivery spend (low mood)', value: '$42' }, { label: 'Avg delivery spend (normal)', value: '$15' }], cat: 'correlation' },
    { title: 'Declining Sleep Quality', insight: 'Your average sleep has dropped from 7.8 hours in August to 6.4 hours in February. At this rate, you will be below 6 hours by April. Sleep deprivation compounds: your next-day mood drops 0.8 points and your spending increases 25% after nights below 6 hours.', sev: 0.75, dp: [{ label: 'Aug avg', value: '7.8h' }, { label: 'Feb avg', value: '6.4h' }, { label: 'Trend', value: '-0.23h/month' }], cat: 'trend' },
    { title: 'Subscription Creep', insight: 'Your digital subscriptions have grown from $29/month in August to $76/month now. You added YouTube Premium and ChatGPT Plus without canceling any service. Tidal HiFi is paused but still on file. Total annual cost: $912 — enough for a weekend trip.', sev: 0.9, dp: [{ label: 'Aug total', value: '$29/mo' }, { label: 'Feb total', value: '$76/mo' }, { label: 'Unused', value: 'Tidal HiFi' }, { label: 'Annual cost', value: '$912' }], cat: 'anomaly' },
    { title: 'Weekend Overspending', insight: 'You spend 2.3x more on weekends than weekdays. Saturday alone accounts for 35% of your weekly spending. Weekend dining averages $95 versus $25 on weekdays.', sev: 0.7, dp: [{ label: 'Weekday avg', value: '$38' }, { label: 'Weekend avg', value: '$85' }, { label: 'Saturday share', value: '35%' }], cat: 'correlation' },
    { title: 'Gym Attendance vs. Cost', insight: 'Gym visits dropped from 12/month in September to 4/month in February. Your gym subscription costs $99/month, meaning each visit now costs $25 — more than a pay-per-session option ($15). At current rate, you are paying $1,188/year for 48 visits.', sev: 0.8, dp: [{ label: 'Sep visits', value: '12' }, { label: 'Feb visits', value: '4' }, { label: 'Cost/visit', value: '$25' }, { label: 'Annual cost', value: '$1,188' }], cat: 'trend' },
    { title: 'Late Night Working', insight: 'You logged 8 work sessions after 11pm in February, up from 2 in September. Your average mood the following morning is 2.1/5 versus 3.8/5 after normal bedtimes. Late nights also correlate with 40% fewer gym sessions the following week.', sev: 0.65, dp: [{ label: 'Late sessions (Feb)', value: '8' }, { label: 'Late sessions (Sep)', value: '2' }, { label: 'Next-day mood', value: '2.1/5' }], cat: 'anomaly' },
    { title: 'Coffee = Productivity', insight: 'Days with 2+ coffee purchases have 70% more note and thought entries. You are spending $210/month on coffee. The question is whether coffee drives productivity or if productive days just happen to include more cafe visits.', sev: 0.6, dp: [{ label: 'Monthly coffee', value: '$210' }, { label: 'Notes (coffee days)', value: '4.2 avg' }, { label: 'Notes (no coffee)', value: '2.5 avg' }], cat: 'correlation' },
    { title: 'Social Connection Deficit', insight: 'In November, you had 1 social event the entire month. Your mood averaged 2.3/5. In December, with 6 social events, mood averaged 4.2/5. The correlation between social frequency and mood is your strongest pattern (r=0.82).', sev: 0.8, dp: [{ label: 'Nov social events', value: '1' }, { label: 'Nov mood avg', value: '2.3/5' }, { label: 'Dec social events', value: '6' }, { label: 'Dec mood avg', value: '4.2/5' }], cat: 'correlation' },
    { title: 'Morning Routine Erosion', insight: 'In August, your gym sessions started at 7:00am on 85% of scheduled days. By February, only 40% of morning sessions are completed. Your wake time has drifted from 6:30 to 7:45, and the "first coffee" transaction has moved from 8:00 to 9:30.', sev: 0.55, dp: [{ label: 'Aug gym completion', value: '85%' }, { label: 'Feb gym completion', value: '40%' }, { label: 'Wake time drift', value: '+75 min' }], cat: 'trend' },
    { title: 'The Kadikoy Effect', insight: 'On days you visit Kadikoy, you write 2x more notes, report 0.6 higher mood, and walk 3,000 more steps than average. You visit Kadikoy mainly on weekends. Consider integrating more Asian-side visits into weekdays.', sev: 0.5, dp: [{ label: 'Notes (Kadikoy days)', value: '3.8 avg' }, { label: 'Notes (other days)', value: '1.9 avg' }, { label: 'Mood boost', value: '+0.6' }, { label: 'Extra steps', value: '+3,000' }], cat: 'correlation' },
  ];

  confrontationsData.forEach(c => {
    const relatedIds = refs.moodEvents.slice(0, 3).map(e => e.id);
    ins.confrontation.run(uuid(), c.title, c.insight, c.sev, JSON.stringify(c.dp), JSON.stringify(relatedIds), c.cat, ts('2026-02-23', 10));
  });
  console.log(`   [+] ${confrontationsData.length} confrontations`);

  // ════════════════════════════
  //  15. RULES (6) + ACTIONS (5)
  // ════════════════════════════
  ins.rule.run(uuid(), 'ignore_merchant', JSON.stringify({ merchant: 'Istanbulkart', reason: 'Transit card top-ups are not discretionary spending' }), ts('2025-09-01'), 1);
  ins.rule.run(uuid(), 'ignore_category', JSON.stringify({ category: 'transfer', reason: 'Internal transfers between accounts' }), ts('2025-09-01'), 1);
  ins.rule.run(uuid(), 'threshold', JSON.stringify({ minAmount: '2000', type: 'daily_spending', currency: 'USD', alert: true }), ts('2025-10-15'), 1);
  ins.rule.run(uuid(), 'whitelist_subscription', JSON.stringify({ merchant: 'Netflix', amount: 17.99, currency: 'USD' }), ts('2025-08-20'), 1);
  ins.rule.run(uuid(), 'threshold', JSON.stringify({ minAmount: '5000', type: 'single_transaction', currency: 'USD', alert: true }), ts('2025-11-01'), 1);
  ins.rule.run(uuid(), 'ignore_merchant', JSON.stringify({ merchant: 'Salary Deposit', reason: 'Income, not expense' }), ts('2025-08-01'), 0);
  console.log('   [+] 6 rules');

  const firstTxEvent = refs.txEvents[0]?.id || uuid();
  ins.action.run(uuid(), firstTxEvent, 'draft_email', 'draft', JSON.stringify({ to: 'support@tidal.com', subject: 'Cancel subscription', body: 'I would like to cancel my Tidal HiFi subscription...' }), ts('2025-09-10'), null);
  ins.action.run(uuid(), firstTxEvent, 'create_reminder', 'approved', JSON.stringify({ text: 'Review gym attendance next week', date: '2026-02-28' }), ts('2026-02-20'), null);
  ins.action.run(uuid(), firstTxEvent, 'mark_ignore', 'applied', JSON.stringify({ reason: 'Planned MacBook purchase for new hire' }), ts('2026-02-12'), ts('2026-02-12'));
  ins.action.run(uuid(), firstTxEvent, 'draft_email', 'cancelled', JSON.stringify({ to: 'support@netflix.com', subject: 'Price increase inquiry' }), ts('2026-01-20'), null);
  ins.action.run(uuid(), firstTxEvent, 'create_reminder', 'draft', JSON.stringify({ text: 'Check sleep improvement in 2 weeks', date: '2026-03-10' }), ts('2026-02-23'), null);
  console.log('   [+] 5 actions');

  // ════════════════════════════
  //  16. ACTIVITY LOG (40+)
  // ════════════════════════════
  const activities = [
    { d: '2025-08-02', t: 'csv_import', desc: 'Imported 85 transactions from Garanti BBVA CSV export' },
    { d: '2025-08-02', t: 'diff_generated', desc: 'Generated initial spending diff for August 2025' },
    { d: '2025-08-05', t: 'rule_created', desc: 'Created rule: Ignore Istanbulkart top-ups' },
    { d: '2025-08-10', t: 'mood_recorded', desc: 'Mood recorded: 4/5 - Great evening walk along the Bosphorus' },
    { d: '2025-09-01', t: 'import_location', desc: 'Imported 50 locations from Google Takeout' },
    { d: '2025-09-05', t: 'note_created', desc: 'Note: Decided to cancel Tidal subscription' },
    { d: '2025-09-15', t: 'voice_recording', desc: 'Voice memo transcribed (30s) — Bosphorus ferry walk' },
    { d: '2025-10-01', t: 'import_calendar', desc: 'Imported 40 calendar events from Google Calendar' },
    { d: '2025-10-01', t: 'import_health', desc: 'Imported 140 health entries from Apple Health' },
    { d: '2025-10-08', t: 'voice_recording', desc: 'Voice memo transcribed (90s) — debugging notes' },
    { d: '2025-10-15', t: 'inconsistency_detected', desc: 'Location mismatch: Airport flight vs Kadikoy location on Oct 15' },
    { d: '2025-11-01', t: 'rule_created', desc: 'Created rule: Alert on single transactions above $500' },
    { d: '2025-11-14', t: 'inconsistency_detected', desc: 'Schedule conflict: Sprint Planning vs Dentist on Nov 14' },
    { d: '2025-11-18', t: 'photo_saved', desc: 'Photo saved: late_night_coding.jpg — burnout mode' },
    { d: '2025-11-20', t: 'deep_scan', desc: 'Deep scan completed: 8 inconsistencies found across 90 days' },
    { d: '2025-11-25', t: 'mood_recorded', desc: 'Mood recorded: 2/5 - Burnout week continues' },
    { d: '2025-12-01', t: 'diff_generated', desc: 'Generated monthly diff: November vs October 2025' },
    { d: '2025-12-10', t: 'video_imported', desc: 'Video imported: bazaar_walk.mp4 (60s, 4 frames)' },
    { d: '2025-12-20', t: 'photo_saved', desc: "Photo saved: birthday_mikla.jpg — Elif's birthday" },
    { d: '2025-12-25', t: 'note_created', desc: 'Year-end reflection note created' },
    { d: '2025-12-31', t: 'photo_saved', desc: 'Photo saved: newyear_bosphorus.jpg — fireworks' },
    { d: '2026-01-01', t: 'diff_generated', desc: 'Generated monthly diff: December 2025' },
    { d: '2026-01-05', t: 'note_created', desc: 'New Year resolution: better sleep hygiene' },
    { d: '2026-01-10', t: 'voice_recording', desc: 'Voice memo transcribed (40s) — standing desk update' },
    { d: '2026-01-15', t: 'csv_import', desc: 'Imported 45 new transactions from January statement' },
    { d: '2026-01-20', t: 'inconsistency_detected', desc: 'Schedule conflict: Gym vs Investor coffee on Jan 20' },
    { d: '2026-02-01', t: 'diff_generated', desc: 'Generated monthly diff: January 2026' },
    { d: '2026-02-05', t: 'voice_recording', desc: 'Voice memo transcribed (55s) — product roadmap thoughts' },
    { d: '2026-02-10', t: 'threshold_alert', desc: 'Alert: Single transaction $1,299 at Hepsiburada exceeds $500 threshold' },
    { d: '2026-02-12', t: 'action_applied', desc: 'Action applied: Mark Hepsiburada $1,299 as planned business expense' },
    { d: '2026-02-14', t: 'photo_saved', desc: "Photo saved: valentines_dinner.jpg — Valentine's at Sunset Grill" },
    { d: '2026-02-18', t: 'note_created', desc: 'Thought: Maybe I should build a personal finance tracker...' },
    { d: '2026-02-19', t: 'voice_recording', desc: 'Voice memo transcribed (30s) — demo prep notes' },
    { d: '2026-02-20', t: 'deep_scan', desc: 'Deep scan completed: 12 inconsistencies found across 180 days' },
    { d: '2026-02-20', t: 'confrontation_generated', desc: 'Generated 10 confrontations for 6-month review' },
    { d: '2026-02-21', t: 'comparison_run', desc: 'Period comparison: November vs December 2025' },
    { d: '2026-02-22', t: 'data_export', desc: 'Full data export completed: mirror-history-export-2026-02-22.json' },
    { d: '2026-02-23', t: 'digest_generated', desc: 'Weekly digest generated: Feb 17-23' },
    { d: '2026-02-23', t: 'csv_import', desc: 'Imported 30 new transactions from February statement' },
    { d: '2026-02-24', t: 'mood_recorded', desc: 'Mood recorded: 4/5 - Demo prep going well' },
  ];

  activities.forEach(a => {
    ins.activity.run(uuid(), ts(a.d, rand(8, 20)), a.t, a.desc, '{}');
  });
  console.log(`   [+] ${activities.length} activity log entries`);

  // ════════════════════════════
  //  17. DIFFS (4)
  // ════════════════════════════
  const diffsData = [
    { pt: 'monthly', s: '2026-02-01', e: '2026-02-28', sum: 'February: spending 8% above 6-month baseline. 2 anomalies (Hepsiburada $1,299, Starbucks $85). Netflix price increase confirmed (+$2). Gold\'s Gym raised to $99.', json: JSON.stringify([{ type: 'spending_summary', title: 'Monthly Overview', amount: 2800, currency: 'USD', change_percent: 8 }, { type: 'anomaly', title: 'Hepsiburada Electronics', amount: 1299, merchant: 'Hepsiburada' }, { type: 'price_increase', title: 'Netflix Subscription', old_amount: 15.99, new_amount: 17.99, merchant: 'Netflix' }]) },
    { pt: 'monthly', s: '2026-01-01', e: '2026-01-31', sum: 'January: post-holiday normalization. Spending down 22% from December. Netflix price increase flagged. All subscriptions active.', json: JSON.stringify([{ type: 'spending_summary', title: 'Monthly Overview', amount: 2200, currency: 'USD', change_percent: -22 }]) },
    { pt: 'weekly', s: '2026-02-17', e: '2026-02-23', sum: 'Week of Feb 17: moderate spending, 1 subscription renewal (Spotify). Coffee at $55 for the week.', json: JSON.stringify([{ type: 'spending_summary', title: 'Weekly Overview', amount: 520, currency: 'USD' }, { type: 'subscription', title: 'Spotify Renewal', amount: 9.99, merchant: 'Spotify' }]) },
    { pt: 'monthly', s: '2025-12-01', e: '2025-12-31', sum: 'December: highest spending month ($3,400). Holiday gifts, social dining, and celebrations drove 45% increase. Mood correlation positive — high spend = high mood this month.', json: JSON.stringify([{ type: 'spending_summary', title: 'Monthly Overview', amount: 3400, currency: 'USD', change_percent: 45 }]) },
  ];

  diffsData.forEach(d => {
    ins.diff.run(uuid(), d.pt, d.s, d.e, d.sum, d.json);
  });
  console.log(`   [+] ${diffsData.length} diffs`);

}); // end transaction

// ── Execute ──
seedAll();

db.close();

console.log(`\n   ✅ Done! Demo database ready.\n`);
console.log('   Start the demo:\n');
console.log(`   MIRROR_HISTORY_DB_PATH=${DEMO_DB_PATH} npm run start:dev\n`);
console.log('   Or use the shortcut:\n');
console.log('   npm run demo\n');
