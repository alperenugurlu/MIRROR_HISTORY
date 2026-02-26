// ── Event types ──
export type EventType =
  | 'money_transaction'
  | 'subscription'
  | 'price_increase'
  | 'refund_pending'
  | 'anomaly'
  | 'user_rule'
  | 'action_draft'
  | 'reminder'
  // Life event types (Phase 2)
  | 'note'
  | 'voice_memo'
  | 'thought'
  | 'decision'
  | 'observation'
  // Phase 3: Grain — multi-source life recording
  | 'location'
  | 'calendar_event'
  | 'health_entry'
  | 'mood'
  | 'ai_digest'
  // Phase 7: Visual Memory — "The Grain Sees"
  | 'photo'
  | 'video'
  // Phase 6: Dark Grain — "The Entire History of You"
  | 'inconsistency'
  | 'confrontation';

export type Classification = 'local_private' | 'local_sensitive';
export type PeriodType = 'daily' | 'weekly' | 'monthly';
export type TransactionSource = 'csv_import' | 'email_receipt';
export type SubscriptionPeriod = 'monthly' | 'annual' | 'unknown';
export type SubscriptionStatus = 'active' | 'paused' | 'unknown';
export type EvidenceType = 'csv_row' | 'receipt_email' | 'file' | 'note';
export type NoteSource = 'manual' | 'telegram' | 'api' | 'voice_transcription';
export type MemoSource = 'telegram' | 'api' | 'file_import';
export type RuleType = 'ignore_merchant' | 'ignore_category' | 'threshold' | 'whitelist_subscription';
export type ActionType = 'draft_email' | 'create_reminder' | 'mark_ignore';
export type ActionStatus = 'draft' | 'approved' | 'applied' | 'cancelled';

// Phase 3 types
export type LocationSource = 'google_takeout' | 'manual' | 'api' | 'telegram';
export type HealthMetricType = 'steps' | 'heart_rate' | 'sleep_hours' | 'workout' | 'weight';
export type HealthSource = 'apple_health' | 'manual' | 'api';
export type ChatRole = 'user' | 'assistant';
export type DigestPeriod = 'weekly' | 'monthly';
export type PhotoSource = 'import' | 'telegram' | 'screenshot' | 'api';
export type VideoSource = 'import' | 'api';

// ── DB row types ──

export interface Event {
  id: string;
  type: EventType;
  timestamp: string;
  summary: string;
  details_json: string;
  confidence: number;
  classification: Classification;
  created_at: string;
  content_hash?: string;
}

export interface MoneyTransaction {
  id: string;
  event_id: string;
  date: string;
  merchant: string;
  amount: number;
  currency: string;
  category: string | null;
  account: string | null;
  raw_row_hash: string;
  source: TransactionSource;
  source_ref: string;
}

export interface Subscription {
  id: string;
  merchant: string;
  estimated_period: SubscriptionPeriod;
  first_seen_date: string;
  last_seen_date: string;
  typical_amount: number;
  status: SubscriptionStatus;
  confidence: number;
}

export interface Diff {
  id: string;
  period_type: PeriodType;
  period_start: string;
  period_end: string;
  diff_summary: string;
  diff_json: string;
}

export interface EvidenceRef {
  id: string;
  event_id: string;
  evidence_type: EvidenceType;
  pointer: string;
  excerpt: string;
  hash: string;
  created_at: string;
}

export interface Rule {
  id: string;
  rule_type: RuleType;
  rule_json: string;
  created_at: string;
  enabled: number; // SQLite boolean
}

export interface Action {
  id: string;
  event_id: string;
  action_type: ActionType;
  status: ActionStatus;
  payload_json: string;
  created_at: string;
  applied_at: string | null;
}

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  entry_type: string;
  description: string;
  details_json: string;
}

// ── Life Memory types ──

export interface Note {
  id: string;
  event_id: string;
  content: string;
  source: NoteSource;
  tags: string;  // JSON array stored as text
  created_at: string;
}

export interface VoiceMemo {
  id: string;
  event_id: string;
  transcript: string;
  duration_seconds: number;
  file_path: string;
  source: MemoSource;
  created_at: string;
}

// ── Phase 7: Visual Memory types ──

export interface PhotoRecord {
  id: string;
  event_id: string;
  file_path: string;
  caption: string;
  source: string;
  created_at: string;
}

export interface PhotoAnalysis {
  id: string;
  photo_id: string;
  description: string;
  tags: string;             // JSON array
  detected_text: string;
  mood_indicators: string;  // JSON object
  people_count: number;
  analyzed_at: string;
  model: string;
}

