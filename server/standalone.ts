/**
 * Mirror History Standalone Server
 *
 * Entry point for running Mirror History without Electron (Docker, self-hosted, etc.)
 * Serves the frontend static files and the API on a single port.
 *
 * Usage:
 *   npx tsx server/standalone.ts
 *   node dist-server/standalone.js
 *
 * Environment variables:
 *   MIRROR_HISTORY_PORT       — Server port (default: 31072)
 *   MIRROR_HISTORY_HOST       — Bind address (default: 0.0.0.0)
 *   MIRROR_HISTORY_JWT_SECRET — JWT signing secret (auto-generated if not set)
 *   MIRROR_HISTORY_DB_PATH    — Database file path (default: ~/.mirror-history/mirror-history.db)
 */

import { initDatabase } from '../core/database';
import { seedDefaultUser } from '../core/services/auth-service';
import { createServer } from './api';

const PORT = parseInt(process.env.MIRROR_HISTORY_PORT || '31072', 10);
const HOST = process.env.MIRROR_HISTORY_HOST || '0.0.0.0';
const DB_PATH = process.env.MIRROR_HISTORY_DB_PATH || undefined;

async function main() {
  console.log('[MirrorHistory] Starting standalone server...');

  // Initialize database
  initDatabase(DB_PATH);
  console.log('[MirrorHistory] Database initialized');

  // Seed default admin user if none exists
  seedDefaultUser();
  console.log('[MirrorHistory] Default user seeded (admin/changeme)');

  // Start server with static file serving enabled
  await createServer(PORT, HOST, true);
  console.log(`[MirrorHistory] Server running at http://${HOST}:${PORT}`);
  console.log('[MirrorHistory] Default login: admin / changeme');
}

main().catch((err) => {
  console.error('[MirrorHistory] Failed to start:', err);
  process.exit(1);
});
