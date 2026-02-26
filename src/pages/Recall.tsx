import { useState, useEffect, useRef } from 'react';
import { useApi } from '../hooks/useApi';
import DayDetail from '../components/DayDetail';
import ForensicDrawer from '../components/ForensicDrawer';
import type { TimelineEntry, TimelineStats, EventType } from '../../shared/types';
import { eventTypeIcon, eventTypeLabel, moodEmoji, moodColor, eventTypeColor, formatTime } from '../utils';
import { useGrainVoice } from '../contexts/GrainVoiceContext';

const ALL_TYPES: EventType[] = [
  'money_transaction', 'note', 'voice_memo', 'thought', 'decision',
  'location', 'calendar_event', 'health_entry', 'mood', 'ai_digest',
];

type ZoomLevel = 'day' | 'week' | 'month';

function getDateRange(zoom: ZoomLevel): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  if (zoom === 'day') start.setDate(start.getDate() - 1);
  else if (zoom === 'week') start.setDate(start.getDate() - 7);
  else start.setMonth(start.getMonth() - 1);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function getDayMoodAvg(events: TimelineEntry['events']): number | null {
  const moods = events.filter(e => e.mood).map(e => e.mood!.score);
  if (moods.length === 0) return null;
  return moods.reduce((s, v) => s + v, 0) / moods.length;
}

function moodGlowColor(score: number | null): string {
  if (score === null) return 'rgba(42, 42, 60, 0.5)';
  if (score >= 4) return 'rgba(16, 185, 129, 0.15)';
  if (score >= 3) return 'rgba(245, 158, 11, 0.1)';
  return 'rgba(244, 63, 94, 0.1)';
}

function moodLineColor(score: number | null): string {
  if (score === null) return '#2a2a3c';
  if (score >= 4) return '#10b981';
  if (score >= 3) return '#f59e0b';
  return '#f43f5e';
}

function getEventSummary(event: TimelineEntry['events'][0]): string {
  if (event.transaction) return `${event.transaction.merchant}: $${Math.abs(event.transaction.amount).toFixed(2)}`;
  if (event.note) return event.note.content.slice(0, 80);
  if (event.voice_memo) return event.voice_memo.transcript?.slice(0, 80) || `Voice recording (${event.voice_memo.duration_seconds}s)`;
  if (event.calendar_event) return event.calendar_event.title;
  if (event.health_entry) return `${event.health_entry.metric_type}: ${event.health_entry.value} ${event.health_entry.unit}`;
  if (event.mood) return `Neural state: ${event.mood.score}/5${event.mood.note ? ' — ' + event.mood.note : ''}`;
  if (event.location) return event.location.address || 'Location recorded';
  return event.summary.slice(0, 80);
}

function typeAccentDot(type: string): string {
  switch (type) {
    case 'money_transaction': case 'subscription': case 'price_increase':
    case 'refund_pending': case 'anomaly': return 'bg-grain-cyan';
    case 'note': case 'thought': case 'decision': case 'observation': return 'bg-grain-amber';
    case 'voice_memo': return 'bg-grain-purple';
    case 'location': return 'bg-grain-emerald';
    case 'calendar_event': return 'bg-grain-indigo';
    case 'health_entry': return 'bg-grain-rose';
    case 'mood': return 'bg-grain-amber';
    case 'ai_digest': return 'bg-grain-purple';
    default: return 'bg-surface-3';
  }
}

