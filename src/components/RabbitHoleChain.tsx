/**
 * RabbitHoleChain — Exploration depth tracker.
 *
 * Breadcrumb trail showing how deep you've gone:
 * "Moment -> Context -> Pattern -> Correlation"
 *
 * Each level shows what question/event led there.
 * "Go back" navigation through the chain.
 * Depth counter: "You're 4 levels deep"
 */

import type { Event } from '../../shared/types';
import { eventTypeIcon } from '../utils';

export interface RabbitHoleStep {
  eventId: string;
  event: Event;
  question?: string; // The question that led to this step
}

interface RabbitHoleChainProps {
  steps: RabbitHoleStep[];
  onGoBack: (stepIndex: number) => void;
}

const depthLabels = ['Surface', 'Context', 'Pattern', 'Correlation', 'Deep Memory', 'Obsession'];

function getDepthColor(depth: number): string {
  if (depth <= 1) return 'text-grain-cyan';
  if (depth <= 2) return 'text-grain-amber';
  if (depth <= 3) return 'text-grain-purple';
  return 'text-grain-rose';
}

export default function RabbitHoleChain({ steps, onGoBack }: RabbitHoleChainProps) {
  if (steps.length <= 1) return null;

  const depth = steps.length;
  const depthLabel = depthLabels[Math.min(depth - 1, depthLabels.length - 1)];
  const depthColor = getDepthColor(depth);

  return (
    <div className="border-b border-surface-3/50 bg-surface-1/50">
      {/* Depth indicator */}
      <div className="px-4 pt-3 pb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full animate-glow-pulse ${depth > 3 ? 'bg-grain-rose' : 'bg-grain-cyan'}`} />
          <span className={`text-[10px] font-mono uppercase tracking-widest ${depthColor}`}>
            {depthLabel}
          </span>
          <span className="text-[10px] font-mono text-text-muted">
            Depth {depth}
          </span>
        </div>
        {depth > 1 && (
          <button
            onClick={() => onGoBack(0)}
            className="text-[10px] font-mono text-text-muted hover:text-grain-cyan transition-colors"
          >
            Back to surface
          </button>
        )}
      </div>

      {/* Breadcrumb trail */}
      <div className="px-4 pb-3 flex items-center gap-1 overflow-x-auto scrollbar-hide">
        {steps.map((step, i) => (
          <div key={step.eventId + i} className="flex items-center gap-1 shrink-0">
            {i > 0 && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-surface-3 shrink-0">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            )}
            <button
              onClick={() => onGoBack(i)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono transition-colors ${
                i === steps.length - 1
                  ? 'bg-surface-2 text-text-primary border border-surface-3'
                  : 'text-text-muted hover:text-text-secondary hover:bg-surface-2/50'
              }`}
            >
              <span>{eventTypeIcon(step.event.type)}</span>
              <span className="max-w-[100px] truncate">
                {step.question
                  ? step.question.slice(0, 30) + (step.question.length > 30 ? '...' : '')
                  : step.event.summary.slice(0, 30)}
              </span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
