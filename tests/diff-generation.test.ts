import { describe, it, expect } from 'vitest';
import { detectAnomalies, detectPendingRefunds } from '../core/services/detectors';
import { makeTx } from './helpers';

describe('Anomaly Detection', () => {
  it('flags transactions with high z-score vs merchant baseline', () => {
    const historical = [
      makeTx({ merchant: 'Coffee Shop', amount: -5, date: '2025-10-01' }),
      makeTx({ merchant: 'Coffee Shop', amount: -6, date: '2025-10-15' }),
      makeTx({ merchant: 'Coffee Shop', amount: -5.50, date: '2025-11-01' }),
      makeTx({ merchant: 'Coffee Shop', amount: -5.25, date: '2025-11-15' }),
      makeTx({ merchant: 'Coffee Shop', amount: -6.00, date: '2025-12-01' }),
    ];
    const current = [
      makeTx({ merchant: 'Coffee Shop', amount: -25, date: '2026-01-10' }),
    ];
    const anomalies = detectAnomalies(current, [...historical, ...current]);

    expect(anomalies.length).toBe(1);
    expect(anomalies[0].merchant).toBe('Coffee Shop');
    expect(anomalies[0].zScore).toBeGreaterThan(2);
  });

  it('does not flag normal spending', () => {
    const historical = [
      makeTx({ merchant: 'Grocery', amount: -80, date: '2025-10-01' }),
      makeTx({ merchant: 'Grocery', amount: -90, date: '2025-11-01' }),
      makeTx({ merchant: 'Grocery', amount: -85, date: '2025-12-01' }),
    ];
    const current = [
      makeTx({ merchant: 'Grocery', amount: -88, date: '2026-01-01' }),
    ];
    const anomalies = detectAnomalies(current, [...historical, ...current]);
    expect(anomalies.length).toBe(0);
  });
});

describe('Pending Refund Detection', () => {
  it('flags large purchases with no matching refund', () => {
    const txs = [
      makeTx({ merchant: 'Electronics Store', amount: -299.99, date: '2025-11-01' }),
      // No refund within 30 days
    ];
    const refunds = detectPendingRefunds(txs, 30, 50);
    expect(refunds.length).toBe(1);
    expect(refunds[0].merchant).toBe('Electronics Store');
    expect(refunds[0].purchaseAmount).toBeCloseTo(299.99, 1);
  });

  it('does not flag purchases with matching refund', () => {
    const txs = [
      makeTx({ merchant: 'Store', amount: -100, date: '2025-11-01' }),
      makeTx({ merchant: 'Store', amount: 100, date: '2025-11-15' }), // refund
    ];
    const refunds = detectPendingRefunds(txs, 30, 50);
    expect(refunds.length).toBe(0);
  });

  it('does not flag purchases below minimum amount', () => {
    const txs = [
      makeTx({ merchant: 'Small Shop', amount: -10, date: '2025-11-01' }),
    ];
    const refunds = detectPendingRefunds(txs, 30, 50);
    expect(refunds.length).toBe(0);
  });

  it('does not flag recent purchases (within threshold)', () => {
    const txs = [
      makeTx({ merchant: 'Store', amount: -200, date: new Date().toISOString().slice(0, 10) }),
    ];
    const refunds = detectPendingRefunds(txs, 30, 50);
    expect(refunds.length).toBe(0);
  });
});
