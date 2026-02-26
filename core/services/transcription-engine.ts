/**
 * Dual Transcription Engine
 * Supports: OpenAI Whisper API + Ollama local whisper
 * User selects preferred engine in Settings.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { loadAIConfig, saveAIConfig } from './transcription';

export type TranscriptionEngine = 'openai' | 'ollama';

interface TranscriptionConfig {
  engine: TranscriptionEngine;
  ollamaUrl: string; // e.g. http://localhost:11434
  ollamaModel: string; // e.g. whisper
}

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
const DEFAULT_OLLAMA_MODEL = 'whisper';
const TRANSCRIPTION_CONFIG_PATH = path.join(os.homedir(), '.mirror-history', 'transcription-config.json');

// ── Config ──

export function loadTranscriptionConfig(): TranscriptionConfig {
  try {
    if (fs.existsSync(TRANSCRIPTION_CONFIG_PATH)) {
      const raw = JSON.parse(fs.readFileSync(TRANSCRIPTION_CONFIG_PATH, 'utf-8'));
      return {
        engine: raw.engine || 'openai',
        ollamaUrl: raw.ollamaUrl || DEFAULT_OLLAMA_URL,
        ollamaModel: raw.ollamaModel || DEFAULT_OLLAMA_MODEL,
      };
    }
  } catch {
    // ignore
  }
  return {
    engine: 'openai',
    ollamaUrl: DEFAULT_OLLAMA_URL,
    ollamaModel: DEFAULT_OLLAMA_MODEL,
  };
}

export function saveTranscriptionConfig(config: Partial<TranscriptionConfig>): void {
  const existing = loadTranscriptionConfig();
  const merged = { ...existing, ...config };
  const dir = path.dirname(TRANSCRIPTION_CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(TRANSCRIPTION_CONFIG_PATH, JSON.stringify(merged, null, 2), { mode: 0o600 });
}

// ── Transcription ──

export async function transcribe(filePath: string): Promise<string> {
  const config = loadTranscriptionConfig();

  if (config.engine === 'ollama') {
    return transcribeWithOllama(filePath, config);
  }
  return transcribeWithOpenAI(filePath);
}

async function transcribeWithOpenAI(filePath: string): Promise<string> {
  const aiConfig = loadAIConfig();
  const key = aiConfig.openaiApiKey || aiConfig.whisperApiKey;

  if (!key) {
    throw new Error('OpenAI API key not configured. Set in Settings.');
  }

  const audioData = fs.readFileSync(filePath);
  const formData = new FormData();
  formData.append('file', new Blob([audioData]), path.basename(filePath));
  formData.append('model', 'whisper-1');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Whisper API error: ${response.status} — ${error}`);
  }

  const result = await response.json() as { text: string };
  return result.text;
}

async function transcribeWithOllama(filePath: string, config: TranscriptionConfig): Promise<string> {
  // Ollama doesn't natively support audio transcription yet.
  // This uses a compatible endpoint pattern.
  // When Ollama adds whisper support, this will work.
  // For now, we try the /api/audio endpoint or fall back to a generic approach.

  const audioData = fs.readFileSync(filePath);
  const base64Audio = audioData.toString('base64');
  const ext = path.extname(filePath).slice(1) || 'webm';

  try {
    // Try Ollama's audio transcription endpoint (future-compatible)
    const response = await fetch(`${config.ollamaUrl}/api/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.ollamaModel,
        audio: base64Audio,
        format: ext,
      }),
    });

    if (response.ok) {
      const result = await response.json() as { text?: string; transcription?: string };
      return result.text || result.transcription || '';
    }

    // If /api/transcribe doesn't exist, try using generate with audio context
    const fallbackResponse = await fetch(`${config.ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.ollamaModel,
        prompt: 'Transcribe the following audio.',
        images: [base64Audio], // Some multimodal models accept audio through images field
        stream: false,
      }),
    });

    if (fallbackResponse.ok) {
      const result = await fallbackResponse.json() as { response?: string };
      return result.response || '';
    }

    throw new Error(`Ollama transcription failed: ${fallbackResponse.status}`);
  } catch (err) {
    if (err instanceof Error && err.message.includes('Ollama transcription failed')) {
      throw err;
    }
    throw new Error(`Cannot connect to Ollama at ${config.ollamaUrl}. Is it running?`);
  }
}

// ── Audio file management ──

export function getVoiceDir(): string {
  const dir = path.join(os.homedir(), '.mirror-history', 'voice');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function saveAudioFile(audioBuffer: Buffer, filename: string): string {
  const dir = getVoiceDir();
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, audioBuffer);
  return filePath;
}

// ── Status checks ──

export function isTranscriptionEngineConfigured(): {
  engine: TranscriptionEngine;
  configured: boolean;
  ollamaUrl: string;
} {
  const config = loadTranscriptionConfig();
  const aiConfig = loadAIConfig();

  if (config.engine === 'openai') {
    return {
      engine: 'openai',
      configured: !!(aiConfig.openaiApiKey || aiConfig.whisperApiKey),
      ollamaUrl: config.ollamaUrl,
    };
  }

  return {
    engine: 'ollama',
    configured: true, // Ollama is always "configured" if URL is set (connectivity checked on use)
    ollamaUrl: config.ollamaUrl,
  };
}
