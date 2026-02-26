import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useGrainVoice } from '../contexts/GrainVoiceContext';
import VisualComparison from '../components/VisualComparison';
import type { ComparisonResult, MetricChange, VisualComparisonResult } from '../../shared/types';

const domainConfig: Record<string, { icon: string; color: string; barColor: string }> = {
  mood: { icon: '🧠', color: 'text-grain-purple', barColor: 'bg-grain-purple' },
  spending: { icon: '💸', color: 'text-grain-amber', barColor: 'bg-grain-amber' },
  health: { icon: '🏃', color: 'text-grain-emerald', barColor: 'bg-grain-emerald' },
  calendar: { icon: '📅', color: 'text-grain-cyan', barColor: 'bg-grain-cyan' },
  notes: { icon: '📝', color: 'text-grain-cyan', barColor: 'bg-grain-cyan' },
  locations: { icon: '📍', color: 'text-grain-rose', barColor: 'bg-grain-rose' },
  visual: { icon: '📷', color: 'text-grain-cyan', barColor: 'bg-grain-cyan' },
};

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ChangeIndicator({ change }: { change: MetricChange }) {
  const arrow = change.direction === 'up' ? '↑' : change.direction === 'down' ? '↓' : '→';
  const color = change.direction === 'stable'
    ? 'text-text-muted'
    : change.domain === 'mood' || change.domain === 'health'
      ? change.direction === 'up' ? 'text-grain-emerald' : 'text-grain-rose'
      : change.domain === 'spending'
        ? change.direction === 'up' ? 'text-grain-rose' : 'text-grain-emerald'
        : change.direction === 'up' ? 'text-grain-cyan' : 'text-grain-amber';

  return (
    <span className={`text-xs font-mono font-bold ${color}`}>
      {arrow} {change.changePct > 0 ? '+' : ''}{change.changePct.toFixed(1)}%
    </span>
  );
}

function formatValue(metric: string, value: number): string {
  if (metric.toLowerCase().includes('mood') && !metric.toLowerCase().includes('entries')) {
    return `${value.toFixed(1)}/5`;
  }
  if (metric.toLowerCase().includes('spending') || metric.toLowerCase().includes('daily average')) {
    return `$${value.toFixed(0)}`;
  }
  if (metric.toLowerCase().includes('sleep')) {
    return `${value.toFixed(1)}h`;
  }
  if (metric.toLowerCase().includes('steps')) {
    return value.toLocaleString();
  }
  if (metric.toLowerCase().includes('per day')) {
    return value.toFixed(1);
  }
  return value.toFixed(0);
}

/** Horizontal comparison bar for a single metric */
function MetricBar({ change, barColor }: { change: MetricChange; barColor: string }) {
  const max = Math.max(change.p1, change.p2, 0.01);
  const p1Pct = (change.p1 / max) * 100;
  const p2Pct = (change.p2 / max) * 100;

  return (
    <div className="flex gap-2 items-center mt-1.5">
      <div className="flex-1 flex items-center gap-1.5">
        <span className="text-[9px] font-mono text-text-muted w-6 text-right shrink-0">P1</span>
        <div className="flex-1 h-2 bg-surface-2 rounded-full overflow-hidden">
          <div className={`h-full rounded-full opacity-40 ${barColor} compare-bar-fill`} style={{ width: `${p1Pct}%` }} />
        </div>
      </div>
      <div className="flex-1 flex items-center gap-1.5">
        <span className="text-[9px] font-mono text-text-primary w-6 text-right shrink-0">P2</span>
        <div className="flex-1 h-2 bg-surface-2 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${barColor} compare-bar-fill`} style={{ width: `${p2Pct}%` }} />
        </div>
      </div>
    </div>
  );
}

/* ─── Demo Visual Gallery Data ──────────────────────────────────────────── */

const UNS = 'https://images.unsplash.com';

interface DemoPhoto {
  url: string;          // real Unsplash image
  bg: string;           // gradient fallback
  label: string;
  mood: string;
  date: string;
  people: number;
}