export default function Recall() {
  const api = useApi();
  const [zoom, setZoom] = useState<ZoomLevel>('week');
  const [activeTypes, setActiveTypes] = useState<Set<EventType>>(new Set(ALL_TYPES));
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [stats, setStats] = useState<TimelineStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<{ date: string; events: TimelineEntry['events'] } | null>(null);
  const [forensicEventId, setForensicEventId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { feedApiData } = useGrainVoice();

  const toggleType = (type: EventType) => {
    setActiveTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  useEffect(() => {
    api.getTimelineStats().then(s => {
      setStats(s);
      feedApiData({ totalMemories: s.totalEvents });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const { start, end } = getDateRange(zoom);
    const types = activeTypes.size === ALL_TYPES.length ? undefined : Array.from(activeTypes);
    api.getEnhancedTimeline(start, end, types)
      .then(setTimeline)
      .catch(() => setTimeline([]))
      .finally(() => setLoading(false));
  }, [zoom, activeTypes]);

  const handleDayNavigate = (date: string) => {
    const group = timeline.find(g => g.date === date);
    if (group) {
      setSelectedDay({ date: group.date, events: group.events });
    } else {
      api.getEnhancedTimeline(date, date)
        .then(tl => {
          if (tl.length > 0) setSelectedDay({ date: tl[0].date, events: tl[0].events });
          else setSelectedDay({ date, events: [] });
        })
        .catch(() => setSelectedDay({ date, events: [] }));
    }
  };

  // Flatten all events with their dates for film strip view
  const allEvents = timeline.flatMap(group =>
    group.events.map(event => ({ ...event, _date: group.date, _dayMood: getDayMoodAvg(group.events) }))
  );

  return (
    <div className="flex flex-col h-full animate-grain-load">
      {/* Fixed Header */}
      <div className="px-6 py-4 border-b border-surface-3/50 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 19 2 12 11 5" />
                <polygon points="22 19 13 12 22 5" />
              </svg>
              <h1 className="text-xs font-mono text-grain-cyan uppercase tracking-widest">Memory Recall</h1>
            </div>
            {stats && (
              <p className="text-xs text-text-muted font-mono">
                {stats.totalEvents.toLocaleString()} memories recorded
                {stats.dateRange && ` · ${stats.dateRange.min} → ${stats.dateRange.max}`}
              </p>
            )}
          </div>

          {/* Recall Depth (time zoom) */}
          <div className="flex bg-surface-1 rounded-lg border border-surface-3/50 p-0.5">
            {(['day', 'week', 'month'] as ZoomLevel[]).map(z => (
              <button
                key={z}
                onClick={() => setZoom(z)}
                className={`px-3 py-1.5 text-xs font-mono rounded-md transition-all ${
                  zoom === z
                    ? 'bg-grain-cyan text-surface-0 shadow-grain'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {z === 'day' ? '24h' : z === 'week' ? '7d' : '30d'}
              </button>
            ))}
          </div>
        </div>

        {/* Memory Type Filters */}
        <div className="flex flex-wrap gap-1.5">
          {ALL_TYPES.map(type => (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                activeTypes.has(type)
                  ? 'bg-grain-cyan/15 text-grain-cyan border border-grain-cyan/30'
                  : 'bg-surface-2 text-text-muted hover:text-text-secondary border border-surface-3/50'
              }`}
            >
              {eventTypeIcon(type)} {eventTypeLabel(type)}
            </button>
          ))}
        </div>
      </div>

      {/* Film Strip Timeline */}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        {loading ? (
          <div className="text-center py-16">
            <div className="w-3 h-3 rounded-full bg-grain-cyan animate-glow-pulse mx-auto mb-3" />
            <div className="text-sm text-text-muted font-mono">Rewinding memories...</div>
          </div>
        ) : allEvents.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-2xl mb-3 opacity-30">{'\u{1F441}\uFE0F'}</div>
            <p className="text-sm text-text-secondary">No memories found for this period.</p>
            <p className="text-xs text-grain-rose/60 mt-2 italic max-w-xs mx-auto leading-relaxed">
              Days without memories are days the grain can't verify. What happened here stays unrecorded — invisible to your future self.
            </p>
          </div>
        ) : (
          <div className="relative px-6 py-4">
            {/* Day groups in the film strip */}
            {timeline.map((group, groupIdx) => {
              const moodAvg = getDayMoodAvg(group.events);
              const lineColor = moodLineColor(moodAvg !== null ? Math.round(moodAvg) : null);
              const glowColor = moodGlowColor(moodAvg !== null ? Math.round(moodAvg) : null);

              return (
                <div key={group.date} className="relative">
                  {/* Day Separator */}
                  <div
                    className="sticky top-0 z-10 flex items-center gap-3 py-2 mb-1"
                    style={{ backgroundColor: 'rgba(15, 15, 23, 0.95)', backdropFilter: 'blur(8px)' }}
                  >
                    {/* Date node */}
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2"
                      style={{ borderColor: lineColor, boxShadow: `0 0 12px ${glowColor}` }}
                    >
                      {moodAvg !== null ? (
                        <span className="text-sm">{moodEmoji(Math.round(moodAvg))}</span>
                      ) : (
                        <span className="text-xs font-mono text-text-muted">
                          {new Date(group.date + 'T12:00:00').getDate()}
                        </span>
                      )}
                    </div>

                    {/* Date label */}
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-text-primary">
                        {formatGroupDate(group.date)}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-text-muted font-mono">
                          {group.events.length} {group.events.length === 1 ? 'memory' : 'memories'}
                        </span>
                        {moodAvg !== null && (
                          <span className="text-xs font-medium" style={{ color: lineColor }}>
                            {moodAvg.toFixed(1)}/5
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Expand day button */}
                    <button
                      onClick={() => setSelectedDay({ date: group.date, events: group.events })}
                      className="text-xs font-mono text-text-muted hover:text-grain-cyan transition-colors px-2 py-1 rounded hover:bg-surface-2"
                    >
                      Expand ›
                    </button>
                  </div>

                  {/* Events in this day — film strip */}
                  <div className="relative ml-5 pl-6 border-l-2" style={{ borderColor: lineColor }}>
                    {group.events.map((event, eventIdx) => (
                      <div
                        key={event.id}
                        className="relative pb-4 group/event cursor-pointer"
                        onClick={() => setSelectedDay({ date: group.date, events: group.events })}
                      >
                        {/* Timeline dot */}
                        <div
                          className={`absolute -left-[31px] top-1 w-3 h-3 rounded-full ${typeAccentDot(event.type)} ring-2 ring-surface-0`}
                        />

                        {/* Event card — the "film frame" */}
                        <div
                          className="rounded-lg p-3 transition-all group-hover/event:border-surface-3"
                          style={{ backgroundColor: glowColor }}
                        >
                          <div className="flex items-start gap-3">
                            {/* Time */}
                            <div className="shrink-0 w-12 text-right">
                              <span className="text-xs font-mono text-text-muted">
                                {event.timestamp.slice(11, 16) || '—'}
                              </span>
                            </div>

                            {/* Icon */}
                            <span className="text-base shrink-0">{eventTypeIcon(event.type)}</span>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-text-primary leading-snug">
                                {getEventSummary(event)}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-text-muted">{eventTypeLabel(event.type)}</span>
                                {event.mood && (
                                  <span className="text-xs" style={{ color: lineColor }}>
                                    {moodEmoji(event.mood.score)} {event.mood.score}/5
                                  </span>
                                )}
                                {event.voice_memo && (
                                  <span className="text-xs text-grain-purple">
                                    {'\uD83C\uDFA4'} {event.voice_memo.duration_seconds}s
                                  </span>
                                )}
                                {event.transaction && (
                                  <span className={`text-xs font-mono ${event.transaction.amount < 0 ? 'text-grain-rose' : 'text-grain-emerald'}`}>
                                    {event.transaction.amount < 0 ? '-' : '+'}${Math.abs(event.transaction.amount).toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Forensic zoom button */}
                            <button
                              onClick={(e) => { e.stopPropagation(); setForensicEventId(event.id); }}
                              className="shrink-0 opacity-0 group-hover/event:opacity-100 transition-opacity p-1 rounded hover:bg-surface-3/50"
                              title="Forensic Zoom"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-grain-cyan">
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                <line x1="11" y1="8" x2="11" y2="14" />
                                <line x1="8" y1="11" x2="14" y2="11" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Spacer between days */}
                  {groupIdx < timeline.length - 1 && (
                    <div className="ml-5 h-4 border-l-2 border-dashed border-surface-3/50" />
                  )}
                </div>
              );
            })}

            {/* End of timeline marker */}
            <div className="flex items-center gap-3 pt-2 ml-0">
              <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center border border-surface-3/50">
                <span className="text-xs font-mono text-text-muted">{'\u23F9'}</span>
              </div>
              <div>
                <span className="text-xs text-text-muted font-mono block">End of recall window</span>
                <span className="text-[10px] text-grain-rose/50 font-mono italic block mt-0.5">
                  The grain has more. It always has more.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Day Detail panel */}
      {selectedDay && (
        <DayDetail
          date={selectedDay.date}
          events={selectedDay.events}
          onClose={() => setSelectedDay(null)}
          onNavigate={handleDayNavigate}
        />
      )}

      {/* Forensic Zoom drawer */}
      {forensicEventId && (
        <ForensicDrawer
          eventId={forensicEventId}
          onClose={() => setForensicEventId(null)}
        />
      )}
    </div>
  );
}

function formatGroupDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}
