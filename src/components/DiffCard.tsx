import type { DiffCard as DiffCardType } from '../../shared/types';
import { formatCurrency, confidenceLabel, confidenceColor, cardTypeIcon } from '../utils';

interface Props {
  card: DiffCardType;
  onSelect: (card: DiffCardType) => void;
}

export default function DiffCard({ card, onSelect }: Props) {
  const isSummary = card.type === 'spending_summary';

  const grainConfidenceColor = (confidence: number) => {
    if (confidence >= 0.7) return 'text-grain-emerald';
    if (confidence >= 0.4) return 'text-grain-amber';
    return 'text-text-muted';
  };

  return (
    <button
      onClick={() => onSelect(card)}
      className={`card-${card.type} w-full text-left rounded-lg p-4 grain-card bg-surface-1 hover:bg-surface-2 border border-surface-3/50 transition-colors cursor-pointer`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm">{cardTypeIcon(card.type)}</span>
            <h3 className="text-sm font-medium text-text-primary truncate">
              {card.title}
            </h3>
            {!isSummary && (
              <span className={`text-xs font-mono ${grainConfidenceColor(card.confidence)}`}>
                {confidenceLabel(card.confidence)}
              </span>
            )}
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">{card.summary}</p>
        </div>

        {!isSummary && (
          <div className="text-right shrink-0">
            <span className={`text-sm font-mono font-medium ${
              card.impact < 0 ? 'text-grain-rose' : 'text-grain-emerald'
            }`}>
              {formatCurrency(card.impact)}
            </span>
          </div>
        )}
      </div>

      {card.suggested_actions.length > 0 && (
        <div className="flex gap-1.5 mt-3">
          {card.suggested_actions.map((action) => (
            <span
              key={action}
              className="text-xs px-2 py-0.5 rounded bg-surface-2 text-text-secondary"
            >
              {action.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
