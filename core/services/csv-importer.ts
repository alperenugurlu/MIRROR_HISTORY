import fs from 'fs';
import Papa from 'papaparse';
import crypto from 'crypto';
import type { ColumnMapping, ImportResult, CsvPreviewRow } from '../types';
import * as db from '../database';
import { broadcast } from '../event-bus';

export function previewCsv(filePath: string): { headers: string[]; rows: CsvPreviewRow[] } {
  const content = fs.readFileSync(filePath, 'utf-8');
  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    preview: 20,
  });
  return {
    headers: result.meta.fields || [],
    rows: result.data,
  };
}

export function importCsv(filePath: string, mapping: ColumnMapping): ImportResult {
  const content = fs.readFileSync(filePath, 'utf-8');
  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
  });

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  const dbInstance = db.getDb();
  const insertMany = dbInstance.transaction(() => {
    for (const row of result.data) {
      try {
        const dateRaw = row[mapping.date]?.trim();
        const merchantRaw = row[mapping.merchant]?.trim();
        const amountRaw = row[mapping.amount]?.trim();

        if (!dateRaw || !merchantRaw || !amountRaw) {
          skipped++;
          continue;
        }

        const date = normalizeDate(dateRaw);
        if (!date) {
          errors.push(`Invalid date: "${dateRaw}"`);
          skipped++;
          continue;
        }

        const amount = parseAmount(amountRaw);
        if (amount === null) {
          errors.push(`Invalid amount: "${amountRaw}"`);
          skipped++;
          continue;
        }

        const merchant = normalizeMerchant(merchantRaw);
        const currency = mapping.currency ? (row[mapping.currency]?.trim() || 'USD') : 'USD';
        const category = mapping.category ? (row[mapping.category]?.trim() || null) : null;
        const account = mapping.account ? (row[mapping.account]?.trim() || null) : null;

        const rowHash = crypto.createHash('sha256')
          .update(`${date}|${merchant}|${amount}|${currency}`)
          .digest('hex');

        const event = db.insertEvent(
          'money_transaction',
          date,
          `${merchant}: ${amount >= 0 ? '+' : ''}${amount.toFixed(2)} ${currency}`,
          { merchant, amount, currency, category },
          1.0,
          'local_private',
        );

        const tx = db.insertTransaction(
          event.id, date, merchant, amount, currency,
          rowHash, 'csv_import', filePath, category, account,
        );

        if (tx) {
          db.insertEvidence(
            event.id,
            'csv_row',
            filePath,
            `${date} | ${merchant} | ${amount.toFixed(2)} ${currency}`,
            rowHash,
          );
          imported++;
        } else {
          skipped++;
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(msg);
        skipped++;
      }
    }
  });

  insertMany();

  db.logActivity('import', `Imported ${imported} transactions from CSV`, {
    file: filePath,
    imported,
    skipped,
    errorCount: errors.length,
  });

  broadcast('csv_imported', { imported, skipped, file: filePath });

  return { imported, skipped, errors: errors.slice(0, 10) };
}

function normalizeDate(raw: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10);
  }
  const mdy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;
  }
  const dmy = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return null;
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[$€£¥,\s]/g, '').replace(/\((.+)\)/, '-$1');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function normalizeMerchant(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/\s*[-#]\s*\d+.*$/, '')
    .trim();
}
