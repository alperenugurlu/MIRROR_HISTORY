/**
 * ForensicDrawer — Universal deep-dive drawer.
 *
 * Like Liam zooming into Ffion's expressions. Works for ANY event type.
 * Shows: "Before" → "The Moment" → "After" → "What else was happening"
 * → "Similar moments" → "Dig Deeper" buttons.
 *
 * Integrates with RabbitHoleChain for exploration depth tracking.
 */

import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import RabbitHoleChain from './RabbitHoleChain';
import VisualComparison from './VisualComparison';
import { useGrainVoice } from '../contexts/GrainVoiceContext';
import type { RabbitHoleStep } from './RabbitHoleChain';
import type { ForensicContext, EnrichedEvent, Event, VisualComparisonResult } from '../../shared/types';
import { eventTypeIcon, eventTypeLabel, formatTime, formatCurrency, moodEmoji } from '../utils';

interface ForensicDrawerProps {
  eventId: string;
  onClose: () => void;
}

function EnrichedEventCard({ event, onClick }: { event: EnrichedEvent; onClick: () => void }) {
  const time = formatTime(event.timestamp);

  const getSummary = (): string => {
    if (event.transaction) return `${event.transaction.merchant}: ${formatCurrency(event.transaction.amount)}`;
    if (event.note) return event.note.content.slice(0, 100);
    if (event.voice_memo) return event.voice_memo.transcript?.slice(0, 100) || `Voice (${event.voice_memo.duration_seconds}s)`;
    if (event.calendar_event) return `${event.calendar_event.title}${event.calendar_event.location ? ' @ ' + event.calendar_event.location : ''}`;
    if (event.health_entry) return `${event.health_entry.metric_type}: ${event.health_entry.value} ${event.health_entry.unit}`;
    if (event.mood) return `${moodEmoji(event.mood.score)} ${event.mood.score}/5${event.mood.note ? ' \u2014 ' + event.mood.note : ''}`;
    if (event.location) return event.location.address || `${event.location.lat.toFixed(4)}, ${event.location.lng.toFixed(4)}`;
    return event.summary.slice(0, 100);
  };

  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-start gap-2 px-3 py-2 rounded-lg hover:bg-surface-3/50 transition-colors group"
    >
      <span className="text-sm shrink-0 mt-0.5">{eventTypeIcon(event.type)}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-text-primary leading-snug truncate">{getSummary()}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] font-mono text-text-muted">{time}</span>
          <span className="text-[10px] text-text-muted">{eventTypeLabel(event.type)}</span>
        </div>
      </div>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted group-hover:text-grain-cyan transition-colors mt-1 shrink-0">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}

function SectionHeader({ title, icon, count }: { title: string; icon: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-2 px-1">
      <span className="text-sm">{icon}</span>
      <span className="text-[11px] font-mono uppercase tracking-widest text-text-muted">{title}</span>
      {count !== undefined && (
        <span className="text-[10px] font-mono text-text-muted bg-surface-2 px-1.5 py-0.5 rounded-full ml-auto">
          {count}
        </span>
      )}
    </div>
  );
}

function CenterEventDisplay({ event, enriched }: { event: Event; enriched: ForensicContext }) {
  const time = formatTime(event.timestamp);
  const date = event.timestamp.slice(0, 10);
  const cross = enriched.crossDomain;

  return (
    <div className="rounded-lg border border-grain-cyan/30 bg-grain-cyan/5 p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{eventTypeIcon(event.type)}</span>
        <div className="flex-1 min-w-0">
          <div className="text-base font-medium text-text-primary">{event.summary}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-mono text-grain-cyan">{date} {time}</span>
            <span className="text-xs text-text-muted">{eventTypeLabel(event.type)}</span>
          </div>

          {/* Cross-domain snapshot chips */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {cross.mood && (
              <span className="px-2 py-0.5 rounded-full bg-surface-2 text-xs text-text-secondary">
                {moodEmoji(cross.mood.score)} {cross.mood.score}/5
              </span>
            )}
            {cross.location && (
              <span className="px-2 py-0.5 rounded-full bg-surface-2 text-xs text-text-secondary">
                {'\uD83D\uDCCD'} {cross.location.address || 'Location'}
              </span>
            )}
            {cross.transactions.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-surface-2 text-xs text-text-secondary">
                {'\uD83D\uDCB3'} {cross.transactions.length} transaction{cross.transactions.length > 1 ? 's' : ''}
              </span>
            )}
            {cross.calendarEvents.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-surface-2 text-xs text-text-secondary">
                {'\uD83D\uDCC5'} {cross.calendarEvents.length} event{cross.calendarEvents.length > 1 ? 's' : ''}
              </span>
            )}
            {cross.healthEntries.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-surface-2 text-xs text-text-secondary">
                {'\u2764\uFE0F'} {cross.healthEntries.length} reading{cross.healthEntries.length > 1 ? 's' : ''}
              </span>
            )}
            {cross.notes.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-surface-2 text-xs text-text-secondary">
                {'\uD83D\uDCDD'} {cross.notes.length} note{cross.notes.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Forensic gate messages — "Are you sure you want to know?"
const GATE_MESSAGES = [
  'The deeper you look, the more you see. Are you ready?',
  'Some memories are better left unexamined.',
  'The grain remembers everything. Even the parts you forgot on purpose.',
  'Every forensic dive changes how you see the past.',
  'You can\'t unknow what the grain shows you.',
];

export default function ForensicDrawer({ eventId: initialEventId, onClose }: ForensicDrawerProps) {
  const api = useApi();
  const { pushWhisper } = useGrainVoice();
  const [loading, setLoading] = useState(true);
  const [forensic, setForensic] = useState<ForensicContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const [gateMessage] = useState(() => GATE_MESSAGES[Math.floor(Math.random() * GATE_MESSAGES.length)]);
  const [depthWarningShown, setDepthWarningShown] = useState(false);
  const [visualCompare, setVisualCompare] = useState<VisualComparisonResult | null>(null);
  const [loadingVisual, setLoadingVisual] = useState(false);

  // Rabbit hole state
  const [steps, setSteps] = useState<RabbitHoleStep[]>([]);
  const [currentEventId, setCurrentEventId] = useState(initialEventId);

  const loadForensicContext = useCallback((eventId: string) => {
    setLoading(true);
    setError(null);
    api.getForensicContext(eventId, 30)
      .then(ctx => {
        setForensic(ctx);
      })
      .catch(err => {
        setError(err?.message || 'Failed to load forensic context');
      })
      .finally(() => setLoading(false));
  }, [api]);

  // Load initial context (after gate is opened)
  useEffect(() => {
    if (gateOpen) {
      loadForensicContext(initialEventId);
    }
  }, [initialEventId, gateOpen]);

  // Auto-open gate after brief pause for dramatic effect
  useEffect(() => {
    const timer = setTimeout(() => setGateOpen(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  // When forensic context loads, update rabbit hole steps
  useEffect(() => {
    if (forensic && steps.length === 0) {
      setSteps([{ eventId: forensic.event.id, event: forensic.event }]);
    }
  }, [forensic]);

  // Drill into a different event (rabbit hole)
  const drillInto = (event: EnrichedEvent, question?: string) => {
    const newStep: RabbitHoleStep = { eventId: event.id, event, question };
    setSteps(prev => [...prev, newStep]);
    setCurrentEventId(event.id);
    loadForensicContext(event.id);
    // Show depth warning at 3+ steps
    if (steps.length >= 3 && !depthWarningShown) {
      setDepthWarningShown(true);
    }
    // The grain reacts to deep forensic dives
    if (steps.length === 2) {
      pushWhisper('You\'re going deeper. The grain has no bottom.', 'behavioral', 'suspicious', 'forensic');
    } else if (steps.length >= 4) {
      pushWhisper(`${steps.length + 1} layers deep. Liam would be proud.`, 'confrontational', 'concerned', 'forensic');
    }
  };

  // Navigate back in the rabbit hole
  const goBack = (stepIndex: number) => {
    const targetStep = steps[stepIndex];
    setSteps(prev => prev.slice(0, stepIndex + 1));
    setCurrentEventId(targetStep.eventId);
    loadForensicContext(targetStep.eventId);
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Panel */}
      <div className="relative ml-auto w-full max-w-2xl bg-surface-0 overflow-hidden shadow-2xl border-l border-surface-3 flex flex-col">
        {/* Header */}
        <div className="shrink-0 sticky top-0 bg-surface-0 border-b border-surface-3/50 z-10">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-grain-cyan">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="11" y1="8" x2="11" y2="14" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
              <h2 className="text-sm font-mono font-semibold text-text-primary tracking-tight">FORENSIC ZOOM</h2>
            </div>
            <button
              onClick={onClose}
              className="text-text-muted hover:text-text-primary text-lg transition-colors"
            >
              {'\u2715'}
            </button>
          </div>

          {/* Rabbit hole breadcrumbs */}
          <RabbitHoleChain steps={steps} onGoBack={goBack} />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Confrontation Gate */}
          {!gateOpen ? (
            <div className="flex-1 flex items-center justify-center py-24">
              <div className="text-center space-y-4 max-w-xs animate-fade-in">
                <div className="w-16 h-16 rounded-full border-2 border-grain-rose/30 flex items-center justify-center mx-auto">
                  <div className="w-3 h-3 rounded-full bg-grain-rose animate-pulse" />
                </div>
                <p className="text-sm text-grain-rose/90 italic leading-relaxed font-mono">
                  {gateMessage}
                </p>
                <button
                  onClick={() => setGateOpen(true)}
                  className="text-[10px] font-mono uppercase tracking-widest text-text-muted hover:text-grain-cyan transition-colors"
                >
                  Show me everything
                </button>
              </div>
            </div>
          ) : loading ? (
            <div className="flex-1 flex items-center justify-center py-16">
              <div className="text-center space-y-2">
                <div className="w-6 h-6 border-2 border-grain-cyan border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm font-mono text-text-muted">Zooming in...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center py-16">
              <div className="text-center space-y-2">
                <p className="text-sm text-grain-rose">{error}</p>
                <button
                  onClick={() => loadForensicContext(currentEventId)}
                  className="text-xs text-grain-cyan hover:underline"
                >
                  Try again
                </button>
              </div>
            </div>
          ) : forensic ? (
            <div className="p-4 space-y-6">
              {/* Depth Warning — you're going too deep */}
              {depthWarningShown && steps.length >= 3 && (
                <div className="rounded-lg border border-grain-rose/30 bg-grain-rose/5 p-3 animate-fade-in">
                  <div className="flex items-start gap-2.5">
                    <div className="w-4 h-4 rounded-full bg-grain-rose/20 flex items-center justify-center shrink-0 mt-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-grain-rose animate-pulse" />
                    </div>
                    <div>
                      <span className="text-[9px] font-mono uppercase tracking-widest text-grain-rose font-bold">
                        Rabbit hole depth: {steps.length}
                      </span>
                      <p className="text-xs text-text-secondary mt-0.5 italic">
                        You're {steps.length} levels deep. Each click pulls you further from the surface. The grain has no bottom.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* The Moment — center event */}
              <CenterEventDisplay event={forensic.event} enriched={forensic} />

              {/* Before */}
              {forensic.before.length > 0 && (
                <div>
                  <SectionHeader title="Before" icon={'\u23EA'} count={forensic.before.length} />
                  <div className="space-y-0.5">
                    {forensic.before.slice(0, 8).map(e => (
                      <EnrichedEventCard
                        key={e.id}
                        event={e}
                        onClick={() => drillInto(e, `What led to ${eventTypeLabel(forensic.event.type).toLowerCase()}?`)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* After */}
              {forensic.after.length > 0 && (
                <div>
                  <SectionHeader title="After" icon={'\u23E9'} count={forensic.after.length} />
                  <div className="space-y-0.5">
                    {forensic.after.slice(0, 8).map(e => (
                      <EnrichedEventCard
                        key={e.id}
                        event={e}
                        onClick={() => drillInto(e, `What happened after?`)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Similar Moments */}
              {forensic.similarMoments.length > 0 && (
                <div>
                  <SectionHeader title="Similar Moments" icon={'\uD83D\uDD04'} count={forensic.similarMoments.length} />
                  <div className="space-y-1">
                    {forensic.similarMoments.map((sm, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-2/50"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-text-primary truncate">{sm.summary}</div>
                          <div className="text-[10px] font-mono text-text-muted mt-0.5">{sm.date}</div>
                        </div>
                        <div className="shrink-0">
                          <div
                            className="h-1.5 rounded-full bg-grain-cyan"
                            style={{ width: `${sm.similarity * 60}px` }}
                          />
                          <div className="text-[9px] font-mono text-text-muted text-right mt-0.5">
                            {Math.round(sm.similarity * 100)}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Visual Comparison — the grain compares */}
              {forensic.visualComparison && forensic.visualComparison.similarPhotoPaths.length > 0 && (
                <div>
                  <SectionHeader title="Visual Comparison" icon={'\uD83D\uDCF8'} />
                  <div className="space-y-3">
                    <p className="text-xs text-text-muted px-1">
                      The grain found similar visual memories. Compare them to see what changed.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {forensic.visualComparison.similarPhotoPaths.map((photoPath, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            if (!forensic.visualComparison) return;
                            setLoadingVisual(true);
                            setVisualCompare(null);
                            api.compareImages(forensic.visualComparison.targetPhotoPath, photoPath.path)
                              .then(result => setVisualCompare(result))
                              .catch(() => {/* non-fatal */})
                              .finally(() => setLoadingVisual(false));
                          }}
                          disabled={loadingVisual}
                          className="px-3 py-2 rounded-lg border border-grain-cyan/30 bg-grain-cyan/5 text-[11px] font-mono text-grain-cyan hover:bg-grain-cyan/10 transition-colors disabled:opacity-50"
                        >
                          Compare with memory #{i + 1}
                        </button>
                      ))}
                    </div>
                    {loadingVisual && (
                      <div className="flex items-center gap-2 py-4">
                        <div className="w-4 h-4 border-2 border-grain-cyan border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-mono text-text-muted">The grain is comparing...</span>
                      </div>
                    )}
                    {visualCompare && (
                      <VisualComparison result={visualCompare} />
                    )}
                  </div>
                </div>
              )}

              {/* Dig Deeper — suggested questions */}
              {forensic.suggestedQuestions.length > 0 && (
                <div>
                  <SectionHeader title="Dig Deeper" icon={'\uD83D\uDD73\uFE0F'} />
                  <div className="space-y-1.5">
                    {forensic.suggestedQuestions.map((q, i) => (
                      <div
                        key={i}
                        className="px-3 py-2.5 rounded-lg border border-dashed border-grain-purple/30 bg-grain-purple/5 text-sm text-text-secondary hover:border-grain-purple/50 hover:bg-grain-purple/10 transition-colors cursor-default"
                      >
                        <span className="text-grain-purple mr-1.5">{'\u2022'}</span>
                        {q}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state for before/after */}
              {forensic.before.length === 0 && forensic.after.length === 0 && (
                <div className="text-center py-8">
                  <div className="text-3xl opacity-20 mb-2">{'\uD83D\uDD0D'}</div>
                  <p className="text-sm text-text-muted">No surrounding events found</p>
                  <p className="text-[11px] text-text-muted mt-1">This moment stands alone in the grain</p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
