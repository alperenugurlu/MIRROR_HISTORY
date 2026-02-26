import type {
  MirrorHistoryApi, DiffResult, DiffCard, TimeMachineData,
  MonthlyAuditData, MoneyTransaction, Subscription, Diff,
  Rule, Action, ActivityLogEntry, ImportResult, EvidenceRef,
  ChatMessage, AIDigest, ImportStats, TimelineStats, TimelineEntry,
  MoodEntry, EventType, RedoDay, MomentSnapshot, HourlySlice, ForensicContext, Event as MirrorHistoryEvent,
  InconsistencyScanResult, Inconsistency,
  Confrontation, ConfrontationResult,
  ComparisonResult,
} from '../../shared/types';

// ── Demo transactions ──
const demoTransactions: MoneyTransaction[] = [
  { id: 't1', event_id: 'e1', date: '2026-02-01', merchant: 'Netflix', amount: -15.99, currency: 'USD', category: 'Entertainment', account: 'Checking', raw_row_hash: 'h1', source: 'csv_import', source_ref: '' },
  { id: 't2', event_id: 'e2', date: '2026-02-03', merchant: 'Whole Foods', amount: -95.40, currency: 'USD', category: 'Groceries', account: 'Checking', raw_row_hash: 'h2', source: 'csv_import', source_ref: '' },
  { id: 't3', event_id: 'e3', date: '2026-02-05', merchant: 'Shell Gas', amount: -51.20, currency: 'USD', category: 'Transportation', account: 'Credit Card', raw_row_hash: 'h3', source: 'csv_import', source_ref: '' },
  { id: 't4', event_id: 'e4', date: '2026-02-07', merchant: 'Spotify', amount: -10.99, currency: 'USD', category: 'Entertainment', account: 'Checking', raw_row_hash: 'h4', source: 'csv_import', source_ref: '' },
  { id: 't5', event_id: 'e5', date: '2026-02-08', merchant: 'Adobe Creative Cloud', amount: -54.99, currency: 'USD', category: 'Software', account: 'Credit Card', raw_row_hash: 'h5', source: 'csv_import', source_ref: '' },
  { id: 't6', event_id: 'e6', date: '2026-02-10', merchant: 'ChatGPT Plus', amount: -20.00, currency: 'USD', category: 'Software', account: 'Credit Card', raw_row_hash: 'h6', source: 'csv_import', source_ref: '' },
  { id: 't7', event_id: 'e7', date: '2026-02-15', merchant: 'Planet Fitness', amount: -34.99, currency: 'USD', category: 'Health', account: 'Checking', raw_row_hash: 'h7', source: 'csv_import', source_ref: '' },
  { id: 't8', event_id: 'e8', date: '2026-02-18', merchant: 'Whole Foods', amount: -110.25, currency: 'USD', category: 'Groceries', account: 'Checking', raw_row_hash: 'h8', source: 'csv_import', source_ref: '' },
  { id: 't9', event_id: 'e9', date: '2026-02-20', merchant: 'Con Edison', amount: -155.00, currency: 'USD', category: 'Utilities', account: 'Checking', raw_row_hash: 'h9', source: 'csv_import', source_ref: '' },
];

// ── Demo diff cards ──
const demoCards: DiffCard[] = [
  {
    id: 'c0', event_id: 'ev-summary', title: 'Total: $548.81', type: 'spending_summary',
    impact: -37.5, confidence: 1.0, merchant: '',
    summary: '+7.3% vs previous cycle ($511.31)',
    details: { totalSpent: 548.81, baselineSpent: 511.31, changePct: 7.3, count: 9 },
    evidence_ids: [], suggested_actions: [],
  },
  {
    id: 'c1', event_id: 'ev-sub-chatgpt', title: 'New Pattern: ChatGPT Plus', type: 'subscription',
    impact: -20.00, confidence: 0.65, merchant: 'ChatGPT Plus',
    summary: 'Recurring pattern detected: $20.00/monthly',
    details: { subscription: { merchant: 'ChatGPT Plus', typicalAmount: 20, estimatedPeriod: 'monthly', firstSeen: '2026-02-10' } },
    evidence_ids: ['ev1'], suggested_actions: ['mark_ignore', 'create_reminder'],
  },
  {
    id: 'c2', event_id: 'ev-pi-spotify', title: 'Value Drift: Spotify', type: 'price_increase',
    impact: -1.00, confidence: 0.8, merchant: 'Spotify',
    summary: '$9.99 \u2192 $10.99 (+10.0%)',
    details: { priceIncrease: { merchant: 'Spotify', previousAmount: 9.99, currentAmount: 10.99, increaseAmount: 1.0, increasePct: 10.0 } },
    evidence_ids: ['ev2'], suggested_actions: ['draft_email', 'create_reminder'],
  },
  {
    id: 'c3', event_id: 'ev-pi-gym', title: 'Value Drift: Planet Fitness', type: 'price_increase',
    impact: -5.00, confidence: 0.8, merchant: 'Planet Fitness',
    summary: '$29.99 \u2192 $34.99 (+16.7%)',
    details: { priceIncrease: { merchant: 'Planet Fitness', previousAmount: 29.99, currentAmount: 34.99, increaseAmount: 5.0, increasePct: 16.7 } },
    evidence_ids: ['ev3'], suggested_actions: ['draft_email', 'create_reminder'],
  },
  {
    id: 'c4', event_id: 'ev-refund-bb', title: 'Pending Trace: Best Buy', type: 'refund_pending',
    impact: -549.99, confidence: 0.4, merchant: 'Best Buy',
    summary: '$549.99 memory on 2025-12-25 \u2014 no refund trace found (59 days)',
    details: { refundPending: { merchant: 'Best Buy', purchaseAmount: 549.99, purchaseDate: '2025-12-25', daysSincePurchase: 59 } },
    evidence_ids: ['ev4'], suggested_actions: ['draft_email', 'mark_ignore'],
  },
  {
    id: 'c5', event_id: 'ev-anomaly-wf', title: 'Anomaly: Whole Foods', type: 'anomaly',
    impact: -110.25, confidence: 0.72, merchant: 'Whole Foods',
    summary: 'Whole Foods: $110.25 is 2.4 std devs above baseline ($88.76)',
    details: { anomaly: { merchant: 'Whole Foods', amount: 110.25, baselineAvg: 88.76, baselineStdDev: 8.95, zScore: 2.4 } },
    evidence_ids: ['ev5'], suggested_actions: ['mark_ignore'],
  },
];