export interface Video {
  id: string;
  event_id: string;
  file_path: string;
  duration_seconds: number;
  frame_count: number;
  summary: string;
  source: VideoSource;
  created_at: string;
}

export interface VideoFrame {
  id: string;
  video_id: string;
  frame_path: string;
  timestamp_seconds: number;
  description: string;
}

// ── Phase 3: Multi-source data ──

export interface Location {
  id: string;
  event_id: string;
  lat: number;
  lng: number;
  address: string;
  timestamp: string;
  source: LocationSource;
}

export interface CalendarEvent {
  id: string;
  event_id: string;
  title: string;
  start_time: string;
  end_time: string;
  location: string;
  description: string;
}

export interface HealthEntry {
  id: string;
  event_id: string;
  metric_type: HealthMetricType;
  value: number;
  unit: string;
  timestamp: string;
  source: HealthSource;
}

export interface MoodEntry {
  id: string;
  event_id: string;
  score: number; // 1-5
  note: string;
  timestamp: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  context_summary: string;
  created_at: string;
}

export interface AIDigest {
  id: string;
  event_id: string;
  period: DigestPeriod;
  period_start: string;
  period_end: string;
  content: string;
  created_at: string;
}

export interface MemorySearchResult {
  event: Event;
  snippet: string;
  rank: number;
  note?: Note;
  voice_memo?: VoiceMemo;
  transaction?: MoneyTransaction;
  location?: Location;
  calendar_event?: CalendarEvent;
  health_entry?: HealthEntry;
  mood?: MoodEntry;
  photo?: PhotoRecord & { analysis?: PhotoAnalysis };
  video?: Video;
}

export interface SemanticSearchResult extends MemorySearchResult {
  score: number; // Combined similarity score (0-1)
}

export interface TimelineEntry {
  date: string;
  events: (Event & {
    note?: Note;
    voice_memo?: VoiceMemo;
    transaction?: MoneyTransaction;
    location?: Location;
    calendar_event?: CalendarEvent;
    health_entry?: HealthEntry;
    mood?: MoodEntry;
    photo?: PhotoRecord & { analysis?: PhotoAnalysis };
    video?: Video & { frames?: VideoFrame[] };
  })[];
}

// ── UI / API types ──

export interface DiffCard {
  id: string;
  event_id: string;
  title: string;
  type: 'subscription' | 'price_increase' | 'refund_pending' | 'anomaly' | 'spending_summary';
  impact: number;
  confidence: number;
  merchant: string;
  summary: string;
  details: Record<string, unknown>;
  evidence_ids: string[];
  suggested_actions: ActionType[];
}

export interface DiffResult {
  id: string;
  period_type: PeriodType;
  period_start: string;
  period_end: string;
  summary: string;
  cards: DiffCard[];
  total_spent: number;
  baseline_spent: number;
  change_pct: number;
}

export interface TimeMachineData {
  event: Event;
  explanation: string;
  drivers: string[];
  evidence: EvidenceRef[];
  baseline_comparison: {
    current: number;
    baseline: number;
    change_pct: number;
    period_label: string;
  } | null;
  confidence_statement: string;
}

export interface MonthlyAuditData {
  month: string;
  new_subscriptions: DiffCard[];
  price_increases: DiffCard[];
  refunds_pending: DiffCard[];
  anomalies: DiffCard[];
  total_leakage: number;
}

export interface ColumnMapping {
  date: string;
  merchant: string;
  amount: string;
  currency?: string;
  category?: string;
  account?: string;
}

