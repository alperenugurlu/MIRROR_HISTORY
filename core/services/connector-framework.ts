/**
 * Connector Framework — Automatic data sync from external services
 *
 * Architecture:
 * - DataConnector interface for each service
 * - ConnectorManager handles polling, state persistence, error handling
 * - Each connector stores its state (tokens, lastSync) in the DB
 */

import * as db from '../database';

// ── Interfaces ──

export interface NormalizedEvent {
  type: string;
  timestamp: string;
  summary: string;
  details: Record<string, unknown>;
  contentHash: string;
}

export interface ConnectorStatus {
  connected: boolean;
  lastSync: string | null;
  lastError: string | null;
  eventCount: number;
}

export interface DataConnector {
  id: string;
  name: string;
  icon: string;
  pollInterval: 'hourly' | 'daily';

  /** Check if connector has valid credentials */
  isConnected(): boolean;

  /** Start OAuth flow or validate credentials. Returns auth URL for OAuth. */
  authenticate(config: Record<string, string>): Promise<{ ok: boolean; authUrl?: string; error?: string }>;

  /** Exchange OAuth code for tokens (after user completes consent) */
  handleCallback(code: string): Promise<{ ok: boolean; error?: string }>;

  /** Fetch new events since last sync */
  fetchNew(): Promise<NormalizedEvent[]>;

  /** Remove stored credentials */
  disconnect(): void;

  /** Get current status */
  getStatus(): ConnectorStatus;
}

// ── Connector State DB helpers ──

export interface ConnectorState {
  id: string;
  connector_id: string;
  auth_data: string; // JSON encrypted tokens
  last_sync: string | null;
  last_error: string | null;
  enabled: number;
  event_count: number;
}

export function getConnectorState(connectorId: string): ConnectorState | null {
  ensureConnectorTable();
  const row = db.getDb().prepare(
    'SELECT * FROM connector_state WHERE connector_id = ?',
  ).get(connectorId) as ConnectorState | undefined;
  return row || null;
}

export function saveConnectorState(
  connectorId: string,
  authData: Record<string, unknown>,
  lastSync: string | null = null,
): void {
  ensureConnectorTable();
  const database = db.getDb();
  const existing = getConnectorState(connectorId);

  if (existing) {
    database.prepare(`
      UPDATE connector_state SET auth_data = ?, last_sync = ? WHERE connector_id = ?
    `).run(JSON.stringify(authData), lastSync, connectorId);
  } else {
    const id = require('crypto').randomUUID();
    database.prepare(`
      INSERT INTO connector_state (id, connector_id, auth_data, last_sync, enabled)
      VALUES (?, ?, ?, ?, 1)
    `).run(id, connectorId, JSON.stringify(authData), lastSync);
  }
}

export function updateConnectorSync(connectorId: string, lastSync: string, eventCount: number): void {
  ensureConnectorTable();
  db.getDb().prepare(`
    UPDATE connector_state SET last_sync = ?, event_count = ?, last_error = NULL WHERE connector_id = ?
  `).run(lastSync, eventCount, connectorId);
}

export function updateConnectorError(connectorId: string, error: string): void {
  ensureConnectorTable();
  db.getDb().prepare(`
    UPDATE connector_state SET last_error = ? WHERE connector_id = ?
  `).run(error, connectorId);
}

export function deleteConnectorState(connectorId: string): void {
  ensureConnectorTable();
  db.getDb().prepare('DELETE FROM connector_state WHERE connector_id = ?').run(connectorId);
}

function ensureConnectorTable(): void {
  db.getDb().exec(`
    CREATE TABLE IF NOT EXISTS connector_state (
      id TEXT PRIMARY KEY,
      connector_id TEXT NOT NULL UNIQUE,
      auth_data TEXT NOT NULL DEFAULT '{}',
      last_sync TEXT,
      last_error TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      event_count INTEGER NOT NULL DEFAULT 0
    )
  `);
}

// ── Connector Manager ──

export class ConnectorManager {
  private connectors: Map<string, DataConnector> = new Map();
  private intervals: ReturnType<typeof setInterval>[] = [];
  private running = false;

  register(connector: DataConnector): void {
    this.connectors.set(connector.id, connector);
  }

  getConnector(id: string): DataConnector | undefined {
    return this.connectors.get(id);
  }

  listConnectors(): { id: string; name: string; icon: string; status: ConnectorStatus }[] {
    return Array.from(this.connectors.values()).map(c => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      status: c.getStatus(),
    }));
  }

  /** Start polling all enabled connectors */
  start(): void {
    if (this.running) return;
    this.running = true;

    for (const connector of this.connectors.values()) {
      if (!connector.isConnected()) continue;

      const intervalMs = connector.pollInterval === 'hourly'
        ? 60 * 60 * 1000
        : 24 * 60 * 60 * 1000;

      // Initial sync after 10 seconds
      const timeout = setTimeout(() => {
        this.syncConnector(connector.id).catch(err => {
          console.error(`[ConnectorManager] Initial sync error for ${connector.id}:`, err);
        });
      }, 10_000);

      // Then poll at interval
      const interval = setInterval(() => {
        this.syncConnector(connector.id).catch(err => {
          console.error(`[ConnectorManager] Poll error for ${connector.id}:`, err);
        });
      }, intervalMs);

      this.intervals.push(interval);
      // Store timeout as interval for cleanup (it's a number type)
      this.intervals.push(timeout as unknown as ReturnType<typeof setInterval>);
    }

    console.log(`[ConnectorManager] Started polling ${this.connectors.size} connector(s)`);
  }

  /** Stop all polling */
  stop(): void {
    for (const interval of this.intervals) {
      clearInterval(interval);
      clearTimeout(interval as unknown as ReturnType<typeof setTimeout>);
    }
    this.intervals = [];
    this.running = false;
  }

  /** Manually trigger sync for a connector */
  async syncConnector(connectorId: string): Promise<{ imported: number; errors: number }> {
    const connector = this.connectors.get(connectorId);
    if (!connector) throw new Error(`Connector "${connectorId}" not found`);
    if (!connector.isConnected()) throw new Error(`Connector "${connectorId}" not connected`);

    try {
      const events = await connector.fetchNew();
      let imported = 0;
      let errors = 0;

      for (const ev of events) {
        try {
          // Deduplicate using content hash
          const { isNew } = db.findOrInsertEvent(
            ev.type as any,
            ev.timestamp,
            ev.summary,
            ev.details,
            1.0,
            'local_private',
            ev.contentHash,
          );
          if (isNew) {
            imported++;
            // Index for search
            db.indexForSearch(ev.contentHash, `${ev.type} ${ev.summary}`);
          }
        } catch (err) {
          errors++;
          console.error(`[ConnectorManager] Event import error:`, err);
        }
      }

      const now = new Date().toISOString();
      const state = getConnectorState(connectorId);
      const totalCount = (state?.event_count || 0) + imported;
      updateConnectorSync(connectorId, now, totalCount);

      if (imported > 0) {
        db.logActivity('connector_sync', `${connector.name}: ${imported} new events synced`, {
          connector_id: connectorId,
          imported,
          errors,
        });
      }

      return { imported, errors };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      updateConnectorError(connectorId, errorMsg);
      throw err;
    }
  }
}

// Global connector manager instance
export const connectorManager = new ConnectorManager();