const demoTimeMachine: Record<string, TimeMachineData> = {
  'ev-sub-chatgpt': {
    event: { id: 'ev-sub-chatgpt', type: 'subscription', timestamp: '2026-02-10', summary: 'New recurring pattern: ChatGPT Plus', details_json: '{}', confidence: 0.65, classification: 'local_private', created_at: '2026-02-22' },
    explanation: 'This pattern was detected because "ChatGPT Plus" appears as a recurring charge. One transaction found, not present in the previous cycle, suggesting a new recurring pattern.',
    drivers: ['New merchant not in previous cycle', 'Amount: $20.00', 'Category: Software'],
    evidence: [{ id: 'ev1', event_id: 'ev-sub-chatgpt', evidence_type: 'csv_row', pointer: '', excerpt: '2026-02-10 | ChatGPT Plus | $20.00', hash: '', created_at: '2026-02-22' }],
    baseline_comparison: null,
    confidence_statement: 'Confidence 65% \u2014 single occurrence, will increase with more data points',
  },
  'ev-pi-spotify': {
    event: { id: 'ev-pi-spotify', type: 'price_increase', timestamp: '2026-02-07', summary: 'Value drift: Spotify (+$1.00)', details_json: '{}', confidence: 0.8, classification: 'local_private', created_at: '2026-02-22' },
    explanation: 'This pattern was detected because the charge from "Spotify" drifted from $9.99 to $10.99 (+10.0%).',
    drivers: ['Previous baseline: $9.99', 'Current charge: $10.99', 'Drift: +$1.00 (+10.0%)'],
    evidence: [
      { id: 'ev2a', event_id: 'ev-pi-spotify', evidence_type: 'csv_row', pointer: '', excerpt: '2025-12-07 | Spotify | $9.99', hash: '', created_at: '2026-02-22' },
      { id: 'ev2b', event_id: 'ev-pi-spotify', evidence_type: 'csv_row', pointer: '', excerpt: '2026-02-07 | Spotify | $10.99', hash: '', created_at: '2026-02-22' },
    ],
    baseline_comparison: { current: 10.99, baseline: 9.99, change_pct: 10.0, period_label: 'vs previous cycle' },
    confidence_statement: 'Confidence 80% \u2014 based on cross-cycle baseline comparison',
  },
  'ev-pi-gym': {
    event: { id: 'ev-pi-gym', type: 'price_increase', timestamp: '2026-02-15', summary: 'Value drift: Planet Fitness (+$5.00)', details_json: '{}', confidence: 0.8, classification: 'local_private', created_at: '2026-02-22' },
    explanation: 'This pattern was detected because the charge from "Planet Fitness" drifted from $29.99 to $34.99 (+16.7%).',
    drivers: ['Previous baseline: $29.99', 'Current charge: $34.99', 'Drift: +$5.00 (+16.7%)'],
    evidence: [
      { id: 'ev3a', event_id: 'ev-pi-gym', evidence_type: 'csv_row', pointer: '', excerpt: '2025-12-15 | Planet Fitness | $29.99', hash: '', created_at: '2026-02-22' },
      { id: 'ev3b', event_id: 'ev-pi-gym', evidence_type: 'csv_row', pointer: '', excerpt: '2026-02-15 | Planet Fitness | $34.99', hash: '', created_at: '2026-02-22' },
    ],
    baseline_comparison: { current: 34.99, baseline: 29.99, change_pct: 16.7, period_label: 'vs previous cycle' },
    confidence_statement: 'Confidence 80% \u2014 based on cross-cycle baseline comparison',
  },
  'ev-refund-bb': {
    event: { id: 'ev-refund-bb', type: 'refund_pending', timestamp: '2025-12-25', summary: 'Possible missing refund: Best Buy ($549.99)', details_json: '{}', confidence: 0.4, classification: 'local_private', created_at: '2026-02-22' },
    explanation: 'A financial memory of $549.99 at "Best Buy" on 2025-12-25 has no matching refund trace after 59 days. This is a heuristic \u2014 the item may not need a refund.',
    drivers: ['Memory: $549.99 on 2025-12-25', 'Days elapsed: 59', 'No matching refund trace found'],
    evidence: [{ id: 'ev4', event_id: 'ev-refund-bb', evidence_type: 'csv_row', pointer: '', excerpt: '2025-12-25 | Best Buy | $549.99', hash: '', created_at: '2026-02-22' }],
    baseline_comparison: null,
    confidence_statement: 'Confidence 40% \u2014 heuristic detection. Suppress if intentional purchase.',
  },
  'ev-anomaly-wf': {
    event: { id: 'ev-anomaly-wf', type: 'anomaly', timestamp: '2026-02-18', summary: 'Whole Foods: $110.25 is 2.4 std devs above baseline ($88.76)', details_json: '{}', confidence: 0.72, classification: 'local_private', created_at: '2026-02-22' },
    explanation: 'This financial memory is significantly higher than your baseline spending at "Whole Foods".',
    drivers: ['Amount: $110.25', 'Your baseline: $88.76', 'Standard deviation: $8.95', 'Z-score: 2.4 (anomalous)'],
    evidence: [{ id: 'ev5', event_id: 'ev-anomaly-wf', evidence_type: 'csv_row', pointer: '', excerpt: '2026-02-18 | Whole Foods | $110.25', hash: '', created_at: '2026-02-22' }],
    baseline_comparison: { current: 110.25, baseline: 88.76, change_pct: 24.2, period_label: 'vs your baseline' },
    confidence_statement: 'Confidence 72% \u2014 statistical anomaly detection (z-score 2.4)',
  },
};

let mockRules: Rule[] = [];
let mockActions: Action[] = [];
let mockLog: ActivityLogEntry[] = [
  { id: 'log1', timestamp: '2026-02-22T08:00:00Z', entry_type: 'import', description: 'Ingested 48 financial memories from CSV', details_json: '{}' },
  { id: 'log2', timestamp: '2026-02-22T08:01:00Z', entry_type: 'diff_generated', description: 'February 2026 scan: $548.81 (5 patterns detected)', details_json: '{}' },
];

let idCounter = 100;
function mockId() { return `mock-${++idCounter}`; }

let mockChatHistory: ChatMessage[] = [];

