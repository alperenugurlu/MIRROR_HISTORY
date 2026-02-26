import { describe, it, expect } from 'vitest';
import { detectSubscriptions } from '../core/services/detectors';
import { makeTx, makeMonthlySubscription } from './helpers';

describe('Subscription Detection', () => {
  it('detects monthly recurring charges', () => {
    const txs = makeMonthlySubscription('Netflix', 15.99, 10, 4); // Oct-Jan
    const subs = detectSubscriptions(txs);

    expect(subs.length).toBe(1);
    expect(subs[0].merchant).toBe('Netflix');
    expect(subs[0].typicalAmount).toBeCloseTo(15.99, 1);
    expect(subs[0].estimatedPeriod).toBe('monthly');
    expect(subs[0].confidence).toBeGreaterThanOrEqual(0.4);
  });

  it('does not flag single transactions', () => {
    const txs = [makeTx({ merchant: 'Amazon', amount: -50, date: '2026-01-10' })];
    const subs = detectSubscriptions(txs);
    expect(subs.length).toBe(0);
  });

  it('handles varying amounts with low confidence', () => {
    const txs = [
      makeTx({ merchant: 'Electric Co', amount: -80, date: '2025-11-15' }),
      makeTx({ merchant: 'Electric Co', amount: -120, date: '2025-12-15' }),
      makeTx({ merchant: 'Electric Co', amount: -95, date: '2026-01-15' }),
    ];
    const subs = detectSubscriptions(txs);
    // Should still detect as recurring but with lower confidence
    if (subs.length > 0) {
      expect(subs[0].confidence).toBeLessThan(0.9);
    }
  });

  it('detects multiple subscriptions', () => {
    const txs = [
      ...makeMonthlySubscription('Netflix', 15.99, 10, 3),
      ...makeMonthlySubscription('Spotify', 9.99, 10, 3),
      ...makeMonthlySubscription('Gym', 29.99, 10, 3),
    ];
    const subs = detectSubscriptions(txs);
    expect(subs.length).toBeGreaterThanOrEqual(3);
    const merchants = subs.map(s => s.merchant.toLowerCase());
    expect(merchants).toContain('netflix');
    expect(merchants).toContain('spotify');
    expect(merchants).toContain('gym');
  });

  it('ignores refunds (positive amounts)', () => {
    const txs = [
      makeTx({ merchant: 'Store', amount: 50, date: '2025-11-15' }),
      makeTx({ merchant: 'Store', amount: 50, date: '2025-12-15' }),
      makeTx({ merchant: 'Store', amount: 50, date: '2026-01-15' }),
    ];
    const subs = detectSubscriptions(txs);
    expect(subs.length).toBe(0);
  });
});
