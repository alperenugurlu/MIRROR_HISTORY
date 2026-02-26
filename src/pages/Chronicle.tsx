import { useState, useEffect, useMemo } from 'react';
import type { ActivityLogEntry } from '../../shared/types';
import { useApi } from '../hooks/useApi';
import { useGrainVoice } from '../contexts/GrainVoiceContext';
import { formatRelativeDate } from '../utils';

const typeAccentColors: Record<string, string> = {
  import: 'border-l-grain-cyan',
  diff_generated: 'border-l-grain-amber',
  rule_created: 'border-l-grain-purple',
  rule_updated: 'border-l-grain-purple',
  rule_deleted: 'border-l-grain-purple',
  action_drafted: 'border-l-grain-emerald',
  action_approved: 'border-l-grain-emerald',
  action_applied: 'border-l-grain-emerald',
  // Dark Grain events
  deep_scan: 'border-l-grain-rose',
  inconsistency_detected: 'border-l-grain-rose',
  inconsistency_dismissed: 'border-l-grain-rose/50',
  confrontation_generated: 'border-l-grain-purple',
  confrontation_acknowledged: 'border-l-grain-purple/50',
  comparison_run: 'border-l-grain-amber',
  // Memory events
  voice_recording: 'border-l-grain-cyan',
  mood_recorded: 'border-l-grain-amber',
  note_created: 'border-l-grain-cyan',
  retention_cleanup: 'border-l-grain-rose',
  data_export: 'border-l-grain-emerald',
};

const typeIcons: Record<string, string> = {
  import: '\u25C8',
  diff_generated: '\u25C7',
  rule_created: '\u25CB',
  rule_updated: '\u25CB',
  rule_deleted: '\u25CB',
  action_drafted: '\u25B9',
  action_approved: '\u25B9',
  action_applied: '\u25B9',
  deep_scan: '\u{1F50D}',
  inconsistency_detected: '\u26A1',
  inconsistency_dismissed: '\u2716',
  confrontation_generated: '\u{1F525}',
  confrontation_acknowledged: '\u2714',
  comparison_run: '\u{1F4CA}',
  voice_recording: '\u{1F3A4}',
  mood_recorded: '\u{1F9E0}',
  note_created: '\u{1F4DD}',
  retention_cleanup: '\u{1F5D1}\uFE0F',
  data_export: '\u{1F4E6}',
};

type FilterCategory = 'all' | 'financial' | 'dark_grain' | 'memory' | 'system';

const filterConfig: { id: FilterCategory; label: string; types: string[] }[] = [
  { id: 'all', label: 'All', types: [] },
  { id: 'financial', label: 'Financial', types: ['import', 'diff_generated', 'rule_created', 'rule_updated', 'rule_deleted', 'action_drafted', 'action_approved', 'action_applied'] },
  { id: 'dark_grain', label: 'Dark Grain', types: ['deep_scan', 'inconsistency_detected', 'inconsistency_dismissed', 'confrontation_generated', 'confrontation_acknowledged', 'comparison_run'] },
  { id: 'memory', label: 'Memory', types: ['voice_recording', 'mood_recorded', 'note_created'] },
  { id: 'system', label: 'System', types: ['retention_cleanup', 'data_export'] },
];

export default function Chronicle() {
  const api = useApi();
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [filter, setFilter] = useState<FilterCategory>('all');
  const { pushWhisper } = useGrainVoice();

  useEffect(() => {
    api.getActivityLog().then(entries => {
      setEntries(entries);
      // The grain reacts to the volume of operations
      if (entries.length > 50) {
        pushWhisper(`${entries.length} operations logged. The grain remembers every one.`, 'ambient', 'watching', 'chronicle');
      }
    });
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return entries;
    const cfg = filterConfig.find(f => f.id === filter);
    if (!cfg) return entries;
    return entries.filter(e => cfg.types.includes(e.entry_type));
  }, [entries, filter]);

  // Group by date
  const grouped = useMemo(() => {
    const groups: Record<string, ActivityLogEntry[]> = {};
    for (const entry of filtered) {
      const date = entry.timestamp.slice(0, 10);
      if (!groups[date]) groups[date] = [];
      groups[date].push(entry);
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 animate-grain-load">
      <div className="mb-4">
        <h1 className="text-[11px] font-mono text-grain-cyan uppercase tracking-widest">System Chronicle</h1>
        <p className="text-xs text-text-muted mt-0.5">
          Immutable record of all grain operations
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 bg-surface-1 rounded-lg p-0.5">
        {filterConfig.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-mono transition-colors ${
              filter === f.id
                ? 'bg-grain-cyan text-surface-0'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {f.label}
            {f.id !== 'all' && entries.filter(e => f.types.includes(e.entry_type)).length > 0 && (
              <span className={`ml-1 text-[9px] ${filter === f.id ? 'text-surface-0/70' : 'text-text-muted/60'}`}>
                {entries.filter(e => f.types.includes(e.entry_type)).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Stats */}
      {entries.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-surface-1 rounded-lg p-2.5 border border-surface-3/50">
            <p className="text-[10px] uppercase text-text-muted font-mono tracking-widest">Total Ops</p>
            <p className="text-lg font-mono font-medium text-text-primary mt-0.5">{entries.length}</p>
          </div>
          <div className="bg-surface-1 rounded-lg p-2.5 border border-surface-3/50">
            <p className="text-[10px] uppercase text-text-muted font-mono tracking-widest">Showing</p>
            <p className="text-lg font-mono font-medium text-grain-cyan mt-0.5">{filtered.length}</p>
          </div>
          <div className="bg-surface-1 rounded-lg p-2.5 border border-surface-3/50">
            <p className="text-[10px] uppercase text-text-muted font-mono tracking-widest">Days</p>
            <p className="text-lg font-mono font-medium text-text-primary mt-0.5">{grouped.length}</p>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-text-secondary">
            {entries.length === 0 ? 'Chronicle is empty' : 'No entries match this filter'}
          </p>
          <p className="text-xs text-text-muted mt-2 max-w-xs mx-auto leading-relaxed">
            {entries.length === 0
              ? 'Begin by ingesting your first memory data.'
              : 'Try a different filter category.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, dayEntries]) => (
            <div key={date}>
              <div className="sticky top-0 bg-surface-0 z-10 py-1.5 mb-1">
                <span className="text-[10px] font-mono uppercase tracking-widest text-text-muted">
                  {formatRelativeDate(date + 'T00:00:00')} &mdash; {date}
                </span>
              </div>
              <div className="space-y-0.5">
                {dayEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className={`flex items-start gap-3 py-2.5 px-3 rounded-lg border-l-2 ${
                      typeAccentColors[entry.entry_type] || 'border-l-surface-3'
                    } hover:bg-surface-1 transition-colors`}
                  >
                    <span className="text-sm mt-0.5 shrink-0 text-text-muted">
                      {typeIcons[entry.entry_type] || '\u2022'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary">{entry.description}</p>
                      <p className="text-xs text-text-muted mt-0.5 font-mono">
                        {entry.timestamp.slice(11, 16)} &mdash; {entry.entry_type.replace(/_/g, ' ')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