const mockTimeline: TimelineEntry[] = [
  {
    date: '2026-02-22',
    events: [
      { id: 'te1', type: 'mood', timestamp: '2026-02-22T08:00:00Z', summary: 'Neural State: 4/5 \u2014 Productive morning', details_json: '{}', confidence: 1, classification: 'local_private', created_at: '2026-02-22', mood: { id: 'm1', event_id: 'te1', score: 4, note: 'Productive morning', timestamp: '2026-02-22T08:00:00Z' } },
      { id: 'te2', type: 'note', timestamp: '2026-02-22T10:30:00Z', summary: 'Written Memory: Q1 planning notes', details_json: '{}', confidence: 1, classification: 'local_private', created_at: '2026-02-22', note: { id: 'n1', event_id: 'te2', content: 'Q1 planning \u2014 discussed roadmap priorities', source: 'manual', tags: '[]', created_at: '2026-02-22' } },
    ],
  },
  {
    date: '2026-02-21',
    events: [
      { id: 'te3', type: 'money_transaction', timestamp: '2026-02-21T12:00:00Z', summary: 'Financial Memory: Whole Foods -$95.40', details_json: '{}', confidence: 1, classification: 'local_private', created_at: '2026-02-21', transaction: demoTransactions[1] },
      { id: 'te4', type: 'calendar_event', timestamp: '2026-02-21T14:00:00Z', summary: 'Temporal Memory: Team Standup', details_json: '{}', confidence: 1, classification: 'local_private', created_at: '2026-02-21', calendar_event: { id: 'ce1', event_id: 'te4', title: 'Team Standup', start_time: '2026-02-21T14:00:00Z', end_time: '2026-02-21T14:30:00Z', location: 'Zoom', description: '' } },
    ],
  },
  {
    date: '2026-02-20',
    events: [
      { id: 'te5', type: 'health_entry', timestamp: '2026-02-20T23:59:00Z', summary: 'Biometric Memory: 9,412 steps', details_json: '{}', confidence: 1, classification: 'local_private', created_at: '2026-02-20', health_entry: { id: 'he1', event_id: 'te5', metric_type: 'steps', value: 9412, unit: 'count', timestamp: '2026-02-20T23:59:00Z', source: 'apple_health' } },
      { id: 'te6', type: 'mood', timestamp: '2026-02-20T21:00:00Z', summary: 'Neural State: 3/5', details_json: '{}', confidence: 1, classification: 'local_private', created_at: '2026-02-20', mood: { id: 'm2', event_id: 'te6', score: 3, note: '', timestamp: '2026-02-20T21:00:00Z' } },
    ],
  },
];

// ── Demo inconsistencies ──
const demoInconsistencies: Inconsistency[] = [
  {
    id: 'inc-1', type: 'location_mismatch', severity: 0.8,
    title: "You weren't where you said you'd be",
    description: 'Calendar event "Team Standup" was at "Istanbul Office", but your location data shows you were at "Kadikoy Waterfront" during that time.',
    evidenceEventIds: ['te3', 'te4'],
    suggestedQuestion: 'Why were you at Kadikoy Waterfront instead of Istanbul Office?',
    date: '2026-02-20', detectedAt: '2026-02-20T22:00:00Z',
  },
  {
    id: 'inc-2', type: 'spending_mood_correlation', severity: 0.7,
    title: 'Emotional spending: 140% above normal',
    description: 'On a 2.0/5 mood day, you spent $185.40 \u2014 140% more than your average $77.25 on normal-mood days. Biggest: $95.40 at Whole Foods.',
    evidenceEventIds: ['e2', 'te6'],
    suggestedQuestion: 'Did spending at Whole Foods make you feel better or worse?',
    date: '2026-02-20', detectedAt: '2026-02-20T22:00:00Z',
  },
  {
    id: 'inc-3', type: 'schedule_conflict', severity: 0.6,
    title: 'Double-booked: 45min overlap',
    description: '"Dentist Appointment" and "Client Call" overlap by 45 minutes. You agreed to be in two places at once.',
    evidenceEventIds: ['te3', 'te3'],
    suggestedQuestion: 'Which one did you actually attend \u2014 "Dentist Appointment" or "Client Call"?',
    date: '2026-02-19', detectedAt: '2026-02-19T22:00:00Z',
  },
  {
    id: 'inc-4', type: 'mood_behavior_disconnect', severity: 0.65,
    title: 'Emotional rollercoaster: 1/5 \u2192 5/5',
    description: 'Your mood swung 4 points in one day. From 1/5 at 08:30 to 5/5 at 19:00. What happened in between?',
    evidenceEventIds: ['te6'],
    suggestedQuestion: 'What caused the shift from 1/5 to 5/5?',
    date: '2026-02-18', detectedAt: '2026-02-18T22:00:00Z',
  },
  {
    id: 'inc-5', type: 'time_gap', severity: 0.5,
    title: '4h silence: 13:00\u201317:00',
    description: 'No recorded activity from 13:00 to 17:00 \u2014 4 hours of silence in the middle of an otherwise active day. What were you doing?',
    evidenceEventIds: [],
    suggestedQuestion: 'What happened between 13:00 and 17:00? The grain was silent.',
    date: '2026-02-20', detectedAt: '2026-02-20T22:00:00Z',
  },
  {
    id: 'inc-6', type: 'pattern_break', severity: 0.45,
    title: 'Broke your Monday routine',
    description: 'You had "health_entry" events on 3 of the last 4 Mondays, but not today. Routine broken.',
    evidenceEventIds: [],
    suggestedQuestion: 'Why did you skip health entry this Monday?',
    date: '2026-02-17', detectedAt: '2026-02-17T22:00:00Z',
  },
];

