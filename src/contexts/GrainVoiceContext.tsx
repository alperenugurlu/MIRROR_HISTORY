/**
 * GrainVoiceContext — The brain of the grain.
 * Manages whisper queue, mood, behavior tracking, and autonomous observation.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from 'react';
import type {
  GrainMood,
  WhisperPriority,
  GrainWhisperMessage,
  SessionBehavior,
  ObservationApiData,
} from '../types/grain-voice';
import { generateObservations, pickObservation } from '../utils/grainObservations';

// ── Default session behavior ──
function createDefaultBehavior(): SessionBehavior {
  return {
    pageVisits: {},
    pageTimeSpent: {},
    lastPages: [],
    sessionStart: Date.now(),
    dismissCount: 0,
    totalWhispersSeen: 0,
    lastWhisperAt: 0,
    scanCount: 0,
    replayCount: 0,
  };
}

const STORAGE_KEY = 'grain-voice-session';

function loadSession(): SessionBehavior | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionBehavior;
  } catch {
    return null;
  }
}

function persistSession(behavior: SessionBehavior) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(behavior));
  } catch { /* ignore quota errors */ }
}

// ── Default API data ──
const defaultApiData: ObservationApiData = {
  inconsistencyCount: 0,
  confrontationCount: 0,
  highSeverityCount: 0,
  todayEventCount: 0,
  totalMemories: 0,
  moodTrend: [],
  lastMood: null,
};

