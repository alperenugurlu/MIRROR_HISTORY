/**
 * Google Calendar Connector
 *
 * Uses Google Calendar API v3 with OAuth 2.0.
 * No external Google SDK — pure fetch-based implementation.
 *
 * Flow:
 * 1. User provides client_id + client_secret (from Google Cloud Console)
 * 2. authenticate() returns auth URL → user consents in browser
 * 3. handleCallback(code) exchanges code for tokens
 * 4. fetchNew() uses Calendar API with syncToken for delta sync
 */

import crypto from 'crypto';
import * as db from '../../database';
import {
  type DataConnector,
  type NormalizedEvent,
  type ConnectorStatus,
  getConnectorState,
  saveConnectorState,
  deleteConnectorState,
} from '../connector-framework';

const CONNECTOR_ID = 'google-calendar';
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

// For Electron desktop apps, use localhost redirect
const REDIRECT_URI = 'http://localhost:19876/oauth/callback';

interface GoogleTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix timestamp ms
  client_id: string;
  client_secret: string;
  sync_token?: string; // Google Calendar sync token for delta sync
}

export class GoogleCalendarConnector implements DataConnector {
  id = CONNECTOR_ID;
  name = 'Google Calendar';
  icon = '\u{1F4C5}';
  pollInterval: 'hourly' = 'hourly';

  private tokens: GoogleTokens | null = null;
  private pendingClientId = '';
  private pendingClientSecret = '';

  constructor() {
    this.loadTokens();
  }

  private loadTokens(): void {
    const state = getConnectorState(CONNECTOR_ID);
    if (state) {
      try {
        this.tokens = JSON.parse(state.auth_data);
      } catch {
        this.tokens = null;
      }
    }
  }

  isConnected(): boolean {
    return this.tokens !== null && !!this.tokens.refresh_token;
  }

  async authenticate(config: Record<string, string>): Promise<{ ok: boolean; authUrl?: string; error?: string }> {
    const clientId = config.client_id;
    const clientSecret = config.client_secret;

    if (!clientId || !clientSecret) {
      return { ok: false, error: 'client_id and client_secret are required' };
    }

    this.pendingClientId = clientId;
    this.pendingClientSecret = clientSecret;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent',
    });

    const authUrl = `${AUTH_ENDPOINT}?${params.toString()}`;
    return { ok: true, authUrl };
  }

  async handleCallback(code: string): Promise<{ ok: boolean; error?: string }> {
    if (!this.pendingClientId || !this.pendingClientSecret) {
      return { ok: false, error: 'No pending auth. Call authenticate() first.' };
    }

    try {
      const response = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: this.pendingClientId,
          client_secret: this.pendingClientSecret,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code',
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        return { ok: false, error: `Token exchange failed: ${err}` };
      }

      const data = await response.json() as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
      };

      this.tokens = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + data.expires_in * 1000,
        client_id: this.pendingClientId,
        client_secret: this.pendingClientSecret,
      };

      saveConnectorState(CONNECTOR_ID, this.tokens as any);
      this.pendingClientId = '';
      this.pendingClientSecret = '';

      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Token exchange failed' };
    }
  }

  async fetchNew(): Promise<NormalizedEvent[]> {
    if (!this.tokens) throw new Error('Not connected');

    await this.ensureValidToken();

    const events: NormalizedEvent[] = [];
    let pageToken: string | undefined;
    const syncToken = this.tokens.sync_token;

    try {
      do {
        const params = new URLSearchParams({ maxResults: '250', singleEvents: 'true' });

        if (syncToken) {
          // Delta sync — only changed events
          params.set('syncToken', syncToken);
        } else {
          // Full sync — last 90 days
          const timeMin = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
          params.set('timeMin', timeMin);
          params.set('orderBy', 'startTime');
        }

        if (pageToken) {
          params.set('pageToken', pageToken);
        }

        const response = await fetch(
          `${CALENDAR_API}/calendars/primary/events?${params.toString()}`,
          {
            headers: { Authorization: `Bearer ${this.tokens.access_token}` },
          },
        );

        if (response.status === 410) {
          // Sync token expired — do full sync
          this.tokens.sync_token = undefined;
          saveConnectorState(CONNECTOR_ID, this.tokens as any);
          return this.fetchNew(); // Retry without sync token
        }

        if (!response.ok) {
          throw new Error(`Calendar API error: ${response.status} ${await response.text()}`);
        }

        const data = await response.json() as {
          items?: Array<{
            id: string;
            summary?: string;
            start?: { dateTime?: string; date?: string };
            end?: { dateTime?: string; date?: string };
            location?: string;
            description?: string;
            status?: string;
          }>;
          nextPageToken?: string;
          nextSyncToken?: string;
        };

        for (const item of data.items || []) {
          // Skip cancelled events
          if (item.status === 'cancelled') continue;

          const startTime = item.start?.dateTime || item.start?.date || '';
          const endTime = item.end?.dateTime || item.end?.date || '';
          const title = item.summary || 'Untitled event';

          if (!startTime) continue;

          const contentHash = crypto.createHash('sha256')
            .update(`gcal|${item.id}|${startTime}|${title}`)
            .digest('hex');

          events.push({
            type: 'calendar_event',
            timestamp: startTime,
            summary: `${title}${item.location ? ' @ ' + item.location : ''}`,
            details: {
              source: 'google_calendar',
              google_event_id: item.id,
              title,
              start_time: startTime,
              end_time: endTime,
              location: item.location || '',
              description: (item.description || '').slice(0, 500),
            },
            contentHash,
          });
        }

        pageToken = data.nextPageToken;

        // Save the new sync token for delta sync
        if (data.nextSyncToken) {
          this.tokens.sync_token = data.nextSyncToken;
          saveConnectorState(CONNECTOR_ID, this.tokens as any);
        }
      } while (pageToken);

      return events;
    } catch (err) {
      console.error('[GoogleCalendar] Fetch error:', err);
      throw err;
    }
  }

  disconnect(): void {
    this.tokens = null;
    deleteConnectorState(CONNECTOR_ID);
  }

  getStatus(): ConnectorStatus {
    const state = getConnectorState(CONNECTOR_ID);
    return {
      connected: this.isConnected(),
      lastSync: state?.last_sync || null,
      lastError: state?.last_error || null,
      eventCount: state?.event_count || 0,
    };
  }

  /** Refresh the access token if it's expired or about to expire */
  private async ensureValidToken(): Promise<void> {
    if (!this.tokens) throw new Error('Not connected');

    // Refresh if expiring within 5 minutes
    if (this.tokens.expires_at > Date.now() + 5 * 60 * 1000) return;

    try {
      const response = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.tokens.client_id,
          client_secret: this.tokens.client_secret,
          refresh_token: this.tokens.refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`);
      }

      const data = await response.json() as {
        access_token: string;
        expires_in: number;
      };

      this.tokens.access_token = data.access_token;
      this.tokens.expires_at = Date.now() + data.expires_in * 1000;

      saveConnectorState(CONNECTOR_ID, this.tokens as any);
    } catch (err) {
      console.error('[GoogleCalendar] Token refresh error:', err);
      throw err;
    }
  }
}

export const googleCalendarConnector = new GoogleCalendarConnector();
