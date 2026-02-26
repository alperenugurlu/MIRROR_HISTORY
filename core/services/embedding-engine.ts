import { loadAIConfig } from './transcription';
import * as db from '../database';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 384;
const BATCH_SIZE = 100; // OpenAI batch limit

// ── In-memory cache for fast cosine search ──

let cache: Map<string, Float32Array> | null = null;

function getCache(): Map<string, Float32Array> {
  if (cache) return cache;
  cache = new Map();
  const rows = db.getAllEmbeddings();
  for (const row of rows) {
    // Copy to own Float32Array (row.embedding Buffer may share ArrayBuffer)
    const floats = new Float32Array(
      row.embedding.buffer,
      row.embedding.byteOffset,
      row.embedding.byteLength / 4,
    );
    cache.set(row.event_id, new Float32Array(floats));
  }
  return cache;
}

export function invalidateEmbeddingCache(): void {
  cache = null;
}

// ── OpenAI API Key ──

function getOpenAIKey(): string {
  const config = loadAIConfig();
  const key = config.openaiApiKey || config.whisperApiKey;
  if (!key) throw new Error('OpenAI API key not configured. Set in Settings.');
  return key;
}

export function isEmbeddingConfigured(): boolean {
  const config = loadAIConfig();
  return !!(config.openaiApiKey || config.whisperApiKey);
}

// ── Embedding API Calls ──

export async function embedText(text: string): Promise<number[]> {
  const key = getOpenAIKey();

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text.slice(0, 8000),
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI Embedding API error: ${response.status} — ${err}`);
  }

  const result = await response.json() as {
    data: { index: number; embedding: number[] }[];
  };
  return result.data[0].embedding;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const key = getOpenAIKey();
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE).map(t => t.slice(0, 8000));

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: batch,
        dimensions: EMBEDDING_DIMENSIONS,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI Embedding API error: ${response.status} — ${err}`);
    }

    const result = await response.json() as {
      data: { index: number; embedding: number[] }[];
    };
    const sorted = result.data.sort((a, b) => a.index - b.index);
    allEmbeddings.push(...sorted.map(d => d.embedding));
  }

  return allEmbeddings;
}

// ── Cosine Similarity (optimized for Float32Array) ──

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ── Text Building (rich text from event + related data) ──

export function buildEmbeddingText(eventId: string): string {
  const event = db.getEvent(eventId);
  if (!event) return '';

  const parts: string[] = [event.summary];

  // Enrich with typed data from related tables
  const note = db.getNoteByEvent(eventId);
  if (note) parts.push(note.content);

  const voiceMemo = db.getVoiceMemoByEvent(eventId);
  if (voiceMemo?.transcript) parts.push(voiceMemo.transcript);

  const calEvent = db.getCalendarEventByEvent(eventId);
  if (calEvent) {
    parts.push(calEvent.title);
    if (calEvent.description) parts.push(calEvent.description);
    if (calEvent.location) parts.push(`location: ${calEvent.location}`);
  }

  const location = db.getLocationByEvent(eventId);
  if (location?.address) parts.push(`at ${location.address}`);

  const mood = db.getMoodByEvent(eventId);
  if (mood) {
    parts.push(`mood: ${mood.score}/5`);
    if (mood.note) parts.push(mood.note);
  }

  const health = db.getHealthEntryByEvent(eventId);
  if (health) {
    parts.push(`${health.metric_type}: ${health.value} ${health.unit}`);
  }

  // Phase 7: Visual memory context
  const photo = db.getPhotoByEvent(eventId);
  if (photo) {
    const analysis = db.getPhotoAnalysisByPhoto(photo.id);
    if (analysis) {
      parts.push(`Photo: ${analysis.description}`);
      try {
        const tags = JSON.parse(analysis.tags || '[]');
        if (tags.length) parts.push(`Visual tags: ${tags.join(', ')}`);
      } catch { /* ignore */ }
      if (analysis.detected_text) parts.push(`Text in image: ${analysis.detected_text}`);
    } else if (photo.caption) {
      parts.push(`Photo: ${photo.caption}`);
    }
  }

  const video = db.getVideoByEvent(eventId);
  if (video && video.summary) {
    parts.push(`Video (${Math.round(video.duration_seconds)}s): ${video.summary}`);
  }

  // Add date context for temporal queries
  if (event.timestamp) {
    const dateStr = event.timestamp.slice(0, 10);
    try {
      const dayOfWeek = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });
      parts.push(`on ${dayOfWeek} ${dateStr}`);
    } catch {
      parts.push(`on ${dateStr}`);
    }
  }

  return parts.filter(Boolean).join('. ').slice(0, 8000);
}

// ── Vector Search (in-memory cosine similarity against all cached embeddings) ──

export function vectorSearch(
  queryEmbedding: number[],
  limit: number,
): { event_id: string; score: number }[] {
  const cached = getCache();
  if (cached.size === 0) return [];

  const queryF32 = new Float32Array(queryEmbedding);
  const results: { event_id: string; score: number }[] = [];

  for (const [eventId, embedding] of cached) {
    const score = cosineSimilarity(queryF32, embedding);
    results.push({ event_id: eventId, score });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

// ── Rebuild All Embeddings (batch process un-embedded events) ──

export async function rebuildEmbeddings(): Promise<{
  total: number;
  embedded: number;
  errors: number;
}> {
  const unembedded = db.getUnembeddedEventIds();
  const total = unembedded.length;
  let embedded = 0;
  let errors = 0;

  // Build texts for all un-embedded events
  for (let i = 0; i < unembedded.length; i += BATCH_SIZE) {
    const batchIds = unembedded.slice(i, i + BATCH_SIZE);

    // Build texts, filtering out empty ones
    const validPairs: { id: string; text: string }[] = [];
    for (const id of batchIds) {
      const text = buildEmbeddingText(id);
      if (text.trim()) {
        validPairs.push({ id, text });
      }
    }

    if (validPairs.length === 0) continue;

    try {
      const embeddings = await embedBatch(validPairs.map(p => p.text));
      for (let j = 0; j < validPairs.length; j++) {
        db.upsertEmbedding(validPairs[j].id, embeddings[j], EMBEDDING_MODEL);
        embedded++;
      }
    } catch (err) {
      console.error('Embedding batch error:', err);
      errors += validPairs.length;
    }
  }

  // Invalidate cache so it reloads with new data
  invalidateEmbeddingCache();

  return { total, embedded, errors };
}

// ── Auto-embed a single event (called after event creation) ──

export async function embedEventIfConfigured(eventId: string): Promise<void> {
  if (!isEmbeddingConfigured()) return;

  const text = buildEmbeddingText(eventId);
  if (!text.trim()) return;

  try {
    const embedding = await embedText(text);
    db.upsertEmbedding(eventId, embedding, EMBEDDING_MODEL);

    // Update in-memory cache
    if (cache) {
      cache.set(eventId, new Float32Array(embedding));
    }
  } catch (err) {
    console.error(`Failed to embed event ${eventId}:`, err);
  }
}