export interface CsvPreviewRow {
  [key: string]: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

// ── Phase 3 UI types ──

export interface ImportStats {
  transactions: { count: number; lastImport: string | null };
  locations: { count: number; lastImport: string | null };
  calendar: { count: number; lastImport: string | null };
  health: { count: number; lastImport: string | null };
  photos: { count: number; analyzed: number; lastImport: string | null };
  videos: { count: number; lastImport: string | null };
}

export interface TimelineStats {
  totalEvents: number;
  byType: Record<string, number>;
  dateRange: { min: string; max: string } | null;
}

// ── Phase 4: "Entire History of You" types ──

export interface DailyNarrative {
  date: string;
  narrative: string;
  moodAvg: number | null;
  eventCount: number;
  dominantTypes: string[];
}

export interface EnrichedTimelineEntry extends TimelineEntry {
  narrative?: string;
  moodAvg: number | null;
  eventCount: number;
}

// ── Phase 6: Dark Grain — Re-do & Forensic types ──

export interface MomentSnapshot {
  timestamp: string;
  location?: Location;
  mood?: MoodEntry;
  transactions: MoneyTransaction[];
  calendarEvents: CalendarEvent[];
  healthEntries: HealthEntry[];
  notes: Note[];
  voiceMemos: VoiceMemo[];
}

export interface HourlySlice {
  hour: number; // 0-23
  label: string; // "09:00"
  snapshot: MomentSnapshot;
  eventCount: number;
  dominantType: EventType | null;
}

export interface RedoDay {
  date: string;
  slices: HourlySlice[];
  moodArc: { hour: number; score: number }[];
  totalEvents: number;
  narrative?: string;
}

export interface ForensicContext {
  event: Event;
  before: EnrichedEvent[];
  after: EnrichedEvent[];
  crossDomain: MomentSnapshot;
  similarMoments: { date: string; similarity: number; summary: string }[];
  suggestedQuestions: string[];
  visualComparison?: {
    targetPhotoPath: string;
    similarPhotoPaths: { path: string; date: string; similarity: number }[];
  };
}

export type EnrichedEvent = Event & {
  note?: Note;
  voice_memo?: VoiceMemo;
  transaction?: MoneyTransaction;
  location?: Location;
  calendar_event?: CalendarEvent;
  health_entry?: HealthEntry;
  mood?: MoodEntry;
  photo?: PhotoRecord & { analysis?: PhotoAnalysis };
  video?: Video & { frames?: VideoFrame[] };
};

// ── Phase 6: Dark Grain — Inconsistency Engine types ──

export type InconsistencyType =
  | 'location_mismatch'    // Calendar says X, location says Y
  | 'schedule_conflict'    // Overlapping calendar events
  | 'mood_behavior_disconnect' // High mood but negative actions, or vice versa
  | 'pattern_break'        // Regular routine disrupted
  | 'spending_mood_correlation' // Spending spikes on low-mood days
  | 'time_gap'             // Hours with no data (suspicious silence)
  | 'visual_mood_mismatch'; // Photo expression contradicts reported mood

export interface Inconsistency {
  id: string;
  type: InconsistencyType;
  severity: number;        // 0-1, how "dark" this finding is
  title: string;           // Blunt headline
  description: string;     // Detailed explanation with evidence
  evidenceEventIds: string[];
  suggestedQuestion: string; // Follow-up to dig deeper
  detectedAt: string;
  date: string;            // The date this inconsistency pertains to
  dismissed?: boolean;     // User acknowledged/dismissed this finding
}

export interface InconsistencyScanResult {
  scannedDays: number;
  found: Inconsistency[];
}

// ── Phase 6: Dark Grain — Confrontation Engine types ──

export type ConfrontationCategory = 'correlation' | 'trend' | 'anomaly';

export interface Confrontation {
  id: string;
  title: string;
  insight: string;
  severity: number;           // 0-1, how uncomfortable
  dataPoints: { label: string; value: string }[];
  relatedEventIds: string[];
  category: ConfrontationCategory;
  generatedAt: string;
  acknowledged?: boolean;     // User acknowledged this truth
}

export interface ConfrontationResult {
  generated: number;
  confrontations: Confrontation[];
}

// ── Phase 6: Dark Grain — Comparison Engine types ──

export interface PeriodMetrics {
  mood: { avg: number; min: number; max: number; count: number };
  spending: { total: number; avgDaily: number; topMerchants: { name: string; total: number }[] };
  health: { avgSteps: number; avgSleep: number; workoutCount: number };
  calendar: { eventCount: number; avgPerDay: number };
  notes: { count: number; voiceCount: number };
  locations: { uniquePlaces: number };
  visual: VisualPeriodSummary;
}

export interface MetricChange {
  domain: string;
  metric: string;
  p1: number;
  p2: number;
  changePct: number;
  direction: 'up' | 'down' | 'stable';
}

export interface ComparisonResult {
  period1: { start: string; end: string; metrics: PeriodMetrics };
  period2: { start: string; end: string; metrics: PeriodMetrics };
  changes: MetricChange[];
  narrative?: string;
}

// ── Phase 8: Visual Comparison — "The Grain Compares" ──

export interface VisualComparisonResult {
  image1Path: string;
  image2Path: string;
  changes: VisualChange[];
  overallSummary: string;
  similarityScore: number;
  emotionalShift: {
    from: string;
    to: string;
    interpretation: string;
  } | null;
  physicalChanges: string[];
  environmentChanges: string[];
  peopleChanges: string | null;
}

export interface VisualChange {
  category: 'appearance' | 'environment' | 'expression' | 'objects' | 'text' | 'people' | 'posture' | 'lighting';
  description: string;
  significance: 'minor' | 'notable' | 'major';
}

export interface VisualPeriodSummary {
  photoCount: number;
  videoCount: number;
  dominantMood: string;
  avgPeopleCount: number;
  uniqueTags: string[];
  moodDistribution: Record<string, number>;
}

export interface VisualInconsistency {
  photoEventId: string;
  photoPath: string;
  photoMoodTone: string;
  photoMoodConfidence: number;
  reportedMoodScore: number;
  mismatchDescription: string;
  severity: number;
}

// ── Auth types ──
export interface AuthUser {
  id: string;
  username: string;
  mustChangePassword: boolean;
}

export interface LoginResult {
  token: string;
  user: AuthUser;
}

// ── IPC API shape ──
export interface MirrorHistoryApi {
  // Auth
  login(username: string, password: string): Promise<LoginResult>;
  changePassword(oldPassword: string, newPassword: string): Promise<{ success: boolean }>;
  getAuthUser(): Promise<AuthUser | null>;
  logout(): Promise<void>;

