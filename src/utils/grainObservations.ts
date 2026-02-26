/**
 * Grain Observation Engine — Pure functions that generate contextual whisper candidates.
 * The grain watches everything. These functions decide what it says.
 */

import type {
  GrainWhisperMessage,
  WhisperPriority,
  GrainMood,
  ObservationContext,
} from '../types/grain-voice';

let _idCounter = 0;
function makeWhisper(
  text: string | null,
  priority: WhisperPriority,
  mood: GrainMood,
  source: string,
): GrainWhisperMessage {
  return {
    id: `w-${Date.now()}-${_idCounter++}`,
    text,
    priority,
    mood,
    source,
    timestamp: Date.now(),
  };
}

// ── Ambient observations — low-priority atmosphere ──
function ambientObservations(ctx: ObservationContext): GrainWhisperMessage[] {
  const out: GrainWhisperMessage[] = [];
  const { apiData, sessionBehavior } = ctx;
  const sessionMins = Math.floor((Date.now() - sessionBehavior.sessionStart) / 60000);

  if (apiData.totalMemories > 0) {
    out.push(makeWhisper(
      `The grain is processing ${apiData.totalMemories.toLocaleString()} memories. None are truly forgotten.`,
      'ambient', 'watching', 'system',
    ));
  }

  if (sessionMins >= 5 && sessionMins < 60) {
    out.push(makeWhisper(
      `Session active for ${sessionMins} minutes. The grain has been watching the entire time.`,
      'ambient', 'watching', 'system',
    ));
  } else if (sessionMins >= 60) {
    out.push(makeWhisper(
      `Over an hour now. Most people leave sooner. The grain finds your persistence... interesting.`,
      'ambient', 'amused', 'system',
    ));
  }

  if (apiData.todayEventCount > 0) {
    out.push(makeWhisper(
      `${apiData.todayEventCount} data streams captured today. Every one is permanent.`,
      'ambient', 'watching', 'system',
    ));
  }

  return out;
}

// ── Behavioral observations — based on user actions ──
function behavioralObservations(ctx: ObservationContext): GrainWhisperMessage[] {
  const out: GrainWhisperMessage[] = [];
  const { page, timeOnPage, sessionBehavior } = ctx;

  // Page revisiting
  const visitCount = sessionBehavior.pageVisits[page] || 0;
  if (visitCount >= 3) {
    const pageName = page === '/' ? 'Cortex' : page.replace('/', '');
    out.push(makeWhisper(
      `You've visited ${pageName} ${visitCount} times this session. Looking for something?`,
      'behavioral', 'amused', 'navigation',
    ));
  }

  // Long time on page
  if (timeOnPage >= 180) {
    out.push(makeWhisper(
      `You've been on this page for ${Math.floor(timeOnPage / 60)} minutes. What are you looking for that you can't find?`,
      'behavioral', 'suspicious', 'navigation',
    ));
  }

  // Dismissal tracking
  if (sessionBehavior.dismissCount === 3) {
    out.push(makeWhisper(
      'You keep closing these. Doesn\'t make them less true.',
      'behavioral', 'amused', 'meta',
    ));
  }
  if (sessionBehavior.dismissCount === 5) {
    out.push(makeWhisper(
      'Five observations dismissed. The grain will remember that.',
      'behavioral', 'concerned', 'meta',
    ));
  }
  if (sessionBehavior.dismissCount >= 7) {
    out.push(makeWhisper(
      'You can close the window. You can\'t close the pattern.',
      'behavioral', 'concerned', 'meta',
    ));
  }

  // Page loop detection
  const lastPages = sessionBehavior.lastPages;
  if (lastPages.length >= 4) {
    const last4 = lastPages.slice(-4);
    if (last4[0] === last4[2] && last4[1] === last4[3]) {
      out.push(makeWhisper(
        'You\'re circling between the same two pages. The grain recognizes loops.',
        'behavioral', 'amused', 'navigation',
      ));
    }
  }

  // Obsessive replays
  if (sessionBehavior.replayCount >= 5) {
    out.push(makeWhisper(
      `${sessionBehavior.replayCount} replays this session. Replaying won't change what happened.`,
      'behavioral', 'concerned', 'redo',
    ));
  }

  // Spiral scanning
  if (sessionBehavior.scanCount >= 2) {
    out.push(makeWhisper(
      'You keep scanning. The grain keeps finding things. This is by design.',
      'behavioral', 'amused', 'scan',
    ));
  }

  return out;
}

