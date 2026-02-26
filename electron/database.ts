// Thin wrapper: delegates to core/database with Electron-specific default path
import { app } from 'electron';
import path from 'path';
import { initDatabase as coreInitDatabase } from '../core/database';

// Re-export everything from core
export * from '../core/database';

// Override initDatabase to use Electron's userData path by default
export function initDatabase(dbPath?: string): void {
  const resolvedPath = dbPath || path.join(app.getPath('userData'), 'mirror-history.db');
  coreInitDatabase(resolvedPath);
}
