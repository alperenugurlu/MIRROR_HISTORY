import { describe, it, expect } from 'vitest';
import { detectPriceIncreases } from '../core/services/detectors';
import { makeTx } from './helpers';

describe('Price Increase Detection', () => {
  it('detects a price increase for same merchant', () => {
    const baseline = [
      makeTx({ merchant: 'Gym', amount: -29.99, date: '2025-12-15' }),
    ];
    const current = [
      makeTx({ merchant: 'Gym', amount: -34.99, date: '2026-01-15' }),
    ];
    const results = detectPriceIncreases(current, baseline);

    expect(results.length).toBe(1);
    expect(results[0].merchant).toBe('Gym');
    expect(results[0].previousAmount).toBeCloseTo(29.99, 1);
    expect(results[0].currentAmount).toBeCloseTo(34.99, 1);
    expect(results[0].increaseAmount).toBeCloseTo(5.0, 1);
    expect(results[0].increasePct).toBeGreaterThan(15);
  });

  it('ignores negligible increases (<5% or <$0.50)', () => {
    const baseline = [makeTx({ merchant: 'Coffee', amount: -5.00, date: '2025-12-10' })];
    const current = [makeTx({ merchant: 'Coffee', amount: -5.10, date: '2026-01-10' })];
    const results = detectPriceIncreases(current, baseline);
    expect(results.length).toBe(0);
  });

  it('does not flag price decreases', () => {
    const baseline = [makeTx({ merchant: 'Service', amount: -50.00, date: '2025-12-15' })];
    const current = [makeTx({ merchant: 'Service', amount: -40.00, date: '2026-01-15' })];
    const results = detectPriceIncreases(current, baseline);
    expect(results.length).toBe(0);
  });

  it('uses average when multiple transactions exist per merchant', () => {
    const baseline = [
      makeTx({ merchant: 'Grocer', amount: -80, date: '2025-12-05' }),
      makeTx({ merchant: 'Grocer', amount: -90, date: '2025-12-20' }),
    ];
    const current = [
      makeTx({ merchant: 'Grocer', amount: -120, date: '2026-01-05' }),
      makeTx({ merchant: 'Grocer', amount: -110, date: '2026-01-20' }),
    ];
    const results = detectPriceIncreases(current, baseline);
    expect(results.length).toBe(1);
    expect(results[0].previousAmount).toBeCloseTo(85, 0); // avg of 80+90
    expect(results[0].currentAmount).toBeCloseTo(115, 0); // avg of 120+110
  });

  it('handles case-insensitive merchant matching', () => {
    const baseline = [makeTx({ merchant: 'Netflix', amount: -15.99, date: '2025-12-01' })];
    const current = [makeTx({ merchant: 'NETFLIX', amount: -19.99, date: '2026-01-01' })];
    const results = detectPriceIncreases(current, baseline);
    expect(results.length).toBe(1);
  });
});
