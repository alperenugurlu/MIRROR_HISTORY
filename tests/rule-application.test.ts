import { describe, it, expect } from 'vitest';
import { applyRules } from '../core/services/detectors';
import type { DiffCard, Rule } from '../core/types';

function makeCard(overrides: Partial<DiffCard> = {}): DiffCard {
  return {
    id: 'card-1',
    event_id: 'evt-1',
    title: 'Test',
    type: 'subscription',
    impact: -10,
    confidence: 0.8,
    merchant: 'Netflix',
    summary: 'test',
    details: {},
    evidence_ids: [],
    suggested_actions: [],
    ...overrides,
  };
}

function makeRule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: 'rule-1',
    rule_type: 'ignore_merchant',
    rule_json: JSON.stringify({ merchant: 'Netflix' }),
    created_at: '2026-01-01T00:00:00Z',
    enabled: 1,
    ...overrides,
  };
}

describe('Rule Application', () => {
  it('filters cards matching ignore_merchant rule', () => {
    const cards = [
      makeCard({ merchant: 'Netflix' }),
      makeCard({ id: 'card-2', merchant: 'Spotify' }),
    ];
    const rules = [makeRule()];
    const filtered = applyRules(cards, rules);

    expect(filtered.length).toBe(1);
    expect(filtered[0].merchant).toBe('Spotify');
  });

  it('does not filter when rule is disabled', () => {
    const cards = [makeCard({ merchant: 'Netflix' })];
    const rules = [makeRule({ enabled: 0 })];
    const filtered = applyRules(cards, rules);

    expect(filtered.length).toBe(1);
  });

  it('filters by category', () => {
    const cards = [
      makeCard({ merchant: 'Foo', details: { category: 'Entertainment' } }),
      makeCard({ id: 'card-2', merchant: 'Bar', details: { category: 'Groceries' } }),
    ];
    const rules = [makeRule({
      rule_type: 'ignore_category',
      rule_json: JSON.stringify({ category: 'Entertainment' }),
    })];
    const filtered = applyRules(cards, rules);

    expect(filtered.length).toBe(1);
    expect(filtered[0].merchant).toBe('Bar');
  });

  it('filters by threshold', () => {
    const cards = [
      makeCard({ impact: -5 }),
      makeCard({ id: 'card-2', impact: -20 }),
    ];
    const rules = [makeRule({
      rule_type: 'threshold',
      rule_json: JSON.stringify({ minAmount: 10 }),
    })];
    const filtered = applyRules(cards, rules);

    expect(filtered.length).toBe(1);
    expect(filtered[0].impact).toBe(-20);
  });

  it('filters whitelist_subscription', () => {
    const cards = [
      makeCard({ type: 'subscription', merchant: 'Netflix' }),
      makeCard({ id: 'card-2', type: 'price_increase', merchant: 'Netflix' }),
    ];
    const rules = [makeRule({
      rule_type: 'whitelist_subscription',
      rule_json: JSON.stringify({ merchant: 'Netflix' }),
    })];
    const filtered = applyRules(cards, rules);

    expect(filtered.length).toBe(1);
    expect(filtered[0].type).toBe('price_increase'); // price increase not filtered by whitelist
  });

  it('handles no rules gracefully', () => {
    const cards = [makeCard()];
    const filtered = applyRules(cards, []);
    expect(filtered.length).toBe(1);
  });

  it('applies multiple rules', () => {
    const cards = [
      makeCard({ merchant: 'Netflix' }),
      makeCard({ id: 'card-2', merchant: 'Spotify' }),
      makeCard({ id: 'card-3', merchant: 'Gym' }),
    ];
    const rules = [
      makeRule({ id: 'r1', rule_json: JSON.stringify({ merchant: 'Netflix' }) }),
      makeRule({ id: 'r2', rule_json: JSON.stringify({ merchant: 'Spotify' }) }),
    ];
    const filtered = applyRules(cards, rules);

    expect(filtered.length).toBe(1);
    expect(filtered[0].merchant).toBe('Gym');
  });
});
