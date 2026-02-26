import type { Confrontation } from '../../shared/types';

const categoryConfig: Record<string, { icon: string; color: string; bgColor: string; borderColor: string; label: string }> = {
  correlation: {
    icon: '\u{1F517}',
    color: 'text-grain-rose',
    bgColor: 'bg-grain-rose/10',
    borderColor: 'border-grain-rose/30',
    label: 'PATTERN',
  },
  trend: {
    icon: '\u{1F4C9}',
    color: 'text-grain-amber',
    bgColor: 'bg-grain-amber/10',
    borderColor: 'border-grain-amber/30',
    label: 'TREND',
  },
  anomaly: {
    icon: '\u{1F441}\uFE0F',
    color: 'text-grain-purple',
    bgColor: 'bg-grain-purple/10',
    borderColor: 'border-grain-purple/30',
    label: 'ANOMALY',
  },
};

function SeverityPulse({ severity }: { severity: number }) {
  const color = severity >= 0.7 ? 'bg-grain-rose' : severity >= 0.5 ? 'bg-grain-amber' : 'bg-grain-cyan';
  const glow = severity >= 0.7 ? 'shadow-[0_0_8px_rgba(244,63,94,0.5)]' : '';
  return (
    <div className={`w-2 h-2 rounded-full ${color} ${glow} ${severity >= 0.7 ? 'animate-pulse' : ''}`} />
  );
}

interface ConfrontationCardProps {
  confrontation: Confrontation;
  onShowEvidence?: (confrontation: Confrontation) => void;
  onDigDeeper?: (confrontation: Confrontation) => void;
  onAcknowledge?: (confrontation: Confrontation) => void;
  compact?: boolean;
}

export default function ConfrontationCard({
  confrontation,
  onShowEvidence,
  onDigDeeper,
  onAcknowledge,
  compact,
}: ConfrontationCardProps) {
  const config = categoryConfig[confrontation.category] || categoryConfig.correlation;

  if (compact) {
    return (
      <button
        onClick={() => onShowEvidence?.(confrontation)}
        className={`w-full text-left p-3 rounded-lg border ${config.borderColor} ${config.bgColor} hover:bg-surface-3/50 transition-colors group`}
      >
        <div className="flex items-start gap-2.5">
          <SeverityPulse severity={confrontation.severity} />
          <div className="flex-1 min-w-0">
            <span className={`text-xs font-mono font-bold ${config.color} leading-tight block truncate`}>
              {confrontation.title}
            </span>
            <span className="text-[10px] text-text-muted mt-0.5 block truncate">
              {confrontation.insight}
            </span>
          </div>
          <span className="text-[9px] font-mono uppercase tracking-widest text-text-muted shrink-0">
            {config.label}
          </span>
        </div>
      </button>
    );
  }

  return (
    <div className={`rounded-xl border ${config.borderColor} ${config.bgColor} overflow-hidden transition-all hover:shadow-card-hover`}>
      {/* Severity strip */}
      <div
        className="h-0.5"
        style={{
          background: `linear-gradient(90deg, ${
            confrontation.severity >= 0.7 ? '#f43f5e' : confrontation.severity >= 0.5 ? '#f59e0b' : '#06b6d4'
          } ${Math.round(confrontation.severity * 100)}%, transparent ${Math.round(confrontation.severity * 100)}%)`,
        }}
      />

      {/* Header */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            <span className="text-lg leading-none mt-0.5">{config.icon}</span>
            <div className="min-w-0">
              <h3 className={`text-sm font-mono font-bold ${config.color} leading-tight`}>
                {confrontation.title}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px] font-mono uppercase tracking-widest text-text-muted">
                  {config.label}
                </span>
                <SeverityPulse severity={confrontation.severity} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Insight text */}
      <div className="px-4 pb-2">
        <p className="text-xs text-text-secondary leading-relaxed">
          {confrontation.insight}
        </p>
      </div>

      {/* Data points */}
      {confrontation.dataPoints.length > 0 && (
        <div className="px-4 pb-3">
          <div className="flex flex-wrap gap-2">
            {confrontation.dataPoints.map((dp, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface-1/50 border border-surface-3"
              >
                <span className="text-[10px] font-mono text-text-muted">{dp.label}</span>
                <span className={`text-[11px] font-mono font-bold ${config.color}`}>{dp.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 pb-3 flex items-center gap-3">
        {onShowEvidence && (
          <button
            onClick={() => onShowEvidence(confrontation)}
            className={`text-[11px] font-mono uppercase tracking-wider ${config.color} hover:underline transition-colors`}
          >
            Show evidence
          </button>
        )}
        {onDigDeeper && (
          <button
            onClick={() => onDigDeeper(confrontation)}
            className="text-[11px] font-mono uppercase tracking-wider text-text-muted hover:text-grain-cyan transition-colors"
          >
            Dig deeper
          </button>
        )}
        {onAcknowledge && (
          <button
            onClick={() => onAcknowledge(confrontation)}
            className="text-[11px] font-mono uppercase tracking-wider text-text-muted hover:text-grain-emerald transition-colors ml-auto"
          >
            I see this
          </button>
        )}
      </div>
    </div>
  );
}
