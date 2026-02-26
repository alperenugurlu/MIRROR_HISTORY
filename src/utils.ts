export function formatCurrency(amount: number, currency = 'USD'): string {
  const sign = amount < 0 ? '-' : amount > 0 ? '+' : '';
  return `${sign}$${Math.abs(amount).toFixed(2)}`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatRelativeDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

export function confidenceLabel(c: number): string {
  if (c >= 0.8) return 'High';
  if (c >= 0.5) return 'Medium';
  return 'Low';
}

export function confidenceColor(c: number): string {
  if (c >= 0.8) return 'text-grain-emerald';
  if (c >= 0.5) return 'text-grain-amber';
  return 'text-text-muted';
}

export function cardTypeIcon(type: string): string {
  switch (type) {
    case 'subscription': return '\uD83D\uDD04';
    case 'price_increase': return '\uD83D\uDCC8';
    case 'refund_pending': return '\u23F3';
    case 'anomaly': return '\u26A1';
    case 'spending_summary': return '\uD83D\uDCB0';
    default: return '\u2022';
  }
}

export function cardTypeBg(type: string): string {
  switch (type) {
    case 'subscription': return 'bg-grain-cyan/5';
    case 'price_increase': return 'bg-grain-rose/5';
    case 'refund_pending': return 'bg-grain-amber/5';
    case 'anomaly': return 'bg-grain-amber/5';
    case 'spending_summary': return 'bg-surface-2';
    default: return 'bg-surface-2';
  }
}

export function eventTypeIcon(type: string): string {
  switch (type) {
    case 'money_transaction': return '\uD83D\uDCB0';
    case 'subscription': return '\uD83D\uDD04';
    case 'price_increase': return '\uD83D\uDCC8';
    case 'refund_pending': return '\u23F3';
    case 'anomaly': return '\u26A1';
    case 'note': return '\uD83D\uDCDD';
    case 'voice_memo': return '\uD83C\uDFA4';
    case 'thought': return '\uD83D\uDCAD';
    case 'decision': return '\u2696\uFE0F';
    case 'observation': return '\uD83D\uDC41';
    case 'location': return '\uD83D\uDCCD';
    case 'calendar_event': return '\uD83D\uDCC5';
    case 'health_entry': return '\uD83C\uDFCB\uFE0F';
    case 'mood': return '\uD83E\uDDE0';
    case 'ai_digest': return '\uD83D\uDD2E';
    case 'photo': return '\uD83D\uDCF7';
    case 'video': return '\uD83C\uDFA5';
    default: return '\uD83D\uDCCC';
  }
}

export function eventTypeColor(type: string): string {
  switch (type) {
    case 'money_transaction':
    case 'subscription':
    case 'price_increase':
    case 'refund_pending':
    case 'anomaly':
      return 'border-grain-cyan';
    case 'note':
    case 'thought':
    case 'decision':
    case 'observation':
      return 'border-grain-amber';
    case 'voice_memo':
      return 'border-grain-purple';
    case 'location':
      return 'border-grain-emerald';
    case 'calendar_event':
      return 'border-grain-indigo';
    case 'health_entry':
      return 'border-grain-rose';
    case 'mood':
      return 'border-grain-amber';
    case 'ai_digest':
      return 'border-grain-purple';
    case 'photo':
      return 'border-grain-cyan';
    case 'video':
      return 'border-grain-cyan';
    default:
      return 'border-surface-3';
  }
}

export function eventTypeBg(type: string): string {
  switch (type) {
    case 'money_transaction':
    case 'subscription':
    case 'price_increase':
    case 'refund_pending':
    case 'anomaly':
      return 'bg-grain-cyan/5';
    case 'note':
    case 'thought':
    case 'decision':
    case 'observation':
      return 'bg-grain-amber/5';
    case 'voice_memo':
      return 'bg-grain-purple/5';
    case 'location':
      return 'bg-grain-emerald/5';
    case 'calendar_event':
      return 'bg-grain-indigo/5';
    case 'health_entry':
      return 'bg-grain-rose/5';
    case 'mood':
      return 'bg-grain-amber/5';
    case 'ai_digest':
      return 'bg-grain-purple/5';
    case 'photo':
      return 'bg-grain-cyan/5';
    case 'video':
      return 'bg-grain-cyan/5';
    default:
      return 'bg-surface-2';
  }
}

export function eventTypeLabel(type: string): string {
  switch (type) {
    case 'money_transaction': return 'Financial Memory';
    case 'subscription': return 'Recurring Pattern';
    case 'price_increase': return 'Value Drift';
    case 'refund_pending': return 'Pending Refund';
    case 'anomaly': return 'Anomaly';
    case 'note': return 'Written Memory';
    case 'voice_memo': return 'Audio Memory';
    case 'thought': return 'Thought';
    case 'decision': return 'Decision';
    case 'observation': return 'Observation';
    case 'location': return 'Location Memory';
    case 'calendar_event': return 'Temporal Memory';
    case 'health_entry': return 'Biometric Memory';
    case 'mood': return 'Neural State';
    case 'ai_digest': return 'Grain Digest';
    case 'photo': return 'Visual Memory';
    case 'video': return 'Video Memory';
    default: return type;
  }
}

// ── Phase 4: Mood helpers ──

export function moodEmoji(score: number): string {
  return ['\u{2796}', '\u{1F629}', '\u{1F614}', '\u{1F610}', '\u{1F60A}', '\u{1F929}'][score] || '\u{2796}';
}

export function moodColor(score: number | null): string {
  if (score === null) return 'bg-surface-3';
  if (score >= 4) return 'bg-grain-emerald';
  if (score === 3) return 'bg-grain-amber';
  if (score === 2) return 'bg-grain-amber';
  return 'bg-grain-rose';
}

export function moodTextColor(score: number | null): string {
  if (score === null) return 'text-text-muted';
  if (score >= 4) return 'text-grain-emerald';
  if (score === 3) return 'text-grain-amber';
  if (score === 2) return 'text-grain-amber';
  return 'text-grain-rose';
}

export function formatTime(timestamp: string): string {
  return timestamp.slice(11, 16) || '';
}