  selectFile(): Promise<string | null>;
  previewCsv(filePath: string): Promise<{ headers: string[]; rows: CsvPreviewRow[] }>;
  importCsv(filePath: string, mapping: ColumnMapping): Promise<ImportResult>;
  hasData(): Promise<boolean>;
  getTransactions(start?: string, end?: string): Promise<MoneyTransaction[]>;
  generateDiff(periodType: PeriodType, refDate: string): Promise<DiffResult>;
  getDiffs(periodType?: PeriodType): Promise<Diff[]>;
  getTimeMachine(eventId: string): Promise<TimeMachineData>;
  getSubscriptions(): Promise<Subscription[]>;
  getMonthlyAudit(month: string): Promise<MonthlyAuditData>;
  getRules(): Promise<Rule[]>;
  createRule(ruleType: RuleType, ruleJson: string): Promise<Rule>;
  updateRule(id: string, enabled: number): Promise<void>;
  deleteRule(id: string): Promise<void>;
  createAction(eventId: string, actionType: ActionType, payloadJson: string): Promise<Action>;
  updateActionStatus(id: string, status: ActionStatus): Promise<void>;
  getActions(): Promise<Action[]>;
  getActivityLog(): Promise<ActivityLogEntry[]>;

  // Phase 3: AI Chat
  sendChatMessage(message: string): Promise<{ userMsg: ChatMessage; assistantMsg: ChatMessage }>;
  getChatHistory(limit?: number): Promise<ChatMessage[]>;
  clearChatHistory(): Promise<void>;
  getAIStatus(): Promise<{ configured: boolean; transcription: boolean }>;

  // Phase 3: AI Digest
  generateDigest(period: DigestPeriod): Promise<AIDigest>;
  getDigests(limit?: number): Promise<AIDigest[]>;

  // Phase 3: Import Hub
  getImportStats(): Promise<ImportStats>;
  importLocationHistory(filePath: string): Promise<ImportResult>;
  importCalendarICS(filePath: string): Promise<ImportResult>;
  importAppleHealth(filePath: string): Promise<ImportResult>;
  selectFileWithFilter(filterName: string, extensions: string[]): Promise<string | null>;

  // Phase 3: Timeline
  getEnhancedTimeline(start: string, end: string, types?: EventType[]): Promise<TimelineEntry[]>;
  getTimelineStats(): Promise<TimelineStats>;

  // Phase 3: Mood
  recordMood(score: number, note?: string): Promise<{ event_id: string; mood: MoodEntry }>;

  // Phase 3H: Settings
  getAIConfig(): Promise<{
    hasAnthropicKey: boolean;
    hasWhisperKey: boolean;
    hasOpenaiKey: boolean;
    embeddingStats: { count: number; total: number };
    privacyLevel: string;
  }>;
  saveAIConfigSettings(config: { anthropicApiKey?: string; whisperApiKey?: string; openaiApiKey?: string; privacyLevel?: string }): Promise<void>;
  getTelegramConfig(): Promise<{ hasToken: boolean; allowedChatIds: number[] } | null>;
  saveTelegramConfig(config: { botToken: string; allowedChatIds: number[] }): Promise<{ ok: boolean; message: string }>;
  getTelegramStatus(): Promise<{ running: boolean; botUsername?: string }>;
  getSystemStatus(): Promise<{ apiServer: boolean; dbEvents: number; dbDateRange: { min: string; max: string } | null }>;

