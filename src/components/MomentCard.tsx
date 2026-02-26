import type { MomentSnapshot } from '../../shared/types';

interface MomentCardProps {
  snapshot: MomentSnapshot;
  onEventClick?: (eventId: string) => void;
}

function getMoodEmoji(score: number): string {
  return ['\u{1F629}', '\u{1F614}', '\u{1F610}', '\u{1F60A}', '\u{1F929}'][score - 1] || '';
}

function getMoodBg(score: number): string {
  if (score >= 4) return 'border-grain-emerald/30 bg-grain-emerald/5';
  if (score >= 3) return 'border-grain-amber/30 bg-grain-amber/5';
  return 'border-grain-rose/30 bg-grain-rose/5';
}

function StreamSection({ title, icon, count, accent, children }: {
  title: string;
  icon: string;
  count: number;
  accent: string;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className="grain-card p-3 animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm">{icon}</span>
        <span className="text-[11px] font-mono uppercase tracking-widest text-text-muted">{title}</span>
        <span
          className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: accent + '20', color: accent }}
        >
          {count}
        </span>
      </div>
      {children}
    </div>
  );
}

export default function MomentCard({ snapshot, onEventClick }: MomentCardProps) {
  const { location, mood, transactions, calendarEvents, healthEntries, notes, voiceMemos } = snapshot;

  const hasData = location || mood || transactions.length || calendarEvents.length ||
    healthEntries.length || notes.length || voiceMemos.length;

  if (!hasData) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted">
        <div className="text-center space-y-2">
          <div className="text-3xl opacity-30">{'\u{1F4AD}'}</div>
          <p className="text-sm font-mono">No data recorded at this moment</p>
          <p className="text-[11px] text-text-muted">The grain has no memory of this time</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-memory-fade">
      {/* Mood — prominent display */}
      {mood && (
        <div className={`rounded-lg border p-4 ${getMoodBg(mood.score)}`}>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{getMoodEmoji(mood.score)}</span>
            <div>
              <div className="text-lg font-mono font-medium text-text-primary">
                {mood.score}/5
              </div>
              {mood.note && (
                <p className="text-sm text-text-secondary mt-0.5">{mood.note}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Location */}
      {location && (
        <StreamSection title="Location" icon={'\u{1F4CD}'} count={1} accent="#10b981">
          <div className="text-sm text-text-primary">{location.address || `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`}</div>
        </StreamSection>
      )}

      {/* Calendar Events */}
      <StreamSection title="Calendar" icon={'\u{1F4C5}'} count={calendarEvents.length} accent="#6366f1">
        <div className="space-y-1.5">
          {calendarEvents.map(ce => (
            <div
              key={ce.id}
              className="flex items-start gap-2 cursor-pointer hover:bg-surface-3/50 rounded px-1 py-0.5 transition-colors"
              onClick={() => onEventClick?.(ce.event_id)}
            >
              <div className="w-1 h-1 rounded-full bg-grain-indigo mt-2 shrink-0" />
              <div>
                <div className="text-sm text-text-primary">{ce.title}</div>
                {ce.location && (
                  <div className="text-[11px] text-text-muted">{ce.location}</div>
                )}
                <div className="text-[10px] font-mono text-text-muted">
                  {ce.start_time.slice(11, 16)} — {ce.end_time.slice(11, 16)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </StreamSection>

      {/* Transactions */}
      <StreamSection title="Spending" icon={'\u{1F4B3}'} count={transactions.length} accent="#f59e0b">
        <div className="space-y-1">
          {transactions.map(tx => (
            <div
              key={tx.id}
              className="flex items-center justify-between cursor-pointer hover:bg-surface-3/50 rounded px-1 py-0.5 transition-colors"
              onClick={() => onEventClick?.(tx.event_id)}
            >
              <span className="text-sm text-text-primary">{tx.merchant}</span>
              <span className={`text-sm font-mono ${tx.amount < 0 ? 'text-grain-rose' : 'text-grain-emerald'}`}>
                {tx.amount < 0 ? '-' : '+'}${Math.abs(tx.amount).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </StreamSection>

      {/* Health */}
      <StreamSection title="Health" icon={'\u{2764}\u{FE0F}'} count={healthEntries.length} accent="#ec4899">
        <div className="grid grid-cols-2 gap-2">
          {healthEntries.map(he => (
            <div key={he.id} className="text-sm">
              <span className="text-text-muted capitalize">{he.metric_type.replace('_', ' ')}: </span>
              <span className="text-text-primary font-mono">{he.value} {he.unit}</span>
            </div>
          ))}
        </div>
      </StreamSection>

      {/* Notes */}
      <StreamSection title="Notes" icon={'\u{1F4DD}'} count={notes.length} accent="#06b6d4">
        <div className="space-y-2">
          {notes.map(n => (
            <div
              key={n.id}
              className="text-sm text-text-secondary border-l-2 border-grain-cyan/30 pl-2 cursor-pointer hover:border-grain-cyan transition-colors"
              onClick={() => onEventClick?.(n.event_id)}
            >
              {n.content.length > 200 ? n.content.slice(0, 200) + '...' : n.content}
            </div>
          ))}
        </div>
      </StreamSection>

      {/* Voice Memos */}
      <StreamSection title="Voice" icon={'\u{1F3A4}'} count={voiceMemos.length} accent="#06b6d4">
        <div className="space-y-2">
          {voiceMemos.map(vm => (
            <div
              key={vm.id}
              className="cursor-pointer hover:bg-surface-3/50 rounded px-1 py-1 transition-colors"
              onClick={() => onEventClick?.(vm.event_id)}
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-grain-cyan/20 flex items-center justify-center">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="text-grain-cyan">
                    <polygon points="5 3 19 12 5 21" />
                  </svg>
                </div>
                <span className="text-[11px] font-mono text-text-muted">
                  {Math.floor(vm.duration_seconds / 60)}:{(vm.duration_seconds % 60).toString().padStart(2, '0')}
                </span>
              </div>
              {vm.transcript && (
                <p className="text-sm text-text-secondary mt-1 italic">
                  "{vm.transcript.length > 150 ? vm.transcript.slice(0, 150) + '...' : vm.transcript}"
                </p>
              )}
            </div>
          ))}
        </div>
      </StreamSection>
    </div>
  );
}