// ── Demo confrontations ──
const demoConfrontations: Confrontation[] = [
  {
    id: 'conf-1',
    title: 'You spend more when you\'re sad',
    insight: 'On days your mood is below 3/5, you spend an average of $142.30 — that\'s 83% more than your $77.60 average on good-mood days. This pattern has held for the last 3 weeks.',
    severity: 0.85,
    dataPoints: [
      { label: 'Low-mood avg', value: '$142.30' },
      { label: 'Good-mood avg', value: '$77.60' },
      { label: 'Difference', value: '+83%' },
    ],
    relatedEventIds: ['te6', 'e2', 'e8'],
    category: 'correlation',
    generatedAt: '2026-02-22T10:00:00Z',
  },
  {
    id: 'conf-2',
    title: 'Your mood is declining',
    insight: 'Your average mood dropped from 3.8/5 in the first half of the period to 2.9/5 in the second half. That\'s a steady decline of 0.9 points over two weeks.',
    severity: 0.75,
    dataPoints: [
      { label: 'First half', value: '3.8/5' },
      { label: 'Second half', value: '2.9/5' },
      { label: 'Drop', value: '-0.9' },
    ],
    relatedEventIds: ['te1', 'te6'],
    category: 'trend',
    generatedAt: '2026-02-22T10:00:00Z',
  },
  {
    id: 'conf-3',
    title: 'Meetings are killing your mood',
    insight: 'On days with 3+ calendar events, your average mood is 2.4/5. On days with 0-1 events, it\'s 4.1/5. Meetings correlate with a 1.7 point mood drop.',
    severity: 0.80,
    dataPoints: [
      { label: 'Busy days', value: '2.4/5' },
      { label: 'Calm days', value: '4.1/5' },
      { label: 'Impact', value: '-1.7 pts' },
    ],
    relatedEventIds: ['te4'],
    category: 'correlation',
    generatedAt: '2026-02-22T10:00:00Z',
  },
  {
    id: 'conf-4',
    title: 'You stopped exercising',
    insight: 'First half of the period: 6 workouts. Second half: 1. Your exercise frequency dropped 83%. This coincides with your declining mood trend.',
    severity: 0.70,
    dataPoints: [
      { label: 'Before', value: '6 workouts' },
      { label: 'After', value: '1 workout' },
      { label: 'Drop', value: '-83%' },
    ],
    relatedEventIds: ['te5'],
    category: 'trend',
    generatedAt: '2026-02-22T10:00:00Z',
  },
  {
    id: 'conf-5',
    title: 'Kadikoy: 8 visits, zero notes',
    insight: 'You\'ve been to Kadikoy 8 times in the last 2 weeks but never wrote a single note about what you did there. What happens in Kadikoy that you don\'t want to record?',
    severity: 0.60,
    dataPoints: [
      { label: 'Visits', value: '8' },
      { label: 'Notes', value: '0' },
      { label: 'Period', value: '14 days' },
    ],
    relatedEventIds: [],
    category: 'anomaly',
    generatedAt: '2026-02-22T10:00:00Z',
  },
];

