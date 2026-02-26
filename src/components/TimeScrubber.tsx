import { useState, useRef, useEffect, useCallback } from 'react';
import type { HourlySlice, EventType } from '../../shared/types';

type PlaybackSpeed = 0.5 | 1 | 2 | 4;

interface TimeScrubberProps {
  slices: HourlySlice[];
  selectedHour: number;
  onHourChange: (hour: number) => void;
  moodArc: { hour: number; score: number }[];
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  inconsistencyHours?: number[];
  playbackSpeed?: PlaybackSpeed;
  onSpeedChange?: (speed: PlaybackSpeed) => void;
  replayCount?: number;
}

const typeColors: Record<string, string> = {
  money_transaction: '#f59e0b',
  location: '#10b981',
  calendar_event: '#6366f1',
  health_entry: '#ec4899',
  mood: '#a855f7',
  note: '#06b6d4',
  voice_memo: '#06b6d4',
  thought: '#06b6d4',
  decision: '#06b6d4',
};

function getMoodColor(score: number): string {
  if (score >= 4) return '#10b981';
  if (score >= 3) return '#f59e0b';
  return '#f43f5e';
}

const SPEEDS: PlaybackSpeed[] = [0.5, 1, 2, 4];

export default function TimeScrubber({
  slices,
  selectedHour,
  onHourChange,
  moodArc,
  isPlaying = false,
  onTogglePlay,
  inconsistencyHours = [],
  playbackSpeed = 1,
  onSpeedChange,
  replayCount = 0,
}: TimeScrubberProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const maxEvents = Math.max(1, ...slices.map(s => s.eventCount));

  const handleTrackClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const hour = Math.floor((x / rect.width) * 24);
    onHourChange(Math.max(0, Math.min(23, hour)));
  }, [onHourChange]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const hour = Math.floor((x / rect.width) * 24);
    onHourChange(Math.max(0, Math.min(23, hour)));
  }, [isDragging, onHourChange]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Build mood line path
  const moodMap = new Map(moodArc.map(m => [m.hour, m.score]));

  return (
    <div className="w-full select-none">
      {/* Mood arc line */}
      <div className="h-8 relative mb-1">
        <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 24 5">
          {moodArc.length > 1 && (
            <polyline
              fill="none"
              stroke="#a855f7"
              strokeWidth="0.15"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.6"
              points={moodArc.map(m => `${m.hour + 0.5},${5 - m.score}`).join(' ')}
            />
          )}
          {moodArc.map(m => (
            <circle
              key={m.hour}
              cx={m.hour + 0.5}
              cy={5 - m.score}
              r="0.2"
              fill={getMoodColor(m.score)}
            />
          ))}
        </svg>
      </div>

      {/* Main track */}
      <div
        ref={trackRef}
        className="relative h-12 bg-surface-2 rounded-lg cursor-pointer border border-surface-3 overflow-hidden"
        onClick={handleTrackClick}
        onMouseDown={() => setIsDragging(true)}
      >
        {/* Event density bars */}
        <div className="absolute inset-0 flex">
          {slices.map((slice) => {
            const height = slice.eventCount > 0
              ? Math.max(15, (slice.eventCount / maxEvents) * 100)
              : 0;
            const color = slice.dominantType
              ? typeColors[slice.dominantType] || '#06b6d4'
              : '#06b6d4';

            return (
              <div
                key={slice.hour}
                className="flex-1 flex items-end justify-center relative"
              >
                {slice.eventCount > 0 && (
                  <div
                    className="w-[60%] rounded-t transition-all duration-150"
                    style={{
                      height: `${height}%`,
                      backgroundColor: color,
                      opacity: slice.hour === selectedHour ? 0.9 : 0.35,
                    }}
                  />
                )}
                {inconsistencyHours.includes(slice.hour) && (
                  <div className="absolute top-0.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-grain-rose animate-pulse z-10" title="Inconsistency detected" />
                )}
              </div>
            );
          })}
        </div>

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-grain-cyan shadow-grain transition-all duration-100 z-10"
          style={{ left: `${((selectedHour + 0.5) / 24) * 100}%` }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-grain-cyan rounded-full shadow-grain-lg" />
        </div>
      </div>

      {/* Hour labels */}
      <div className="flex justify-between mt-1 px-0.5">
        {[0, 3, 6, 9, 12, 15, 18, 21].map(h => (
          <span
            key={h}
            className={`text-[10px] font-mono ${
              h === selectedHour ? 'text-grain-cyan' : 'text-text-muted'
            }`}
          >
            {h.toString().padStart(2, '0')}
          </span>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          {/* Play/Pause button */}
          {onTogglePlay && (
            <button
              onClick={onTogglePlay}
              className="w-8 h-8 rounded-full bg-surface-2 border border-surface-3 flex items-center justify-center text-grain-cyan hover:bg-surface-3 transition-colors"
            >
              {isPlaying ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21" />
                </svg>
              )}
            </button>
          )}

          {/* Speed Control */}
          {onSpeedChange && (
            <div className="flex items-center bg-surface-2 rounded-lg border border-surface-3 overflow-hidden">
              {SPEEDS.map(s => (
                <button
                  key={s}
                  onClick={() => onSpeedChange(s)}
                  className={`px-2 py-1 text-[10px] font-mono transition-colors ${
                    playbackSpeed === s
                      ? s === 0.5 ? 'bg-grain-rose/20 text-grain-rose' : 'bg-grain-cyan/20 text-grain-cyan'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {s === 0.5 ? '½×' : `${s}×`}
                </button>
              ))}
            </div>
          )}

          {/* Current time display */}
          <span className="text-sm font-mono text-grain-cyan font-medium">
            {selectedHour.toString().padStart(2, '0')}:00
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Replay counter — obsession tracking */}
          {replayCount > 0 && (
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono ${
              replayCount >= 5 ? 'bg-grain-rose/15 text-grain-rose' :
              replayCount >= 3 ? 'bg-grain-amber/15 text-grain-amber' :
              'bg-surface-2 text-text-muted'
            }`}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
              {replayCount}× replayed
            </div>
          )}

          {/* Event count at selected hour */}
          <div className="text-[11px] font-mono text-text-muted">
            {slices[selectedHour]?.eventCount || 0} events
            {moodMap.has(selectedHour) && (
              <span className="ml-2" style={{ color: getMoodColor(moodMap.get(selectedHour)!) }}>
                mood {moodMap.get(selectedHour)}/5
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
