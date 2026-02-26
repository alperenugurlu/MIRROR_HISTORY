import fs from 'fs';
import { XMLParser } from 'fast-xml-parser';
import * as db from '../database';
import { broadcast } from '../event-bus';
import type { ImportResult, HealthMetricType } from '../types';

const METRIC_MAP: Record<string, HealthMetricType> = {
  'HKQuantityTypeIdentifierStepCount': 'steps',
  'HKQuantityTypeIdentifierHeartRate': 'heart_rate',
  'HKCategoryTypeIdentifierSleepAnalysis': 'sleep_hours',
  'HKQuantityTypeIdentifierBodyMass': 'weight',
};

const UNIT_MAP: Record<string, string> = {
  steps: 'count',
  heart_rate: 'bpm',
  sleep_hours: 'hours',
  weight: 'kg',
  workout: 'min',
};

function normalizeAppleDate(raw: string): string {
  if (!raw) return '';
  // Apple format: "2026-02-01 08:00:00 -0500"
  const cleaned = raw.replace(/\s([+-]\d{4})$/, '$1').replace(' ', 'T');
  try {
    return new Date(cleaned).toISOString();
  } catch {
    return '';
  }
}

export function importAppleHealth(filePath: string): ImportResult {
  const content = fs.readFileSync(filePath, 'utf-8');
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  });
  const result = parser.parse(content);

  const records = result.HealthData?.Record || [];
  const recordArray = Array.isArray(records) ? records : [records];

  // Aggregate steps by day to avoid thousands of entries
  const stepsByDay = new Map<string, number>();
  const otherRecords: { metricType: HealthMetricType; value: number; unit: string; timestamp: string }[] = [];

  for (const record of recordArray) {
    const hkType = record['@_type'];
    const metricType = METRIC_MAP[hkType];
    if (!metricType) continue;

    const value = parseFloat(record['@_value'] || '0');
    const timestamp = normalizeAppleDate(record['@_startDate'] || '');
    if (!timestamp || isNaN(value)) continue;

    const unit = UNIT_MAP[metricType] || record['@_unit'] || '';

    if (metricType === 'steps') {
      const day = timestamp.slice(0, 10);
      stepsByDay.set(day, (stepsByDay.get(day) || 0) + value);
    } else if (metricType === 'heart_rate') {
      // Sample: keep one per hour
      const hourKey = timestamp.slice(0, 13);
      const existing = otherRecords.find(
        r => r.metricType === 'heart_rate' && r.timestamp.slice(0, 13) === hourKey,
      );
      if (!existing) {
        otherRecords.push({ metricType, value, unit, timestamp });
      }
    } else {
      otherRecords.push({ metricType, value, unit, timestamp });
    }
  }

  // Convert aggregated steps to records
  for (const [day, totalSteps] of stepsByDay) {
    otherRecords.push({
      metricType: 'steps',
      value: Math.round(totalSteps),
      unit: 'count',
      timestamp: `${day}T23:59:00.000Z`,
    });
  }

  // Also extract workouts
  const workouts = result.HealthData?.Workout || [];
  const workoutArray = Array.isArray(workouts) ? workouts : workouts ? [workouts] : [];
  for (const workout of workoutArray) {
    const duration = parseFloat(workout['@_duration'] || '0');
    const timestamp = normalizeAppleDate(workout['@_startDate'] || '');
    const workoutType = (workout['@_workoutActivityType'] || '').replace('HKWorkoutActivityType', '');
    if (timestamp && duration > 0) {
      otherRecords.push({
        metricType: 'workout',
        value: Math.round(duration),
        unit: `min (${workoutType || 'unknown'})`,
        timestamp,
      });
    }
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Insert in batches
  const BATCH_SIZE = 500;
  for (let i = 0; i < otherRecords.length; i += BATCH_SIZE) {
    const batch = otherRecords.slice(i, i + BATCH_SIZE);
    const batchInsert = db.getDb().transaction(() => {
      for (const rec of batch) {
        try {
          const contentHash = db.computeContentHash([
            rec.metricType, String(rec.value), rec.timestamp.slice(0, 13),
          ]);

          const { event, isNew } = db.findOrInsertEvent(
            'health_entry', rec.timestamp,
            `${rec.metricType}: ${rec.value} ${rec.unit}`,
            { metricType: rec.metricType, value: rec.value, unit: rec.unit },
            1.0, 'local_private', contentHash,
          );

          if (!isNew) { skipped++; continue; }

          db.insertHealthEntry(event.id, rec.metricType, rec.value, rec.unit, rec.timestamp, 'apple_health');
          imported++;
        } catch (e) {
          if (errors.length < 10) errors.push(e instanceof Error ? e.message : String(e));
          skipped++;
        }
      }
    });
    batchInsert();
  }

  db.logActivity('import_health', `Imported ${imported} health entries from Apple Health`, {
    imported, skipped, source: filePath,
  });
  broadcast('health_imported', { imported, skipped });

  return { imported, skipped, errors };
}
