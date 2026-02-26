import { useState, useEffect, useRef, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useGrainVoice } from '../contexts/GrainVoiceContext';
import TimeScrubber from '../components/TimeScrubber';
import MomentCard from '../components/MomentCard';
import ForensicDrawer from '../components/ForensicDrawer';
import type { RedoDay, Inconsistency } from '../../shared/types';
import InconsistencyCard from '../components/InconsistencyCard';

type PlaybackSpeed = 0.5 | 1 | 2 | 4;

// Provocative messages for silent hours — the grain questions your silence
const SILENCE_MESSAGES = [
  'The grain was watching. You weren\'t recording.',
  'Hours of silence. What were you hiding?',
  'No trace. No memory. As if this hour never existed.',
  'You were alive here but the grain has nothing. Why?',
  'A gap in the record. The grain notices these things.',
  'Every unrecorded moment is a question without an answer.',
  'The absence of data is itself a data point.',
  'What happened here that you didn\'t want remembered?',
];

// Obsession warnings — escalating as replay count grows
const OBSESSION_WARNINGS: Record<number, string> = {
  3: 'You keep coming back to this hour.',
  4: 'The grain sees you replaying this moment again.',
  5: 'This is the 5th time. What are you looking for?',
  6: 'Obsessive replay detected. Are you sure you want to continue?',
  7: 'You\'re stuck in a loop. The grain has noticed.',
};