// ── Mood calculation ──
function calculateGrainMood(
  behavior: SessionBehavior,
  apiData: ObservationApiData,
): GrainMood {
  // Silent: after being dismissed 5+ times, grain goes quiet for 2 minutes
  if (behavior.dismissCount >= 5 && Date.now() - behavior.lastWhisperAt < 120000) {
    return 'silent';
  }

  // Suspicious: high-severity findings and user avoiding scan
  if (apiData.highSeverityCount >= 3 && !(behavior.pageVisits['/scan'] > 0)) {
    return 'suspicious';
  }

  // Concerned: mood declining or obsessive replaying
  if (behavior.replayCount > 10) {
    return 'concerned';
  }
  const recentMoods = apiData.moodTrend.filter(m => m.avg !== null);
  if (recentMoods.length >= 4) {
    const firstHalf = recentMoods.slice(0, Math.floor(recentMoods.length / 2));
    const secondHalf = recentMoods.slice(Math.floor(recentMoods.length / 2));
    const avgFirst = firstHalf.reduce((s, m) => s + (m.avg || 0), 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((s, m) => s + (m.avg || 0), 0) / secondHalf.length;
    if (avgSecond < avgFirst - 0.5) return 'concerned';
  }

  // Amused: predictable page loops
  const lastPages = behavior.lastPages;
  if (lastPages.length >= 4) {
    const last4 = lastPages.slice(-4);
    if (last4[0] === last4[2] && last4[1] === last4[3]) {
      return 'amused';
    }
  }

  // Satisfied: lots of data and user engaging
  if (apiData.totalMemories > 100 && apiData.todayEventCount > 5) {
    return 'satisfied';
  }

  return 'watching';
}

// ── Cooldown between whispers (adapts to dismissals) ──
function getCooldownMs(behavior: SessionBehavior): number {
  if (behavior.dismissCount >= 5) return 120000; // 2 minutes after many dismissals
  if (behavior.dismissCount >= 3) return 60000;  // 60s after some dismissals
  if (behavior.totalWhispersSeen === 0) return 0; // First whisper: show immediately
  return 8000; // 8s between whispers (autonomous engine controls pacing)
}

// ── Context shape ──
interface GrainVoiceContextValue {
  grainMood: GrainMood;
  currentWhisper: GrainWhisperMessage | null;
  isTyping: boolean;
  sessionBehavior: SessionBehavior;
  pushWhisper: (text: string | null, priority: WhisperPriority, mood?: GrainMood, source?: string) => void;
  dismissWhisper: () => void;
  reportPageVisit: (page: string) => void;
  reportPageLeave: (page: string) => void;
  feedApiData: (data: Partial<ObservationApiData>) => void;
  incrementScanCount: () => void;
  incrementReplayCount: () => void;
}

const GrainVoiceContext = createContext<GrainVoiceContextValue | null>(null);

export function GrainVoiceProvider({ children }: { children: ReactNode }) {
  const [whisperQueue, setWhisperQueue] = useState<GrainWhisperMessage[]>([]);
  const [currentWhisper, setCurrentWhisper] = useState<GrainWhisperMessage | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [grainMood, setGrainMood] = useState<GrainMood>('watching');
  const [sessionBehavior, setSessionBehavior] = useState<SessionBehavior>(
    () => loadSession() || createDefaultBehavior()
  );
  const [apiDataCache, setApiDataCache] = useState<ObservationApiData>(defaultApiData);

  const currentPageRef = useRef<string>('');
  const pageEnteredAtRef = useRef<number>(Date.now());
  const recentTextsRef = useRef<Set<string>>(new Set());
  const recentTextsAgeRef = useRef<number>(Date.now());
  const whisperTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs for the autonomous engine to read latest values without dependency cycles
  const sessionBehaviorRef = useRef(sessionBehavior);
  sessionBehaviorRef.current = sessionBehavior;
  const apiDataCacheRef = useRef(apiDataCache);
  apiDataCacheRef.current = apiDataCache;

  // ── Mood recalculation ──
  useEffect(() => {
    setGrainMood(calculateGrainMood(sessionBehavior, apiDataCache));
  }, [sessionBehavior, apiDataCache]);

  // ── Whisper display engine ──
  // Only depends on queue and currentWhisper — reads behavior from ref
  useEffect(() => {
    if (currentWhisper) return;
    if (whisperQueue.length === 0) return;

    const behavior = sessionBehaviorRef.current;
    const cooldown = getCooldownMs(behavior);
    const timeSinceLast = Date.now() - behavior.lastWhisperAt;
    const delay = Math.max(0, cooldown - timeSinceLast);

    whisperTimerRef.current = setTimeout(() => {
      setWhisperQueue(prev => {
        if (prev.length === 0) return prev;
        const [next, ...rest] = prev;
        setCurrentWhisper(next);
        setIsTyping(true);

        if (next.text) recentTextsRef.current.add(next.text);
        if (recentTextsRef.current.size > 10) {
          const arr = [...recentTextsRef.current];
          recentTextsRef.current = new Set(arr.slice(-5));
        }

        setSessionBehavior(b => {
          const updated = {
            ...b,
            totalWhispersSeen: b.totalWhispersSeen + 1,
            lastWhisperAt: Date.now(),
          };
          persistSession(updated);
          return updated;
        });

        return rest;
      });
    }, delay);

    return () => {
      if (whisperTimerRef.current) clearTimeout(whisperTimerRef.current);
    };
  }, [whisperQueue, currentWhisper]);

  // ── Auto-dismiss after display duration ──
  useEffect(() => {
    if (!currentWhisper) return;

    // Silence: 4s visible. Text: typewriter time + 5s linger (min 8s total)
    const displayTime = currentWhisper.text === null
      ? 4000
      : Math.max(8000, (currentWhisper.text.length * 40) + 5000);

    const timer = setTimeout(() => {
      setCurrentWhisper(null);
      setIsTyping(false);
    }, displayTime);

    return () => clearTimeout(timer);
  }, [currentWhisper]);

  // ── Autonomous observation engine ──
  // Runs once on mount, reads latest state from refs to avoid dependency cycles
  useEffect(() => {
    const run = () => {
      // Decay: clear recent texts every 3 minutes so messages can repeat
      if (Date.now() - recentTextsAgeRef.current > 180000) {
        recentTextsRef.current.clear();
        recentTextsAgeRef.current = Date.now();
      }

      const timeOnPage = (Date.now() - pageEnteredAtRef.current) / 1000;
      const candidates = generateObservations({
        page: currentPageRef.current,
        timeOnPage,
        sessionBehavior: sessionBehaviorRef.current,
        apiData: apiDataCacheRef.current,
      });

      const chosen = pickObservation(candidates, recentTextsRef.current);
      if (chosen) {
        setWhisperQueue(prev => [...prev, chosen]);
      }
    };

    // First observation after 5s, then every 30-60s
    const firstTimer = setTimeout(() => {
      run();
      intervalRef.current = setInterval(run, 30000 + Math.random() * 30000);
    }, 5000);

    const intervalRef = { current: null as ReturnType<typeof setInterval> | null };

    return () => {
      clearTimeout(firstTimer);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Actions ──
  const pushWhisper = useCallback((
    text: string | null,
    priority: WhisperPriority,
    mood: GrainMood = 'watching',
    source: string = 'page',
  ) => {
    const whisper: GrainWhisperMessage = {
      id: `w-${Date.now()}-${_pushId++}`,
      text,
      priority,
      mood,
      source,
      timestamp: Date.now(),
    };
    setWhisperQueue(prev => [...prev, whisper]);
  }, []);

  const dismissWhisper = useCallback(() => {
    setCurrentWhisper(null);
    setIsTyping(false);
    setSessionBehavior(b => {
      const updated = { ...b, dismissCount: b.dismissCount + 1 };
      persistSession(updated);
      return updated;
    });
  }, []);

  const reportPageVisit = useCallback((page: string) => {
    currentPageRef.current = page;
    pageEnteredAtRef.current = Date.now();
    setSessionBehavior(prev => {
      const updated = {
        ...prev,
        pageVisits: { ...prev.pageVisits, [page]: (prev.pageVisits[page] || 0) + 1 },
        lastPages: [...prev.lastPages.slice(-4), page],
      };
      persistSession(updated);
      return updated;
    });
  }, []);

  const reportPageLeave = useCallback((page: string) => {
    const timeSpent = (Date.now() - pageEnteredAtRef.current) / 1000;
    setSessionBehavior(prev => {
      const updated = {
        ...prev,
        pageTimeSpent: {
          ...prev.pageTimeSpent,
          [page]: (prev.pageTimeSpent[page] || 0) + timeSpent,
        },
      };
      persistSession(updated);
      return updated;
    });
  }, []);

  const feedApiData = useCallback((data: Partial<ObservationApiData>) => {
    setApiDataCache(prev => ({ ...prev, ...data }));
  }, []);

  const incrementScanCount = useCallback(() => {
    setSessionBehavior(prev => {
      const updated = { ...prev, scanCount: prev.scanCount + 1 };
      persistSession(updated);
      return updated;
    });
  }, []);

  const incrementReplayCount = useCallback(() => {
    setSessionBehavior(prev => {
      const updated = { ...prev, replayCount: prev.replayCount + 1 };
      persistSession(updated);
      return updated;
    });
  }, []);

  return (
    <GrainVoiceContext.Provider value={{
      grainMood,
      currentWhisper,
      isTyping,
      sessionBehavior,
      pushWhisper,
      dismissWhisper,
      reportPageVisit,
      reportPageLeave,
      feedApiData,
      incrementScanCount,
      incrementReplayCount,
    }}>
      {children}
    </GrainVoiceContext.Provider>
  );
}

let _pushId = 0;

export function useGrainVoice() {
  const ctx = useContext(GrainVoiceContext);
  if (!ctx) throw new Error('useGrainVoice must be used within GrainVoiceProvider');
  return ctx;
}