const DEMO_P1_PHOTOS: DemoPhoto[] = [
  { url: `${UNS}/photo-1524231757912-21f4fe3a7200?w=500&h=375&fit=crop&auto=format&q=80`, bg: 'from-orange-400 via-rose-400 to-purple-600', label: 'Bosphorus Sunset', mood: 'serene', date: 'Feb 12', people: 0 },
  { url: `${UNS}/photo-1529543544282-7c478294b928?w=200&h=200&fit=crop&auto=format&q=75`, bg: 'from-pink-400 via-rose-500 to-red-600', label: 'Valentine Dinner', mood: 'romantic', date: 'Feb 14', people: 2 },
  { url: `${UNS}/photo-1441974231531-c6227db76b6e?w=200&h=200&fit=crop&auto=format&q=75`, bg: 'from-emerald-400 via-green-500 to-teal-600', label: 'Bebek Park Walk', mood: 'calm', date: 'Feb 13', people: 1 },
  { url: `${UNS}/photo-1509042239860-f550ce710b93?w=200&h=200&fit=crop&auto=format&q=75`, bg: 'from-amber-300 via-orange-400 to-red-500', label: 'Cafe Session', mood: 'content', date: 'Feb 15', people: 1 },
  { url: `${UNS}/photo-1461749280684-dccba630e2f6?w=200&h=200&fit=crop&auto=format&q=75`, bg: 'from-indigo-800 via-blue-900 to-slate-900', label: 'Late Night Code', mood: 'focused', date: 'Feb 16', people: 1 },
  { url: `${UNS}/photo-1559128010-7c1ad6e1b6a5?w=200&h=200&fit=crop&auto=format&q=75`, bg: 'from-cyan-300 via-blue-400 to-indigo-500', label: 'Ferry Crossing', mood: 'peaceful', date: 'Feb 17', people: 0 },
];

const DEMO_P2_PHOTOS: DemoPhoto[] = [
  { url: `${UNS}/photo-1497366216548-37526070297c?w=500&h=375&fit=crop&auto=format&q=80`, bg: 'from-slate-500 via-gray-600 to-zinc-700', label: 'Office Morning', mood: 'neutral', date: 'Feb 19', people: 0 },
  { url: `${UNS}/photo-1529156069898-49953e39b3ac?w=200&h=200&fit=crop&auto=format&q=75`, bg: 'from-yellow-400 via-amber-500 to-orange-600', label: 'Team Celebration', mood: 'joyful', date: 'Feb 20', people: 5 },
  { url: `${UNS}/photo-1514888286974-6c03e2ca1dba?w=200&h=200&fit=crop&auto=format&q=75`, bg: 'from-violet-400 via-purple-500 to-fuchsia-600', label: 'Street Cat', mood: 'amused', date: 'Feb 22', people: 0 },
  { url: `${UNS}/photo-1530103862676-de8c9debad1d?w=200&h=200&fit=crop&auto=format&q=75`, bg: 'from-rose-400 via-pink-500 to-red-500', label: 'Birthday Party', mood: 'celebratory', date: 'Feb 23', people: 6 },
  { url: `${UNS}/photo-1571019613454-1cb2f99b2d8b?w=200&h=200&fit=crop&auto=format&q=75`, bg: 'from-teal-400 via-cyan-500 to-sky-600', label: 'Morning Jog', mood: 'energetic', date: 'Feb 21', people: 1 },
  { url: `${UNS}/photo-1456513080510-7bf3a84b82f8?w=200&h=200&fit=crop&auto=format&q=75`, bg: 'from-stone-500 via-zinc-600 to-neutral-700', label: 'Reading Night', mood: 'contemplative', date: 'Feb 24', people: 1 },
];

const MOOD_PILL_COLORS: Record<string, string> = {
  romantic: 'bg-pink-500', serene: 'bg-blue-400', calm: 'bg-emerald-400',
  content: 'bg-amber-400', focused: 'bg-indigo-500', peaceful: 'bg-cyan-400',
  neutral: 'bg-gray-400', joyful: 'bg-yellow-400', amused: 'bg-purple-400',
  celebratory: 'bg-rose-400', energetic: 'bg-teal-400', contemplative: 'bg-stone-400',
};

/* ─── Black Mirror Psychological Analysis ───────────────────────────────── */

