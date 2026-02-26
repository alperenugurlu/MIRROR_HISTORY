import type { MirrorHistoryApi } from '../../shared/types';

let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const resp = await fetch(url, { ...options, headers });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new Error(body.message || body.error || `HTTP ${resp.status}`);
  }
  return resp.json();
}

function get<T>(url: string): Promise<T> {
  return apiFetch<T>(url);
}

function post<T>(url: string, body: unknown): Promise<T> {
  return apiFetch<T>(url, { method: 'POST', body: JSON.stringify(body) });
}

function patch<T>(url: string, body: unknown): Promise<T> {
  return apiFetch<T>(url, { method: 'PATCH', body: JSON.stringify(body) });
}

function del<T>(url: string): Promise<T> {
  return apiFetch<T>(url, { method: 'DELETE' });
}

function notSupported(name: string): never {
  throw new Error(`${name} is not supported in web mode. Use Electron for file operations.`);
}

export const httpApi: MirrorHistoryApi = {
  // Auth
  login: (username, password) => post('/api/auth/login', { username, password }),
  changePassword: (oldPassword, newPassword) => post('/api/auth/change-password', { oldPassword, newPassword }),
  getAuthUser: () => get('/api/auth/me'),
  logout: async () => { setAuthToken(null); },

  // File operations — not supported in web mode
  selectFile: () => notSupported('selectFile'),
  selectFileWithFilter: () => notSupported('selectFileWithFilter'),
  selectMultipleFiles: () => notSupported('selectMultipleFiles'),

  // CSV
  previewCsv: (filePath) => post('/api/csv/preview', { filePath }),
  importCsv: (filePath, mapping) => post('/api/csv/import', { filePath, mapping }),

  // Data
  hasData: () => get<{ hasData: boolean }>('/api/has-data').then(r => r.hasData),
  getTransactions: (start, end) => {
    const params = new URLSearchParams();
    if (start) params.set('start', start);
    if (end) params.set('end', end);
    return get(`/api/transactions?${params}`);
  },

  // Diffs
  generateDiff: (periodType, refDate) => post('/api/diff/generate', { periodType, refDate }),
  getDiffs: (periodType) => {
    const params = periodType ? `?periodType=${periodType}` : '';
    return get(`/api/diffs${params}`);
  },
  getTimeMachine: (eventId) => get(`/api/time-machine/${eventId}`),
  getSubscriptions: () => get('/api/subscriptions'),
  getMonthlyAudit: (month) => get(`/api/audit/${month}`),

  // Rules
  getRules: () => get('/api/rules'),
  createRule: (ruleType, ruleJson) => post('/api/rules', { ruleType, ruleJson }),
  updateRule: (id, enabled) => patch(`/api/rules/${id}`, { enabled }),
  deleteRule: (id) => del(`/api/rules/${id}`),

  // Actions
  createAction: (eventId, actionType, payloadJson) => post('/api/actions', { eventId, actionType, payloadJson }),
  updateActionStatus: (id, status) => patch(`/api/actions/${id}`, { status }),
  getActions: () => get('/api/actions'),
  getActivityLog: () => get('/api/activity-log'),

  // AI
  sendChatMessage: (message) => post('/api/ai/chat', { message }),
  getChatHistory: (limit) => get(`/api/ai/chat/history?limit=${limit || 50}`),
  clearChatHistory: () => del('/api/ai/chat/history'),
  getAIStatus: () => get('/api/ai/status'),

  // Digest
  generateDigest: (period) => post('/api/ai/digest', { period }),
  getDigests: (limit) => get(`/api/ai/digests?limit=${limit || 20}`),

  // Import
  getImportStats: () => get('/api/import/stats'),
  importLocationHistory: (filePath) => post('/api/import/location', { filePath }),
  importCalendarICS: (filePath) => post('/api/import/calendar', { filePath }),
  importAppleHealth: (filePath) => post('/api/import/health', { filePath }),

  // Timeline
  getEnhancedTimeline: (start, end, types) => {
    const params = new URLSearchParams({ start, end });
    if (types) params.set('types', types.join(','));
    return get(`/api/timeline/enhanced?${params}`);
  },
  getTimelineStats: () => get('/api/timeline/stats'),

  // Mood
  recordMood: (score, note) => post('/api/mood', { score, note }),

  // Settings
  getAIConfig: () => get('/api/ai/status').then((s: any) => ({
    hasAnthropicKey: s.configured,
    hasWhisperKey: s.transcription,
    hasOpenaiKey: false,
    embeddingStats: { count: 0, total: 0 },
    privacyLevel: 'balanced',
  })),
  saveAIConfigSettings: (config) => post('/api/ai/configure', config),
  getTelegramConfig: () => get<{ hasToken: boolean; allowedChatIds: number[] } | null>('/api/telegram/config').catch(() => null),
  saveTelegramConfig: (config) => post('/api/telegram/configure', config),
  getTelegramStatus: () => get<any>('/health').then(() => ({ running: false })).catch(() => ({ running: false })),
  getSystemStatus: async () => {
    const health = await get<any>('/health').catch(() => null);
    return {
      apiServer: !!health,
      dbEvents: 0,
      dbDateRange: null,
    };
  },

  // Phase 4
  getDailyNarrative: () => Promise.resolve({ date: '', narrative: '', moodAvg: null, eventCount: 0, dominantTypes: [] as string[] }),
  getVoiceFile: () => notSupported('getVoiceFile'),

  // Phase 5
  semanticSearch: (query, limit) => get(`/api/search?q=${encodeURIComponent(query)}&limit=${limit || 50}`),
  rebuildEmbeddings: () => post('/api/embeddings/rebuild', {}),
  saveAudioRecording: () => notSupported('saveAudioRecording'),
  getTranscriptionConfig: () => Promise.resolve({ engine: 'none', configured: false, ollamaUrl: '' }),
  saveTranscriptionConfig: () => Promise.resolve(),

  // Connectors
  connectorList: () => get<{ id: string; name: string; icon: string; status: { connected: boolean; lastSync: string | null; lastError: string | null; eventCount: number } }[]>('/api/connectors').catch((): { id: string; name: string; icon: string; status: { connected: boolean; lastSync: string | null; lastError: string | null; eventCount: number } }[] => []),
  connectorAuthenticate: (id, config) => post(`/api/connectors/${id}/auth`, config),
  connectorCallback: (id, code) => post(`/api/connectors/${id}/callback`, { code }),
  connectorSync: (id) => post(`/api/connectors/${id}/sync`, {}),
  connectorDisconnect: (id) => del(`/api/connectors/${id}`),

  // Privacy
  getPrivacyStats: () => get<{ retentionPeriod: string; totalEvents: number; sensitiveEvents: number; voiceFiles: number; dbSizeBytes: number }>('/api/privacy/stats').catch(() => ({
    retentionPeriod: 'forever',
    totalEvents: 0,
    sensitiveEvents: 0,
    voiceFiles: 0,
    dbSizeBytes: 0,
  })),
  setRetentionPolicy: (period) => post('/api/privacy/retention', { period }),
  exportAllData: () => notSupported('exportAllData'),
  panicWipe: () => notSupported('panicWipe'),

  // Notes
  createNote: (content, source, tags) => post('/api/notes', { content, source, tags }),
  getWeeklyHighlights: () => get('/api/memories/recent').then(() => []).catch(() => []),

  // Phase 6: Dark Grain
  getRedoDay: (date) => get(`/api/redo/${date}`),
  getMomentData: (timestamp, windowMinutes) => get(`/api/redo/moment?ts=${encodeURIComponent(timestamp)}&window=${windowMinutes}`),
  getForensicContext: (eventId, windowMinutes) => get(`/api/forensic/${eventId}?window=${windowMinutes || 30}`),
  scanInconsistencies: (startDate, endDate) => post('/api/inconsistencies/scan', { startDate, endDate }),
  getInconsistencies: (limit) => get(`/api/inconsistencies?limit=${limit || 50}`),
  dismissInconsistency: (id) => del(`/api/inconsistencies/${id}`),
  generateConfrontations: (period) => post('/api/confrontations/generate', { period }),
  getConfrontations: (limit) => get(`/api/confrontations?limit=${limit || 20}`),
  acknowledgeConfrontation: (id) => del(`/api/confrontations/${id}`),
  comparePeriods: (p1Start, p1End, p2Start, p2End) => post('/api/compare', { p1Start, p1End, p2Start, p2End }),

  // Phase 7: Visual Memory
  importPhotos: () => notSupported('importPhotos'),
  importVideo: () => notSupported('importVideo'),
  analyzePhoto: (eventId) => post(`/api/photos/${eventId}/analyze`, {}),
  getPhotoFile: (filePath: string) => get<string>(`/api/photos/file?path=${encodeURIComponent(filePath)}`),
  getVideoFile: () => notSupported('getVideoFile'),
  getVisualMemories: (limit) => get<any[]>(`/api/visual-memories?limit=${limit || 50}`).catch((): any[] => []),

  // Phase 8: Visual Comparison
  compareImages: (img1, img2) => post('/api/visual/compare', { imagePath1: img1, imagePath2: img2 }),
  comparePhotoSets: (p1s, p1e, p2s, p2e) => post('/api/visual/compare-sets', { p1Start: p1s, p1End: p1e, p2Start: p2s, p2End: p2e }),
  getVisualInconsistencies: (limit) => get<any[]>(`/api/visual/inconsistencies?limit=${limit || 50}`).catch((): any[] => []),
};
