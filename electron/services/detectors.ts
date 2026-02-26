import type { MoneyTransaction, Subscription, DiffCard, Rule } from '../../shared/types';
import crypto from 'crypto';

// ── Subscription Detection ──

export interface SubscriptionCandidate {
  merchant: string;
  occurrences: { date: string; amount: number }[];
  estimatedPeriod: 'monthly' | 'annual' | 'unknown';
  typicalAmount: number;
  confidence: number;
  firstSeen: string;
  lastSeen: string;
}

export function detectSubscriptions(transactions: MoneyTransaction[]): SubscriptionCandidate[] {
  // Group by merchant
  const byMerchant = new Map<string, MoneyTransaction[]>();
  for (const tx of transactions) {
    if (tx.amount >= 0) continue; // skip refunds/credits (positive = income, negative = expense)
    // Actually, handle both conventions. We'll use absolute amounts for grouping.
    const key = tx.merchant.toLowerCase();
    if (!byMerchant.has(key)) byMerchant.set(key, []);
    byMerchant.get(key)!.push(tx);
  }

  const candidates: SubscriptionCandidate[] = [];

  for (const [, txs] of byMerchant) {
    if (txs.length < 2) continue;

    // Sort by date
    const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));

    // Check for recurring pattern: similar amounts at regular intervals
    const amounts = sorted.map(t => Math.abs(t.amount));
    const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const amountVariance = amounts.reduce((s, a) => s + (a - avgAmount) ** 2, 0) / amounts.length;
    const amountStdDev = Math.sqrt(amountVariance);
    const amountConsistency = avgAmount > 0 ? 1 - Math.min(amountStdDev / avgAmount, 1) : 0;

    // Check interval regularity
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const d1 = new Date(sorted[i - 1].date);
      const d2 = new Date(sorted[i].date);
      intervals.push((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
    }

    if (intervals.length === 0) continue;

    const avgInterval = intervals.reduce((s, d) => s + d, 0) / intervals.length;
    const intervalVariance = intervals.reduce((s, d) => s + (d - avgInterval) ** 2, 0) / intervals.length;
    const intervalStdDev = Math.sqrt(intervalVariance);

    let estimatedPeriod: 'monthly' | 'annual' | 'unknown' = 'unknown';
    if (avgInterval >= 25 && avgInterval <= 35) estimatedPeriod = 'monthly';
    else if (avgInterval >= 350 && avgInterval <= 380) estimatedPeriod = 'annual';

    // Confidence scoring
    let confidence = 0;
    if (amountConsistency > 0.85) confidence += 0.3;
    else if (amountConsistency > 0.7) confidence += 0.15;
    if (estimatedPeriod !== 'unknown') confidence += 0.3;
    if (intervalStdDev < 5) confidence += 0.2;
    else if (intervalStdDev < 10) confidence += 0.1;
    if (sorted.length >= 3) confidence += 0.2;
    else if (sorted.length >= 2) confidence += 0.1;

    if (confidence >= 0.4) {
      candidates.push({
        merchant: sorted[0].merchant,
        occurrences: sorted.map(t => ({ date: t.date, amount: Math.abs(t.amount) })),
        estimatedPeriod,
        typicalAmount: Math.round(avgAmount * 100) / 100,
        confidence: Math.round(confidence * 100) / 100,
        firstSeen: sorted[0].date,
        lastSeen: sorted[sorted.length - 1].date,
      });
    }
  }

  return candidates.sort((a, b) => b.confidence - a.confidence);
}

// ── Price Increase Detection ──

export interface PriceIncreaseCandidate {
  merchant: string;
  previousAmount: number;
  currentAmount: number;
  increaseAmount: number;
  increasePct: number;
  previousDate: string;
  currentDate: string;
  confidence: number;
}

