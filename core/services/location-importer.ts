import fs from 'fs';
import * as db from '../database';
import { broadcast } from '../event-bus';
import type { ImportResult } from '../types';

interface GoogleLocationRecord {
  latitudeE7?: number;
  longitudeE7?: number;
  timestamp?: string;
  timestampMs?: string;
  formattedAddress?: string;
  address?: string;
}

function extractRecords(data: Record<string, unknown>): GoogleLocationRecord[] {
  // New format: { locations: [...] }
  if (Array.isArray((data as { locations?: unknown[] }).locations)) {
    return (data as { locations: GoogleLocationRecord[] }).locations;
  }
  // Old format: { timelineObjects: [{ placeVisit: { location: {...} } }] }
  if (Array.isArray((data as { timelineObjects?: unknown[] }).timelineObjects)) {
    const objects = (data as { timelineObjects: Record<string, unknown>[] }).timelineObjects;
    return objects
      .filter(o => o.placeVisit)
      .map(o => {
        const pv = o.placeVisit as { location: GoogleLocationRecord; duration?: { startTimestamp?: string } };
        return {
          ...pv.location,
          timestamp: pv.duration?.startTimestamp,
        };
      });
  }
  return [];
}

function normalizeTimestamp(raw?: string): string {
  if (!raw) return new Date().toISOString();
  // Already ISO
  if (raw.includes('T')) return raw;
  // Unix milliseconds
  const ms = parseInt(raw, 10);
  if (!isNaN(ms) && ms > 1e12) return new Date(ms).toISOString();
  // Unix seconds
  if (!isNaN(ms) && ms > 1e9) return new Date(ms * 1000).toISOString();
  return new Date(raw).toISOString();
}

export function importLocationHistory(filePath: string): ImportResult {
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  const records = extractRecords(data);

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  const batchInsert = db.getDb().transaction(() => {
    for (const record of records) {
      try {
        const latE7 = record.latitudeE7;
        const lngE7 = record.longitudeE7;
        if (latE7 == null || lngE7 == null) { skipped++; continue; }

        const lat = latE7 / 1e7;
        const lng = lngE7 / 1e7;
        const timestamp = normalizeTimestamp(record.timestamp || record.timestampMs);
        const address = record.formattedAddress || record.address || '';

        // Dedup: round to hour precision + ~100m precision
        const contentHash = db.computeContentHash([
          lat.toFixed(3), lng.toFixed(3), timestamp.slice(0, 13),
        ]);

        const { event, isNew } = db.findOrInsertEvent(
          'location', timestamp,
          address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          { lat, lng, address },
          1.0, 'local_private', contentHash,
        );

        if (!isNew) { skipped++; continue; }

        db.insertLocation(event.id, lat, lng, address, timestamp, 'google_takeout');
        if (address) db.indexForSearch(event.id, address);

        imported++;
      } catch (e) {
        if (errors.length < 10) errors.push(e instanceof Error ? e.message : String(e));
        skipped++;
      }
    }
  });

  batchInsert();

  db.logActivity('import_location', `Imported ${imported} locations from Google Takeout`, {
    imported, skipped, source: filePath,
  });
  broadcast('location_imported', { imported, skipped });

  return { imported, skipped, errors };
}
