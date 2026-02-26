import { contextBridge, ipcRenderer } from 'electron';
import type { MirrorHistoryApi } from '../shared/types';

const api: MirrorHistoryApi = {
  // Auth
  login: (username, password) => ipcRenderer.invoke('login', username, password),
  changePassword: (oldPassword, newPassword) => ipcRenderer.invoke('change-password', oldPassword, newPassword),
  getAuthUser: () => ipcRenderer.invoke('get-auth-user'),
  logout: () => ipcRenderer.invoke('logout'),

  selectFile: () => ipcRenderer.invoke('select-file'),
  previewCsv: (filePath) => ipcRenderer.invoke('preview-csv', filePath),
  importCsv: (filePath, mapping) => ipcRenderer.invoke('import-csv', filePath, mapping),
  hasData: () => ipcRenderer.invoke('has-data'),
  getTransactions: (start, end) => ipcRenderer.invoke('get-transactions', start, end),
  generateDiff: (periodType, refDate) => ipcRenderer.invoke('generate-diff', periodType, refDate),
  getDiffs: (periodType) => ipcRenderer.invoke('get-diffs', periodType),
  getTimeMachine: (eventId) => ipcRenderer.invoke('get-time-machine', eventId),
  getSubscriptions: () => ipcRenderer.invoke('get-subscriptions'),
  getMonthlyAudit: (month) => ipcRenderer.invoke('get-monthly-audit', month),
  getRules: () => ipcRenderer.invoke('get-rules'),
  createRule: (ruleType, ruleJson) => ipcRenderer.invoke('create-rule', ruleType, ruleJson),
  updateRule: (id, enabled) => ipcRenderer.invoke('update-rule', id, enabled),
  deleteRule: (id) => ipcRenderer.invoke('delete-rule', id),
  createAction: (eventId, actionType, payloadJson) => ipcRenderer.invoke('create-action', eventId, actionType, payloadJson),
  updateActionStatus: (id, status) => ipcRenderer.invoke('update-action-status', id, status),
  getActions: () => ipcRenderer.invoke('get-actions'),
  getActivityLog: () => ipcRenderer.invoke('get-activity-log'),

  // Phase 3: AI Chat
  sendChatMessage: (message) => ipcRenderer.invoke('send-chat-message', message),
  getChatHistory: (limit) => ipcRenderer.invoke('get-chat-history', limit),
  clearChatHistory: () => ipcRenderer.invoke('clear-chat-history'),
  getAIStatus: () => ipcRenderer.invoke('get-ai-status'),

  // Phase 3: AI Digest
  generateDigest: (period) => ipcRenderer.invoke('generate-digest', period),
  getDigests: (limit) => ipcRenderer.invoke('get-digests', limit),

  // Phase 3: Import Hub
  getImportStats: () => ipcRenderer.invoke('get-import-stats'),
  importLocationHistory: (filePath) => ipcRenderer.invoke('import-location-history', filePath),
  importCalendarICS: (filePath) => ipcRenderer.invoke('import-calendar-ics', filePath),
  importAppleHealth: (filePath) => ipcRenderer.invoke('import-apple-health', filePath),
  selectFileWithFilter: (filterName, extensions) => ipcRenderer.invoke('select-file-with-filter', filterName, extensions),

  // Phase 3: Timeline
  getEnhancedTimeline: (start, end, types) => ipcRenderer.invoke('get-enhanced-timeline', start, end, types),
  getTimelineStats: () => ipcRenderer.invoke('get-timeline-stats'),

  // Phase 3: Mood
  recordMood: (score, note) => ipcRenderer.invoke('record-mood', score, note),

  // Phase 3H: Settings
  getAIConfig: () => ipcRenderer.invoke('get-ai-config'),
  saveAIConfigSettings: (config) => ipcRenderer.invoke('save-ai-config', config),
  getTelegramConfig: () => ipcRenderer.invoke('get-telegram-config'),
  saveTelegramConfig: (config) => ipcRenderer.invoke('save-telegram-config', config),
  getTelegramStatus: () => ipcRenderer.invoke('get-telegram-status'),
  getSystemStatus: () => ipcRenderer.invoke('get-system-status'),

  // Phase 4: "Entire History of You"
  getDailyNarrative: (date) => ipcRenderer.invoke('get-daily-narrative', date),
  getVoiceFile: (filePath) => ipcRenderer.invoke('get-voice-file', filePath),

  // Phase 5: Semantic Search
  semanticSearch: (query, limit) => ipcRenderer.invoke('semantic-search', query, limit),
  rebuildEmbeddings: () => ipcRenderer.invoke('rebuild-embeddings'),

  // Phase 5: Voice Recording
  saveAudioRecording: (base64Audio, durationSeconds) => ipcRenderer.invoke('save-audio-recording', base64Audio, durationSeconds),
  getTranscriptionConfig: () => ipcRenderer.invoke('get-transcription-config'),
  saveTranscriptionConfig: (config) => ipcRenderer.invoke('save-transcription-config', config),

  // Phase 5: Connector Framework
  connectorList: () => ipcRenderer.invoke('connector-list'),
  connectorAuthenticate: (connectorId: string, config: Record<string, string>) => ipcRenderer.invoke('connector-authenticate', connectorId, config),
  connectorCallback: (connectorId: string, code: string) => ipcRenderer.invoke('connector-callback', connectorId, code),
  connectorSync: (connectorId: string) => ipcRenderer.invoke('connector-sync', connectorId),
  connectorDisconnect: (connectorId: string) => ipcRenderer.invoke('connector-disconnect', connectorId),

  // Phase 5: Privacy Controls
  getPrivacyStats: () => ipcRenderer.invoke('get-privacy-stats'),
  setRetentionPolicy: (period) => ipcRenderer.invoke('set-retention-policy', period),
  exportAllData: (excludeSensitive) => ipcRenderer.invoke('export-all-data', excludeSensitive),
  panicWipe: () => ipcRenderer.invoke('panic-wipe'),

  // Quick Note Input
  createNote: (content: string, source?: string, tags?: string[]) => ipcRenderer.invoke('create-note', content, source, tags),

  // Phase 5: Moment Detection
  getWeeklyHighlights: () => ipcRenderer.invoke('get-weekly-highlights'),

  // Phase 6: Dark Grain — Re-do
  getRedoDay: (date: string) => ipcRenderer.invoke('get-redo-day', date),
  getMomentData: (timestamp: string, windowMinutes: number) => ipcRenderer.invoke('get-moment-data', timestamp, windowMinutes),

  // Phase 6: Dark Grain — Forensic Zoom
  getForensicContext: (eventId: string, windowMinutes?: number) => ipcRenderer.invoke('get-forensic-context', eventId, windowMinutes),

  // Phase 6: Dark Grain — Inconsistency Engine
  scanInconsistencies: (startDate: string, endDate: string) => ipcRenderer.invoke('scan-inconsistencies', startDate, endDate),
  getInconsistencies: (limit?: number) => ipcRenderer.invoke('get-inconsistencies', limit),
  dismissInconsistency: (id: string) => ipcRenderer.invoke('dismiss-inconsistency', id),

  // Phase 6: Dark Grain — Confrontation Engine
  generateConfrontations: (period: 'weekly' | 'monthly') => ipcRenderer.invoke('generate-confrontations', period),
  getConfrontations: (limit?: number) => ipcRenderer.invoke('get-confrontations', limit),
  acknowledgeConfrontation: (id: string) => ipcRenderer.invoke('acknowledge-confrontation', id),

  // Phase 6: Dark Grain — Comparison Engine
  comparePeriods: (p1Start: string, p1End: string, p2Start: string, p2End: string) => ipcRenderer.invoke('compare-periods', p1Start, p1End, p2Start, p2End),

  // Phase 7: Visual Memory — "The Grain Sees"
  importPhotos: (filePaths: string[]) => ipcRenderer.invoke('import-photos', filePaths),
  importVideo: (filePath: string) => ipcRenderer.invoke('import-video', filePath),
  analyzePhoto: (eventId: string) => ipcRenderer.invoke('analyze-photo', eventId),
  getPhotoFile: (filePath: string) => ipcRenderer.invoke('get-photo-file', filePath),
  getVideoFile: (filePath: string) => ipcRenderer.invoke('get-video-file', filePath),
  selectMultipleFiles: (filterName: string, extensions: string[]) => ipcRenderer.invoke('select-multiple-files', filterName, extensions),
  getVisualMemories: (limit?: number) => ipcRenderer.invoke('get-visual-memories', limit),

  // Phase 8: Visual Comparison — "The Grain Compares"
  compareImages: (imagePath1: string, imagePath2: string) => ipcRenderer.invoke('compare-images', imagePath1, imagePath2),
  comparePhotoSets: (p1Start: string, p1End: string, p2Start: string, p2End: string) => ipcRenderer.invoke('compare-photo-sets', p1Start, p1End, p2Start, p2End),
  getVisualInconsistencies: (limit?: number) => ipcRenderer.invoke('get-visual-inconsistencies', limit),
};

contextBridge.exposeInMainWorld('api', api);