  // Phase 4: "Entire History of You"
  getDailyNarrative(date: string): Promise<DailyNarrative>;
  getVoiceFile(filePath: string): Promise<string>;  // base64 audio data

  // Phase 5: Semantic Search
  semanticSearch(query: string, limit?: number): Promise<SemanticSearchResult[]>;
  rebuildEmbeddings(): Promise<{ total: number; embedded: number; errors: number }>;

  // Phase 5: Voice Recording
  saveAudioRecording(base64Audio: string, durationSeconds: number): Promise<{ event_id: string; transcript: string }>;
  getTranscriptionConfig(): Promise<{ engine: string; configured: boolean; ollamaUrl: string }>;
  saveTranscriptionConfig(config: { engine?: string; ollamaUrl?: string; ollamaModel?: string }): Promise<void>;

  // Phase 5: Connector Framework
  connectorList(): Promise<{
    id: string;
    name: string;
    icon: string;
    status: { connected: boolean; lastSync: string | null; lastError: string | null; eventCount: number };
  }[]>;
  connectorAuthenticate(connectorId: string, config: Record<string, string>): Promise<{ ok: boolean; authUrl?: string; error?: string }>;
  connectorCallback(connectorId: string, code: string): Promise<{ ok: boolean; error?: string }>;
  connectorSync(connectorId: string): Promise<{ imported: number; errors: number }>;
  connectorDisconnect(connectorId: string): Promise<{ ok: boolean; error?: string }>;

  // Phase 5: Privacy Controls
  getPrivacyStats(): Promise<{
    retentionPeriod: string;
    totalEvents: number;
    sensitiveEvents: number;
    voiceFiles: number;
    dbSizeBytes: number;
  }>;
  setRetentionPolicy(period: string): Promise<void>;
  exportAllData(excludeSensitive?: boolean): Promise<{ filePath: string }>;
  panicWipe(): Promise<{ success: boolean; message: string }>;

  // Quick Note Input
  createNote(content: string, source?: string, tags?: string[]): Promise<{ event_id: string }>;

  // Phase 5: Moment Detection
  getWeeklyHighlights(): Promise<{
    id: string;
    type: string;
    date: string;
    title: string;
    description: string;
    icon: string;
    score: number;
    relatedEventIds: string[];
  }[]>;

  // Phase 6: Dark Grain — Re-do
  getRedoDay(date: string): Promise<RedoDay>;
  getMomentData(timestamp: string, windowMinutes: number): Promise<MomentSnapshot>;

  // Phase 6: Dark Grain — Forensic Zoom
  getForensicContext(eventId: string, windowMinutes?: number): Promise<ForensicContext>;

  // Phase 6: Dark Grain — Inconsistency Engine
  scanInconsistencies(startDate: string, endDate: string): Promise<InconsistencyScanResult>;
  getInconsistencies(limit?: number): Promise<Inconsistency[]>;
  dismissInconsistency(id: string): Promise<void>;

  // Phase 6: Dark Grain — Confrontation Engine
  generateConfrontations(period: 'weekly' | 'monthly'): Promise<ConfrontationResult>;
  getConfrontations(limit?: number): Promise<Confrontation[]>;
  acknowledgeConfrontation(id: string): Promise<void>;

  // Phase 6: Dark Grain — Comparison Mode
  comparePeriods(p1Start: string, p1End: string, p2Start: string, p2End: string): Promise<ComparisonResult>;

  // Phase 7: Visual Memory — "The Grain Sees"
  importPhotos(filePaths: string[]): Promise<{ imported: number; analyzed: number; errors: string[] }>;
  importVideo(filePath: string): Promise<{ event_id: string; frames_extracted: number; summary: string }>;
  analyzePhoto(eventId: string): Promise<PhotoAnalysis>;
  getPhotoFile(filePath: string): Promise<string>;
  getVideoFile(filePath: string): Promise<string>;
  selectMultipleFiles(filterName: string, extensions: string[]): Promise<string[]>;
  getVisualMemories(limit?: number): Promise<(Event & { photo?: PhotoRecord & { analysis?: PhotoAnalysis }; video?: Video })[]>;

  // Phase 8: Visual Comparison — "The Grain Compares"
  compareImages(imagePath1: string, imagePath2: string): Promise<VisualComparisonResult>;
  comparePhotoSets(p1Start: string, p1End: string, p2Start: string, p2End: string): Promise<{
    period1Summary: VisualPeriodSummary;
    period2Summary: VisualPeriodSummary;
    comparison: VisualComparisonResult | null;
    narrative: string;
  }>;
  getVisualInconsistencies(limit?: number): Promise<VisualInconsistency[]>;
}
