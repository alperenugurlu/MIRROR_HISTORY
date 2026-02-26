import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { initDatabase } from '../core/database';
import * as db from '../core/database';
import { importAppleHealth } from '../core/services/health-importer';

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

const SAMPLE_HEALTH_XML = `<?xml version="1.0" encoding="UTF-8"?>
<HealthData>
  <Record type="HKQuantityTypeIdentifierStepCount" value="1200" startDate="2026-02-01 08:00:00 -0500" unit="count"/>
  <Record type="HKQuantityTypeIdentifierStepCount" value="3400" startDate="2026-02-01 12:00:00 -0500" unit="count"/>
  <Record type="HKQuantityTypeIdentifierStepCount" value="2100" startDate="2026-02-02 09:00:00 -0500" unit="count"/>
  <Record type="HKQuantityTypeIdentifierHeartRate" value="72" startDate="2026-02-01 08:00:00 -0500" unit="count/min"/>
  <Record type="HKQuantityTypeIdentifierHeartRate" value="75" startDate="2026-02-01 08:30:00 -0500" unit="count/min"/>
  <Record type="HKQuantityTypeIdentifierBodyMass" value="75.5" startDate="2026-02-01 07:00:00 -0500" unit="kg"/>
  <Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="32.5" startDate="2026-02-01 18:00:00 -0500"/>
</HealthData>`;

describe('Health Importer', () => {
  it('imports health records from Apple Health XML', () => {
    const filePath = writeTmpFile('export.xml', SAMPLE_HEALTH_XML);
    const result = importAppleHealth(filePath);

    expect(result.imported).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });

  it('aggregates steps by day', () => {
    const filePath = writeTmpFile('export.xml', SAMPLE_HEALTH_XML);
    const result = importAppleHealth(filePath);

    // Feb 1 has two step records (1200 + 3400 = 4600), Feb 2 has one (2100)
    // Should produce 2 step entries (one per day), not 3
    const healthEntries = db.getHealthEntriesByType('steps');
    expect(healthEntries.length).toBe(2);

    const dayTotals = healthEntries.map(e => e.value).sort((a, b) => a - b);
    expect(dayTotals).toContain(2100);
    expect(dayTotals).toContain(4600);
  });

  it('samples heart rate by hour', () => {
    const filePath = writeTmpFile('export.xml', SAMPLE_HEALTH_XML);
    importAppleHealth(filePath);

    // Two HR records at same hour (08:00 and 08:30) — only one should be kept
    const hrEntries = db.getHealthEntriesByType('heart_rate');
    expect(hrEntries.length).toBe(1);
    expect(hrEntries[0].value).toBe(72);
  });

  it('imports weight and workout entries', () => {
    const filePath = writeTmpFile('export.xml', SAMPLE_HEALTH_XML);
    importAppleHealth(filePath);

    const weightEntries = db.getHealthEntriesByType('weight');
    expect(weightEntries.length).toBe(1);
    expect(weightEntries[0].value).toBe(75.5);

    const workoutEntries = db.getHealthEntriesByType('workout');
    expect(workoutEntries.length).toBe(1);
    expect(workoutEntries[0].value).toBe(33); // rounded from 32.5
  });

  it('ignores unknown HK types', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<HealthData>
  <Record type="HKQuantityTypeIdentifierBloodPressureSystolic" value="120" startDate="2026-02-01 08:00:00 -0500" unit="mmHg"/>
  <Record type="HKQuantityTypeIdentifierStepCount" value="5000" startDate="2026-02-01 08:00:00 -0500" unit="count"/>
</HealthData>`;
    const filePath = writeTmpFile('export.xml', xml);
    const result = importAppleHealth(filePath);

    // Only step count should be imported, blood pressure is not in METRIC_MAP
    expect(result.imported).toBe(1);
  });

  it('deduplicates on reimport', () => {
    const filePath = writeTmpFile('export.xml', SAMPLE_HEALTH_XML);
    importAppleHealth(filePath);
    const result2 = importAppleHealth(filePath);

    expect(result2.skipped).toBeGreaterThan(0);
    expect(result2.imported).toBe(0);
  });
});
