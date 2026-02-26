import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DiffCard as DiffCardType, DiffResult, PeriodType } from '../../shared/types';
import { useApi } from '../hooks/useApi';
import DiffCard from '../components/DiffCard';
import TimeMachineDrawer from '../components/TimeMachineDrawer';
import CsvImport from '../components/CsvImport';
import { useGrainVoice } from '../contexts/GrainVoiceContext';

const periodTabs: { key: PeriodType; label: string }[] = [
  { key: 'daily', label: 'Last Cycle' },
  { key: 'weekly', label: '7-Day Scan' },
  { key: 'monthly', label: '30-Day Scan' },
];

export default function Ledger() {
  const api = useApi();
  const [period, setPeriod] = useState<PeriodType>('daily');
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [selectedCard, setSelectedCard] = useState<DiffCardType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const { pushWhisper } = useGrainVoice();

  useEffect(() => {
    loadDiff(period);
  }, [period]);

  const loadDiff = async (pt: PeriodType) => {
    setLoading(true);
    setSelectedCard(null);
    setError(false);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const refDate = pt === 'daily'
        ? new Date(Date.now() - 86400000).toISOString().slice(0, 10)
        : today;
      const result = await api.generateDiff(pt, refDate);
      setDiff(result);
      // The grain reacts to spending anomalies
      if (result.change_pct > 30) {
        pushWhisper(`Spending up ${result.change_pct.toFixed(0)}% from baseline. The grain noticed.`, 'behavioral', 'concerned', 'ledger');
      } else if (result.cards.length >= 5) {
        pushWhisper(`${result.cards.length} financial findings. The pattern is forming.`, 'provocative', 'suspicious', 'ledger');
      }
    } catch (e) {
      console.error('Diff generation failed:', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const navigate = useNavigate();

  return (
    <div className="animate-grain-load flex h-full">
      {/* Main content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[11px] font-mono uppercase tracking-widest text-grain-amber">
              Financial Memory Ledger
            </h1>
            {diff && (
              <p className="text-xs font-mono text-text-muted mt-0.5">
                {diff.period_start} — {diff.period_end}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/oracle')}
              className="text-xs px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-text-secondary transition-colors"
            >
              Ask AI about spending
            </button>
            <button
              onClick={() => setShowImport(!showImport)}
              className="text-xs px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-text-muted transition-colors"
            >
              + Import CSV
            </button>
          </div>
        </div>

        {/* Import overlay */}
        {showImport && (
          <div className="mb-6 grain-card rounded-xl p-4 border border-surface-3/50">
            <CsvImport onComplete={() => { setShowImport(false); loadDiff(period); }} />
          </div>
        )}

        {/* Period tabs */}
        <div className="flex gap-1 mb-5 bg-surface-1 rounded-lg p-0.5 w-fit">
          {periodTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setPeriod(tab.key)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
                period === tab.key
                  ? 'bg-grain-amber text-surface-0'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Summary bar */}
        {diff && !loading && (
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-surface-1 rounded-lg p-3 border border-surface-3/50">
              <p className="text-[11px] uppercase text-text-muted font-mono tracking-widest">Spent</p>
              <p className="text-lg font-mono font-medium text-text-primary mt-0.5">${diff.total_spent.toFixed(2)}</p>
            </div>
            <div className="bg-surface-1 rounded-lg p-3 border border-surface-3/50">
              <p className="text-[11px] uppercase text-text-muted font-mono tracking-widest">vs Baseline</p>
              <p className={`text-lg font-mono font-medium mt-0.5 ${
                diff.change_pct > 0 ? 'text-grain-rose' : diff.change_pct < 0 ? 'text-grain-emerald' : 'text-text-muted'
              }`}>
                {diff.change_pct > 0 ? '+' : ''}{diff.change_pct.toFixed(1)}%
              </p>
            </div>
            <div className="bg-surface-1 rounded-lg p-3 border border-surface-3/50">
              <p className="text-[11px] uppercase text-text-muted font-mono tracking-widest">Findings</p>
              <p className="text-lg font-mono font-medium text-text-primary mt-0.5">{Math.max(0, diff.cards.length - 1)}</p>
            </div>
          </div>
        )}

        {/* Cards */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-grain-cyan animate-glow-pulse" />
              <p className="text-sm font-mono text-text-secondary">Scanning financial memories...</p>
            </div>
            <p className="text-xs text-text-muted">Comparing against spending baselines</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <p className="text-sm font-medium text-text-primary">Analysis couldn't complete</p>
            <p className="text-xs text-text-secondary max-w-xs text-center">
              This usually means no transactions exist for this period, or the data couldn't be read.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => loadDiff(period)}
                className="px-4 py-1.5 rounded-lg bg-grain-amber hover:bg-grain-amber/80 text-surface-0 text-xs transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => setShowImport(true)}
                className="px-4 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-text-secondary text-xs transition-colors"
              >
                Import More Data
              </button>
            </div>
          </div>
        ) : diff && diff.cards.length > 0 ? (
          <div className="space-y-2">
            {diff.cards.map((card) => (
              <DiffCard key={card.id} card={card} onSelect={setSelectedCard} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <p className="text-sm text-text-secondary">No changes detected for this period</p>
            <p className="text-xs text-text-muted">Try a different time range, or import more transactions.</p>
            <button
              onClick={() => setShowImport(true)}
              className="px-4 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-text-secondary text-xs transition-colors"
            >
              Import CSV
            </button>
          </div>
        )}
      </div>

      {/* Memory Trace drawer */}
      {selectedCard && (
        <TimeMachineDrawer card={selectedCard} onClose={() => setSelectedCard(null)} />
      )}
    </div>
  );
}
