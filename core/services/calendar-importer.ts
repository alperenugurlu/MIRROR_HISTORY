import fs from 'fs';
import ICAL from 'ical.js';
import * as db from '../database';
import { broadcast } from '../event-bus';
import type { ImportResult } from '../types';

export function importCalendarICS(filePath: string): ImportResult {
  const content = fs.readFileSync(filePath, 'utf-8');
  const jcalData = ICAL.parse(content);
  const vcalendar = new ICAL.Component(jcalData);
  const vevents = vcalendar.getAllSubcomponents('vevent');

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  const batchInsert = db.getDb().transaction(() => {
    for (const vevent of vevents) {
      try {
        const icalEvent = new ICAL.Event(vevent);
        const title = icalEvent.summary || 'Untitled Event';
        const startTime = icalEvent.startDate?.toJSDate()?.toISOString() || '';
        const endTime = icalEvent.endDate?.toJSDate()?.toISOString() || '';
        const location = icalEvent.location || '';
        const description = icalEvent.description || '';

        if (!startTime) { skipped++; continue; }

        const contentHash = db.computeContentHash([title, startTime, endTime]);

        const { event, isNew } = db.findOrInsertEvent(
          'calendar_event', startTime,
          `${title}${location ? ' @ ' + location : ''}`,
          { title, startTime, endTime, location },
          1.0, 'local_private', contentHash,
        );

        if (!isNew) { skipped++; continue; }

        db.insertCalendarEvent(event.id, title, startTime, endTime, location, description);
        db.indexForSearch(event.id, [title, location, description].filter(Boolean).join(' '));

        imported++;
      } catch (e) {
        if (errors.length < 10) errors.push(e instanceof Error ? e.message : String(e));
        skipped++;
      }
    }
  });

  batchInsert();

  db.logActivity('import_calendar', `Imported ${imported} calendar events from ICS`, {
    imported, skipped, source: filePath,
  });
  broadcast('calendar_imported', { imported, skipped });

  return { imported, skipped, errors };
}