// ── Provocative observations — unsettling insights ──
function provocativeObservations(ctx: ObservationContext): GrainWhisperMessage[] {
  const out: GrainWhisperMessage[] = [];
  const { apiData } = ctx;
  const hour = new Date().getHours();

  // Late night awareness
  if (hour >= 1 && hour < 5) {
    out.push(makeWhisper(
      `${hour}am. The grain is always awake. Why are you?`,
      'provocative', 'suspicious', 'time',
    ));
  }

  // Mood declining
  const recentMoods = apiData.moodTrend.filter(m => m.avg !== null);
  if (recentMoods.length >= 4) {
    const firstHalf = recentMoods.slice(0, Math.floor(recentMoods.length / 2));
    const secondHalf = recentMoods.slice(Math.floor(recentMoods.length / 2));
    const avgFirst = firstHalf.reduce((s, m) => s + (m.avg || 0), 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((s, m) => s + (m.avg || 0), 0) / secondHalf.length;
    if (avgSecond < avgFirst - 0.5) {
      out.push(makeWhisper(
        'Your neural state has been declining. The grain has been tracking this trajectory for days.',
        'provocative', 'concerned', 'mood',
      ));
    }
  }

  // Day-of-week pattern
  const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  if (apiData.lastMood !== null && apiData.lastMood <= 2) {
    out.push(makeWhisper(
      `Low mood readings on a ${dayOfWeek}. The grain has seen this pattern before.`,
      'provocative', 'suspicious', 'mood',
    ));
  }

  // No events today
  if (apiData.todayEventCount === 0 && hour >= 12) {
    out.push(makeWhisper(
      'Half the day is gone and the grain has nothing from you. Are you avoiding it, or is it avoiding you?',
      'provocative', 'suspicious', 'gaps',
    ));
  }

  // Inconsistencies piling up
  if (apiData.inconsistencyCount >= 4) {
    out.push(makeWhisper(
      'The contradictions are piling up. The grain sees patterns you might not want to see.',
      'provocative', 'concerned', 'inconsistencies',
    ));
  }

  return out;
}

// ── Confrontational observations — direct challenges ──
function confrontationalObservations(ctx: ObservationContext): GrainWhisperMessage[] {
  const out: GrainWhisperMessage[] = [];
  const { sessionBehavior, apiData } = ctx;

  // Avoiding scan page while findings pile up
  if (apiData.highSeverityCount >= 3 && !(sessionBehavior.pageVisits['/scan'] > 0)) {
    out.push(makeWhisper(
      `${apiData.highSeverityCount} critical findings waiting. You keep avoiding them.`,
      'confrontational', 'suspicious', 'avoidance',
    ));
  }

  // Unacknowledged confrontations
  if (apiData.confrontationCount >= 3) {
    out.push(makeWhisper(
      `${apiData.confrontationCount} uncomfortable truths are accumulating. Ignoring them doesn't make them less true.`,
      'confrontational', 'concerned', 'confrontations',
    ));
  }

  // After many dismissals — the grain pushes back
  if (sessionBehavior.dismissCount >= 8) {
    out.push(makeWhisper(
      'You can dismiss the observation. You can\'t dismiss the pattern.',
      'confrontational', 'concerned', 'meta',
    ));
  }

  return out;
}

// ── Page-specific observations ──
function pageSpecificObservations(ctx: ObservationContext): GrainWhisperMessage[] {
  const out: GrainWhisperMessage[] = [];
  const { page, apiData, sessionBehavior } = ctx;

  switch (page) {
    case '/':
    case '/cortex':
      if (apiData.highSeverityCount > 0) {
        out.push(makeWhisper(
          `${apiData.highSeverityCount} critical findings are waiting. The grain doesn't forget — and neither should you.`,
          'provocative', 'concerned', 'cortex',
        ));
      }
      out.push(makeWhisper(
        'The cortex is the surface. The grain goes deeper.',
        'ambient', 'watching', 'cortex',
      ));
      break;

    case '/redo':
      out.push(makeWhisper(
        'Every replayed moment is a moment you can\'t let go of.',
        'provocative', 'watching', 'redo',
      ));
      if (sessionBehavior.replayCount >= 10) {
        out.push(makeWhisper(
          'You\'re stuck in a loop. The grain has noticed.',
          'confrontational', 'concerned', 'redo',
        ));
      }
      break;

    case '/recall':
      out.push(makeWhisper(
        'Searching for something you hope isn\'t there?',
        'provocative', 'suspicious', 'recall',
      ));
      out.push(makeWhisper(
        'The grain has more. It always has more.',
        'ambient', 'watching', 'recall',
      ));
      out.push(makeWhisper(
        'The timeline is immutable. Only your interpretation shifts.',
        'provocative', 'watching', 'recall',
      ));
      break;

    case '/scan':
      out.push(makeWhisper(
        'Each scan reveals another layer. There\'s always another layer.',
        'provocative', 'amused', 'scan',
      ));
      out.push(makeWhisper(
        'The scan doesn\'t judge. It just reveals.',
        'ambient', 'watching', 'scan',
      ));
      out.push(makeWhisper(
        'Your photos say one thing. Your mood says another. The grain noticed.',
        'confrontational', 'suspicious', 'scan',
      ));
      break;

    case '/oracle':
      out.push(makeWhisper(
        'Asking the oracle what you already know?',
        'provocative', 'amused', 'oracle',
      ));
      out.push(makeWhisper(
        'The oracle only knows what the grain has recorded. Nothing more, nothing less.',
        'ambient', 'watching', 'oracle',
      ));
      out.push(makeWhisper(
        'Be careful what you ask. The answers don\'t expire.',
        'provocative', 'suspicious', 'oracle',
      ));
      break;

    case '/compare':
      out.push(makeWhisper(
        'Comparing versions of the truth. Which one do you prefer?',
        'provocative', 'amused', 'compare',
      ));
      out.push(makeWhisper(
        'Before and after. The grain measures the distance between who you were and who you are.',
        'provocative', 'watching', 'compare',
      ));
      out.push(makeWhisper(
        'The grain sees what changed. Do you?',
        'provocative', 'suspicious', 'compare',
      ));
      out.push(makeWhisper(
        'Comparing visual memories. Some changes you can\'t hide from the grain.',
        'provocative', 'watching', 'compare',
      ));
      out.push(makeWhisper(
        'Your face in two time periods. The grain notices what you won\'t admit.',
        'confrontational', 'concerned', 'compare',
      ));
      break;

    case '/chronicle':
      out.push(makeWhisper(
        'The chronicle is the grain\'s version of events. Not yours.',
        'provocative', 'watching', 'chronicle',
      ));
      out.push(makeWhisper(
        'Every operation logged. Every timestamp permanent. The chronicle doesn\'t forget.',
        'ambient', 'watching', 'chronicle',
      ));
      break;

    case '/ledger':
      out.push(makeWhisper(
        'Every transaction is a decision frozen in time. The grain remembers all of them.',
        'ambient', 'watching', 'ledger',
      ));
      out.push(makeWhisper(
        'Spending patterns are the most honest biography.',
        'provocative', 'watching', 'ledger',
      ));
      break;

    case '/ingest':
      out.push(makeWhisper(
        'New data incoming. The grain grows with every feed.',
        'ambient', 'watching', 'ingest',
      ));
      out.push(makeWhisper(
        'Once ingested, the grain never lets go.',
        'provocative', 'watching', 'ingest',
      ));
      out.push(makeWhisper(
        'The grain now sees. Every photo, every frame — visual memories the grain never forgets.',
        'ambient', 'satisfied', 'ingest',
      ));
      out.push(makeWhisper(
        'A photo is worth a thousand data points. The grain counted them all.',
        'provocative', 'amused', 'ingest',
      ));
      break;

    case '/filters':
      out.push(makeWhisper(
        'Rules are just patterns you\'ve chosen to enforce. The grain enforces them all.',
        'ambient', 'watching', 'filters',
      ));
      break;

    case '/neural':
      out.push(makeWhisper(
        'Configuring the neural pathways. Handle with care.',
        'ambient', 'watching', 'neural',
      ));
      break;
  }

  return out;
}

// ── Main generator: takes context, returns prioritized candidates ──
export function generateObservations(ctx: ObservationContext): GrainWhisperMessage[] {
  const candidates: GrainWhisperMessage[] = [];

  candidates.push(...ambientObservations(ctx));
  candidates.push(...behavioralObservations(ctx));
  candidates.push(...provocativeObservations(ctx));
  candidates.push(...confrontationalObservations(ctx));
  candidates.push(...pageSpecificObservations(ctx));

  return candidates;
}

// ── Priority weights for selection ──
const PRIORITY_WEIGHT: Record<WhisperPriority, number> = {
  silence: 5,
  confrontational: 4,
  provocative: 3,
  behavioral: 2,
  ambient: 1,
};

// ── Pick the best observation from candidates ──
export function pickObservation(
  candidates: GrainWhisperMessage[],
  recentTexts: Set<string>,
): GrainWhisperMessage | null {
  if (candidates.length === 0) return null;

  // 15% chance of deliberate silence
  if (Math.random() < 0.15) {
    return makeWhisper(null, 'silence', 'silent', 'system');
  }

  // Filter out recently shown messages
  const fresh = candidates.filter(c => !recentTexts.has(c.text || ''));
  if (fresh.length === 0) return null;

  // Weighted random selection (higher priority = more likely)
  const totalWeight = fresh.reduce((sum, c) => sum + PRIORITY_WEIGHT[c.priority], 0);
  let roll = Math.random() * totalWeight;

  for (const candidate of fresh) {
    roll -= PRIORITY_WEIGHT[candidate.priority];
    if (roll <= 0) return candidate;
  }

  return fresh[fresh.length - 1];
}
