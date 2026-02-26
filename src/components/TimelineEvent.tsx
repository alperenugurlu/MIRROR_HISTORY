import { useState } from 'react';
import type { Event, Note, VoiceMemo, MoneyTransaction, Location, CalendarEvent, HealthEntry, MoodEntry, PhotoRecord, PhotoAnalysis, Video, VideoFrame } from '../../shared/types';
import { eventTypeIcon, eventTypeLabel, formatCurrency, moodEmoji } from '../utils';
import AudioPlayer from './AudioPlayer';
import PhotoViewer from './PhotoViewer';
import VideoPlayer from './VideoPlayer';

export type EnrichedEvent = Event & {
  note?: Note;
  voice_memo?: VoiceMemo;
  transaction?: MoneyTransaction;
  location?: Location;
  calendar_event?: CalendarEvent;
  health_entry?: HealthEntry;
  mood?: MoodEntry;
  photo?: PhotoRecord & { analysis?: PhotoAnalysis };
  video?: Video & { frames?: VideoFrame[] };
};

// Grain accent palette for event types
function grainBorderColor(type: string): string {
  switch (type) {
    case 'financial': return 'border-grain-cyan';
    case 'note': return 'border-grain-amber';
    case 'voice': return 'border-grain-purple';
    case 'location': return 'border-grain-emerald';
    case 'calendar': return 'border-grain-indigo';
    case 'health': return 'border-grain-rose';
    case 'mood': return 'border-grain-amber';
    case 'digest': return 'border-grain-cyan';
    case 'photo': return 'border-grain-cyan';
    case 'video': return 'border-grain-cyan';
    default: return 'border-grain-cyan';
  }
}

function getSourceBadge(event: any): { icon: string; label: string } | null {
  const source = event.note?.source || event.health_entry?.source || event.voice_memo?.source || event.photo?.source || event.video?.source || null;
  if (!source) return null;
  switch (source) {
    case 'telegram': return { icon: '📱', label: 'Telegram' };
    case 'manual': return { icon: '✏️', label: 'Manual' };
    case 'csv_import': return { icon: '📄', label: 'CSV' };
    case 'apple_health': return { icon: '🏃', label: 'Health' };
    case 'voice_transcription': return { icon: '🎤', label: 'Voice' };
    case 'api': return { icon: '🔗', label: 'API' };
    default: return { icon: '📌', label: source };
  }
}

export default function TimelineEvent({ event, dayMoodAvg }: { event: EnrichedEvent; dayMoodAvg?: number | null }) {
  const [expanded, setExpanded] = useState(false);
  const icon = eventTypeIcon(event.type);
  const borderColor = grainBorderColor(event.type);
  const label = eventTypeLabel(event.type);
  const time = event.timestamp.slice(11, 16) || '';

  return (
    <div
      className={`border-l-3 ${borderColor} bg-surface-2 rounded-r-lg transition-all cursor-pointer hover:bg-surface-3/50 ${
        expanded ? 'p-4' : 'p-3'
      }`}
      onClick={() => setExpanded(prev => !prev)}
    >
      {/* Header row */}
      <div className="flex gap-3 items-start">
        <span className="text-lg leading-none mt-0.5">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase text-text-muted font-mono tracking-widest">{label}</span>
            {(() => {
              const badge = getSourceBadge(event);
              return badge ? (
                <span className="text-[11px] text-text-muted ml-1" title={badge.label}>
                  {badge.icon}
                </span>
              ) : null;
            })()}
            {time && <span className="text-xs text-text-muted font-mono">{time}</span>}
            {/* Mood indicator badge */}
            {dayMoodAvg !== undefined && dayMoodAvg !== null && event.type !== 'mood' && (
              <span className="text-xs text-text-muted ml-auto">{moodEmoji(Math.round(dayMoodAvg))}</span>
            )}
            {/* Expand indicator */}
            <span className={`text-xs text-grain-cyan transition-transform ${expanded ? 'rotate-180' : ''} ${dayMoodAvg !== undefined && dayMoodAvg !== null && event.type !== 'mood' ? '' : 'ml-auto'}`}>
              {'\u25BE'}
            </span>
          </div>
          <div className="text-sm text-text-primary mt-0.5">{renderSummary(event)}</div>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-surface-3/50 space-y-2" onClick={e => e.stopPropagation()}>
          {renderExpanded(event)}
        </div>
      )}
    </div>
  );
}