export function detectPriceIncreases(
  currentPeriodTxs: MoneyTransaction[],
  baselinePeriodTxs: MoneyTransaction[],
): PriceIncreaseCandidate[] {
  // Build baseline average per merchant
  const baselineByMerchant = new Map<string, { total: number; count: number; lastDate: string }>();
  for (const tx of baselinePeriodTxs) {
    const key = tx.merchant.toLowerCase();
    const existing = baselineByMerchant.get(key) || { total: 0, count: 0, lastDate: '' };
    existing.total += Math.abs(tx.amount);
    existing.count++;
    if (tx.date > existing.lastDate) existing.lastDate = tx.date;
    baselineByMerchant.set(key, existing);
  }

  // Build current average per merchant
  const currentByMerchant = new Map<string, { total: number; count: number; lastDate: string }>();
  for (const tx of currentPeriodTxs) {
    const key = tx.merchant.toLowerCase();
    const existing = currentByMerchant.get(key) || { total: 0, count: 0, lastDate: '' };
    existing.total += Math.abs(tx.amount);
    existing.count++;
    if (tx.date > existing.lastDate) existing.lastDate = tx.date;
    currentByMerchant.set(key, existing);
  }

  const results: PriceIncreaseCandidate[] = [];

  for (const [merchantKey, current] of currentByMerchant) {
    const baseline = baselineByMerchant.get(merchantKey);
    if (!baseline) continue;

    const currentAvg = current.total / current.count;
    const baselineAvg = baseline.total / baseline.count;

    if (currentAvg <= baselineAvg) continue;

    const increase = currentAvg - baselineAvg;
    const increasePct = (increase / baselineAvg) * 100;

    // Only flag meaningful increases (>5% and > $0.50)
    if (increasePct < 5 || increase < 0.5) continue;

    // Get the original merchant name from current transactions
    const merchantName = currentPeriodTxs.find(
      t => t.merchant.toLowerCase() === merchantKey
    )?.merchant || merchantKey;

    let confidence = 0.5;
    if (increasePct > 20) confidence += 0.2;
    else if (increasePct > 10) confidence += 0.1;
    if (baseline.count >= 2 && current.count >= 1) confidence += 0.2;
    if (increase > 5) confidence += 0.1;

    results.push({
      merchant: merchantName,
      previousAmount: Math.round(baselineAvg * 100) / 100,
      currentAmount: Math.round(currentAvg * 100) / 100,
      increaseAmount: Math.round(increase * 100) / 100,
      increasePct: Math.round(increasePct * 10) / 10,
      previousDate: baseline.lastDate,
      currentDate: current.lastDate,
      confidence: Math.min(confidence, 1),
    });
  }

  return results.sort((a, b) => b.increaseAmount - a.increaseAmount);
}

// ── Refund Pending Detection ──

export interface RefundPendingCandidate {
  merchant: string;
  purchaseAmount: number;
  purchaseDate: string;
  daysSincePurchase: number;
  transactionId: string;
  confidence: number;
}