const DEMO_VISUAL_ANALYSIS = {
  similarityScore: 38,
  summary: 'You replaced intimacy with performance. The grain tracked 6 visual memories from Period 1: candlelit dinners, solitary walks, a ferry ride at golden hour \u2014 all centered on a single companion who appears in 4 of 6 frames. Period 2 contains 6 captures but not a single frame includes that person. You filled the void with group events, forced smiles, and artificial lighting. The grain doesn\'t judge, but it notices: your pupils dilate in the older photos. In the newer ones, they don\'t.',
  changes: [
    { icon: '🎭', desc: 'Micro-expression scan: genuine Duchenne smile detected in 5/6 P1 frames (83%) collapsed to 1/6 in P2 (17%). Social smiling frequency increased 340% \u2014 zygomatic major engaged but orbicularis oculi inactive. You\'re performing happiness.', sig: 'major' as const },
    { icon: '👤', desc: 'A person appearing in 4 of 6 Period 1 frames is entirely absent from Period 2. Their removal restructured your visual signature \u2014 framing, posture, gaze direction all shifted to compensate for the empty space they left.', sig: 'major' as const },
    { icon: '🌡', desc: 'Environment color temperature dropped from ~3200K (warm, intimate) to ~5600K (harsh daylight / fluorescent). Your spaces became clinically bright. The grain reads this as a shift from vulnerability to exposure avoidance.', sig: 'notable' as const },
    { icon: '👥', desc: 'Average human presence per frame: 0.8 \u2192 3.4 (+325%). You surrounded yourself with groups exactly when solitude would have revealed the most. Classic compensatory social behavior \u2014 filling silence with noise.', sig: 'notable' as const },
    { icon: '🧍', desc: 'Posture analysis: open body language (uncrossed arms, forward lean, exposed torso) in P1 shifted to guarded positioning in 4/6 P2 frames \u2014 crossed arms, elevated shoulders, reduced interpersonal distance tolerance.', sig: 'minor' as const },
    { icon: '👁', desc: 'Direct camera gaze dropped from 100% to 33%. In group photos your eyes scan the room periphery rather than engaging the lens. The grain reads this as hypervigilance \u2014 or deliberate emotional avoidance.', sig: 'minor' as const },
  ],
  physicalTags: ['Emotional masking detected', 'Duchenne smile absent', 'Pupil constriction pattern', 'Guarded posture shift'],
  envTags: ['Warm \u2192 Clinical lighting', 'Intimate \u2192 Public exposure', 'Compensatory social behavior', 'Absence pattern: 1 person removed'],
  grainQuestions: [
    'Who was removed from your visual field between these periods?',
    'Were you performing happiness for the group, or for the grain?',
    'The absence of that person correlates with a 2.1-point mood inflation in your self-reports. Which version was honest?',
  ],
};