export const mockApi: MirrorHistoryApi = {
  // Auth (mock — always succeeds)
  login: async (username, password) => {
    if (username === 'admin' && password === 'changeme') {
      return { token: 'mock-jwt-token', user: { id: 'mock-1', username: 'admin', mustChangePassword: false } };
    }
    throw new Error('Invalid username or password');
  },
  changePassword: async () => ({ success: true }),
  getAuthUser: async () => ({ id: 'mock-1', username: 'admin', mustChangePassword: false }),
  logout: async () => {},

  selectFile: async () => '/mock/demo-transactions.csv',
  previewCsv: async () => ({
    headers: ['Date', 'Description', 'Amount', 'Currency', 'Category', 'Account'],
    rows: [
      { Date: '2026-02-01', Description: 'Netflix', Amount: '-15.99', Currency: 'USD', Category: 'Entertainment', Account: 'Checking' },
      { Date: '2026-02-03', Description: 'Whole Foods', Amount: '-95.40', Currency: 'USD', Category: 'Groceries', Account: 'Checking' },
    ],
  }),
  importCsv: async () => ({ imported: 48, skipped: 0, errors: [] }),
  hasData: async () => true,
  getTransactions: async () => demoTransactions,
  generateDiff: async (periodType) => ({
    id: 'diff-1',
    period_type: periodType,
    period_start: '2026-02-01',
    period_end: '2026-02-28',
    summary: 'February 2026 scan: $548.81 (5 patterns detected)',
    cards: demoCards,
    total_spent: 548.81,
    baseline_spent: 511.31,
    change_pct: 7.3,
  }),
  getDiffs: async () => [],
  getTimeMachine: async (eventId) => {
    return demoTimeMachine[eventId] || {
      event: { id: eventId, type: 'money_transaction', timestamp: '2026-02-01', summary: 'Financial Memory', details_json: '{}', confidence: 1, classification: 'local_private', created_at: '2026-02-22' },
      explanation: 'Standard financial memory.',
      drivers: ['See details'],
      evidence: [],
      baseline_comparison: null,
      confidence_statement: 'Confidence 100%',
    };
  },
  getSubscriptions: async () => [],
  getMonthlyAudit: async (month) => ({
    month,
    new_subscriptions: [demoCards[1]],
    price_increases: [demoCards[2], demoCards[3]],
    refunds_pending: [demoCards[4]],
    anomalies: [demoCards[5]],
    total_leakage: 576.24,
  }),
  getRules: async () => mockRules,
  createRule: async (ruleType, ruleJson) => {
    const rule: Rule = { id: mockId(), rule_type: ruleType, rule_json: ruleJson, created_at: new Date().toISOString(), enabled: 1 };
    mockRules = [rule, ...mockRules];
    mockLog = [{ id: mockId(), timestamp: new Date().toISOString(), entry_type: 'rule_created', description: `Filter created: ${ruleType}`, details_json: '{}' }, ...mockLog];
    return rule;
  },
  updateRule: async (id, enabled) => {
    mockRules = mockRules.map(r => r.id === id ? { ...r, enabled } : r);
  },
  deleteRule: async (id) => {
    mockRules = mockRules.filter(r => r.id !== id);
  },
  createAction: async (eventId, actionType, payloadJson) => {
    const action: Action = { id: mockId(), event_id: eventId, action_type: actionType, status: 'draft', payload_json: payloadJson, created_at: new Date().toISOString(), applied_at: null };
    mockActions = [action, ...mockActions];
    mockLog = [{ id: mockId(), timestamp: new Date().toISOString(), entry_type: 'action_drafted', description: `Response drafted: ${actionType}`, details_json: '{}' }, ...mockLog];
    return action;
  },
  updateActionStatus: async () => {},
  getActions: async () => mockActions,
  getActivityLog: async () => mockLog,

  // Oracle Engine
  sendChatMessage: async (message) => {
    const userMsg: ChatMessage = {
      id: mockId(), role: 'user', content: message,
      context_summary: '', created_at: new Date().toISOString(),
    };
    const assistantMsg: ChatMessage = {
      id: mockId(), role: 'assistant',
      content: `Based on your memory data, here's what I found about "${message.slice(0, 50)}":\n\nThis is a mock response. Configure your Oracle Engine (Anthropic API key) to get real AI-powered analysis of your grain data.`,
      context_summary: '', created_at: new Date().toISOString(),
    };
    mockChatHistory = [...mockChatHistory, userMsg, assistantMsg];
    return { userMsg, assistantMsg };
  },
  getChatHistory: async () => mockChatHistory,
  clearChatHistory: async () => { mockChatHistory = []; },
  getAIStatus: async () => ({ configured: false, transcription: false }),

  // Grain Digest
  generateDigest: async (period) => ({
    id: mockId(), event_id: mockId(), period,
    period_start: '2026-02-15', period_end: '2026-02-22',
    content: `# ${period === 'weekly' ? 'Weekly' : 'Monthly'} Grain Digest\n\nThis is a mock digest. Configure your Oracle Engine to generate real AI-powered grain digests.\n\n**Financial:** $548.81 across 9 memories\n**Neural State:** Average 3.5/5\n**Biometric:** 8,234 average daily steps`,
    created_at: new Date().toISOString(),
  }),
  getDigests: async () => [],

  // Memory Ingestion
  getImportStats: async () => ({
    transactions: { count: 9, lastImport: '2026-02-22' },
    locations: { count: 0, lastImport: null },
    calendar: { count: 0, lastImport: null },
    health: { count: 0, lastImport: null },
    photos: { count: 0, analyzed: 0, lastImport: null },
    videos: { count: 0, lastImport: null },
  }),
  importLocationHistory: async () => ({ imported: 142, skipped: 3, errors: [] }),
  importCalendarICS: async () => ({ imported: 67, skipped: 0, errors: [] }),
  importAppleHealth: async () => ({ imported: 1240, skipped: 12, errors: [] }),
  selectFileWithFilter: async () => '/mock/selected-file',

  // Memory Recall
  getEnhancedTimeline: async () => mockTimeline,
  getTimelineStats: async () => ({
    totalEvents: 24,
    byType: { money_transaction: 9, note: 5, mood: 4, calendar_event: 3, health_entry: 2, location: 1 },
    dateRange: { min: '2026-02-01', max: '2026-02-22' },
  }),

  // Neural State
  recordMood: async (score, note) => ({
    event_id: mockId(),
    mood: { id: mockId(), event_id: '', score, note: note || '', timestamp: new Date().toISOString() },
  }),

  // Neural Configuration
  getAIConfig: async () => ({ hasAnthropicKey: false, hasWhisperKey: false, hasOpenaiKey: false, embeddingStats: { count: 0, total: 24 }, privacyLevel: 'balanced' }),
  saveAIConfigSettings: async () => {},
  getTelegramConfig: async () => null,
  saveTelegramConfig: async () => ({ ok: false, message: 'Mock mode \u2014 configure in Electron app' }),
  getTelegramStatus: async () => ({ running: false }),
  getSystemStatus: async () => ({ apiServer: true, dbEvents: 24, dbDateRange: { min: '2026-02-01', max: '2026-02-22' } }),

  // Memory Recall: Semantic Search
  getDailyNarrative: async (date) => ({
    date,
    narrative: 'A productive day \u2014 you had a morning meeting about Q1 planning, your neural state was upbeat at 4/5, and financial memories stayed in check. The day felt balanced overall.',
    moodAvg: 3.5,
    eventCount: 6,
    dominantTypes: ['note', 'mood', 'money_transaction'],
  }),
  getVoiceFile: async () => '',  // No audio in mock mode

  // Semantic Search
  semanticSearch: async (query) => {
    // Return mock results based on existing timeline data
    return mockTimeline.flatMap(day =>
      day.events.map((event, i) => ({
        event: { ...event },
        snippet: event.summary.slice(0, 100),
        rank: -(i + 1),
        score: 0.85 - (i * 0.1),
        ...(event.note ? { note: event.note } : {}),
        ...(event.mood ? { mood: event.mood } : {}),
        ...(event.transaction ? { transaction: event.transaction } : {}),
        ...(event.calendar_event ? { calendar_event: event.calendar_event } : {}),
        ...(event.health_entry ? { health_entry: event.health_entry } : {}),
      }))
    ).slice(0, 5);
  },
  rebuildEmbeddings: async () => ({ total: 24, embedded: 24, errors: 0 }),

  // Audio Memory Recording
  saveAudioRecording: async (_base64, duration) => ({
    event_id: mockId(),
    transcript: `Mock transcription of ${duration}s audio memory. In Electron mode, this will use Whisper API or local Ollama for real transcription.`,
  }),
  getTranscriptionConfig: async () => ({ engine: 'openai', configured: false, ollamaUrl: 'http://localhost:11434' }),
  saveTranscriptionConfig: async () => {},

  // Connector Framework
  connectorList: async () => ([
    {
      id: 'google-calendar',
      name: 'Google Calendar',
      icon: '\u{1F4C5}',
      status: { connected: false, lastSync: null, lastError: null, eventCount: 0 },
    },
  ]),
  connectorAuthenticate: async () => ({ ok: true, authUrl: 'https://accounts.google.com/o/oauth2/v2/auth?mock=true' }),
  connectorCallback: async () => ({ ok: true }),
  connectorSync: async () => ({ imported: 5, errors: 0 }),
  connectorDisconnect: async () => ({ ok: true }),

  // Memory Vault (Privacy Controls)
  getPrivacyStats: async () => ({
    retentionPeriod: 'forever',
    totalEvents: 24,
    sensitiveEvents: 0,
    voiceFiles: 2,
    dbSizeBytes: 524288,
  }),
  setRetentionPolicy: async () => {},
  exportAllData: async () => ({ filePath: '/mock/mirror-history-export-2026-02-22.json' }),
  panicWipe: async () => ({ success: true, message: 'All grain data purged (mock)' }),

  // Quick Note Input
  createNote: async (content: string, source?: string, tags?: string[]) => {
    const eventId = mockId();
    mockLog = [{ id: mockId(), timestamp: new Date().toISOString(), entry_type: 'note_created', description: `Written Memory: ${content.slice(0, 40)}`, details_json: '{}' }, ...mockLog];
    return { event_id: eventId };
  },

  // Moment Detection
  getWeeklyHighlights: async () => ([
    {
      id: 'mood_spike_2026-02-20',
      type: 'mood_spike',
      date: '2026-02-20',
      title: 'Peak Neural State',
      description: 'Your neural state hit 4.5/5, well above your baseline 3.2',
      icon: '\u{1F929}',
      score: 0.85,
      relatedEventIds: [],
    },
    {
      id: 'productive_2026-02-19',
      type: 'productive_day',
      date: '2026-02-19',
      title: 'High Recording Activity',
      description: 'Captured 5 written memories and 2 audio memories',
      icon: '\u{1F4DD}',
      score: 0.7,
      relatedEventIds: [],
    },
  ]),

  // Phase 6: Dark Grain — Re-do
  getRedoDay: async (date: string): Promise<RedoDay> => {
    const emptySnapshot: MomentSnapshot = {
      timestamp: '', transactions: [], calendarEvents: [], healthEntries: [], notes: [], voiceMemos: [],
    };
    const slices: HourlySlice[] = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      label: `${h.toString().padStart(2, '0')}:00`,
      snapshot: { ...emptySnapshot, timestamp: `${date}T${h.toString().padStart(2, '0')}:30:00.000Z` },
      eventCount: 0,
      dominantType: null,
    }));

    // Populate demo data for interesting hours
    slices[8] = {
      ...slices[8], eventCount: 2, dominantType: 'mood',
      snapshot: {
        timestamp: `${date}T08:30:00.000Z`,
        mood: { id: 'm1', event_id: 'em1', score: 3, note: 'Groggy morning', timestamp: `${date}T08:15:00.000Z` },
        transactions: [],
        calendarEvents: [{ id: 'ce1', event_id: 'ece1', title: 'Team Standup', start_time: `${date}T09:00:00`, end_time: `${date}T09:30:00`, location: 'Zoom', description: '' }],
        healthEntries: [{ id: 'he1', event_id: 'ehe1', metric_type: 'heart_rate', value: 72, unit: 'bpm', timestamp: `${date}T08:00:00`, source: 'apple_health' }],
        notes: [], voiceMemos: [],
      },
    };
    slices[12] = {
      ...slices[12], eventCount: 3, dominantType: 'money_transaction',
      snapshot: {
        timestamp: `${date}T12:30:00.000Z`,
        mood: { id: 'm2', event_id: 'em2', score: 4, note: 'Good lunch', timestamp: `${date}T12:45:00.000Z` },
        location: { id: 'l1', event_id: 'el1', lat: 41.0082, lng: 28.9784, address: 'Istiklal Caddesi, Beyoglu', timestamp: `${date}T12:20:00`, source: 'google_takeout' },
        transactions: [
          { id: 'mt1', event_id: 'emt1', date, merchant: 'Cafe Mandabatmaz', amount: -45.00, currency: 'TRY', category: 'Food', account: null, raw_row_hash: 'rh1', source: 'csv_import', source_ref: '' },
        ],
        calendarEvents: [],
        healthEntries: [{ id: 'he2', event_id: 'ehe2', metric_type: 'steps', value: 4500, unit: 'steps', timestamp: `${date}T12:00:00`, source: 'apple_health' }],
        notes: [{ id: 'n1', event_id: 'en1', content: 'Had a great Turkish coffee at Mandabatmaz. The foam was perfect.', source: 'manual', tags: '["food","istanbul"]', created_at: `${date}T12:50:00` }],
        voiceMemos: [],
      },
    };
    slices[15] = {
      ...slices[15], eventCount: 2, dominantType: 'calendar_event',
      snapshot: {
        timestamp: `${date}T15:30:00.000Z`,
        calendarEvents: [
          { id: 'ce2', event_id: 'ece2', title: 'Product Review Meeting', start_time: `${date}T15:00:00`, end_time: `${date}T16:00:00`, location: 'Conference Room B', description: 'Q1 roadmap review' },
          { id: 'ce3', event_id: 'ece3', title: '1:1 with Manager', start_time: `${date}T16:00:00`, end_time: `${date}T16:30:00`, location: '', description: '' },
        ],
        transactions: [],
        healthEntries: [],
        notes: [],
        voiceMemos: [],
      },
    };
    slices[19] = {
      ...slices[19], eventCount: 3, dominantType: 'note',
      snapshot: {
        timestamp: `${date}T19:30:00.000Z`,
        mood: { id: 'm3', event_id: 'em3', score: 2, note: 'Feeling drained after meetings', timestamp: `${date}T19:00:00.000Z` },
        location: { id: 'l2', event_id: 'el2', lat: 41.0422, lng: 29.0083, address: 'Home, Kadikoy', timestamp: `${date}T18:45:00`, source: 'google_takeout' },
        transactions: [
          { id: 'mt2', event_id: 'emt2', date, merchant: 'Getir', amount: -89.90, currency: 'TRY', category: 'Groceries', account: null, raw_row_hash: 'rh2', source: 'csv_import', source_ref: '' },
        ],
        calendarEvents: [],
        healthEntries: [],
        notes: [{ id: 'n2', event_id: 'en2', content: 'Need to rethink the architecture. The current approach is too complex.', source: 'manual', tags: '["work","reflection"]', created_at: `${date}T19:20:00` }],
        voiceMemos: [{ id: 'vm1', event_id: 'evm1', transcript: 'Just got home. Today was exhausting. Three back to back meetings and I could not focus on actual work at all. I need to block my calendar better.', duration_seconds: 32, file_path: '/mock/voice1.webm', source: 'api', created_at: `${date}T19:35:00` }],
      },
    };

    return {
      date,
      slices,
      moodArc: [
        { hour: 8, score: 3 },
        { hour: 12, score: 4 },
        { hour: 19, score: 2 },
      ],
      totalEvents: 10,
    };
  },

  getMomentData: async (timestamp: string, windowMinutes: number): Promise<MomentSnapshot> => ({
    timestamp,
    transactions: [],
    calendarEvents: [],
    healthEntries: [],
    notes: [],
    voiceMemos: [],
  }),

  // Phase 6: Dark Grain — Forensic Zoom
  getForensicContext: async (eventId: string, windowMinutes?: number): Promise<ForensicContext> => {
    const ts = '2026-02-20T12:30:00.000Z';
    const mockEvent: MirrorHistoryEvent = {
      id: eventId,
      type: 'money_transaction',
      timestamp: ts,
      summary: 'Starbucks -$5.50',
      details_json: '{}',
      confidence: 1,
      classification: 'local_private',
      created_at: ts,
    };

    return {
      event: mockEvent,
      before: [
        {
          id: 'ev-before-1',
          type: 'mood',
          timestamp: '2026-02-20T12:00:00.000Z',
          summary: 'Mood: 3/5',
          details_json: '{}',
          confidence: 1,
          classification: 'local_private',
          created_at: '2026-02-20T12:00:00.000Z',
          mood: { id: 'mood-b1', event_id: 'ev-before-1', score: 3, note: 'Midday slump', timestamp: '2026-02-20T12:00:00.000Z' },
        },
        {
          id: 'ev-before-2',
          type: 'calendar_event',
          timestamp: '2026-02-20T11:00:00.000Z',
          summary: 'Team Standup',
          details_json: '{}',
          confidence: 1,
          classification: 'local_private',
          created_at: '2026-02-20T11:00:00.000Z',
          calendar_event: { id: 'cal-b1', event_id: 'ev-before-2', title: 'Team Standup', start_time: '2026-02-20T11:00:00', end_time: '2026-02-20T11:30:00', location: 'Zoom', description: '' },
        },
        {
          id: 'ev-before-3',
          type: 'location',
          timestamp: '2026-02-20T10:30:00.000Z',
          summary: 'Location: Office',
          details_json: '{}',
          confidence: 1,
          classification: 'local_private',
          created_at: '2026-02-20T10:30:00.000Z',
          location: { id: 'loc-b1', event_id: 'ev-before-3', lat: 41.0082, lng: 28.9784, address: 'Levent Office, Istanbul', timestamp: '2026-02-20T10:30:00.000Z', source: 'google_takeout' },
        },
      ],
      after: [
        {
          id: 'ev-after-1',
          type: 'note',
          timestamp: '2026-02-20T13:00:00.000Z',
          summary: 'Afternoon thought',
          details_json: '{}',
          confidence: 1,
          classification: 'local_private',
          created_at: '2026-02-20T13:00:00.000Z',
          note: { id: 'note-a1', event_id: 'ev-after-1', content: 'Need to cut down on coffee spending. Third time this week.', source: 'manual', tags: '["spending","reflection"]', created_at: '2026-02-20T13:00:00.000Z' },
        },
        {
          id: 'ev-after-2',
          type: 'mood',
          timestamp: '2026-02-20T14:00:00.000Z',
          summary: 'Mood: 4/5',
          details_json: '{}',
          confidence: 1,
          classification: 'local_private',
          created_at: '2026-02-20T14:00:00.000Z',
          mood: { id: 'mood-a1', event_id: 'ev-after-2', score: 4, note: 'Caffeine kicked in', timestamp: '2026-02-20T14:00:00.000Z' },
        },
      ],
      crossDomain: {
        timestamp: ts,
        location: { id: 'loc-cd', event_id: 'ev-cd-loc', lat: 41.0082, lng: 28.9784, address: 'Levent, Istanbul', timestamp: ts, source: 'google_takeout' },
        mood: { id: 'mood-cd', event_id: 'ev-cd-mood', score: 3, note: 'Midday slump', timestamp: '2026-02-20T12:00:00.000Z' },
        transactions: [{ id: 'tx-cd', event_id: eventId, date: '2026-02-20', merchant: 'Starbucks', amount: -5.50, currency: 'USD', category: null, account: null, raw_row_hash: 'h1', source: 'csv_import', source_ref: '' }],
        calendarEvents: [{ id: 'cal-cd', event_id: 'ev-cd-cal', title: 'Team Standup', start_time: '2026-02-20T11:00:00', end_time: '2026-02-20T11:30:00', location: 'Zoom', description: '' }],
        healthEntries: [{ id: 'he-cd', event_id: 'ev-cd-he', metric_type: 'heart_rate', value: 78, unit: 'bpm', timestamp: ts, source: 'apple_health' }],
        notes: [],
        voiceMemos: [],
      },
      similarMoments: [
        { date: '2026-02-18', similarity: 0.85, summary: 'Starbucks -$5.50 — same merchant, similar amount' },
        { date: '2026-02-15', similarity: 0.72, summary: 'Starbucks -$6.00 — same merchant, mood was 2/5' },
        { date: '2026-02-10', similarity: 0.55, summary: 'Cafe Mandabatmaz -$4.00 — different cafe, similar time' },
      ],
      suggestedQuestions: [
        'What were you doing before spending $5.50 at Starbucks?',
        'Your mood was 3/5 when you spent at Starbucks. Is there a pattern?',
        'How many times have you been to Starbucks this month?',
        'Your mood improved to 4/5 after coffee. Caffeine dependency?',
        'You noted "Need to cut down on coffee spending." Are you acting on it?',
        'What else was happening on 2026-02-20 around 12:30?',
      ],
    };
  },

  // Phase 6: Dark Grain — Inconsistency Engine
  scanInconsistencies: async (startDate: string, endDate: string): Promise<InconsistencyScanResult> => {
    return {
      scannedDays: 7,
      found: demoInconsistencies,
    };
  },

  getInconsistencies: async (limit?: number): Promise<Inconsistency[]> => {
    return demoInconsistencies.filter(i => !i.dismissed).slice(0, limit || 50);
  },

  dismissInconsistency: async (id: string): Promise<void> => {
    const inc = demoInconsistencies.find(i => i.id === id);
    if (inc) inc.dismissed = true;
  },

  // Phase 6: Dark Grain — Confrontation Engine
  generateConfrontations: async (period: 'weekly' | 'monthly'): Promise<ConfrontationResult> => {
    return {
      generated: demoConfrontations.length,
      confrontations: demoConfrontations,
    };
  },

  getConfrontations: async (limit?: number): Promise<Confrontation[]> => {
    return demoConfrontations.filter(c => !c.acknowledged).slice(0, limit || 20);
  },

  acknowledgeConfrontation: async (id: string): Promise<void> => {
    const conf = demoConfrontations.find(c => c.id === id);
    if (conf) conf.acknowledged = true;
  },

  // Phase 6: Dark Grain — Comparison Engine
  comparePeriods: async (p1Start: string, p1End: string, p2Start: string, p2End: string): Promise<ComparisonResult> => {
    return {
      period1: {
        start: p1Start, end: p1End,
        metrics: {
          mood: { avg: 3.8, min: 2, max: 5, count: 12 },
          spending: { total: 412.50, avgDaily: 58.93, topMerchants: [{ name: 'Whole Foods', total: 195.00 }, { name: 'Netflix', total: 15.99 }] },
          health: { avgSteps: 8400, avgSleep: 7.2, workoutCount: 4 },
          calendar: { eventCount: 18, avgPerDay: 2.6 },
          notes: { count: 8, voiceCount: 3 },
          locations: { uniquePlaces: 6 },
          visual: { photoCount: 5, videoCount: 1, dominantMood: 'joyful', avgPeopleCount: 1.4, uniqueTags: ['outdoor', 'cafe', 'friends'], moodDistribution: { joyful: 3, calm: 2 } },
        },
      },
      period2: {
        start: p2Start, end: p2End,
        metrics: {
          mood: { avg: 2.9, min: 1, max: 4, count: 10 },
          spending: { total: 589.30, avgDaily: 84.19, topMerchants: [{ name: 'Amazon', total: 234.00 }, { name: 'Getir', total: 89.90 }] },
          health: { avgSteps: 5200, avgSleep: 6.1, workoutCount: 1 },
          calendar: { eventCount: 27, avgPerDay: 3.9 },
          notes: { count: 4, voiceCount: 1 },
          locations: { uniquePlaces: 4 },
          visual: { photoCount: 3, videoCount: 0, dominantMood: 'neutral', avgPeopleCount: 0.7, uniqueTags: ['home', 'desk', 'screen'], moodDistribution: { neutral: 2, tense: 1 } },
        },
      },
      changes: [
        { domain: 'mood', metric: 'Average Mood', p1: 3.8, p2: 2.9, changePct: -23.7, direction: 'down' },
        { domain: 'mood', metric: 'Mood Entries', p1: 12, p2: 10, changePct: -16.7, direction: 'down' },
        { domain: 'spending', metric: 'Total Spending', p1: 412.50, p2: 589.30, changePct: 42.9, direction: 'up' },
        { domain: 'spending', metric: 'Daily Average', p1: 58.93, p2: 84.19, changePct: 42.9, direction: 'up' },
        { domain: 'health', metric: 'Average Steps', p1: 8400, p2: 5200, changePct: -38.1, direction: 'down' },
        { domain: 'health', metric: 'Average Sleep', p1: 7.2, p2: 6.1, changePct: -15.3, direction: 'down' },
        { domain: 'health', metric: 'Workouts', p1: 4, p2: 1, changePct: -75.0, direction: 'down' },
        { domain: 'calendar', metric: 'Calendar Events', p1: 18, p2: 27, changePct: 50.0, direction: 'up' },
        { domain: 'calendar', metric: 'Events Per Day', p1: 2.6, p2: 3.9, changePct: 50.0, direction: 'up' },
        { domain: 'notes', metric: 'Notes Written', p1: 8, p2: 4, changePct: -50.0, direction: 'down' },
        { domain: 'notes', metric: 'Voice Memos', p1: 3, p2: 1, changePct: -66.7, direction: 'down' },
        { domain: 'locations', metric: 'Unique Places', p1: 6, p2: 4, changePct: -33.3, direction: 'down' },
        { domain: 'visual', metric: 'Photos', p1: 5, p2: 3, changePct: -40.0, direction: 'down' },
        { domain: 'visual', metric: 'Videos', p1: 1, p2: 0, changePct: -100.0, direction: 'down' },
        { domain: 'visual', metric: 'Avg People in Photos', p1: 1.4, p2: 0.7, changePct: -50.0, direction: 'down' },
      ],
      narrative: 'The data tells a clear story: your life contracted. Mood dropped 24%, spending surged 43%, exercise collapsed 75%, and you visited fewer places. Meanwhile, calendar events jumped 50% — more meetings, less living. The grain sees a burnout pattern forming.',
    };
  },

  // Phase 7: Visual Memory
  importPhotos: async () => ({ imported: 0, analyzed: 0, errors: ['Mock mode: photo import not available'] }),
  importVideo: async () => ({ event_id: 'mock-video', frames_extracted: 0, summary: 'Mock mode: video import not available' }),
  analyzePhoto: async () => ({ id: '', photo_id: '', description: '', tags: '[]', detected_text: '', mood_indicators: '{}', people_count: 0, analyzed_at: '', model: '' }),
  getPhotoFile: async () => '',
  getVideoFile: async () => '',
  selectMultipleFiles: async () => [],
  getVisualMemories: async () => [],

  // Phase 8: Visual Comparison
  compareImages: async () => ({
    image1Path: '/mock/photo1.jpg',
    image2Path: '/mock/photo2.jpg',
    changes: [
      { category: 'expression' as const, description: 'Smile faded — the earlier photo shows genuine joy, the later one shows a forced, tighter expression.', significance: 'major' as const },
      { category: 'environment' as const, description: 'Background shifted from a bright outdoor cafe to a dimly lit home office.', significance: 'notable' as const },
      { category: 'posture' as const, description: 'Shoulders are higher and more tense in the later image.', significance: 'minor' as const },
    ],
    overallSummary: 'The grain sees it clearly: you went from genuinely relaxed to performing calm. The smile thinned, the shoulders rose, and the light around you dimmed — literally.',
    similarityScore: 0.6,
    emotionalShift: { from: 'joyful', to: 'tense', interpretation: 'A transition from authentic joy to controlled composure. The grain wonders what happened between these two moments.' },
    physicalChanges: ['Posture more rigid', 'Dark circles more visible'],
    environmentChanges: ['Outdoor cafe to home office', 'Lighting shifted from natural to artificial'],
    peopleChanges: 'The friend from the first photo is absent in the second.',
  }),
  comparePhotoSets: async () => ({
    period1Summary: { photoCount: 5, videoCount: 1, dominantMood: 'joyful', avgPeopleCount: 1.4, uniqueTags: ['outdoor', 'cafe', 'friends'], moodDistribution: { joyful: 3, calm: 2 } },
    period2Summary: { photoCount: 3, videoCount: 0, dominantMood: 'neutral', avgPeopleCount: 0.7, uniqueTags: ['home', 'desk', 'screen'], moodDistribution: { neutral: 2, tense: 1 } },
    comparison: null,
    narrative: 'You captured fewer visual memories and the mood in your photos shifted from joyful to neutral. The grain notices you went from outdoor scenes with friends to solitary desk photos.',
  }),
  getVisualInconsistencies: async () => [],
};
