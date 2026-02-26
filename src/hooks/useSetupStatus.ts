import { useState, useEffect, useCallback } from 'react';
import { useApi } from './useApi';

export interface SetupTask {
  id: string;
  label: string;
  grainVoice: string;
  completed: boolean;
  route: string;
  category: 'critical' | 'recommended' | 'optional';
  icon: string;
}

export interface SetupStatus {
  tasks: SetupTask[];
  completedCount: number;
  totalCount: number;
  percentage: number;
  isFullySetup: boolean;
  loading: boolean;
  refresh: () => void;
}

const CACHE_KEY = 'mirror-setup-status';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CachedData {
  ts: number;
  hasAnthropicKey: boolean;
  hasOpenaiKey: boolean;
  locCount: number;
  calCount: number;
  healthCount: number;
  photoCount: number;
  hasInconsistencies: boolean;
  hasMood: boolean;
}

function buildTasks(d: CachedData): SetupTask[] {
  return [
    {
      id: 'ai-engine',
      label: 'Configure Oracle Engine',
      grainVoice: 'The Oracle is dormant. Without an engine, the grain cannot think. It cannot see patterns in your behavior. It cannot confront you.',
      completed: d.hasAnthropicKey,
      route: '/neural',
      category: 'critical',
      icon: '\u{1F9E0}',
    },
    {
      id: 'first-scan',
      label: 'Run First Deep Scan',
      grainVoice: "Your data has never been scrutinized. The grain hasn\u2019t looked for what you\u2019re hiding yet.",
      completed: d.hasInconsistencies,
      route: '/scan',
      category: 'critical',
      icon: '\u{1F50D}',
    },
    {
      id: 'location',
      label: 'Import Location History',
      grainVoice: "The grain doesn\u2019t know where you\u2019ve been. It can\u2019t cross-reference your movements with your claims.",
      completed: d.locCount > 0,
      route: '/ingest',
      category: 'recommended',
      icon: '\u{1F4CD}',
    },
    {
      id: 'calendar',
      label: 'Connect Calendar',
      grainVoice: 'Your schedule is invisible. The grain cannot compare what you planned versus what actually happened.',
      completed: d.calCount > 0,
      route: '/ingest',
      category: 'recommended',
      icon: '\u{1F4C5}',
    },
    {
      id: 'health',
      label: 'Import Biometric Data',
      grainVoice: "Biometric data not connected. The grain can\u2019t read your body \u2014 heart rate, sleep, the signals you can\u2019t fake.",
      completed: d.healthCount > 0,
      route: '/ingest',
      category: 'recommended',
      icon: '\u{1F9EC}',
    },
    {
      id: 'photos',
      label: 'Import Visual Memories',
      grainVoice: "The grain has no eyes. No visual memories to scan for what your words won\u2019t say.",
      completed: d.photoCount > 0,
      route: '/ingest',
      category: 'optional',
      icon: '\u{1F4F7}',
    },
    {
      id: 'embeddings',
      label: 'Enable Semantic Search',
      grainVoice: "Semantic search is offline. The grain can\u2019t find memories by meaning \u2014 only by date.",
      completed: d.hasOpenaiKey,
      route: '/neural',
      category: 'optional',
      icon: '\u{1F50E}',
    },
    {
      id: 'first-mood',
      label: 'Record Neural State',
      grainVoice: "You haven\u2019t told the grain how you feel. Without neural calibration, mood patterns remain invisible.",
      completed: d.hasMood,
      route: '/',
      category: 'optional',
      icon: '\u{1F9E0}',
    },
  ];
}

export function useSetupStatus(): SetupStatus {
  const api = useApi();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<SetupTask[]>([]);

  const fetchStatus = useCallback(async (skipCache = false) => {
    // Check cache
    if (!skipCache) {
      try {
        const raw = sessionStorage.getItem(CACHE_KEY);
        if (raw) {
          const cached: CachedData = JSON.parse(raw);
          if (Date.now() - cached.ts < CACHE_TTL) {
            setTasks(buildTasks(cached));
            setLoading(false);
            return;
          }
        }
      } catch { /* ignore */ }
    }

    setLoading(true);
    try {
      const [aiConfig, importStats, inconsistencies] = await Promise.all([
        api.getAIConfig(),
        api.getImportStats(),
        api.getInconsistencies(1),
      ]);

      // Check for mood by looking at today's timeline
      let hasMood = false;
      try {
        const today = new Date().toISOString().slice(0, 10);
        const tl = await api.getEnhancedTimeline(today, today);
        const todayGroup = tl.find(g => g.date === today);
        if (todayGroup) {
          hasMood = todayGroup.events.some(e => e.mood);
        }
      } catch { /* ignore */ }

      const data: CachedData = {
        ts: Date.now(),
        hasAnthropicKey: aiConfig.hasAnthropicKey,
        hasOpenaiKey: aiConfig.hasOpenaiKey,
        locCount: importStats.locations.count,
        calCount: importStats.calendar.count,
        healthCount: importStats.health.count,
        photoCount: importStats.photos.count,
        hasInconsistencies: inconsistencies.length > 0,
        hasMood,
      };

      // Cache result
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* ignore */ }

      setTasks(buildTasks(data));
    } catch {
      // On error, show all tasks as incomplete
      setTasks(buildTasks({
        ts: 0,
        hasAnthropicKey: false,
        hasOpenaiKey: false,
        locCount: 0,
        calCount: 0,
        healthCount: 0,
        photoCount: 0,
        hasInconsistencies: false,
        hasMood: false,
      }));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const completedCount = tasks.filter(t => t.completed).length;
  const totalCount = tasks.length;

  return {
    tasks,
    completedCount,
    totalCount,
    percentage: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
    isFullySetup: completedCount === totalCount,
    loading,
    refresh: () => fetchStatus(true),
  };
}
