import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useGrainVoice } from '../contexts/GrainVoiceContext';
import type { TimelineEntry, TimelineStats, Inconsistency, Confrontation } from '../../shared/types';
import { moodEmoji, eventTypeIcon } from '../utils';
import InconsistencyCard from '../components/InconsistencyCard';
import ConfrontationCard from '../components/ConfrontationCard';
import ForensicDrawer from '../components/ForensicDrawer';
import SetupChecklist from '../components/SetupChecklist';
import { useSetupStatus } from '../hooks/useSetupStatus';

// Tension level calculation
function calculateTension(
  inconsistencies: Inconsistency[],
  confrontations: Confrontation[],
): { level: number; label: string; color: string; bgColor: string; pulseColor: string } {
  const total = inconsistencies.length + confrontations.length;
  const avgSeverity = total > 0
    ? ([...inconsistencies, ...confrontations].reduce((s, f) => s + ('severity' in f ? f.severity : 0), 0) / total)
    : 0;
  const highCount = [...inconsistencies.filter(i => i.severity >= 0.7), ...confrontations.filter(c => c.severity >= 0.7)].length;

  // Score: 0-100
  const score = Math.min(100, Math.round(
    (total * 8) + (avgSeverity * 30) + (highCount * 15)
  ));

  if (score >= 70) return { level: score, label: 'CRITICAL', color: 'text-grain-rose', bgColor: 'bg-grain-rose', pulseColor: 'shadow-[0_0_12px_rgba(244,63,94,0.4)]' };
  if (score >= 40) return { level: score, label: 'ELEVATED', color: 'text-grain-amber', bgColor: 'bg-grain-amber', pulseColor: 'shadow-[0_0_8px_rgba(245,158,11,0.3)]' };
  if (score >= 15) return { level: score, label: 'LOW', color: 'text-grain-cyan', bgColor: 'bg-grain-cyan', pulseColor: '' };
  return { level: score, label: 'CALM', color: 'text-text-muted', bgColor: 'bg-surface-3', pulseColor: '' };
}

