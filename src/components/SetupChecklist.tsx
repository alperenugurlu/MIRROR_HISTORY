import { useNavigate } from 'react-router-dom';
import type { SetupStatus } from '../hooks/useSetupStatus';

const CATEGORY_DOT: Record<string, string> = {
  critical: 'bg-grain-rose',
  recommended: 'bg-grain-amber',
  optional: 'bg-surface-3',
};

const CATEGORY_LABEL: Record<string, string> = {
  critical: 'text-grain-rose',
  recommended: 'text-grain-amber',
  optional: 'text-text-muted',
};

interface SetupChecklistProps {
  status: SetupStatus;
}

export default function SetupChecklist({ status }: SetupChecklistProps) {
  const navigate = useNavigate();

  if (status.loading || status.isFullySetup) return null;

  const incompleteTasks = status.tasks.filter(t => !t.completed);
  const criticalDone = status.tasks.filter(t => t.category === 'critical').every(t => t.completed);

  return (
    <div className="grain-card border-t-2 border-grain-cyan overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-grain-cyan animate-glow-pulse" />
            <span className="text-[10px] font-mono text-grain-cyan uppercase tracking-widest font-bold">
              Grain Initialization
            </span>
          </div>
          <span className="text-[10px] font-mono text-text-muted">
            {status.completedCount}/{status.totalCount} complete
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1 bg-surface-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-grain-cyan rounded-full transition-all duration-700"
            style={{ width: `${status.percentage}%` }}
          />
        </div>
      </div>

      {/* Critical tasks done message */}
      {criticalDone && (
        <div className="px-4 pb-2">
          <p className="text-xs text-grain-emerald font-mono italic">
            The grain is awake. It sees your finances. It knows your patterns. Feed it more, and it will know everything.
          </p>
        </div>
      )}

      {/* Task list */}
      <div className="divide-y divide-surface-2/50">
        {incompleteTasks.map((task) => (
          <button
            key={task.id}
            onClick={() => navigate(task.route)}
            className="w-full flex items-start gap-3 px-4 py-3 hover:bg-surface-1/50 transition-colors text-left group"
          >
            {/* Status dot + icon */}
            <div className="flex items-center gap-2 pt-0.5 shrink-0">
              <span className={`w-1.5 h-1.5 rounded-full ${CATEGORY_DOT[task.category]}`} />
              <span className="text-sm">{task.icon}</span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-mono font-medium text-text-primary">{task.label}</span>
                <span className={`text-[9px] font-mono uppercase tracking-wider ${CATEGORY_LABEL[task.category]}`}>
                  {task.category}
                </span>
              </div>
              <p className="text-[11px] text-text-secondary font-mono italic leading-relaxed">
                {task.grainVoice}
              </p>
            </div>

            {/* Arrow */}
            <span className="text-text-muted group-hover:text-grain-cyan transition-colors shrink-0 pt-0.5">
              {'\u2192'}
            </span>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-surface-1/30 border-t border-surface-2/50">
        <p className="text-[9px] font-mono text-text-muted text-center tracking-wider">
          THE GRAIN REMEMBERS WHAT YOU FEED IT. IT FORGETS NOTHING.
        </p>
      </div>
    </div>
  );
}
