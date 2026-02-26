// ── Grain Voice System Types ──
// The grain is a living entity that watches, speaks, and reacts.

export type GrainMood =
  | 'watching'    // Default — neutral observation
  | 'suspicious'  // Data gaps, user avoidance detected
  | 'amused'      // User doing something predictable
  | 'concerned'   // Negative patterns emerging
  | 'satisfied'   // Rich data, deep engagement
  | 'silent';     // Deliberate absence — the scariest state

export type WhisperPriority =
  | 'ambient'          // Atmospheric, low priority
  | 'behavioral'       // Based on user actions
  | 'provocative'      // Unsettling insights
  | 'confrontational'  // Direct challenges
  | 'silence';         // Deliberate emptiness

export interface GrainWhisperMessage {
  id: string;
  text: string | null;    // null = deliberate silence
  priority: WhisperPriority;
  mood: GrainMood;
  source: string;         // which page/system generated it
  timestamp: number;
}

export interface SessionBehavior {
  pageVisits: Record<string, number>;
  pageTimeSpent: Record<string, number>;
  lastPages: string[];
  sessionStart: number;
  dismissCount: number;
  totalWhispersSeen: number;
  lastWhisperAt: number;
  scanCount: number;
  replayCount: number;
}

export interface ObservationApiData {
  inconsistencyCount: number;
  confrontationCount: number;
  highSeverityCount: number;
  todayEventCount: number;
  totalMemories: number;
  moodTrend: { day: string; avg: number | null }[];
  lastMood: number | null;
}

export interface ObservationContext {
  page: string;
  timeOnPage: number;
  sessionBehavior: SessionBehavior;
  apiData: ObservationApiData;
}
