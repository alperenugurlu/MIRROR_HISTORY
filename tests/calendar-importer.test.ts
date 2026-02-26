import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { initDatabase } from '../core/database';
import * as db from '../core/database';
import { importCalendarICS } from '../core/services/calendar-importer';

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

const SAMPLE_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
DTSTART:20260215T100000Z
DTEND:20260215T110000Z
SUMMARY:Team Standup
LOCATION:Zoom
DESCRIPTION:Daily standup meeting
END:VEVENT
BEGIN:VEVENT
DTSTART:20260216T140000Z
DTEND:20260216T150000Z
SUMMARY:Project Review
LOCATION:Conference Room B
END:VEVENT
END:VCALENDAR`;

describe('Calendar Importer', () => {
  it('imports events from ICS file', () => {
    const filePath = writeTmpFile('calendar.ics', SAMPLE_ICS);
    const result = importCalendarICS(filePath);

    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);

    expect(db.getCalendarEventCount()).toBe(2);
  });

  it('extracts title, location, and description', () => {
    const filePath = writeTmpFile('calendar.ics', SAMPLE_ICS);
    importCalendarICS(filePath);

    const events = db.getAllEventsPaginated(10);
    const calEvents = events.filter(e => e.type === 'calendar_event');
    expect(calEvents.length).toBe(2);

    const summaries = calEvents.map(e => e.summary);
    expect(summaries).toContain('Team Standup @ Zoom');
    expect(summaries).toContain('Project Review @ Conference Room B');
  });

  it('deduplicates on reimport', () => {
    const filePath = writeTmpFile('calendar.ics', SAMPLE_ICS);
    importCalendarICS(filePath);
    const result2 = importCalendarICS(filePath);

    expect(result2.imported).toBe(0);
    expect(result2.skipped).toBe(2);
    expect(db.getCalendarEventCount()).toBe(2);
  });

  it('indexes events for FTS search', () => {
    const filePath = writeTmpFile('calendar.ics', SAMPLE_ICS);
    importCalendarICS(filePath);

    const results = db.searchFTS('Standup', 10);
    expect(results.length).toBeGreaterThan(0);
  });

  it('handles events without location', () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20260220T090000Z
DTEND:20260220T100000Z
SUMMARY:Quick Chat
END:VEVENT
END:VCALENDAR`;
    const filePath = writeTmpFile('simple.ics', ics);
    const result = importCalendarICS(filePath);

    expect(result.imported).toBe(1);
  });

  it('logs activity on import', () => {
    const filePath = writeTmpFile('calendar.ics', SAMPLE_ICS);
    importCalendarICS(filePath);

    const log = db.getActivityLog();
    expect(log.length).toBeGreaterThan(0);
    expect(log[0].entry_type).toBe('import_calendar');
  });
});
