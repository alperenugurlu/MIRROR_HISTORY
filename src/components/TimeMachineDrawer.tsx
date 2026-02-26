import { useState, useEffect } from 'react';
import type { DiffCard as DiffCardType, TimeMachineData, ActionType } from '../../shared/types';
import { useApi } from '../hooks/useApi';
import { formatCurrency, confidenceColor, cardTypeIcon } from '../utils';
import { useGrainVoice } from '../contexts/GrainVoiceContext';

interface Props {
  card: DiffCardType;
  onClose: () => void;
}

export default function TimeMachineDrawer({ card, onClose }: Props) {
  const api = useApi();
  const { pushWhisper } = useGrainVoice();
  const [tmData, setTmData] = useState<TimeMachineData | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (card.event_id) {
      api.getTimeMachine(card.event_id).then(data => {
        setTmData(data);
        if (data && data.event.confidence >= 0.8) {
          pushWhisper('High confidence trace. The grain is certain about this one.', 'ambient', 'satisfied', 'ledger');
        }
      });
    }
  }, [card.event_id]);

  const handleAction = async (actionType: ActionType) => {
    let payload: Record<string, unknown> = { merchant: card.merchant };

    if (actionType === 'draft_email') {
      payload = {
        merchant: card.merchant,
        amount: Math.abs(card.impact),
        reason: card.type === 'price_increase' ? 'price_increase' : 'refund',
      };
    } else if (actionType === 'create_reminder') {
      payload = {
        merchant: card.merchant,
        note: `Follow up on: ${card.summary}`,
      };
    } else if (actionType === 'mark_ignore') {
      // Also create a rule
      await api.createRule('ignore_merchant', JSON.stringify({ merchant: card.merchant }));
      payload = { merchant: card.merchant };
    }

    await api.createAction(card.event_id, actionType, JSON.stringify(payload));
    setActionFeedback(`Action created: ${actionType.replace('_', ' ')}`);
    setTimeout(() => setActionFeedback(null), 2000);
  };

  return (
    <div className="w-[420px] bg-surface-1 border-l border-surface-3 h-full overflow-auto shrink-0">
      {/* Header */}
      <div className="sticky top-0 bg-surface-1 border-b border-surface-3/50 p-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <span>{cardTypeIcon(card.type)}</span>
          <h2 className="text-[11px] font-mono uppercase tracking-widest text-grain-cyan">Memory Trace</h2>
        </div>
        <button
          onClick={onClose}
          className="text-text-muted hover:text-text-primary text-lg leading-none transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="p-4 space-y-5">
        {/* Card info */}
        <div>
          <h3 className="text-base font-medium text-text-primary mb-1">{card.title}</h3>
          <p className="text-sm text-text-secondary">{card.summary}</p>
          {card.impact !== 0 && (
            <p className={`text-lg font-mono font-medium mt-2 ${
              card.impact < 0 ? 'text-grain-rose' : 'text-grain-emerald'
            }`}>
              {formatCurrency(card.impact)}
            </p>
          )}
        </div>

        {/* Loading skeleton */}
        {card.event_id && !tmData && (
          <div className="space-y-4 animate-pulse">
            <div>
              <div className="h-3 w-32 bg-surface-3 rounded mb-2" />
              <div className="h-3 w-full bg-surface-2 rounded mb-1" />
              <div className="h-3 w-3/4 bg-surface-2 rounded" />
            </div>
            <div>
              <div className="h-3 w-20 bg-surface-3 rounded mb-2" />
              <div className="h-3 w-5/6 bg-surface-2 rounded mb-1" />
              <div className="h-3 w-2/3 bg-surface-2 rounded" />
            </div>
            <div>
              <div className="h-3 w-28 bg-surface-3 rounded mb-2" />
              <div className="h-1.5 w-full bg-surface-2 rounded-full" />
            </div>
          </div>
        )}

        {/* Why this card exists */}
        {tmData && (
          <>
            <section>
              <h4 className="text-[11px] uppercase text-grain-cyan font-mono tracking-widest mb-2">
                Why this card exists
              </h4>
              <p className="text-sm text-text-secondary leading-relaxed">
                {tmData.explanation}
              </p>
            </section>

            {/* Drivers */}
            <section>
              <h4 className="text-[11px] uppercase text-grain-cyan font-mono tracking-widest mb-2">
                Drivers
              </h4>
              <ul className="space-y-1">
                {tmData.drivers.map((d, i) => (
                  <li key={i} className="text-sm text-text-secondary flex items-start gap-2">
                    <span className="text-text-muted mt-0.5">→</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Baseline comparison */}
            {tmData.baseline_comparison && (
              <section>
                <h4 className="text-[11px] uppercase text-grain-cyan font-mono tracking-widest mb-2">
                  Baseline Comparison
                </h4>
                <div className="bg-surface-2 rounded-lg p-3 border border-surface-3/50">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-text-muted">Previous</span>
                    <span className="font-mono text-text-primary">${tmData.baseline_comparison.baseline.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm mt-1">
                    <span className="text-text-muted">Current</span>
                    <span className="font-mono text-text-primary">${tmData.baseline_comparison.current.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-surface-3/50 mt-2 pt-2 flex justify-between items-center text-sm">
                    <span className="text-text-muted">Change</span>
                    <span className={`font-mono font-medium ${
                      tmData.baseline_comparison.change_pct > 0 ? 'text-grain-rose' : 'text-grain-emerald'
                    }`}>
                      {tmData.baseline_comparison.change_pct > 0 ? '+' : ''}{tmData.baseline_comparison.change_pct.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </section>
            )}

            {/* Evidence */}
            {tmData.evidence.length > 0 && (
              <section>
                <h4 className="text-[11px] uppercase text-grain-cyan font-mono tracking-widest mb-2">
                  Evidence ({tmData.evidence.length})
                </h4>
                <div className="space-y-1.5">
                  {tmData.evidence.map((e) => (
                    <div
                      key={e.id}
                      className="bg-surface-2 rounded px-3 py-2 text-xs font-mono text-text-secondary border border-surface-3/50"
                    >
                      <span className="text-text-muted">[{e.evidence_type}]</span>{' '}
                      {e.excerpt}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Confidence */}
            <section>
              <h4 className="text-[11px] uppercase text-grain-cyan font-mono tracking-widest mb-2">
                Confidence
              </h4>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-grain-cyan"
                    style={{ width: `${tmData.event.confidence * 100}%` }}
                  />
                </div>
                <span className={`text-xs font-mono ${
                  tmData.event.confidence >= 0.7 ? 'text-grain-emerald' :
                  tmData.event.confidence >= 0.4 ? 'text-grain-amber' : 'text-text-muted'
                }`}>
                  {(tmData.event.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-xs text-text-muted mt-1">{tmData.confidence_statement}</p>
            </section>
          </>
        )}

        {/* Actions */}
        {card.suggested_actions.length > 0 && (
          <section>
            <h4 className="text-[11px] uppercase text-grain-cyan font-mono tracking-widest mb-2">
              Actions
            </h4>
            <div className="space-y-2">
              {card.suggested_actions.map((action) => (
                <button
                  key={action}
                  onClick={() => handleAction(action)}
                  className="w-full text-left px-3 py-2 rounded-lg bg-surface-2 hover:bg-surface-3 text-sm text-text-secondary transition-colors border border-surface-3/50"
                >
                  {action === 'draft_email' && 'Compose Recall Notice'}
                  {action === 'create_reminder' && 'Schedule Follow-up'}
                  {action === 'mark_ignore' && 'Suppress Pattern'}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Action feedback */}
        {actionFeedback && (
          <div className="bg-grain-emerald/10 border border-grain-emerald/30 rounded-lg p-3 text-sm text-grain-emerald">
            {actionFeedback}
          </div>
        )}
      </div>
    </div>
  );
}
