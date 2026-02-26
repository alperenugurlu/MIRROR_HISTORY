import type { Inconsistency } from '../../shared/types';

const typeConfig: Record<string, { icon: string; color: string; bgColor: string; borderColor: string }> = {
  location_mismatch: {
    icon: '\u{1F4CD}',
    color: 'text-grain-rose',
    bgColor: 'bg-grain-rose/10',
    borderColor: 'border-grain-rose/30',
  },
  schedule_conflict: {
    icon: '\u{26A0}\uFE0F',
    color: 'text-grain-amber',
    bgColor: 'bg-grain-amber/10',
    borderColor: 'border-grain-amber/30',
  },
  mood_behavior_disconnect: {
    icon: '\u{1F3AD}',
    color: 'text-grain-purple',
    bgColor: 'bg-grain-purple/10',
    borderColor: 'border-grain-purple/30',
  },
  pattern_break: {
    icon: '\u{1F517}',
    color: 'text-grain-amber',
    bgColor: 'bg-grain-amber/10',
    borderColor: 'border-grain-amber/30',
  },
  spending_mood_correlation: {
    icon: '\u{1F4B8}',
    color: 'text-grain-rose',
    bgColor: 'bg-grain-rose/10',
    borderColor: 'border-grain-rose/30',
  },
  time_gap: {
    icon: '\u{1F576}\uFE0F',
    color: 'text-grain-cyan',
    bgColor: 'bg-grain-cyan/10',
    borderColor: 'border-grain-cyan/30',
  },
  visual_mood_mismatch: {
    icon: '\u{1F4F8}',
    color: 'text-grain-rose',
    bgColor: 'bg-grain-rose/10',
    borderColor: 'border-grain-rose/30',
  },
};

function SeverityBar({ severity }: { severity: number }) {
  const pct = Math.round(severity * 100);
  const color = severity >= 0.7 ? 'bg-grain-rose' : severity >= 0.5 ? 'bg-grain-amber' : 'bg-grain-cyan';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1 rounded-full bg-surface-3 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono text-text-muted">{pct}%</span>
    </div>
  );
}

interface InconsistencyCardProps {
  inconsistency: Inconsistency;
  onDrillDown?: (inconsistency: Inconsistency) => void;
  onDismiss?: (inconsistency: Inconsistency) => void;
  compact?: boolean;
}

export default function InconsistencyCard({ inconsistency, onDrillDown, onDismiss, compact }: InconsistencyCardProps) {
  const config = typeConfig[inconsistency.type] || typeConfig.time_gap;
  const typeLabel = inconsistency.type.replace(/_/g, ' ');

  if (compact) {
    return (
      <button
        onClick={() => onDrillDown?.(inconsistency)}
        className={`w-full text-left p-2.5 rounded-lg border ${config.borderColor} ${config.bgColor} hover:bg-surface-3/50 transition-colors group`}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">{config.icon}</span>
          <span className={`text-xs font-mono font-medium ${config.color} flex-1 truncate`}>
            {inconsistency.title}
          </span>
          <SeverityBar severity={inconsistency.severity} />
        </div>
      </button>
    );
  }

  return (
    <div className={`rounded-xl border ${config.borderColor} ${config.bgColor} overflow-hidden transition-all hover:shadow-card-hover`}>
      {/* Header */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{config.icon}</span>
            <div>
              <h3 className={`text-sm font-mono font-semibold ${config.color} leading-tight`}>
                {inconsistency.title}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-mono uppercase tracking-widest text-text-muted">
                  {typeLabel}
                </span>
                <span className="text-[10px] text-text-muted">{inconsistency.date}</span>
              </div>
            </div>
          </div>
          <SeverityBar severity={inconsistency.severity} />
        </div>
      </div>

      {/* Description */}
      <div className="px-4 pb-3">
        <p className="text-xs text-text-secondary leading-relaxed">
          {inconsistency.description}
        </p>
      </div>

      {/* Suggested question + actions */}
      <div className="px-4 pb-3 space-y-2">
        <p className="text-[11px] font-mono text-text-muted italic truncate">
          "{inconsistency.suggestedQuestion}"
        </p>
        <div className="flex items-center gap-3">
          {onDrillDown && (
            <button
              onClick={() => onDrillDown(inconsistency)}
              className={`text-[11px] font-mono uppercase tracking-wider ${config.color} hover:underline transition-colors`}
            >
              Investigate
            </button>
          )}
          {onDismiss && (
            <button
              onClick={() => onDismiss(inconsistency)}
              className="text-[11px] font-mono uppercase tracking-wider text-text-muted hover:text-text-secondary transition-colors"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
