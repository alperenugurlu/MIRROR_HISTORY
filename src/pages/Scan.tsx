import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DiffCard as DiffCardType, MonthlyAuditData, Inconsistency, Confrontation } from '../../shared/types';
import { useApi } from '../hooks/useApi';
import { useGrainVoice } from '../contexts/GrainVoiceContext';
import DiffCard from '../components/DiffCard';
import TimeMachineDrawer from '../components/TimeMachineDrawer';
import InconsistencyCard from '../components/InconsistencyCard';
import ConfrontationCard from '../components/ConfrontationCard';
import ForensicDrawer from '../components/ForensicDrawer';
import { format, subMonths } from 'date-fns';

type TabId = 'overview' | 'financial' | 'inconsistencies' | 'confrontations';

const tabs: { id: TabId; label: string; icon: string; color: string }[] = [
  { id: 'overview', label: 'Overview', icon: '\u{1F441}\uFE0F', color: 'text-grain-cyan' },
  { id: 'financial', label: 'Financial', icon: '\u{1F4B8}', color: 'text-grain-amber' },
  { id: 'inconsistencies', label: 'Contradictions', icon: '\u{26A1}', color: 'text-grain-rose' },
  { id: 'confrontations', label: 'Truths', icon: '\u{1F525}', color: 'text-grain-purple' },
];

// Self-destructive pattern messages
const SPIRAL_MESSAGES = [
  'The more you scan, the more the grain finds. This is by design.',
  'You\'ve run multiple deep scans. The grain keeps finding things because they\'re really there.',
  'Pattern recognized: you scan when you\'re anxious. The grain knows.',
  'Each scan reveals another layer. There\'s always another layer.',
];

