import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import TimelineEvent from './TimelineEvent';
import type { TimelineEntry, DailyNarrative } from '../../shared/types';
import { moodColor, moodEmoji, eventTypeIcon, eventTypeLabel } from '../utils';
import { useGrainVoice } from '../contexts/GrainVoiceContext';

interface DayDetailProps {
  date: string;
  events: TimelineEntry['events'];
  onClose: () => void;
  onNavigate: (date: string) => void;
}

export default function DayDetail({ date, events, onClose, onNavigate }: DayDetailProps) {
  const api = useApi();
  const navigate = useNavigate();
  const { pushWhisper } = useGrainVoice();
  const [narrative, setNarrative] = useState<DailyNarrative | null>(null);
  const [loadingNarrative, setLoadingNarrative] = useState(false);

  // Calculate mood average for the day
  const moodEvents = events.filter(e => e.mood);
  const moodAvg = moodEvents.length > 0
    ? moodEvents.reduce((s, e) => s + (e.mood?.score || 0), 0) / moodEvents.length
    : null;

  // Group events by hour
  const byHour = new Map<number, typeof events>();
  for (const event of events) {
    const hour = parseInt(event.timestamp.slice(11, 13) || '0', 10);
    if (!byHour.has(hour)) byHour.set(hour, []);
    byHour.get(hour)!.push(event);
  }
  const sortedHours = [...byHour.entries()].sort((a, b) => a[0] - b[0]);

  // Count event types
  const typeCounts = new Map<string, number>();
  for (const e of events) {
    typeCounts.set(e.type, (typeCounts.get(e.type) || 0) + 1);
  }
  const typeBreakdown = [...typeCounts.entries()].sort((a, b) => b[1] - a[1]);

  // Load AI narrative
  const loadNarrative = () => {
    setLoadingNarrative(true);
    api.getDailyNarrative(date)
      .then(setNarrative)
      .catch(() => {})
      .finally(() => setLoadingNarrative(false));
  };

  // Auto-load narrative on open
  useEffect(() => {
    if (!narrative && !loadingNarrative) {
      loadNarrative();
    }
  }, [date]);

  // Navigation
  const navCount = useRef(0);
  const prevDay = () => {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    navCount.current++;
    if (navCount.current === 5) {
      pushWhisper('Scrubbing through days. What are you looking for?', 'behavioral', 'suspicious', 'recall');
    }
    onNavigate(d.toISOString().slice(0, 10));
  };

  const nextDay = () => {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    navCount.current++;
    if (navCount.current === 5) {
      pushWhisper('Scrubbing through days. What are you looking for?', 'behavioral', 'suspicious', 'recall');
    }
    onNavigate(d.toISOString().slice(0, 10));
  };

  const formatDate = (d: string) => {
    const dt = new Date(d + 'T12:00:00');
    return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Panel */}
      <div className="relative ml-auto w-full max-w-2xl bg-surface-0 overflow-y-auto shadow-2xl border-l border-surface-3">
        {/* Header */}
        <div className="sticky top-0 bg-surface-0 border-b border-surface-3/50 p-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={prevDay} className="text-text-muted hover:text-text-primary text-lg">{'\u2190'}</button>
              <div>
                <h2 className="text-base font-semibold text-text-primary">{formatDate(date)}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-text-muted">{events.length} events</span>
                  {moodAvg !== null && (
                    <>
                      <span className="text-text-muted">{'\u2022'}</span>
                      <span className={`text-xs font-medium`}>
                        {moodEmoji(Math.round(moodAvg))} {moodAvg.toFixed(1)}/5
                      </span>
                    </>
                  )}
                </div>
              </div>
              <button onClick={nextDay} className="text-text-muted hover:text-text-primary text-lg">{'\u2192'}</button>
            </div>
            <button onClick={onClose} className="text-text-muted hover:text-text-primary text-xl">{'\u2715'}</button>
          </div>

          {/* Mood bar */}
          <div className={`mt-3 h-1.5 rounded-full ${moodColor(moodAvg !== null ? Math.round(moodAvg) : null)}`} />
        </div>

        {/* Type breakdown chips */}
        <div className="px-4 pt-4 flex flex-wrap gap-1.5">
          {typeBreakdown.map(([type, count]) => (
            <span key={type} className="px-2 py-0.5 rounded-full bg-surface-2 text-xs text-text-secondary">
              {eventTypeIcon(type)} {eventTypeLabel(type)} ({count})
            </span>
          ))}
        </div>

        {/* AI Narrative */}
        <div className="px-4 pt-4">
          {narrative ? (
            <div className="grain-card border-l-2 border-grain-purple rounded-lg p-4">
              <div className="text-[11px] uppercase text-text-muted font-mono tracking-widest mb-1.5">{'\u{1F9E0}'} Neural Memory</div>
              <p className="text-sm text-text-secondary leading-relaxed">{narrative.narrative}</p>
            </div>
          ) : (
            <button
              onClick={loadNarrative}
              disabled={loadingNarrative}
              className="w-full py-3 rounded-lg border border-dashed border-grain-purple/30 text-grain-purple text-xs hover:bg-grain-purple/10 transition-colors disabled:opacity-50"
            >
              {loadingNarrative ? 'Generating narrative...' : '\u{1F9E0} Generate AI narrative for this day'}
            </button>
          )}

          {/* Cross-page: Consult Oracle */}
          <button
            onClick={() => {
              onClose();
              navigate('/oracle');
            }}
            className="mt-2 w-full py-2 rounded-lg text-xs text-grain-purple hover:bg-grain-purple/10 transition-colors flex items-center justify-center gap-1.5"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Consult Oracle
          </button>
        </div>

        {/* Hourly timeline */}
        <div className="px-4 py-4 space-y-4">
          {sortedHours.length > 0 ? (
            sortedHours.map(([hour, hourEvents]) => (
              <div key={hour}>
                {/* Hour header */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono text-grain-cyan w-12">
                    {hour.toString().padStart(2, '0')}:00
                  </span>
                  <div className="flex-1 h-px bg-surface-3/50" />
                </div>
                {/* Events in this hour */}
                <div className="space-y-2 ml-14">
                  {hourEvents.map(event => (
                    <TimelineEvent key={event.id} event={event} dayMoodAvg={moodAvg} />
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-sm text-text-muted">
              No events with timestamps for this day.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