function formatDateLabel(date: string): string {
  const d = new Date(date + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function getSilenceMessage(hour: number): string {
  return SILENCE_MESSAGES[hour % SILENCE_MESSAGES.length];
}

export default function Redo() {
  const api = useApi();
  const { incrementReplayCount } = useGrainVoice();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [redoDay, setRedoDay] = useState<RedoDay | null>(null);
  const [selectedHour, setSelectedHour] = useState(12);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [forensicEventId, setForensicEventId] = useState<string | null>(null);
  const [inconsistencies, setInconsistencies] = useState<Inconsistency[]>([]);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const [replayCounts, setReplayCounts] = useState<Record<string, number>>({});
  const [obsessionDismissed, setObsessionDismissed] = useState(false);
  const playTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track hour visits for obsession detection
  const handleHourChange = useCallback((hour: number) => {
    setSelectedHour(hour);
    const key = `${date}-${hour}`;
    setReplayCounts(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
    setObsessionDismissed(false);
    incrementReplayCount();
  }, [date, incrementReplayCount]);

  const currentReplayCount = replayCounts[`${date}-${selectedHour}`] || 0;
  const totalReplays = Object.values(replayCounts).reduce((s, c) => s + c, 0);
  const obsessionMsg = currentReplayCount >= 7
    ? OBSESSION_WARNINGS[7]
    : OBSESSION_WARNINGS[currentReplayCount] || '';

  // Load day data
  useEffect(() => {
    setLoading(true);
    api.getRedoDay(date)
      .then(day => {
        setRedoDay(day);
        const firstActive = day.slices.find(s => s.eventCount > 0);
        if (firstActive) setSelectedHour(firstActive.hour);
      })
      .catch(() => setRedoDay(null))
      .finally(() => setLoading(false));
    api.getInconsistencies(50)
      .then(all => setInconsistencies(all.filter(i => i.date === date)))
      .catch(() => setInconsistencies([]));
  }, [date]);

  // Auto-play with speed control
  const togglePlay = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  useEffect(() => {
    if (isPlaying) {
      const interval = playbackSpeed === 0.5 ? 4000 : 2000 / playbackSpeed;
      playTimerRef.current = setInterval(() => {
        setSelectedHour(h => {
          const next = h + 1;
          if (next >= 24) {
            setIsPlaying(false);
            // Track full-day replay completion
            setReplayCounts(prev => {
              const updated = { ...prev };
              for (let i = 0; i < 24; i++) {
                const key = `${date}-${i}`;
                updated[key] = (updated[key] || 0) + 1;
              }
              return updated;
            });
            return 23;
          }
          return next;
        });
      }, interval);
    }
    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    };
  }, [isPlaying, playbackSpeed, date]);

  // Navigate days
  const goDay = (delta: number) => {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().slice(0, 10));
    setIsPlaying(false);
  };

  const currentSlice = redoDay?.slices[selectedHour];
  const silentHours = redoDay ? redoDay.slices.filter(s => s.eventCount === 0).length : 0;

  return (
    <div className="h-full flex flex-col bg-surface-0 animate-grain-load">
      {/* Obsession Warning Banner */}
      {obsessionMsg && !obsessionDismissed && (
        <div className="px-6 py-2.5 bg-grain-rose/10 border-b border-grain-rose/20 flex items-center gap-3 animate-fade-in">
          <div className="w-2 h-2 rounded-full bg-grain-rose animate-pulse shrink-0" />
          <p className="text-xs text-grain-rose font-mono flex-1">{obsessionMsg}</p>
          <button
            onClick={() => setObsessionDismissed(true)}
            className="text-[10px] font-mono text-grain-rose/60 hover:text-grain-rose transition-colors shrink-0"
          >
            dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="px-6 py-4 border-b border-surface-3/50">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-mono font-semibold text-text-primary tracking-tight flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-grain-cyan">
                <polygon points="11 19 2 12 11 5" />
                <polygon points="22 19 13 12 22 5" />
              </svg>
              RE-DO
            </h1>
            <p className="text-[11px] font-mono text-text-muted uppercase tracking-widest mt-0.5">
              Relive any moment — the grain forgets nothing
            </p>
          </div>

          {/* Day navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => goDay(-1)}
              className="w-8 h-8 rounded-lg bg-surface-2 border border-surface-3 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="bg-surface-2 border border-surface-3 rounded-lg px-3 py-1.5 text-sm font-mono text-text-primary focus:outline-none focus:ring-1 focus:ring-grain-cyan"
            />

            <button
              onClick={() => goDay(1)}
              className="w-8 h-8 rounded-lg bg-surface-2 border border-surface-3 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors"
              disabled={date >= new Date().toISOString().slice(0, 10)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>

        {/* Date label + stats */}
        <div className="flex items-center justify-between mt-3">
          <span className="text-sm text-text-secondary">{formatDateLabel(date)}</span>
          {redoDay && (
            <div className="flex items-center gap-4 text-[11px] font-mono text-text-muted">
              <span>{redoDay.totalEvents} events</span>
              <span>{redoDay.moodArc.length} mood readings</span>
              <span className={silentHours >= 16 ? 'text-grain-rose' : ''}>
                {silentHours}/24 silent hours
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-2">
              <div className="w-6 h-6 border-2 border-grain-cyan border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm font-mono text-text-muted">Reconstructing {date}...</p>
            </div>
          </div>
        ) : !redoDay || redoDay.totalEvents === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3 max-w-xs">
              <div className="text-4xl opacity-20">{'\u{1F441}\uFE0F'}</div>
              <p className="text-sm font-mono text-text-secondary">No memories recorded on this day</p>
              <p className="text-xs text-grain-rose/70 leading-relaxed italic">
                24 hours of your life with zero trace. The grain was active but you left nothing behind.
                What were you doing that you didn't want recorded?
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Moment reconstruction area */}
            <div className="flex-1 overflow-auto px-6 py-4">
              {/* Time indicator */}
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-2 h-2 rounded-full ${
                  currentSlice?.eventCount === 0 ? 'bg-grain-rose/50' : 'bg-grain-cyan'
                } animate-glow-pulse`} />
                <span className={`text-2xl font-mono font-bold ${
                  currentSlice?.eventCount === 0 ? 'text-text-muted' : 'text-grain-cyan'
                }`}>
                  {selectedHour.toString().padStart(2, '0')}:00
                </span>
                <span className="text-sm text-text-muted">
                  {currentSlice?.eventCount === 0
                    ? ''
                    : `— ${currentSlice?.eventCount} event${(currentSlice?.eventCount || 0) > 1 ? 's' : ''}`
                  }
                </span>
                {currentSlice?.dominantType && (
                  <span className="text-[10px] font-mono uppercase tracking-widest text-text-muted bg-surface-2 px-2 py-0.5 rounded-full">
                    {currentSlice.dominantType.replace('_', ' ')}
                  </span>
                )}
                {/* Playback speed indicator */}
                {playbackSpeed !== 1 && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                    playbackSpeed === 0.5 ? 'bg-grain-rose/15 text-grain-rose' : 'bg-grain-cyan/15 text-grain-cyan'
                  }`}>
                    {playbackSpeed === 0.5 ? 'SLOW-MO' : `${playbackSpeed}× FAST`}
                  </span>
                )}
              </div>

              {/* Provocative silence message for empty hours */}
              {currentSlice?.eventCount === 0 && (
                <div className="flex-1 flex items-center justify-center py-8">
                  <div className="text-center space-y-3 max-w-sm">
                    <div className="w-16 h-16 rounded-full bg-grain-rose/5 border border-grain-rose/20 flex items-center justify-center mx-auto">
                      <span className="text-2xl opacity-40">{'\u{1F576}\uFE0F'}</span>
                    </div>
                    <p className="text-sm text-grain-rose/80 font-mono leading-relaxed italic">
                      {getSilenceMessage(selectedHour)}
                    </p>
                    <p className="text-[10px] text-text-muted font-mono">
                      {selectedHour.toString().padStart(2, '0')}:00 — {(selectedHour + 1).toString().padStart(2, '0')}:00 | zero data streams
                    </p>
                  </div>
                </div>
              )}

              {/* Moment data */}
              {currentSlice && currentSlice.eventCount > 0 && (
                <MomentCard
                  snapshot={currentSlice.snapshot}
                  onEventClick={(eventId) => setForensicEventId(eventId)}
                />
              )}

              {/* Inconsistencies for this day */}
              {inconsistencies.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-grain-rose animate-pulse" />
                    <h3 className="text-xs font-mono uppercase tracking-widest text-grain-rose font-semibold">
                      Contradictions Found
                    </h3>
                    <span className="text-[10px] font-mono text-text-muted">{inconsistencies.length}</span>
                  </div>
                  <div className="space-y-2">
                    {inconsistencies.map(inc => (
                      <InconsistencyCard
                        key={inc.id}
                        inconsistency={inc}
                        compact
                        onDrillDown={(i) => {
                          if (i.evidenceEventIds.length > 0) {
                            setForensicEventId(i.evidenceEventIds[0]);
                          }
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Time scrubber — pinned to bottom */}
            <div className="px-6 py-4 border-t border-surface-3/50 bg-surface-0">
              <TimeScrubber
                slices={redoDay.slices}
                selectedHour={selectedHour}
                onHourChange={handleHourChange}
                moodArc={redoDay.moodArc}
                isPlaying={isPlaying}
                onTogglePlay={togglePlay}
                playbackSpeed={playbackSpeed}
                onSpeedChange={setPlaybackSpeed}
                replayCount={totalReplays}
                inconsistencyHours={(() => {
                  const hours: number[] = [];
                  for (const inc of inconsistencies) {
                    const gapMatch = inc.title.match(/(\d{2}):00[–-](\d{2}):00/);
                    if (gapMatch) {
                      const start = parseInt(gapMatch[1], 10);
                      const end = parseInt(gapMatch[2], 10);
                      for (let h = start; h <= end; h++) hours.push(h);
                    } else {
                      hours.push(12);
                    }
                  }
                  return [...new Set(hours)];
                })()}
              />
            </div>
          </>
        )}
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
