import { initDatabase } from '../core/database';
import { createServer } from './api';
import { startTelegramBot } from './telegram';

const API_PORT = parseInt(process.env.MIRROR_HISTORY_PORT || '31072', 10);

export async function startServer(dbPath?: string): Promise<void> {
  // Initialize database
  initDatabase(dbPath);
  console.log('[MirrorHistory] Database initialized');

  // Start HTTP API
  await createServer(API_PORT);

  // Start Telegram bot (non-blocking, will skip if not configured)
  await startTelegramBot();
}

// If run directly (not imported by Electron)
const isDirectRun = process.argv[1]?.endsWith('server/index.ts') ||
  process.argv[1]?.endsWith('server/index.js');

if (isDirectRun) {
  startServer().catch((err) => {
    console.error('[MirrorHistory] Failed to start server:', err);
    process.exit(1);
  });
}