export default function Cortex() {
  const api = useApi();
  const navigate = useNavigate();
  const { feedApiData } = useGrainVoice();
  const setupStatus = useSetupStatus();
  const [todayEvents, setTodayEvents] = useState<TimelineEntry['events']>([]);
  const [stats, setStats] = useState<TimelineStats | null>(null);
  const [moodRecording, setMoodRecording] = useState(false);
  const [lastMood, setLastMood] = useState<{ score: number } | null>(null);
  const [highlights, setHighlights] = useState<{
    id: string; type: string; date: string; title: string;
    description: string; icon: string; score: number;
  }[]>([]);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [digests, setDigests] = useState<any[]>([]);
  const [generatingDigest, setGeneratingDigest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [moodTrend, setMoodTrend] = useState<{day: string; avg: number | null}[]>([]);
  const [inconsistencies, setInconsistencies] = useState<Inconsistency[]>([]);
  const [confrontations, setConfrontations] = useState<Confrontation[]>([]);
  const [forensicEventId, setForensicEventId] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    Promise.all([
      api.getEnhancedTimeline(today, today)
        .then(tl => {
          const todayGroup = tl.find(g => g.date === today);
          if (todayGroup) {
            setTodayEvents(todayGroup.events);
            const moods = todayGroup.events.filter(e => e.mood);
            if (moods.length > 0) {
              const latest = moods[moods.length - 1];
              setLastMood({ score: latest.mood!.score });
            }
          }
        })
        .catch(() => {}),
      api.getTimelineStats().then(setStats).catch(() => {}),
      api.getWeeklyHighlights().then(setHighlights).catch(() => {}),
      api.getDailyNarrative(today)
        .then(n => { if (n && n.narrative) setNarrative(n.narrative); })
        .catch(() => {}),
      api.getDigests(3).then(setDigests).catch(() => {}),
      api.getInconsistencies(6).then(setInconsistencies).catch(() => {}),
      api.getConfrontations(5).then(setConfrontations).catch(() => {}),
    ]).finally(() => setLoading(false));

    // Feed data to the grain voice system
    Promise.all([
      api.getInconsistencies(20),
      api.getConfrontations(20),
      api.getTimelineStats(),
    ]).then(([inc, conf, st]) => {
      const highSev = [
        ...inc.filter((i: Inconsistency) => i.severity >= 0.7),
        ...conf.filter((c: Confrontation) => c.severity >= 0.7),
      ];
      feedApiData({
        inconsistencyCount: inc.length,
        confrontationCount: conf.length,
        highSeverityCount: highSev.length,
        todayEventCount: todayEvents.length,
        totalMemories: st.totalEvents,
      });
    }).catch(() => {});

    // Load 7-day mood trend
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 6);
    api.getEnhancedTimeline(weekStart.toISOString().slice(0,10), today)
      .then(tl => {
        const trend: {day: string; avg: number | null}[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().slice(0,10);
          const dayGroup = tl.find(g => g.date === dateStr);
          const moods = dayGroup?.events.filter(e => e.mood).map(e => e.mood!.score) || [];
          trend.push({
            day: d.toLocaleDateString('en-US', {weekday: 'short'}),
            avg: moods.length > 0 ? moods.reduce((a,b) => a+b, 0) / moods.length : null,
          });
        }
        setMoodTrend(trend);
        feedApiData({ moodTrend: trend });
      })
      .catch(() => {});
  }, []);

  const recordMood = async (score: number) => {
    setMoodRecording(true);
    try {
      await api.recordMood(score);
      setLastMood({ score });
    } catch {}
    setMoodRecording(false);
  };

  const handleGenerateDigest = async (period: 'weekly' | 'monthly') => {
    setGeneratingDigest(true);
    try {
      const digest = await api.generateDigest(period);
      setDigests(prev => [digest, ...prev]);
    } catch {}
    setGeneratingDigest(false);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 6) return 'Good night';
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    if (hour < 21) return 'Good evening';
    return 'Good night';
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-3 h-3 rounded-full bg-grain-cyan animate-glow-pulse mx-auto mb-3" />
          <div className="text-text-muted text-sm font-mono">Loading Cortex...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 animate-grain-load">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-grain-cyan animate-glow-pulse" />
          <span className="text-xs font-mono text-grain-cyan uppercase tracking-widest">Grain Active</span>
        </div>
        <div className="flex items-baseline justify-between">
          <h1 className="text-lg font-semibold text-text-primary">
            {getGreeting()}
          </h1>
          <span className="text-xs font-mono text-text-muted uppercase tracking-wider">
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}
            {' | '}
            {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
          </span>
        </div>
      </div>

      {/* ═══ SETUP CHECKLIST — Grain initialization tasks ═══ */}
      <SetupChecklist status={setupStatus} />

      {/* ═══ TENSION METER — How dark is the grain? ═══ */}
      {(inconsistencies.length > 0 || confrontations.length > 0) && (() => {
        const tension = calculateTension(inconsistencies, confrontations);
        return (
          <button
            onClick={() => navigate('/scan')}
            className="grain-card p-3 flex items-center gap-3 group transition-all hover:border-grain-rose/30"
          >
            <div className="relative">
              <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center ${
                tension.label === 'CRITICAL' ? 'border-grain-rose animate-pulse' :
                tension.label === 'ELEVATED' ? 'border-grain-amber' :
                'border-surface-3'
              } ${tension.pulseColor}`}>
                <span className={`text-sm font-mono font-bold ${tension.color}`}>
                  {tension.level}
                </span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-mono uppercase tracking-widest font-bold ${tension.color}`}>
                  Tension: {tension.label}
                </span>
              </div>
              <div className="w-full h-1 bg-surface-2 rounded-full mt-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${tension.bgColor}`}
                  style={{ width: `${tension.level}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-text-muted shrink-0">
              <span>{inconsistencies.length} contradictions</span>
              <span>|</span>
              <span>{confrontations.length} truths</span>
            </div>
          </button>
        );
      })()}

      {/* ═══ NEURAL STATE + 7-DAY TREND — Mood Calibration ═══ */}
      <div className="grain-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs uppercase text-text-muted font-mono tracking-widest">Neural State</div>
          {lastMood && (
            <div className="flex items-center gap-1.5 text-xs text-text-secondary font-mono">
              {moodEmoji(lastMood.score)} {lastMood.score}/5 calibrated
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(score => (
            <button
              key={score}
              onClick={() => recordMood(score)}
              disabled={moodRecording}
              className={`flex-1 py-3 rounded-lg text-xl transition-all ${
                lastMood?.score === score
                  ? 'bg-grain-cyan/20 ring-2 ring-grain-cyan scale-105'
                  : 'bg-surface-2 hover:bg-surface-3 hover:scale-105'
              } disabled:opacity-50`}
            >
              {moodEmoji(score)}
            </button>
          ))}
        </div>

        {/* Inline 7-Day Trend */}
        {moodTrend.length > 0 && moodTrend.some(d => d.avg !== null) && (
          <div className="mt-4 pt-3 border-t border-surface-3/50">
            <div className="text-[10px] uppercase text-text-muted font-mono tracking-widest mb-2">7-Day Trend</div>
            <div className="flex items-end gap-2 h-12">
              {moodTrend.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full relative" style={{height: '32px'}}>
                    {d.avg !== null ? (
                      <div
                        className={`absolute bottom-0 w-full rounded-sm transition-all ${
                          d.avg >= 4 ? 'bg-grain-emerald' : d.avg >= 3 ? 'bg-grain-amber' : 'bg-grain-rose'
                        }`}
                        style={{height: `${(d.avg / 5) * 100}%`}}
                        title={`${d.avg.toFixed(1)}/5`}
                      />
                    ) : (
                      <div className="absolute bottom-0 w-full h-1 rounded-sm bg-surface-3" />
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-text-muted">{d.day.slice(0,2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══ STATS ═══ */}
      <div className="grid grid-cols-3 gap-3">
        <div className="grain-card p-4 border-t-2 border-t-grain-cyan">
          <div className="text-xs uppercase text-text-muted font-mono tracking-widest">Today</div>
          <div className="text-2xl font-semibold text-text-primary mt-1">{todayEvents.length}</div>
          <div className="text-xs text-text-secondary mt-0.5">recordings</div>
        </div>
        <div className="grain-card p-4 border-t-2 border-t-grain-purple">
          <div className="text-xs uppercase text-text-muted font-mono tracking-widest">Total</div>
          <div className="text-2xl font-semibold text-grain-purple mt-1">
            {stats ? stats.totalEvents.toLocaleString() : '\u2014'}
          </div>
          <div className="text-xs text-text-secondary mt-0.5">memories</div>
        </div>
        <div className="grain-card p-4 border-t-2 border-t-grain-amber">
          <div className="text-xs uppercase text-text-muted font-mono tracking-widest">Sources</div>
          <div className="text-2xl font-semibold text-grain-amber mt-1">
            {stats ? Object.keys(stats.byType).length : '\u2014'}
          </div>
          <div className="text-xs text-text-secondary mt-0.5">active feeds</div>
        </div>
      </div>

      {/* ═══ TODAY'S MEMORY STREAM ═══ */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs uppercase text-text-muted font-mono tracking-widest">Today's Memory Stream</h2>
          <button
            onClick={() => navigate('/recall')}
            className="text-xs text-grain-cyan hover:text-grain-cyan-glow transition-colors font-mono flex items-center gap-1"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 19 2 12 11 5" />
              <polygon points="22 19 13 12 22 5" />
            </svg>
            Recall all
          </button>
        </div>
        {todayEvents.length > 0 ? (
          <div className="relative ml-3 pl-5 border-l-2 border-grain-cyan/30 space-y-1">
            {todayEvents.slice(0, 6).map(event => (
              <div key={event.id} className="relative py-2 group">
                {/* Timeline dot */}
                <div className="absolute -left-[23px] top-3 w-2.5 h-2.5 rounded-full bg-grain-cyan ring-2 ring-surface-0" />
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-text-muted w-10 shrink-0">{event.timestamp.slice(11, 16)}</span>
                  <span className="text-base shrink-0">{eventTypeIcon(event.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-text-primary truncate">{event.summary}</div>
                  </div>
                  {event.mood && (
                    <span className="text-sm shrink-0">{moodEmoji(event.mood.score)}</span>
                  )}
                </div>
              </div>
            ))}
            {todayEvents.length > 6 && (
              <button
                onClick={() => navigate('/recall')}
                className="text-xs text-text-muted hover:text-grain-cyan transition-colors font-mono py-2 pl-2"
              >
                +{todayEvents.length - 6} more memories &rarr;
              </button>
            )}
          </div>
        ) : (
          <div className="grain-card p-8 text-center">
            <div className="text-2xl mb-2 opacity-30">&#9210;</div>
            <p className="text-sm text-text-muted">No recordings yet today</p>
            <p className="text-xs text-text-muted mt-1 opacity-60">Your memories will appear here as your day unfolds</p>
          </div>
        )}
      </div>

      {/* ═══ GRAIN DETECTED — Proactive Insights ═══ */}
      {(highlights.length > 0 || narrative) && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-grain-emerald animate-pulse" />
            <h2 className="text-xs uppercase text-grain-emerald font-mono tracking-widest font-semibold">Grain Detected</h2>
          </div>

          {/* AI Daily Brief — what Grain observed today */}
          {narrative && (
            <div className="grain-card p-4 border-l-2 border-l-grain-purple mb-3">
              <div className="flex items-center gap-2 mb-2">
                <span>&#129504;</span>
                <span className="text-xs font-mono uppercase tracking-widest text-grain-purple font-semibold">Today's Analysis</span>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">{narrative}</p>
            </div>
          )}

          {/* Pattern/Moment Detections */}
          {highlights.length > 0 && (
            <div className="space-y-2">
              {highlights.slice(0, 4).map(h => (
                <div key={h.id} className="grain-card px-4 py-3 flex items-center gap-3 group cursor-pointer hover:border-grain-cyan/30 transition-all"
                  onClick={() => navigate('/recall')}
                >
                  <span className="text-xl shrink-0">{h.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text-primary">{h.title}</div>
                    <div className="text-xs text-text-secondary mt-0.5">{h.description}</div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <div
                      className="px-2 py-0.5 rounded-full text-xs font-mono font-semibold"
                      style={{
                        backgroundColor: h.score >= 0.7 ? 'rgba(16, 185, 129, 0.15)' : h.score >= 0.5 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(94, 94, 120, 0.15)',
                        color: h.score >= 0.7 ? '#10b981' : h.score >= 0.5 ? '#f59e0b' : '#b0b0c8',
                      }}
                    >
                      {Math.round(h.score * 100)}%
                    </div>
                    <span className="text-xs text-text-muted font-mono">{h.date}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ INCONSISTENCIES — The grain catches contradictions ═══ */}
      {inconsistencies.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-grain-rose animate-pulse" />
            <h2 className="text-xs uppercase text-grain-rose font-mono tracking-widest font-semibold">Inconsistencies Detected</h2>
            <span className="ml-auto text-[10px] font-mono text-text-muted bg-grain-rose/10 px-2 py-0.5 rounded-full">
              {inconsistencies.length} found
            </span>
          </div>
          <div className="space-y-2">
            {inconsistencies.slice(0, 3).map(inc => (
              <InconsistencyCard
                key={inc.id}
                inconsistency={inc}
                onDrillDown={(i) => {
                  if (i.evidenceEventIds.length > 0) {
                    setForensicEventId(i.evidenceEventIds[0]);
                  }
                }}
              />
            ))}
            {inconsistencies.length > 3 && (
              <button
                onClick={() => navigate('/scan')}
                className="w-full text-center text-xs font-mono text-grain-rose hover:text-grain-rose/80 transition-colors py-2"
              >
                +{inconsistencies.length - 3} more contradictions &rarr;
              </button>
            )}
          </div>
        </div>
      )}

      {/* ═══ CONFRONTATIONS — Uncomfortable Truths ═══ */}
      {confrontations.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-grain-amber animate-pulse" />
            <h2 className="text-xs uppercase text-grain-amber font-mono tracking-widest font-semibold">Uncomfortable Truths</h2>
            <span className="ml-auto text-[10px] font-mono text-text-muted bg-grain-amber/10 px-2 py-0.5 rounded-full">
              {confrontations.length} confrontation{confrontations.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-2">
            {confrontations.slice(0, 3).map(conf => (
              <ConfrontationCard
                key={conf.id}
                confrontation={conf}
                onShowEvidence={(c) => {
                  if (c.relatedEventIds.length > 0) {
                    setForensicEventId(c.relatedEventIds[0]);
                  }
                }}
                onDigDeeper={(c) => {
                  if (c.relatedEventIds.length > 0) {
                    setForensicEventId(c.relatedEventIds[0]);
                  }
                }}
              />
            ))}
            {confrontations.length > 3 && (
              <button
                onClick={() => navigate('/scan')}
                className="w-full text-center text-xs font-mono text-grain-amber hover:text-grain-amber/80 transition-colors py-2"
              >
                +{confrontations.length - 3} more uncomfortable truths &rarr;
              </button>
            )}
          </div>
        </div>
      )}

      {/* ═══ GRAIN DIGESTS ═══ */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs uppercase text-text-muted font-mono tracking-widest">Grain Digests</h2>
          <div className="flex gap-2">
            <button
              onClick={() => handleGenerateDigest('weekly')}
              disabled={generatingDigest}
              className="px-2.5 py-1 rounded text-xs font-mono bg-grain-purple/10 text-grain-purple hover:bg-grain-purple/20 transition-colors disabled:opacity-50"
            >
              Weekly
            </button>
            <button
              onClick={() => handleGenerateDigest('monthly')}
              disabled={generatingDigest}
              className="px-2.5 py-1 rounded text-xs font-mono bg-grain-purple/10 text-grain-purple hover:bg-grain-purple/20 transition-colors disabled:opacity-50"
            >
              Monthly
            </button>
          </div>
        </div>
        {generatingDigest && (
          <div className="grain-card p-4 border-l-2 border-l-grain-purple text-center">
            <div className="text-sm text-text-muted font-mono">Generating digest...</div>
          </div>
        )}
        {digests.length > 0 ? (
          <div className="space-y-3">
            {digests.map((digest, i) => (
              <div key={digest.id || i} className="grain-card p-4 border-l-2 border-l-grain-purple">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono uppercase tracking-widest text-grain-purple">
                    {digest.period} digest
                  </span>
                  {digest.period_start && digest.period_end && (
                    <span className="text-xs font-mono text-text-muted">
                      {digest.period_start} &mdash; {digest.period_end}
                    </span>
                  )}
                </div>
                <p className="text-sm text-text-primary leading-relaxed">
                  {digest.content && digest.content.length > 200
                    ? digest.content.slice(0, 200) + '...'
                    : digest.content}
                </p>
              </div>
            ))}
          </div>
        ) : !generatingDigest ? (
          <div className="grain-card p-6 text-center">
            <p className="text-sm text-text-secondary">No digests yet. Generate your first weekly or monthly summary.</p>
          </div>
        ) : null}
      </div>

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
