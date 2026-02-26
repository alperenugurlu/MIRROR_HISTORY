import {
  startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  subDays, subWeeks, subMonths, format, parseISO,
} from 'date-fns';
import crypto from 'crypto';
import type {
  PeriodType, DiffCard, DiffResult, MoneyTransaction,
  TimeMachineData, MonthlyAuditData, Event,
} from '../../shared/types';
import * as db from '../database';
import {
  detectSubscriptions, detectPriceIncreases,
  detectPendingRefunds, detectAnomalies, applyRules,
} from './detectors';

// ── Period Boundaries ──

function getPeriodBounds(periodType: PeriodType, refDate: string) {
  const ref = parseISO(refDate);
  switch (periodType) {
    case 'daily': return {
      start: format(startOfDay(ref), 'yyyy-MM-dd'),
      end: format(endOfDay(ref), 'yyyy-MM-dd'),
      baselineStart: format(startOfDay(subDays(ref, 1)), 'yyyy-MM-dd'),
      baselineEnd: format(endOfDay(subDays(ref, 1)), 'yyyy-MM-dd'),
      label: format(ref, 'MMM d, yyyy'),
    };
    case 'weekly': return {
      start: format(startOfWeek(ref, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      end: format(endOfWeek(ref, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      baselineStart: format(startOfWeek(subWeeks(ref, 1), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      baselineEnd: format(endOfWeek(subWeeks(ref, 1), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      label: `Week of ${format(startOfWeek(ref, { weekStartsOn: 1 }), 'MMM d')}`,
    };
    case 'monthly': return {
      start: format(startOfMonth(ref), 'yyyy-MM-dd'),
      end: format(endOfMonth(ref), 'yyyy-MM-dd'),
      baselineStart: format(startOfMonth(subMonths(ref, 1)), 'yyyy-MM-dd'),
      baselineEnd: format(endOfMonth(subMonths(ref, 1)), 'yyyy-MM-dd'),
      label: format(ref, 'MMMM yyyy'),
    };
  }
}

// ── Diff Generation ──

export function generateDiff(periodType: PeriodType, refDate: string): DiffResult {
  const bounds = getPeriodBounds(periodType, refDate);
  const currentTxs = db.getTransactions(bounds.start, bounds.end);
  const baselineTxs = db.getTransactions(bounds.baselineStart, bounds.baselineEnd);
  const allTxs = db.getTransactions();
  const rules = db.getActiveRules();

  const totalSpent = sumAbsExpenses(currentTxs);
  const baselineSpent = sumAbsExpenses(baselineTxs);
  const changePct = baselineSpent > 0 ? ((totalSpent - baselineSpent) / baselineSpent) * 100 : 0;

  const cards: DiffCard[] = [];

  // 1. Detect new subscriptions (present in current, not in baseline or recently started)
  const allSubs = detectSubscriptions(allTxs);
  const currentMerchants = new Set(currentTxs.map(t => t.merchant.toLowerCase()));

  for (const sub of allSubs) {
    if (!currentMerchants.has(sub.merchant.toLowerCase())) continue;

    // Check if this is "new" relative to baseline
    const baselineHasMerchant = baselineTxs.some(
      t => t.merchant.toLowerCase() === sub.merchant.toLowerCase()
    );

    if (!baselineHasMerchant && sub.occurrences.length <= 3) {
      const eventId = createDetectionEvent(
        'subscription',
        `New subscription detected: ${sub.merchant}`,
        sub,
        sub.confidence,
        currentTxs.filter(t => t.merchant.toLowerCase() === sub.merchant.toLowerCase()),
      );
      cards.push({
        id: crypto.randomUUID(),
        event_id: eventId,
        title: `New: ${sub.merchant}`,
        type: 'subscription',
        impact: -sub.typicalAmount,
        confidence: sub.confidence,
        merchant: sub.merchant,
        summary: `Recurring charge of $${sub.typicalAmount.toFixed(2)}/${sub.estimatedPeriod}`,
        details: { subscription: sub },
        evidence_ids: [],
        suggested_actions: ['mark_ignore', 'create_reminder'],
      });
    }
  }

  // Also flag active subscriptions (recurring) even if not "new"
  for (const sub of allSubs) {
    if (!currentMerchants.has(sub.merchant.toLowerCase())) continue;
    const alreadyAdded = cards.some(c => c.merchant.toLowerCase() === sub.merchant.toLowerCase());
    if (alreadyAdded) continue;

    // Only include if it's a confirmed subscription (high confidence)
    if (sub.confidence >= 0.6) {
      const eventId = createDetectionEvent(
        'subscription',
        `Active subscription: ${sub.merchant}`,
        sub,
        sub.confidence,
        currentTxs.filter(t => t.merchant.toLowerCase() === sub.merchant.toLowerCase()),
      );
      // Don't add to cards for daily/weekly diff unless flagged — keep it clean
      if (periodType === 'monthly') {
        cards.push({
          id: crypto.randomUUID(),
          event_id: eventId,
          title: `Subscription: ${sub.merchant}`,
          type: 'subscription',
          impact: -sub.typicalAmount,
          confidence: sub.confidence,
          merchant: sub.merchant,
          summary: `$${sub.typicalAmount.toFixed(2)}/${sub.estimatedPeriod} — active since ${sub.firstSeen}`,
          details: { subscription: sub },
          evidence_ids: [],
          suggested_actions: ['mark_ignore', 'create_reminder'],
        });
      }
    }
  }

  // 2. Price increases
  const priceIncreases = detectPriceIncreases(currentTxs, baselineTxs);
  for (const pi of priceIncreases) {
    const eventId = createDetectionEvent(
      'price_increase',
      `Price increase: ${pi.merchant} (+$${pi.increaseAmount.toFixed(2)})`,
      pi,
      pi.confidence,
      currentTxs.filter(t => t.merchant.toLowerCase() === pi.merchant.toLowerCase()),
    );
    cards.push({
      id: crypto.randomUUID(),
      event_id: eventId,
      title: `Price up: ${pi.merchant}`,
      type: 'price_increase',
      impact: -pi.increaseAmount,
      confidence: pi.confidence,
      merchant: pi.merchant,
      summary: `$${pi.previousAmount.toFixed(2)} → $${pi.currentAmount.toFixed(2)} (+${pi.increasePct.toFixed(1)}%)`,
      details: { priceIncrease: pi },
      evidence_ids: [],
      suggested_actions: ['draft_email', 'create_reminder'],
    });
  }

  // 3. Pending refunds
  const pendingRefunds = detectPendingRefunds(allTxs);
  for (const pr of pendingRefunds) {
    // Only show refunds for purchases in or before the current period
    if (pr.purchaseDate > bounds.end) continue;
    const eventId = createDetectionEvent(
      'refund_pending',
      `Possible missing refund: ${pr.merchant} ($${pr.purchaseAmount.toFixed(2)})`,
      pr,
      pr.confidence,
      [allTxs.find(t => t.id === pr.transactionId)!].filter(Boolean),
    );
    cards.push({
      id: crypto.randomUUID(),
      event_id: eventId,
      title: `Refund? ${pr.merchant}`,
      type: 'refund_pending',
      impact: -pr.purchaseAmount,
      confidence: pr.confidence,
      merchant: pr.merchant,
      summary: `$${pr.purchaseAmount.toFixed(2)} purchase on ${pr.purchaseDate} — no refund found (${pr.daysSincePurchase} days)`,
      details: { refundPending: pr },
      evidence_ids: [],
      suggested_actions: ['draft_email', 'mark_ignore'],
    });
  }

  // 4. Anomalies
  const anomalies = detectAnomalies(currentTxs, allTxs);
  for (const a of anomalies) {
    const eventId = createDetectionEvent(
      'anomaly',
      a.reason,
      a,
      a.confidence,
      [currentTxs.find(t => t.id === a.transactionId)!].filter(Boolean),
    );
    cards.push({
      id: crypto.randomUUID(),
      event_id: eventId,
      title: `Unusual: ${a.merchant}`,
      type: 'anomaly',
      impact: -a.amount,
      confidence: a.confidence,
      merchant: a.merchant,
      summary: a.reason,
      details: { anomaly: a },
      evidence_ids: [],
      suggested_actions: ['mark_ignore'],
    });
  }

  // 5. Spending summary card
  if (currentTxs.length > 0) {
    const summaryEventId = createDetectionEvent(
      'money_transaction',
      `Period spending: $${totalSpent.toFixed(2)}`,
      { totalSpent, baselineSpent, changePct, transactionCount: currentTxs.length },
      1.0,
      [],
    );
    cards.unshift({
      id: crypto.randomUUID(),
      event_id: summaryEventId,
      title: `Total: $${totalSpent.toFixed(2)}`,
      type: 'spending_summary',
      impact: -(totalSpent - baselineSpent),
      confidence: 1.0,
      merchant: '',
      summary: baselineSpent > 0
        ? `${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}% vs previous period ($${baselineSpent.toFixed(2)})`
        : `${currentTxs.length} transactions`,
      details: { totalSpent, baselineSpent, changePct, count: currentTxs.length },
      evidence_ids: [],
      suggested_actions: [],
    });
  }

  // Apply rules to filter
  const filteredCards = applyRules(cards, rules);

  // Store the diff
  const diffSummary = `${bounds.label}: $${totalSpent.toFixed(2)} (${filteredCards.length - 1} findings)`;
  const storedDiff = db.insertDiff({
    period_type: periodType,
    period_start: bounds.start,
    period_end: bounds.end,
    diff_summary: diffSummary,
    diff_json: JSON.stringify(filteredCards),
  });

  db.logActivity('diff_generated', diffSummary, {
    period_type: periodType,
    period_start: bounds.start,
    period_end: bounds.end,
    card_count: filteredCards.length,
  });

  return {
    id: storedDiff.id,
    period_type: periodType,
    period_start: bounds.start,
    period_end: bounds.end,
    summary: diffSummary,
    cards: filteredCards,
    total_spent: totalSpent,
    baseline_spent: baselineSpent,
    change_pct: Math.round(changePct * 10) / 10,
  };
}

// ── Time Machine ──

export function getTimeMachine(eventId: string): TimeMachineData | null {
  const event = db.getEvent(eventId);
  if (!event) return null;

  const evidence = db.getEvidenceByEvent(eventId);
  const details = JSON.parse(event.details_json);

  // Build explanation based on event type
  let explanation = '';
  let drivers: string[] = [];
  let baselineComparison = null;
  let confidenceStatement = '';

  switch (event.type) {
    case 'subscription': {
      const sub = details.subscription || details;
      explanation = `This card was generated because "${sub.merchant}" appears as a recurring charge. ` +
        `We found ${sub.occurrences?.length || '2+'} transactions with consistent amounts (~$${sub.typicalAmount?.toFixed(2)}) ` +
        `at regular intervals (${sub.estimatedPeriod}).`;
      drivers = [
        `Recurring pattern: ${sub.occurrences?.length || '2+'} charges found`,
        `Amount consistency: ~$${sub.typicalAmount?.toFixed(2)}`,
        `Period: ${sub.estimatedPeriod}`,
        `First seen: ${sub.firstSeen}`,
      ];
      confidenceStatement = `Confidence ${(event.confidence * 100).toFixed(0)}% — ` +
        (event.confidence >= 0.7 ? 'high regularity in timing and amounts' : 'some variation in timing or amounts');
      break;
    }

    case 'price_increase': {
      const pi = details.priceIncrease || details;
      explanation = `This card was generated because the charge from "${pi.merchant}" increased from ` +
        `$${pi.previousAmount?.toFixed(2)} to $${pi.currentAmount?.toFixed(2)} (+${pi.increasePct?.toFixed(1)}%).`;
      drivers = [
        `Previous average: $${pi.previousAmount?.toFixed(2)}`,
        `Current charge: $${pi.currentAmount?.toFixed(2)}`,
        `Increase: +$${pi.increaseAmount?.toFixed(2)} (+${pi.increasePct?.toFixed(1)}%)`,
      ];
      baselineComparison = {
        current: pi.currentAmount || 0,
        baseline: pi.previousAmount || 0,
        change_pct: pi.increasePct || 0,
        period_label: 'vs previous period',
      };
      confidenceStatement = `Confidence ${(event.confidence * 100).toFixed(0)}% — based on comparing averages across periods`;
      break;
    }

    case 'refund_pending': {
      const rp = details.refundPending || details;
      explanation = `A purchase of $${rp.purchaseAmount?.toFixed(2)} at "${rp.merchant}" on ${rp.purchaseDate} ` +
        `has no matching refund after ${rp.daysSincePurchase} days. This is a heuristic — the item may not need a refund.`;
      drivers = [
        `Purchase: $${rp.purchaseAmount?.toFixed(2)} on ${rp.purchaseDate}`,
        `Days since purchase: ${rp.daysSincePurchase}`,
        `No matching refund/credit found`,
      ];
      confidenceStatement = `Confidence ${(event.confidence * 100).toFixed(0)}% — this is a heuristic guess. ` +
        `Mark as "ignore" if you intended to keep this purchase.`;
      break;
    }

    case 'anomaly': {
      const an = details.anomaly || details;
      explanation = an.reason || `This transaction is significantly higher than your usual spending at "${an.merchant}".`;
      drivers = [
        `Amount: $${an.amount?.toFixed(2)}`,
        `Your average: $${an.baselineAvg?.toFixed(2)}`,
        `Standard deviation: $${an.baselineStdDev?.toFixed(2)}`,
        `Z-score: ${an.zScore?.toFixed(1)} (${an.zScore > 3 ? 'very unusual' : 'unusual'})`,
      ];
      baselineComparison = {
        current: an.amount || 0,
        baseline: an.baselineAvg || 0,
        change_pct: an.baselineAvg ? ((an.amount - an.baselineAvg) / an.baselineAvg) * 100 : 0,
        period_label: 'vs your average',
      };
      confidenceStatement = `Confidence ${(event.confidence * 100).toFixed(0)}% — statistical outlier detection (z-score ${an.zScore?.toFixed(1)})`;
      break;
    }

    default:
      explanation = event.summary;
      drivers = ['See transaction details'];
      confidenceStatement = `Confidence: ${(event.confidence * 100).toFixed(0)}%`;
  }

  return {
    event,
    explanation,
    drivers,
    evidence,
    baseline_comparison: baselineComparison,
    confidence_statement: confidenceStatement,
  };
}

// ── Monthly Audit ──

export function getMonthlyAudit(month: string): MonthlyAuditData {
  // month is YYYY-MM
  const ref = parseISO(`${month}-15`);
  const start = format(startOfMonth(ref), 'yyyy-MM-dd');
  const end = format(endOfMonth(ref), 'yyyy-MM-dd');
  const prevStart = format(startOfMonth(subMonths(ref, 1)), 'yyyy-MM-dd');
  const prevEnd = format(endOfMonth(subMonths(ref, 1)), 'yyyy-MM-dd');

  const currentTxs = db.getTransactions(start, end);
  const baselineTxs = db.getTransactions(prevStart, prevEnd);
  const allTxs = db.getTransactions();
  const rules = db.getActiveRules();

  // Run all detectors
  const subs = detectSubscriptions(allTxs);
  const priceIncreases = detectPriceIncreases(currentTxs, baselineTxs);
  const pendingRefunds = detectPendingRefunds(allTxs);
  const anomalies = detectAnomalies(currentTxs, allTxs);

  const currentMerchants = new Set(currentTxs.map(t => t.merchant.toLowerCase()));

  const newSubCards: DiffCard[] = subs
    .filter(s => currentMerchants.has(s.merchant.toLowerCase()))
    .map(s => ({
      id: crypto.randomUUID(),
      event_id: '',
      title: `${s.merchant}`,
      type: 'subscription' as const,
      impact: -s.typicalAmount,
      confidence: s.confidence,
      merchant: s.merchant,
      summary: `$${s.typicalAmount.toFixed(2)}/${s.estimatedPeriod}`,
      details: { subscription: s },
      evidence_ids: [],
      suggested_actions: ['mark_ignore' as const, 'create_reminder' as const],
    }));

  const piCards: DiffCard[] = priceIncreases.map(pi => ({
    id: crypto.randomUUID(),
    event_id: '',
    title: `${pi.merchant}`,
    type: 'price_increase' as const,
    impact: -pi.increaseAmount,
    confidence: pi.confidence,
    merchant: pi.merchant,
    summary: `$${pi.previousAmount.toFixed(2)} → $${pi.currentAmount.toFixed(2)} (+${pi.increasePct.toFixed(1)}%)`,
    details: { priceIncrease: pi },
    evidence_ids: [],
    suggested_actions: ['draft_email' as const, 'create_reminder' as const],
  }));

  const refundCards: DiffCard[] = pendingRefunds
    .filter(pr => pr.purchaseDate <= end)
    .map(pr => ({
      id: crypto.randomUUID(),
      event_id: '',
      title: `${pr.merchant}`,
      type: 'refund_pending' as const,
      impact: -pr.purchaseAmount,
      confidence: pr.confidence,
      merchant: pr.merchant,
      summary: `$${pr.purchaseAmount.toFixed(2)} — no refund after ${pr.daysSincePurchase} days`,
      details: { refundPending: pr },
      evidence_ids: [],
      suggested_actions: ['draft_email' as const, 'mark_ignore' as const],
    }));

  const anomalyCards: DiffCard[] = anomalies.map(a => ({
    id: crypto.randomUUID(),
    event_id: '',
    title: `${a.merchant}`,
    type: 'anomaly' as const,
    impact: -a.amount,
    confidence: a.confidence,
    merchant: a.merchant,
    summary: a.reason,
    details: { anomaly: a },
    evidence_ids: [],
    suggested_actions: ['mark_ignore' as const],
  }));

  const totalLeakage =
    newSubCards.reduce((s, c) => s + Math.abs(c.impact), 0) +
    piCards.reduce((s, c) => s + Math.abs(c.impact), 0) +
    refundCards.reduce((s, c) => s + Math.abs(c.impact), 0);

  return {
    month,
    new_subscriptions: applyRules(newSubCards, rules),
    price_increases: applyRules(piCards, rules),
    refunds_pending: applyRules(refundCards, rules),
    anomalies: applyRules(anomalyCards, rules),
    total_leakage: Math.round(totalLeakage * 100) / 100,
  };
}

// ── Helpers ──

function sumAbsExpenses(txs: MoneyTransaction[]): number {
  return txs.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
}

function createDetectionEvent(
  type: string,
  summary: string,
  details: Record<string, unknown>,
  confidence: number,
  relatedTxs: MoneyTransaction[],
): string {
  const event = db.insertEvent(
    type as any,
    new Date().toISOString(),
    summary,
    details,
    confidence,
  );
  // Create evidence refs from related transactions
  for (const tx of relatedTxs) {
    db.insertEvidence(
      event.id,
      'csv_row',
      tx.source_ref || '',
      `${tx.date} | ${tx.merchant} | $${Math.abs(tx.amount).toFixed(2)}`,
      tx.raw_row_hash,
    );
  }
  return event.id;
}
