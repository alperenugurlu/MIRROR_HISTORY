import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { loadAIConfig } from './transcription';

const VISION_MODEL = 'claude-sonnet-4-20250514';

function getClient(): Anthropic {
  const config = loadAIConfig();
  if (!config.anthropicApiKey) {
    throw new Error('Anthropic API key not configured for vision analysis.');
  }
  return new Anthropic({ apiKey: config.anthropicApiKey });
}

export function isVisionConfigured(): boolean {
  const config = loadAIConfig();
  return !!config.anthropicApiKey;
}

/**
 * Get the MIME type for an image file based on extension.
 */
function getMediaType(filePath: string): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
    case '.heic':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    default:
      return 'image/jpeg';
  }
}

export interface ImageAnalysisResult {
  description: string;
  tags: string[];
  detected_text: string;
  mood_indicators: { tone: string; confidence: number };
  people_count: number;
}

/**
 * Analyze a single image using Claude Vision API.
 * Reads the file, sends it as base64, and parses the structured response.
 */
export async function analyzeImage(imagePath: string): Promise<ImageAnalysisResult> {
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Image file not found: ${imagePath}`);
  }

  const client = getClient();
  const imageBuffer = fs.readFileSync(imagePath);
  const base64 = imageBuffer.toString('base64');
  const mediaType = getMediaType(imagePath);

  const response = await client.messages.create({
    model: VISION_MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64,
            },
          },
          {
            type: 'text',
            text: `You are the visual cortex of a personal memory system called "the grain." Analyze this image as a visual memory being recorded.

Respond with ONLY a JSON object (no markdown, no backticks):
{
  "description": "A vivid 2-3 sentence scene description capturing what this moment looks like",
  "tags": ["tag1", "tag2", "tag3"],
  "detected_text": "Any visible text, signs, labels, or writing in the image. Empty string if none.",
  "mood_indicators": { "tone": "one of: joyful, calm, tense, melancholic, energetic, neutral", "confidence": 0.0-1.0 },
  "people_count": 0
}

Be precise with tags — include objects, settings, activities, time of day cues, colors, and emotions.`,
          },
        ],
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  try {
    // Try to parse the JSON response, handling potential markdown wrapping
    const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      description: parsed.description || '',
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      detected_text: parsed.detected_text || '',
      mood_indicators: parsed.mood_indicators || { tone: 'neutral', confidence: 0.5 },
      people_count: typeof parsed.people_count === 'number' ? parsed.people_count : 0,
    };
  } catch {
    // If JSON parsing fails, create a basic result from the raw text
    return {
      description: text.slice(0, 500),
      tags: [],
      detected_text: '',
      mood_indicators: { tone: 'neutral', confidence: 0.3 },
      people_count: 0,
    };
  }
}

/**
 * Summarize multiple video frame descriptions into a cohesive video summary.
 * This is a text-only call (no vision needed — descriptions are already extracted).
 */
export async function summarizeVideoFrames(
  frameAnalyses: { timestamp: number; description: string }[],
): Promise<string> {
  if (frameAnalyses.length === 0) return '';

  const client = getClient();

  const frameList = frameAnalyses
    .map(f => `[${Math.floor(f.timestamp / 60)}:${(f.timestamp % 60).toString().padStart(2, '0')}] ${f.description}`)
    .join('\n');

  const response = await client.messages.create({
    model: VISION_MODEL,
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `You are the visual cortex of a personal memory system called "the grain." Given these frame-by-frame descriptions of a video, create a cohesive 2-4 sentence summary of what happens in this video memory.

Frame descriptions:
${frameList}

Write a natural, vivid summary. No JSON — just plain text.`,
      },
    ],
  });

  return response.content[0].type === 'text' ? response.content[0].text.trim() : '';
}