function renderSummary(event: EnrichedEvent): string {
  if (event.transaction) {
    return `${event.transaction.merchant}: ${formatCurrency(event.transaction.amount)}`;
  }
  if (event.note) {
    const content = event.note.content;
    return content.length > 120 ? content.slice(0, 120) + '...' : content;
  }
  if (event.voice_memo) {
    const t = event.voice_memo.transcript;
    return t ? (t.length > 120 ? t.slice(0, 120) + '...' : t) : `Voice memo (${event.voice_memo.duration_seconds}s)`;
  }
  if (event.calendar_event) {
    const ce = event.calendar_event;
    return `${ce.title}${ce.location ? ' @ ' + ce.location : ''}`;
  }
  if (event.health_entry) {
    const he = event.health_entry;
    return `${he.metric_type}: ${he.value.toLocaleString()} ${he.unit}`;
  }
  if (event.mood) {
    const mEmoji = ['\u{2796}', '\u{1F629}', '\u{1F614}', '\u{1F610}', '\u{1F60A}', '\u{1F929}'];
    return `${mEmoji[event.mood.score]} ${event.mood.score}/5${event.mood.note ? ' \u2014 ' + event.mood.note : ''}`;
  }
  if (event.location) {
    return event.location.address || `${event.location.lat.toFixed(4)}, ${event.location.lng.toFixed(4)}`;
  }
  if (event.photo) {
    return event.photo.analysis?.description || event.photo.caption || 'Visual memory captured';
  }
  if (event.video) {
    const dur = Math.round(event.video.duration_seconds);
    return event.video.summary
      ? (event.video.summary.length > 100 ? event.video.summary.slice(0, 100) + '...' : event.video.summary)
      : `Video memory (${dur}s)`;
  }
  return event.summary;
}

function renderExpanded(event: EnrichedEvent) {
  if (event.transaction) {
    const t = event.transaction;
    return (
      <div className="text-xs text-text-secondary space-y-1">
        <Row label="Merchant" value={t.merchant} />
        <Row label="Amount" value={formatCurrency(t.amount)} />
        {t.category && <Row label="Category" value={t.category} />}
        {t.account && <Row label="Account" value={t.account} />}
        <Row label="Date" value={t.date} />
      </div>
    );
  }

  if (event.note) {
    return (
      <div className="text-xs text-text-secondary space-y-1">
        <p className="whitespace-pre-wrap">{event.note.content}</p>
        <div className="text-xs text-text-muted mt-1">
          Source: {event.note.source} {event.note.tags !== '[]' && `\u2022 Tags: ${event.note.tags}`}
        </div>
      </div>
    );
  }

  if (event.voice_memo) {
    return (
      <div className="space-y-2">
        {/* Audio player */}
        {event.voice_memo.file_path && (
          <AudioPlayer
            filePath={event.voice_memo.file_path}
            duration={event.voice_memo.duration_seconds}
          />
        )}
        {/* Full transcript */}
        {event.voice_memo.transcript && (
          <div className="text-xs text-text-secondary">
            <div className="text-[11px] uppercase text-text-muted font-mono tracking-widest mb-1">Transcript</div>
            <p className="whitespace-pre-wrap italic">&ldquo;{event.voice_memo.transcript}&rdquo;</p>
          </div>
        )}
        <div className="text-xs text-text-muted">
          Duration: {event.voice_memo.duration_seconds}s {'\u2022'} Source: {event.voice_memo.source}
        </div>
      </div>
    );
  }

  if (event.calendar_event) {
    const ce = event.calendar_event;
    return (
      <div className="text-xs text-text-secondary space-y-1">
        <Row label="Event" value={ce.title} />
        <Row label="Start" value={ce.start_time} />
        <Row label="End" value={ce.end_time} />
        {ce.location && <Row label="Location" value={ce.location} />}
        {ce.description && <p className="text-text-muted mt-1">{ce.description}</p>}
      </div>
    );
  }

  if (event.health_entry) {
    const he = event.health_entry;
    return (
      <div className="text-xs text-text-secondary space-y-1">
        <Row label="Metric" value={he.metric_type} />
        <Row label="Value" value={`${he.value.toLocaleString()} ${he.unit}`} />
        <Row label="Source" value={he.source} />
      </div>
    );
  }

  if (event.mood) {
    const m = event.mood;
    const bars = Array.from({ length: 5 }, (_, i) => (
      <div
        key={i}
        className={`h-4 w-3 rounded-sm ${i < m.score ? 'bg-grain-amber' : 'bg-surface-3'}`}
      />
    ));
    return (
      <div className="text-xs text-text-secondary space-y-2">
        <div className="flex items-center gap-1">{bars} <span className="ml-2 text-text-muted">{m.score}/5</span></div>
        {m.note && <p>{m.note}</p>}
      </div>
    );
  }

  if (event.location) {
    const loc = event.location;
    return (
      <div className="text-xs text-text-secondary space-y-1">
        {loc.address && <Row label="Address" value={loc.address} />}
        <Row label="Coordinates" value={`${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)}`} />
        <Row label="Source" value={loc.source} />
      </div>
    );
  }

  if (event.photo) {
    return <PhotoViewer photo={event.photo} inline />;
  }

  if (event.video) {
    return <VideoPlayer video={event.video} inline />;
  }

  // Fallback: show event summary and details
  return (
    <div className="text-xs text-text-secondary">
      <p>{event.summary}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-text-muted shrink-0 w-16">{label}</span>
      <span className="text-text-primary">{value}</span>
    </div>
  );
}
