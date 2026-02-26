// Core barrel export — Electron-free
export * from './types';
export * as db from './database';
export { initDatabase, getDb } from './database';
export { eventBus, broadcast } from './event-bus';
export type { MirrorHistoryEvent } from './event-bus';

// Services — Money
export { previewCsv, importCsv } from './services/csv-importer';
export { generateDiff, getTimeMachine, getMonthlyAudit } from './services/diff-engine';
export { createRule, toggleRule, removeRule } from './services/rule-engine';
export { createAction, updateStatus, generateEmailDraft } from './services/action-engine';
export {
  detectSubscriptions, detectPriceIncreases,
  detectPendingRefunds, detectAnomalies, applyRules,
} from './services/detectors';

// Services — Life Memory
export { createNote, createVoiceMemo, createThought, createDecision, createObservation } from './services/note-engine';
export { searchMemories, getTimeline, remember, getRecentMemories, getMemoryStats } from './services/memory-engine';
export { transcribeAudio, isTranscriptionConfigured, saveAIConfig } from './services/transcription';
