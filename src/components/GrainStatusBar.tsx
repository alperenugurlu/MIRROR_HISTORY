/**
 * GrainStatusBar — Ambient "your grain is recording" indicator.
 *
 * The always-on feel from the episode. A thin bar showing:
 * - Pulsing cyan dot: "GRAIN ACTIVE"
 * - Live event counter with tick animation
 * - Latest event type scrolling
 * - Time since last recording
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { eventTypeIcon } from '../utils';

interface GrainStatus {
  totalEvents: number;
  lastEventType: string | null;
  lastEventTime: string | null;
  activeSources: number;
}

function formatTimeSince(timestamp: string | null): string {
  if (!timestamp) return 'no recordings';
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function GrainStatusBar() {
  const api = useApi();
  const navigate = useNavigate();
  const [status, setStatus] = useState<GrainStatus>({
    totalEvents: 0,
    lastEventType: null,
    lastEventTime: null,
    activeSources: 0,
  });
  const [tick, setTick] = useState(false);
  const prevTotal = useRef(0);

  // Poll for status updates
  useEffect(() => {
    const fetchStatus = () => {
      api.getTimelineStats()
        .then(stats => {
          const total = stats.totalEvents;
          const types = Object.keys(stats.byType || {});
          const lastType = types.length > 0 ? types[0] : null;

          setStatus({
            totalEvents: total,
            lastEventType: lastType,
            lastEventTime: stats.dateRange?.max || null,
            activeSources: types.length,
          });

          // Trigger tick animation when count changes
          if (total !== prevTotal.current && prevTotal.current > 0) {
            setTick(true);
            setTimeout(() => setTick(false), 600);
          }
          prevTotal.current = total;
        })
        .catch(() => {});
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [api]);

  return (
    <div className="h-6 bg-surface-1/80 border-b border-surface-3/30 flex items-center px-4 gap-4 text-[10px] font-mono shrink-0 select-none data-stream">
      {/* Grain active indicator */}
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-grain-cyan opacity-50" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-grain-cyan" />
        </span>
        <span className="text-grain-cyan uppercase tracking-[0.2em] font-semibold">Recording</span>
      </div>

      {/* Divider */}
      <div className="w-px h-3 bg-surface-3/50" />

      {/* Event counter */}
      <button
        onClick={() => navigate('/recall')}
        className="flex items-center gap-1 text-text-muted hover:text-text-secondary transition-colors"
      >
        <span className={`tabular-nums transition-all ${tick ? 'text-grain-cyan scale-110' : ''}`}>
          {status.totalEvents.toLocaleString()}
        </span>
        <span className="text-text-muted/70">memories</span>
      </button>

      {/* Divider */}
      <div className="w-px h-3 bg-surface-3/50" />

      {/* Active sources */}
      <span className="text-text-muted/70">
        {status.activeSources} streams
      </span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Latest event */}
      {status.lastEventType && (
        <button
          onClick={() => navigate('/recall')}
          className="flex items-center gap-1 text-text-muted hover:text-text-secondary transition-colors"
        >
          <span className="text-xs">{eventTypeIcon(status.lastEventType)}</span>
          <span className="text-text-muted/70">
            Last: {formatTimeSince(status.lastEventTime)}
          </span>
        </button>
      )}
    </div>
  );
}