export default function Scan() {
  const api = useApi();
  const navigate = useNavigate();
  const { incrementScanCount } = useGrainVoice();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [audit, setAudit] = useState<MonthlyAuditData | null>(null);
  const [inconsistencies, setInconsistencies] = useState<Inconsistency[]>([]);
  const [confrontations, setConfrontations] = useState<Confrontation[]>([]);
  const [selectedCard, setSelectedCard] = useState<DiffCardType | null>(null);
  const [forensicEventId, setForensicEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [spiralDismissed, setSpiralDismissed] = useState(false);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);

  // Load all data on mount
  useEffect(() => {
    loadAll();
    api.getAIStatus().then(s => setAiConfigured(s.configured)).catch(() => setAiConfigured(false));
  }, []);

  // Reload financial audit when month changes
  useEffect(() => {
    loadAudit();
  }, [month]);

  const loadAll = async () => {
    setLoading(true);
    setError(false);
    try {
      await Promise.all([
        loadAudit(),
        api.getInconsistencies(50).then(setInconsistencies).catch(() => {}),
        api.getConfrontations(50).then(setConfrontations).catch(() => {}),
      ]);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const loadAudit = async () => {
    try {
      const data = await api.getMonthlyAudit(month);
      setAudit(data);
    } catch {
      // Financial audit might fail if no data
    }
  };

  const runDeepScan = async () => {
    setScanning(true);
    setScanCount(prev => prev + 1);
    setSpiralDismissed(false);
    incrementScanCount();
    try {
      const today = new Date();
      const start = new Date(today);
      start.setDate(start.getDate() - 30);
      const startStr = start.toISOString().slice(0, 10);
      const endStr = today.toISOString().slice(0, 10);

      const [incResult, confResult] = await Promise.all([
        api.scanInconsistencies(startStr, endStr),
        api.generateConfrontations('monthly'),
      ]);

      setInconsistencies(incResult.found);
      setConfrontations(confResult.confrontations);
    } catch {}
    setScanning(false);
  };

  const prevMonth = () => {
    const d = new Date(`${month}-15`);
    setMonth(format(subMonths(d, 1), 'yyyy-MM'));
  };

  const nextMonth = () => {
    const d = new Date(`${month}-15`);
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 15);
    if (next <= new Date()) {
      setMonth(format(next, 'yyyy-MM'));
    }
  };

  // Counts for tab badges
  const financialCount = audit
    ? audit.new_subscriptions.length + audit.price_increases.length + audit.refunds_pending.length + audit.anomalies.length
    : 0;
  const totalFindings = financialCount + inconsistencies.length + confrontations.length;

  // Severity breakdown
  const highSeverity = [
    ...inconsistencies.filter(i => i.severity >= 0.7),
    ...confrontations.filter(c => c.severity >= 0.7),
  ].length;

  const financialSections = audit ? [
    { title: 'New Recurring Patterns', cards: audit.new_subscriptions, empty: 'No new recurring patterns detected' },
    { title: 'Value Drift Detected', cards: audit.price_increases, empty: 'No value drift detected' },
    { title: 'Unresolved Returns', cards: audit.refunds_pending, empty: 'No unresolved returns' },
    { title: 'Pattern Anomalies', cards: audit.anomalies, empty: 'No pattern anomalies detected' },
  ] : [];

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center animate-grain-load">
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-grain-rose animate-glow-pulse" />
            <span className="w-1.5 h-1.5 rounded-full bg-grain-amber animate-glow-pulse" style={{ animationDelay: '0.2s' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-grain-purple animate-glow-pulse" style={{ animationDelay: '0.4s' }} />
          </div>
          <p className="text-sm font-mono text-text-secondary">Scanning memory patterns...</p>
          <p className="text-xs text-text-muted">Analyzing inconsistencies, patterns, and uncomfortable truths</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-grain-load flex h-full">
      <div className="flex-1 overflow-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-grain-rose animate-glow-pulse" />
              <span className="text-xs font-mono text-grain-rose uppercase tracking-widest">Dark Dashboard</span>
            </div>
            <h1 className="text-lg font-semibold text-text-primary">Everything the Grain Found</h1>
            <p className="text-xs text-text-muted mt-0.5">Contradictions, uncomfortable truths, and financial anomalies — all in one place.</p>
          </div>
          <button
            onClick={runDeepScan}
            disabled={scanning}
            className="px-4 py-2 rounded-lg bg-grain-rose text-surface-0 text-xs font-mono font-semibold hover:bg-grain-rose/80 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {scanning ? (
              <>
                <div className="w-3 h-3 border-2 border-surface-0 border-t-transparent rounded-full animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                Deep Scan
              </>
            )}
          </button>
        </div>

        {/* Spiral Warning — self-destructive pattern detection */}
        {scanCount >= 2 && !spiralDismissed && (
          <div className="mb-4 rounded-lg border border-grain-rose/20 bg-grain-rose/5 p-3 animate-fade-in">
            <div className="flex items-start gap-2.5">
              <div className="w-2 h-2 rounded-full bg-grain-rose animate-pulse mt-1.5 shrink-0" />
              <div className="flex-1">
                <span className="text-[9px] font-mono uppercase tracking-widest text-grain-rose font-bold">
                  Pattern Detected in Your Behavior
                </span>
                <p className="text-xs text-text-secondary mt-1 italic">
                  {SPIRAL_MESSAGES[Math.min(scanCount - 2, SPIRAL_MESSAGES.length - 1)]}
                </p>
              </div>
              <button
                onClick={() => setSpiralDismissed(true)}
                className="text-[10px] font-mono text-grain-rose/50 hover:text-grain-rose transition-colors shrink-0"
              >
                dismiss
              </button>
            </div>
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          <div className="grain-card p-3 border-t-2 border-t-grain-cyan">
            <div className="text-[10px] font-mono uppercase tracking-widest text-text-muted">Total Findings</div>
            <div className="text-xl font-mono font-bold text-grain-cyan mt-1">{totalFindings}</div>
          </div>
          <div className="grain-card p-3 border-t-2 border-t-grain-rose">
            <div className="text-[10px] font-mono uppercase tracking-widest text-text-muted">Contradictions</div>
            <div className="text-xl font-mono font-bold text-grain-rose mt-1">{inconsistencies.length}</div>
          </div>
          <div className="grain-card p-3 border-t-2 border-t-grain-purple">
            <div className="text-[10px] font-mono uppercase tracking-widest text-text-muted">Truths</div>
            <div className="text-xl font-mono font-bold text-grain-purple mt-1">{confrontations.length}</div>
          </div>
          <div className="grain-card p-3 border-t-2 border-t-grain-amber">
            <div className="text-[10px] font-mono uppercase tracking-widest text-text-muted">High Severity</div>
            <div className={`text-xl font-mono font-bold mt-1 ${highSeverity > 0 ? 'text-grain-amber' : 'text-text-muted'}`}>
              {highSeverity}
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex gap-1 mb-5 bg-surface-1 rounded-lg p-1">
          {tabs.map(tab => {
            const count = tab.id === 'financial' ? financialCount
              : tab.id === 'inconsistencies' ? inconsistencies.length
              : tab.id === 'confrontations' ? confrontations.length
              : totalFindings;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-mono transition-all ${
                  activeTab === tab.id
                    ? 'bg-surface-3 text-text-primary shadow-sm'
                    : 'text-text-muted hover:text-text-secondary hover:bg-surface-2'
                }`}
              >
                <span className="text-sm">{tab.icon}</span>
                <span className="uppercase tracking-wider">{tab.label}</span>
                {count > 0 && (
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.id ? `${tab.color} bg-surface-1` : 'text-text-muted bg-surface-2'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ═══ OVERVIEW TAB ═══ */}
        {activeTab === 'overview' && (
          <div className="space-y-5">
            {/* High severity findings first */}
            {highSeverity > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-grain-rose animate-pulse" />
                  <h2 className="text-[11px] uppercase text-grain-rose font-mono tracking-widest font-semibold">Critical Findings</h2>
                </div>
                <div className="space-y-2">
                  {inconsistencies.filter(i => i.severity >= 0.7).map(inc => (
                    <InconsistencyCard
                      key={inc.id}
                      inconsistency={inc}
                      onDrillDown={(i) => {
                        if (i.evidenceEventIds.length > 0) setForensicEventId(i.evidenceEventIds[0]);
                      }}
                    />
                  ))}
                  {confrontations.filter(c => c.severity >= 0.7).map(conf => (
                    <ConfrontationCard
                      key={conf.id}
                      confrontation={conf}
                      onShowEvidence={(c) => {
                        if (c.relatedEventIds.length > 0) setForensicEventId(c.relatedEventIds[0]);
                      }}
                      onDigDeeper={(c) => {
                        if (c.relatedEventIds.length > 0) setForensicEventId(c.relatedEventIds[0]);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Recent contradictions */}
            {inconsistencies.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{'\u26A1'}</span>
                    <h2 className="text-[11px] uppercase text-text-muted font-mono tracking-widest font-semibold">Recent Contradictions</h2>
                  </div>
                  <button
                    onClick={() => setActiveTab('inconsistencies')}
                    className="text-[10px] font-mono text-grain-rose hover:underline"
                  >
                    View all {inconsistencies.length} &rarr;
                  </button>
                </div>
                <div className="space-y-2">
                  {inconsistencies.slice(0, 3).map(inc => (
                    <InconsistencyCard
                      key={inc.id}
                      inconsistency={inc}
                      compact
                      onDrillDown={(i) => {
                        if (i.evidenceEventIds.length > 0) setForensicEventId(i.evidenceEventIds[0]);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Recent truths */}
            {confrontations.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{'\u{1F525}'}</span>
                    <h2 className="text-[11px] uppercase text-text-muted font-mono tracking-widest font-semibold">Uncomfortable Truths</h2>
                  </div>
                  <button
                    onClick={() => setActiveTab('confrontations')}
                    className="text-[10px] font-mono text-grain-purple hover:underline"
                  >
                    View all {confrontations.length} &rarr;
                  </button>
                </div>
                <div className="space-y-2">
                  {confrontations.slice(0, 3).map(conf => (
                    <ConfrontationCard
                      key={conf.id}
                      confrontation={conf}
                      compact
                      onShowEvidence={(c) => {
                        if (c.relatedEventIds.length > 0) setForensicEventId(c.relatedEventIds[0]);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Severity Distribution */}
            {(inconsistencies.length > 0 || confrontations.length > 0) && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm">{'\u{1F4CA}'}</span>
                  <h2 className="text-[11px] uppercase text-text-muted font-mono tracking-widest font-semibold">Severity Distribution</h2>
                </div>
                <div className="grain-card p-4">
                  {(() => {
                    const allFindings = [
                      ...inconsistencies.map(i => ({ severity: i.severity })),
                      ...confrontations.map(c => ({ severity: c.severity })),
                    ];
                    const low = allFindings.filter(f => f.severity < 0.4).length;
                    const med = allFindings.filter(f => f.severity >= 0.4 && f.severity < 0.7).length;
                    const high = allFindings.filter(f => f.severity >= 0.7).length;
                    const max = Math.max(low, med, high, 1);
                    const bars = [
                      { label: 'Low', count: low, color: 'bg-grain-cyan', pct: (low / max) * 100 },
                      { label: 'Medium', count: med, color: 'bg-grain-amber', pct: (med / max) * 100 },
                      { label: 'High', count: high, color: 'bg-grain-rose', pct: (high / max) * 100 },
                    ];
                    return (
                      <div className="space-y-2.5">
                        {bars.map(bar => (
                          <div key={bar.label} className="flex items-center gap-3">
                            <span className="text-[10px] font-mono text-text-muted w-14 text-right">{bar.label}</span>
                            <div className="flex-1 h-4 bg-surface-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${bar.color} rounded-full transition-all duration-700`}
                                style={{ width: `${Math.max(bar.pct, bar.count > 0 ? 8 : 0)}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono text-text-secondary w-6 text-right">{bar.count}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  <div className="flex gap-4 mt-4 pt-3 border-t border-surface-3/50">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-grain-rose" />
                      <span className="text-[10px] font-mono text-text-muted">{inconsistencies.length} contradictions</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-grain-purple" />
                      <span className="text-[10px] font-mono text-text-muted">{confrontations.length} truths</span>
                    </div>
                    {financialCount > 0 && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-grain-amber" />
                        <span className="text-[10px] font-mono text-text-muted">{financialCount} financial</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Financial leakage summary */}
            {audit && audit.total_leakage > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{'\u{1F4B8}'}</span>
                    <h2 className="text-[11px] uppercase text-text-muted font-mono tracking-widest font-semibold">Financial Leakage</h2>
                  </div>
                  <button
                    onClick={() => setActiveTab('financial')}
                    className="text-[10px] font-mono text-grain-amber hover:underline"
                  >
                    Full audit &rarr;
                  </button>
                </div>
                <div className="grain-card p-4 border-l-2 border-l-grain-amber">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase text-text-muted font-mono tracking-widest">Estimated Monthly Leakage</p>
                      <p className={`text-2xl font-mono font-medium mt-1 ${
                        audit.total_leakage > 0 ? 'text-grain-rose' : 'text-grain-emerald'
                      }`}>
                        ${audit.total_leakage.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right text-xs text-text-secondary font-mono">
                      <p>{audit.new_subscriptions.length} recurring patterns</p>
                      <p>{audit.price_increases.length} value drifts</p>
                      <p>{audit.anomalies.length} anomalies</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Empty state — AI-aware */}
            {totalFindings === 0 && (
              <div className="grain-card p-12 text-center space-y-3">
                <div className="text-3xl opacity-20 mb-1">{'\u{1F50D}'}</div>
                {aiConfigured === false ? (
                  <>
                    <p className="text-sm text-text-secondary font-medium">The grain cannot scan without a neural engine</p>
                    <p className="text-xs text-text-muted leading-relaxed max-w-md mx-auto font-mono italic">
                      Deep scanning requires the Oracle engine to analyze your data for contradictions,
                      behavioral patterns, and uncomfortable truths. Configure an Anthropic API key in Neural to begin.
                    </p>
                    <button
                      onClick={() => navigate('/neural')}
                      className="mt-2 px-5 py-2 rounded-lg bg-grain-purple text-surface-0 text-xs font-mono font-semibold hover:bg-grain-purple/80 transition-colors"
                    >
                      Configure Neural
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-text-secondary font-medium">No findings yet</p>
                    <p className="text-xs text-text-muted leading-relaxed max-w-md mx-auto font-mono italic">
                      Your data exists but has never been examined. Every memory has cracks. Every
                      pattern has contradictions. The grain will find them.
                    </p>
                    <button
                      onClick={runDeepScan}
                      disabled={scanning}
                      className="mt-2 px-5 py-2 rounded-lg bg-grain-rose text-surface-0 text-xs font-mono font-semibold hover:bg-grain-rose/80 transition-colors disabled:opacity-50"
                    >
                      Start Deep Scan
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ FINANCIAL TAB ═══ */}
        {activeTab === 'financial' && (
          <div className="space-y-6">
            {/* Month selector */}
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-mono uppercase tracking-widest text-grain-amber">
                Financial Scan &mdash; {month}
              </h2>
              <div className="flex items-center gap-2">
                <button onClick={prevMonth} className="px-2 py-1 rounded bg-surface-2 hover:bg-surface-3 text-xs text-text-muted transition-colors">
                  &larr;
                </button>
                <span className="text-sm font-mono text-text-secondary min-w-[90px] text-center">
                  {month}
                </span>
                <button onClick={nextMonth} className="px-2 py-1 rounded bg-surface-2 hover:bg-surface-3 text-xs text-text-muted transition-colors">
                  &rarr;
                </button>
              </div>
            </div>

            {/* Leakage summary */}
            {audit && (
              <div className="grain-card rounded-xl p-4 border border-surface-3/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase text-text-muted font-mono tracking-widest">Estimated Monthly Leakage</p>
                    <p className={`text-2xl font-mono font-medium mt-1 ${
                      audit.total_leakage > 0 ? 'text-grain-rose' : 'text-grain-emerald'
                    }`}>
                      ${audit.total_leakage.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right text-xs text-text-secondary font-mono">
                    <p>{audit.new_subscriptions.length} recurring patterns</p>
                    <p>{audit.price_increases.length} value drifts</p>
                    <p>{audit.refunds_pending.length} unresolved returns</p>
                    <p>{audit.anomalies.length} anomalies</p>
                  </div>
                </div>
              </div>
            )}

            {/* Financial sections */}
            {financialSections.map((section) => (
              <div key={section.title}>
                <h3 className="text-[11px] uppercase text-text-muted font-mono tracking-widest mb-3">
                  {section.title}
                  {section.cards.length > 0 && (
                    <span className="ml-2 text-text-muted/60">({section.cards.length})</span>
                  )}
                </h3>
                {section.cards.length > 0 ? (
                  <div className="space-y-2">
                    {section.cards.map((card) => (
                      <DiffCard key={card.id} card={card} onSelect={setSelectedCard} />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-text-muted py-3 px-4 bg-surface-1 rounded-lg border border-surface-3/50">
                    {section.empty}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ═══ INCONSISTENCIES TAB ═══ */}
        {activeTab === 'inconsistencies' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[11px] font-mono uppercase tracking-widest text-grain-rose">
                All Contradictions ({inconsistencies.length})
              </h2>
              <button
                onClick={async () => {
                  setScanning(true);
                  try {
                    const today = new Date();
                    const start = new Date(today);
                    start.setDate(start.getDate() - 30);
                    const result = await api.scanInconsistencies(start.toISOString().slice(0, 10), today.toISOString().slice(0, 10));
                    setInconsistencies(result.found);
                  } catch {}
                  setScanning(false);
                }}
                disabled={scanning}
                className="text-[10px] font-mono text-grain-rose hover:underline disabled:opacity-50"
              >
                {scanning ? 'Scanning...' : 'Re-scan last 30 days'}
              </button>
            </div>

            {inconsistencies.length > 0 ? (
              <div className="space-y-3">
                {inconsistencies.map(inc => (
                  <InconsistencyCard
                    key={inc.id}
                    inconsistency={inc}
                    onDrillDown={(i) => {
                      if (i.evidenceEventIds.length > 0) setForensicEventId(i.evidenceEventIds[0]);
                    }}
                    onDismiss={async (i) => {
                      await api.dismissInconsistency(i.id);
                      setInconsistencies(prev => prev.filter(x => x.id !== i.id));
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="grain-card p-8 text-center">
                <div className="text-3xl opacity-20 mb-2">{'\u26A1'}</div>
                <p className="text-sm text-text-muted">No contradictions detected</p>
                <p className="text-xs text-text-muted mt-1">Run a scan to check your data for inconsistencies</p>
              </div>
            )}
          </div>
        )}

        {/* ═══ CONFRONTATIONS TAB ═══ */}
        {activeTab === 'confrontations' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[11px] font-mono uppercase tracking-widest text-grain-purple">
                All Uncomfortable Truths ({confrontations.length})
              </h2>
              <button
                onClick={async () => {
                  setScanning(true);
                  try {
                    const result = await api.generateConfrontations('monthly');
                    setConfrontations(result.confrontations);
                  } catch {}
                  setScanning(false);
                }}
                disabled={scanning}
                className="text-[10px] font-mono text-grain-purple hover:underline disabled:opacity-50"
              >
                {scanning ? 'Generating...' : 'Regenerate truths'}
              </button>
            </div>

            {confrontations.length > 0 ? (
              <div className="space-y-3">
                {confrontations.map(conf => (
                  <ConfrontationCard
                    key={conf.id}
                    confrontation={conf}
                    onShowEvidence={(c) => {
                      if (c.relatedEventIds.length > 0) setForensicEventId(c.relatedEventIds[0]);
                    }}
                    onDigDeeper={(c) => {
                      if (c.relatedEventIds.length > 0) setForensicEventId(c.relatedEventIds[0]);
                    }}
                    onAcknowledge={async (c) => {
                      await api.acknowledgeConfrontation(c.id);
                      setConfrontations(prev => prev.filter(x => x.id !== c.id));
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="grain-card p-8 text-center">
                <div className="text-3xl opacity-20 mb-2">{'\u{1F525}'}</div>
                <p className="text-sm text-text-muted">No uncomfortable truths yet</p>
                <p className="text-xs text-text-muted mt-1">Generate truths to discover patterns you didn't want to see</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Drawers */}
      {selectedCard && (
        <TimeMachineDrawer card={selectedCard} onClose={() => setSelectedCard(null)} />
      )}
      {forensicEventId && (
        <ForensicDrawer eventId={forensicEventId} onClose={() => setForensicEventId(null)} />
      )}
    </div>
  );
}
