import type { MoneyTransaction } from '../core/types';

let counter = 0;

export function makeTx(overrides: Partial<MoneyTransaction> = {}): MoneyTransaction {
  counter++;
  return {
    id: `tx-${counter}`,
    event_id: `evt-${counter}`,
    date: '2026-01-15',
    merchant: 'Test Merchant',
    amount: -10.00,
    currency: 'USD',
    category: null,
    account: null,
    raw_row_hash: `hash-${counter}`,
    source: 'csv_import',
    source_ref: '/test.csv',
    ...overrides,
  };
}

export function makeMonthlySubscription(
  merchant: string,
  amount: number,
  startMonth: number,
  months: number,
): MoneyTransaction[] {
  const txs: MoneyTransaction[] = [];
  for (let i = 0; i < months; i++) {
    const month = startMonth + i;
    const year = 2025 + Math.floor((month - 1) / 12);
    const m = ((month - 1) % 12) + 1;
    txs.push(makeTx({
      merchant,
      amount: -amount,
      date: `${year}-${String(m).padStart(2, '0')}-15`,
    }));
  }
  return txs;
}