/** Mini photo card with real image + gradient fallback */
function DemoPhotoCard({ photo, delay }: { photo: DemoPhoto; delay: number }) {
  return (
    <div
      className="relative aspect-square rounded-lg overflow-hidden group cursor-pointer photo-reveal"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Gradient fallback */}
      <div className={`absolute inset-0 bg-gradient-to-br ${photo.bg}`} />
      {/* Real photo */}
      <img
        src={photo.url}
        alt={photo.label}
        className="absolute inset-0 w-full h-full object-cover"
        loading="lazy"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
      {/* CRT scanlines */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.06]"
        style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,255,0.15) 2px, rgba(0,255,255,0.15) 4px)' }}
      />
      {/* Bottom overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm px-1.5 py-0.5">
        <div className="text-[7px] text-white/90 font-medium truncate">{photo.label}</div>
        <div className="flex items-center gap-1">
          <div className={`w-1 h-1 rounded-full ${MOOD_PILL_COLORS[photo.mood] || 'bg-gray-400'}`} />
          <span className="text-[6px] text-white/50 capitalize">{photo.mood}</span>
          {photo.people > 0 && <span className="text-[6px] text-white/40 ml-auto">👤{photo.people}</span>}
        </div>
      </div>
    </div>
  );
}

/** Hero photo with real image, face detection frame, and scan line */
function HeroPhoto({ photo }: { photo: DemoPhoto }) {
  return (
    <div className={`relative aspect-[4/3] rounded-lg overflow-hidden bg-gradient-to-br ${photo.bg}`}>
      {/* Real photo */}
      <img
        src={photo.url}
        alt={photo.label}
        className="absolute inset-0 w-full h-full object-cover"
        loading="eager"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
      {/* Face detection frame */}
      <div className="absolute top-[18%] left-[22%] w-[56%] h-[52%] detection-frame">
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-grain-cyan/60 rounded-tl-sm" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-grain-cyan/60 rounded-tr-sm" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-grain-cyan/60 rounded-bl-sm" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-grain-cyan/60 rounded-br-sm" />
      </div>
      {/* Scanning line */}
      <div className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-grain-cyan/50 to-transparent photo-scan-line" />
      {/* CRT scanlines */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.06]"
        style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,255,0.12) 2px, rgba(0,255,255,0.12) 4px)' }}
      />
      {/* Bottom info bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm px-3 py-2">
        <div className="text-xs text-white/90 font-medium">{photo.label}</div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <div className={`w-2 h-2 rounded-full ${MOOD_PILL_COLORS[photo.mood] || 'bg-gray-400'}`} />
          <span className="text-[10px] text-white/60 capitalize">{photo.mood}</span>
          <span className="text-[10px] text-white/40">· {photo.date}</span>
          {photo.people > 0 && <span className="text-[10px] text-white/40 ml-auto">👤 {photo.people}</span>}
        </div>
      </div>
    </div>
  );
}

/** Mood distribution bar for a period */
function MoodDistBar({ label, distribution }: { label: string; distribution: Record<string, number> }) {
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const entries = Object.entries(distribution).sort((a, b) => b[1] - a[1]);
  return (
    <div className="space-y-1">
      <div className="text-[9px] font-mono text-text-muted uppercase tracking-wider">{label}</div>
      <div className="flex h-2.5 rounded-full overflow-hidden gap-px">
        {entries.map(([mood, count]) => (
          <div
            key={mood}
            className={`h-full rounded-full ${MOOD_PILL_COLORS[mood] || 'bg-gray-400'} compare-bar-fill`}
            style={{ width: `${(count / total) * 100}%`, animationDelay: '200ms' }}
            title={`${mood}: ${count}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-2.5 gap-y-0.5">
        {entries.map(([mood, count]) => (
          <div key={mood} className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${MOOD_PILL_COLORS[mood] || 'bg-gray-400'}`} />
            <span className="text-[9px] text-text-muted capitalize">{mood} ({count})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Main Compare Page ─────────────────────────────────────────────────── */

export default function Compare() {
  const api = useApi();
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [visualCompare, setVisualCompare] = useState<VisualComparisonResult | null>(null);
  const { pushWhisper } = useGrainVoice();

  // Date range state
  const today = new Date().toISOString().slice(0, 10);
  const [p1Start, setP1Start] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 14); return d.toISOString().slice(0, 10);
  });
  const [p1End, setP1End] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 8); return d.toISOString().slice(0, 10);
  });
  const [p2Start, setP2Start] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10);
  });
  const [p2End, setP2End] = useState(today);

  const handleCompare = async () => {
    setLoading(true);
    setVisualCompare(null);
    try {
      const data = await api.comparePeriods(p1Start, p1End, p2Start, p2End);
      setResult(data);
      const bigChanges = data.changes.filter(c => Math.abs(c.changePct) > 30);
      if (bigChanges.length >= 3) {
        pushWhisper('Significant shifts detected. The grain wonders \u2014 improvement or decline?', 'provocative', 'suspicious', 'compare');
      }

      // Auto-fetch visual comparison (production mode — real photos)
      try {
        const vizData = await api.comparePhotoSets(p1Start, p1End, p2Start, p2End);
        if (vizData?.comparison) setVisualCompare(vizData.comparison);
      } catch {} // silently fail — demo gallery will show instead
    } catch {}
    setLoading(false);
  };

  const applyPreset = (preset: 'week' | 'month' | 'quarter') => {
    const now = new Date();
    const e2 = now.toISOString().slice(0, 10);
    let s2: string, e1: string, s1: string;

    if (preset === 'week') {
      const ws2 = new Date(now); ws2.setDate(ws2.getDate() - 7);
      s2 = ws2.toISOString().slice(0, 10);
      const we1 = new Date(ws2); we1.setDate(we1.getDate() - 1);
      e1 = we1.toISOString().slice(0, 10);
      const ws1 = new Date(we1); ws1.setDate(ws1.getDate() - 6);
      s1 = ws1.toISOString().slice(0, 10);
    } else if (preset === 'month') {
      const ms2 = new Date(now); ms2.setMonth(ms2.getMonth() - 1);
      s2 = ms2.toISOString().slice(0, 10);
      const me1 = new Date(ms2); me1.setDate(me1.getDate() - 1);
      e1 = me1.toISOString().slice(0, 10);
      const ms1 = new Date(me1); ms1.setMonth(ms1.getMonth() - 1);
      s1 = ms1.toISOString().slice(0, 10);
    } else {
      const qs2 = new Date(now); qs2.setMonth(qs2.getMonth() - 3);
      s2 = qs2.toISOString().slice(0, 10);
      const qe1 = new Date(qs2); qe1.setDate(qe1.getDate() - 1);
      e1 = qe1.toISOString().slice(0, 10);
      const qs1 = new Date(qe1); qs1.setMonth(qs1.getMonth() - 3);
      s1 = qs1.toISOString().slice(0, 10);
    }

    setP1Start(s1);
    setP1End(e1);
    setP2Start(s2);
    setP2End(e2);
  };

  // Group changes by domain
  const grouped = result
    ? result.changes.reduce((acc, c) => {
        if (!acc[c.domain]) acc[c.domain] = [];
        acc[c.domain].push(c);
        return acc;
      }, {} as Record<string, MetricChange[]>)
    : {};

  // Summary counts
  const improved = result ? result.changes.filter(c => {
    if (c.direction === 'stable') return false;
    if (c.domain === 'spending') return c.direction === 'down';
    return c.direction === 'up';
  }).length : 0;
  const declined = result ? result.changes.filter(c => {
    if (c.direction === 'stable') return false;
    if (c.domain === 'spending') return c.direction === 'up';
    return c.direction === 'down';
  }).length : 0;
  const stable = result ? result.changes.filter(c => c.direction === 'stable').length : 0;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 animate-grain-load">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-grain-amber animate-glow-pulse" />
          <span className="text-xs font-mono text-grain-amber uppercase tracking-widest">Compare</span>
        </div>
        <h1 className="text-lg font-semibold text-text-primary">Before & After</h1>
        <p className="text-xs text-text-muted mt-1">See how your life changed between two periods. Every metric, side by side.</p>
      </div>

      {/* Presets */}
      <div className="flex gap-2">
        {(['week', 'month', 'quarter'] as const).map(p => (
          <button
            key={p}
            onClick={() => applyPreset(p)}
            className="px-3 py-1.5 rounded text-xs font-mono bg-surface-2 text-text-secondary hover:bg-surface-3 hover:text-grain-amber transition-colors capitalize"
          >
            This {p} vs last
          </button>
        ))}
      </div>

      {/* Period Selectors */}
      <div className="grid grid-cols-2 gap-4">
        <div className="grain-card p-4">
          <div className="text-[10px] font-mono uppercase tracking-widest text-text-muted mb-2">Period 1 (Before)</div>
          <div className="flex gap-2">
            <input type="date" value={p1Start} onChange={e => setP1Start(e.target.value)}
              className="flex-1 bg-surface-2 text-text-primary text-xs font-mono rounded px-2 py-1.5 border border-surface-3 focus:border-grain-amber/50 focus:outline-none" />
            <input type="date" value={p1End} onChange={e => setP1End(e.target.value)}
              className="flex-1 bg-surface-2 text-text-primary text-xs font-mono rounded px-2 py-1.5 border border-surface-3 focus:border-grain-amber/50 focus:outline-none" />
          </div>
        </div>
        <div className="grain-card p-4">
          <div className="text-[10px] font-mono uppercase tracking-widest text-text-muted mb-2">Period 2 (After)</div>
          <div className="flex gap-2">
            <input type="date" value={p2Start} onChange={e => setP2Start(e.target.value)}
              className="flex-1 bg-surface-2 text-text-primary text-xs font-mono rounded px-2 py-1.5 border border-surface-3 focus:border-grain-amber/50 focus:outline-none" />
            <input type="date" value={p2End} onChange={e => setP2End(e.target.value)}
              className="flex-1 bg-surface-2 text-text-primary text-xs font-mono rounded px-2 py-1.5 border border-surface-3 focus:border-grain-amber/50 focus:outline-none" />
          </div>
        </div>
      </div>

      {/* Compare button */}
      <button
        onClick={handleCompare}
        disabled={loading}
        className="w-full py-2.5 rounded-lg bg-grain-amber text-surface-0 text-sm font-mono font-semibold hover:bg-grain-amber/90 transition-colors disabled:opacity-50"
      >
        {loading ? 'Analyzing...' : 'Compare Periods'}
      </button>

      {/* Pre-comparison guidance */}
      {!result && !loading && (
        <div className="grain-card p-8 text-center space-y-3">
          <div className="text-3xl opacity-15">{'\u2696\uFE0F'}</div>
          <p className="text-sm text-text-secondary font-mono italic leading-relaxed max-w-lg mx-auto">
            Select two periods and the grain will measure the distance
            between who you were and who you became.
          </p>
          <p className="text-xs text-text-muted leading-relaxed max-w-md mx-auto">
            The more data sources connected, the deeper the comparison.
            Financial patterns, mood shifts, location changes, visual memories
            &mdash; everything laid bare, side by side.
          </p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary header */}
          <div className="flex items-center justify-between">
            <div className="text-xs font-mono text-text-muted">
              {formatDate(result.period1.start)} — {formatDate(result.period1.end)}
            </div>
            <span className="text-xs font-mono text-grain-amber">vs</span>
            <div className="text-xs font-mono text-text-muted">
              {formatDate(result.period2.start)} — {formatDate(result.period2.end)}
            </div>
          </div>

          {/* Summary stats cards */}
          {result.changes.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div className="grain-card p-4 border-t-2 border-t-grain-emerald">
                <div className="text-[10px] font-mono uppercase tracking-widest text-grain-emerald mb-1">Improved</div>
                <div className="text-2xl font-bold text-grain-emerald">{improved}</div>
                <div className="text-[10px] text-text-muted">metrics trending better</div>
              </div>
              <div className="grain-card p-4 border-t-2 border-t-grain-rose">
                <div className="text-[10px] font-mono uppercase tracking-widest text-grain-rose mb-1">Declined</div>
                <div className="text-2xl font-bold text-grain-rose">{declined}</div>
                <div className="text-[10px] text-text-muted">metrics trending worse</div>
              </div>
              <div className="grain-card p-4 border-t-2 border-t-text-muted">
                <div className="text-[10px] font-mono uppercase tracking-widest text-text-muted mb-1">Stable</div>
                <div className="text-2xl font-bold text-text-secondary">{stable}</div>
                <div className="text-[10px] text-text-muted">metrics unchanged</div>
              </div>
            </div>
          )}

          {/* Domain cards with bar visualizations */}
          {Object.entries(grouped).map(([domain, changes]) => {
            const cfg = domainConfig[domain] || { icon: '📊', color: 'text-grain-cyan', barColor: 'bg-grain-cyan' };
            const domainAvgChange = changes.reduce((s, c) => s + c.changePct, 0) / changes.length;
            const domainDirection = Math.abs(domainAvgChange) < 5 ? 'stable' : domainAvgChange > 0 ? 'up' : 'down';
            const trendColor = domainDirection === 'stable' ? 'bg-surface-3 text-text-muted'
              : (domain === 'spending'
                  ? (domainDirection === 'up' ? 'bg-grain-rose/10 text-grain-rose' : 'bg-grain-emerald/10 text-grain-emerald')
                  : (domainDirection === 'up' ? 'bg-grain-emerald/10 text-grain-emerald' : 'bg-grain-rose/10 text-grain-rose'));
            const trendLabel = domainDirection === 'stable' ? 'Stable'
              : (domain === 'spending'
                  ? (domainDirection === 'up' ? 'Increased' : 'Decreased')
                  : (domainDirection === 'up' ? 'Improved' : 'Declined'));

            return (
              <div key={domain} className="grain-card overflow-hidden">
                <div className="px-4 py-3 border-b border-surface-3/50 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{cfg.icon}</span>
                    <span className={`text-xs font-mono uppercase tracking-widest font-semibold ${cfg.color}`}>{domain}</span>
                  </div>
                  <span className={`text-[10px] font-mono px-2.5 py-1 rounded-full font-semibold ${trendColor}`}>
                    {trendLabel} {domainDirection !== 'stable' ? `${domainAvgChange > 0 ? '+' : ''}${domainAvgChange.toFixed(0)}%` : ''}
                  </span>
                </div>

                <div className="divide-y divide-surface-3/30">
                  {changes.map((c, i) => (
                    <div key={i} className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-text-secondary font-medium">{c.metric}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-text-muted">{formatValue(c.metric, c.p1)}</span>
                          <ChangeIndicator change={c} />
                          <span className="text-xs font-mono text-text-primary font-medium">{formatValue(c.metric, c.p2)}</span>
                        </div>
                      </div>
                      <MetricBar change={c} barColor={cfg.barColor} />
                    </div>
                  ))}
                </div>

                {/* Top Merchants for spending domain */}
                {domain === 'spending' && result.period1.metrics.spending.topMerchants.length > 0 && (
                  <div className="px-4 py-3 border-t border-surface-3/50 bg-surface-1/50">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-text-muted mb-2">Top Merchants</div>
                    <div className="space-y-1.5">
                      {result.period1.metrics.spending.topMerchants.slice(0, 5).map((m, i) => {
                        const p2Match = result.period2.metrics.spending.topMerchants.find(
                          t => t.name.toLowerCase() === m.name.toLowerCase()
                        );
                        const p2Total = p2Match?.total || 0;
                        const mMax = Math.max(m.total, p2Total, 0.01);
                        const chg = m.total > 0 ? ((p2Total - m.total) / m.total * 100) : 0;
                        return (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-[10px] text-text-secondary w-28 truncate">{m.name}</span>
                            <div className="flex-1 flex gap-1">
                              <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-grain-amber/40 compare-bar-fill" style={{ width: `${(m.total / mMax) * 100}%` }} />
                              </div>
                              <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-grain-amber compare-bar-fill" style={{ width: `${(p2Total / mMax) * 100}%` }} />
                              </div>
                            </div>
                            <span className="text-[10px] font-mono text-text-muted w-14 text-right">${m.total.toFixed(0)}</span>
                            <span className="text-[10px] font-mono text-text-muted">→</span>
                            <span className="text-[10px] font-mono text-text-primary w-14 text-right">${p2Total.toFixed(0)}</span>
                            {chg !== 0 && (
                              <span className={`text-[9px] font-mono font-bold ${chg > 0 ? 'text-grain-rose' : 'text-grain-emerald'}`}>
                                {chg > 0 ? '+' : ''}{chg.toFixed(0)}%
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* ═══ Visual Memory Gallery ═══ */}
          {result.period1.metrics.visual && result.period2.metrics.visual &&
           (result.period1.metrics.visual.photoCount > 0 || result.period2.metrics.visual.photoCount > 0) && (
            <div className="grain-card overflow-hidden">
              {/* Gallery Header */}
              <div className="px-4 py-2.5 border-b border-surface-3/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">👁</span>
                  <span className="text-xs font-mono uppercase tracking-widest font-semibold text-grain-cyan">
                    Visual Memory Comparison
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono">
                  <span className="px-1.5 py-0.5 rounded bg-surface-2 text-text-muted">{DEMO_P1_PHOTOS.length} captures</span>
                  <span className="text-grain-rose">→</span>
                  <span className="px-1.5 py-0.5 rounded bg-surface-2 text-text-primary">{DEMO_P2_PHOTOS.length} captures</span>
                </div>
              </div>

              {/* Real photos from production — OR — demo gallery */}
              {visualCompare ? (
                <div className="p-4">
                  <VisualComparison result={visualCompare} />
                </div>
              ) : (
                <>
                  {/* Before / After Photo Grid */}
                  <div className="grid grid-cols-2 divide-x divide-surface-3/30">
                    {/* Period 1 — Before */}
                    <div className="p-4 space-y-2.5">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-text-muted">Before</div>
                      <HeroPhoto photo={DEMO_P1_PHOTOS[0]} />
                      <div className="grid grid-cols-5 gap-1.5">
                        {DEMO_P1_PHOTOS.slice(1).map((p, i) => (
                          <DemoPhotoCard key={i} photo={p} delay={i * 80 + 200} />
                        ))}
                      </div>
                    </div>

                    {/* Period 2 — After */}
                    <div className="p-4 space-y-2.5">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-text-muted">After</div>
                      <HeroPhoto photo={DEMO_P2_PHOTOS[0]} />
                      <div className="grid grid-cols-5 gap-1.5">
                        {DEMO_P2_PHOTOS.slice(1).map((p, i) => (
                          <DemoPhotoCard key={i} photo={p} delay={i * 80 + 400} />
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Mood Distribution */}
              {result.period1.metrics.visual.moodDistribution && result.period2.metrics.visual.moodDistribution && (
                <div className="px-4 py-3 border-t border-surface-3/30 grid grid-cols-2 gap-6">
                  <MoodDistBar label="Period 1 — Mood Spectrum" distribution={result.period1.metrics.visual.moodDistribution} />
                  <MoodDistBar label="Period 2 — Mood Spectrum" distribution={result.period2.metrics.visual.moodDistribution} />
                </div>
              )}

              {/* Mood Shift */}
              {result.period1.metrics.visual.dominantMood !== result.period2.metrics.visual.dominantMood && (
                <div className="px-4 py-2.5 border-t border-surface-3/30 flex items-center gap-3">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-text-muted">Dominant mood:</span>
                  <span className="px-2 py-0.5 rounded bg-surface-2 text-xs font-medium capitalize text-text-primary">
                    {result.period1.metrics.visual.dominantMood}
                  </span>
                  <span className="text-grain-rose">→</span>
                  <span className="px-2 py-0.5 rounded bg-surface-2 text-xs font-medium capitalize text-text-primary">
                    {result.period2.metrics.visual.dominantMood}
                  </span>
                </div>
              )}

              {/* AI Visual Analysis — Psychological Depth */}
              <div className="border-t border-surface-3/30">
                {/* Similarity Score */}
                <div className="px-4 py-3 flex items-center gap-3">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-text-muted shrink-0">Similarity</span>
                  <div className="flex-1 h-2.5 bg-surface-2 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-grain-cyan to-grain-rose compare-bar-fill"
                      style={{ width: `${DEMO_VISUAL_ANALYSIS.similarityScore}%`, animationDelay: '600ms' }}
                    />
                  </div>
                  <span className="text-sm text-text-secondary font-mono font-bold">{DEMO_VISUAL_ANALYSIS.similarityScore}%</span>
                </div>

                {/* Detected Changes */}
                <div className="px-4 py-3 border-t border-surface-3/30 space-y-1.5">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-text-muted mb-2">Grain Visual Forensics</div>
                  {DEMO_VISUAL_ANALYSIS.changes.map((c, i) => {
                    const sigStyle = c.sig === 'major'
                      ? 'bg-grain-rose/10 text-grain-rose border border-grain-rose/20'
                      : c.sig === 'notable'
                        ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20'
                        : 'bg-grain-cyan/10 text-grain-cyan border border-grain-cyan/20';
                    return (
                      <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-lg ${sigStyle}`}>
                        <span className="text-sm shrink-0 mt-0.5">{c.icon}</span>
                        <span className="text-xs flex-1 leading-relaxed">{c.desc}</span>
                        <span className="text-[8px] font-mono uppercase opacity-60 shrink-0 mt-0.5">{c.sig}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Behavioral Tags */}
                <div className="px-4 py-3 border-t border-surface-3/30 flex flex-wrap gap-1.5">
                  {DEMO_VISUAL_ANALYSIS.physicalTags.map((t, i) => (
                    <span key={`p-${i}`} className="px-2 py-0.5 rounded-full bg-grain-rose/10 text-grain-rose text-[10px] font-mono">⚠ {t}</span>
                  ))}
                  {DEMO_VISUAL_ANALYSIS.envTags.map((t, i) => (
                    <span key={`e-${i}`} className="px-2 py-0.5 rounded-full bg-grain-cyan/10 text-grain-cyan text-[10px] font-mono">◉ {t}</span>
                  ))}
                </div>

                {/* Grain Confrontation Questions */}
                <div className="px-4 py-3 border-t border-surface-3/30 space-y-2">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-grain-rose mb-1">The Grain Asks</div>
                  {DEMO_VISUAL_ANALYSIS.grainQuestions.map((q, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-text-secondary italic">
                      <span className="text-grain-rose shrink-0 mt-0.5">?</span>
                      <span className="leading-relaxed">{q}</span>
                    </div>
                  ))}
                </div>

                {/* Grain Observation */}
                <div className="px-4 py-3 border-t border-surface-3/30 bg-surface-1/30">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-grain-rose animate-glow-pulse" />
                    <span className="text-[10px] font-mono uppercase tracking-widest text-grain-rose font-semibold">Grain Observation</span>
                  </div>
                  <p className="text-sm text-text-secondary leading-relaxed italic">
                    {DEMO_VISUAL_ANALYSIS.summary}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* AI Narrative */}
          {result.narrative && (
            <div className="grain-card p-4 border-l-2 border-l-grain-rose">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-grain-rose animate-glow-pulse" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-grain-rose font-semibold">Grain Analysis</span>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">
                {result.narrative}
              </p>
            </div>
          )}

          {/* No changes */}
          {result.changes.length === 0 && (
            <div className="grain-card p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-grain-amber/10 flex items-center justify-center mx-auto mb-3">
                <span className="text-xl opacity-60">📊</span>
              </div>
              <p className="text-sm text-text-secondary">No data in selected periods</p>
              <p className="text-xs text-text-muted mt-1.5 max-w-xs mx-auto leading-relaxed">
                Select two time periods above to see how your patterns shifted. The grain measures the distance between who you were and who you are.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
