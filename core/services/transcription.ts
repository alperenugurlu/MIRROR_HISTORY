import fs from 'fs';
import path from 'path';
import os from 'os';

const AI_CONFIG_PATH = path.join(os.homedir(), '.mirror-history', 'ai-config.json');

interface AIConfig {
  whisperApiKey?: string;
  anthropicApiKey?: string;
  openaiApiKey?: string;
  privacyLevel?: 'strict' | 'balanced';
}

export function loadAIConfig(): AIConfig {
  try {
    if (fs.existsSync(AI_CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(AI_CONFIG_PATH, 'utf-8'));
    }
  } catch {
    // ignore
  }
  return {};
}

export function saveAIConfig(config: Partial<AIConfig>): void {
  const existing = loadAIConfig();
  const merged = { ...existing, ...config };
  const dir = path.dirname(AI_CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(AI_CONFIG_PATH, JSON.stringify(merged, null, 2), { mode: 0o600 });
}

export async function transcribeAudio(filePath: string): Promise<string> {
  const config = loadAIConfig();

  if (!config.whisperApiKey) {
    throw new Error('Whisper API key not configured. Set via POST /api/ai/configure');
  }

  const audioData = fs.readFileSync(filePath);
  const formData = new FormData();
  formData.append('file', new Blob([audioData]), path.basename(filePath));
  formData.append('model', 'whisper-1');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.whisperApiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Whisper API error: ${response.status} ${error}`);
  }

  const result = await response.json() as { text: string };
  return result.text;
}

export function isTranscriptionConfigured(): boolean {
  const config = loadAIConfig();
  return !!config.whisperApiKey;
}