export function detectPendingRefunds(
  transactions: MoneyTransaction[],
  refundThresholdDays = 30,
  minAmount = 50,
): RefundPendingCandidate[] {
  const now = new Date();
  const results: RefundPendingCandidate[] = [];

  // Group all transactions by merchant
  const byMerchant = new Map<string, MoneyTransaction[]>();
  for (const tx of transactions) {
    const key = tx.merchant.toLowerCase();
    if (!byMerchant.has(key)) byMerchant.set(key, []);
    byMerchant.get(key)!.push(tx);
  }

  for (const [, txs] of byMerchant) {
    const purchases = txs.filter(t => Math.abs(t.amount) >= minAmount && t.amount < 0);
    const refunds = txs.filter(t => t.amount > 0);

    for (const purchase of purchases) {
      const purchaseDate = new Date(purchase.date);
      const daysSince = Math.floor((now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSince < refundThresholdDays) continue;

      // Check if a matching refund exists
      const hasRefund = refunds.some(r => {
        const refundDate = new Date(r.date);
        return refundDate >= purchaseDate && Math.abs(r.amount - Math.abs(purchase.amount)) < 1;
      });

      if (!hasRefund) {
        let confidence = 0.3; // base low confidence — we're guessing
        if (daysSince > 60) confidence += 0.1;
        if (Math.abs(purchase.amount) > 200) confidence += 0.1;

        results.push({
          merchant: purchase.merchant,
          purchaseAmount: Math.abs(purchase.amount),
          purchaseDate: purchase.date,
          daysSincePurchase: daysSince,
          transactionId: purchase.id,
          confidence: Math.min(confidence, 1),
        });
      }
    }
  }

  return results.sort((a, b) => b.purchaseAmount - a.purchaseAmount);
}

// ── Anomaly Detection ──

export interface AnomalyCandidate {
  merchant: string;
  amount: number;
  date: string;
  transactionId: string;
  baselineAvg: number;
  baselineStdDev: number;
  zScore: number;
  confidence: number;
  reason: string;
}

export function detectAnomalies(
  currentPeriodTxs: MoneyTransaction[],
  allHistoricalTxs: MoneyTransaction[],
): AnomalyCandidate[] {
  const results: AnomalyCandidate[] = [];

  // Build per-merchant and per-category baselines from historical data
  const merchantStats = new Map<string, { amounts: number[] }>();
  const categoryStats = new Map<string, { amounts: number[] }>();

  for (const tx of allHistoricalTxs) {
    const mKey = tx.merchant.toLowerCase();
    if (!merchantStats.has(mKey)) merchantStats.set(mKey, { amounts: [] });
    merchantStats.get(mKey)!.amounts.push(Math.abs(tx.amount));

    if (tx.category) {
      const cKey = tx.category.toLowerCase();
      if (!categoryStats.has(cKey)) categoryStats.set(cKey, { amounts: [] });
      categoryStats.get(cKey)!.amounts.push(Math.abs(tx.amount));
    }
  }

  for (const tx of currentPeriodTxs) {
    const absAmount = Math.abs(tx.amount);
    const mKey = tx.merchant.toLowerCase();
    const stats = merchantStats.get(mKey);

    // Merchant-level anomaly
    if (stats && stats.amounts.length >= 3) {
      const { mean, stdDev } = calcStats(stats.amounts);
      if (stdDev > 0) {
        const zScore = (absAmount - mean) / stdDev;
        if (zScore > 2) {
          results.push({
            merchant: tx.merchant,
            amount: absAmount,
            date: tx.date,
            transactionId: tx.id,
            baselineAvg: Math.round(mean * 100) / 100,
            baselineStdDev: Math.round(stdDev * 100) / 100,
            zScore: Math.round(zScore * 100) / 100,
            confidence: Math.min(0.5 + (zScore - 2) * 0.15, 0.95),
            reason: `${tx.merchant}: $${absAmount.toFixed(2)} is ${zScore.toFixed(1)} std devs above average ($${mean.toFixed(2)})`,
          });
        }
      }
    }

    // Category-level anomaly (only if no merchant anomaly found)
    if (tx.category && !results.some(r => r.transactionId === tx.id)) {
      const cKey = tx.category.toLowerCase();
      const cStats = categoryStats.get(cKey);
      if (cStats && cStats.amounts.length >= 5) {
        const { mean, stdDev } = calcStats(cStats.amounts);
        if (stdDev > 0) {
          const zScore = (absAmount - mean) / stdDev;
          if (zScore > 2.5) {
            results.push({
              merchant: tx.merchant,
              amount: absAmount,
              date: tx.date,
              transactionId: tx.id,
              baselineAvg: Math.round(mean * 100) / 100,
              baselineStdDev: Math.round(stdDev * 100) / 100,
              zScore: Math.round(zScore * 100) / 100,
              confidence: Math.min(0.4 + (zScore - 2.5) * 0.15, 0.9),
              reason: `${tx.merchant}: $${absAmount.toFixed(2)} in ${tx.category} is ${zScore.toFixed(1)} std devs above category avg ($${mean.toFixed(2)})`,
            });
          }
        }
      }
    }
  }

  return results.sort((a, b) => b.zScore - a.zScore);
}

function calcStats(values: number[]): { mean: number; stdDev: number } {
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return { mean, stdDev: Math.sqrt(variance) };
}

// ── Rule Filtering ──

export function applyRules(cards: DiffCard[], rules: Rule[]): DiffCard[] {
  const activeRules = rules.filter(r => r.enabled);
  if (activeRules.length === 0) return cards;

  return cards.filter(card => {
    for (const rule of activeRules) {
      const ruleData = JSON.parse(rule.rule_json);
      switch (rule.rule_type) {
        case 'ignore_merchant':
          if (card.merchant.toLowerCase() === ruleData.merchant?.toLowerCase()) return false;
          break;
        case 'ignore_category':
          if (card.details?.category?.toString().toLowerCase() === ruleData.category?.toLowerCase()) return false;
          break;
        case 'threshold':
          if (Math.abs(card.impact) < (ruleData.minAmount || 0)) return false;
          break;
        case 'whitelist_subscription':
          if (card.type === 'subscription' && card.merchant.toLowerCase() === ruleData.merchant?.toLowerCase()) return false;
          break;
      }
    }
    return true;
  });
}
