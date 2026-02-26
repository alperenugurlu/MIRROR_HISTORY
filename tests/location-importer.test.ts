import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { initDatabase } from '../core/database';
import * as db from '../core/database';
import { importLocationHistory } from '../core/services/location-importer';

let tmpDir: string;

beforeEach(() => {
  initDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-history-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeTmpFile(name: string, content: string): string {
  const filePath = path.join(tmpDir, name);
  fs.writeFileSync(filePath, content);
  return filePath;
}

describe('Location Importer', () => {
  it('imports locations from new Google Takeout format', () => {
    const data = {
      locations: [
        { latitudeE7: 409876543, longitudeE7: -740123456, timestamp: '2026-01-15T10:00:00Z', formattedAddress: '123 Main St, NYC' },
        { latitudeE7: 409876000, longitudeE7: -740123000, timestamp: '2026-01-15T14:00:00Z', formattedAddress: '456 Broadway, NYC' },
      ],
    };
    const filePath = writeTmpFile('records.json', JSON.stringify(data));
    const result = importLocationHistory(filePath);

    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);

    expect(db.getLocationCount()).toBe(2);
  });

  it('imports from old timelineObjects format', () => {
    const data = {
      timelineObjects: [
        {
          placeVisit: {
            location: { latitudeE7: 409876543, longitudeE7: -740123456, formattedAddress: 'Central Park' },
            duration: { startTimestamp: '2026-01-10T08:00:00Z' },
          },
        },
      ],
    };
    const filePath = writeTmpFile('records.json', JSON.stringify(data));
    const result = importLocationHistory(filePath);

    expect(result.imported).toBe(1);
  });

  it('skips records without coordinates', () => {
    const data = {
      locations: [
        { timestamp: '2026-01-15T10:00:00Z', formattedAddress: 'No coords' },
        { latitudeE7: 409876543, longitudeE7: -740123456, timestamp: '2026-01-15T10:00:00Z' },
      ],
    };
    const filePath = writeTmpFile('records.json', JSON.stringify(data));
    const result = importLocationHistory(filePath);

    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it('deduplicates by location+hour', () => {
    const data = {
      locations: [
        { latitudeE7: 409876543, longitudeE7: -740123456, timestamp: '2026-01-15T10:00:00Z' },
        { latitudeE7: 409876543, longitudeE7: -740123456, timestamp: '2026-01-15T10:30:00Z' }, // same hour
      ],
    };
    const filePath = writeTmpFile('records.json', JSON.stringify(data));
    const result = importLocationHistory(filePath);

    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it('indexes addresses for FTS search', () => {
    const data = {
      locations: [
        { latitudeE7: 409876543, longitudeE7: -740123456, timestamp: '2026-01-15T10:00:00Z', formattedAddress: 'Times Square, Manhattan' },
      ],
    };
    const filePath = writeTmpFile('records.json', JSON.stringify(data));
    importLocationHistory(filePath);

    const results = db.searchFTS('Manhattan', 10);
    expect(results.length).toBeGreaterThan(0);
  });

  it('converts E7 coordinates correctly', () => {
    const data = {
      locations: [
        { latitudeE7: 407128000, longitudeE7: -740060000, timestamp: '2026-01-15T10:00:00Z' },
      ],
    };
    const filePath = writeTmpFile('records.json', JSON.stringify(data));
    importLocationHistory(filePath);

    const events = db.getAllEventsPaginated(10);
    const locEvent = events.find(e => e.type === 'location');
    expect(locEvent).toBeDefined();
    // 407128000 / 1e7 = 40.7128
    expect(locEvent!.summary).toContain('40.7128');
  });
});
