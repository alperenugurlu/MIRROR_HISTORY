/**
 * Visual Comparison Engine — "The Grain Compares"
 *
 * Compares two visual memories using Claude Vision API.
 * Detects changes between photos/video frames across time periods.
 * Finds mismatches between visual mood and reported mood.
 */

import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { loadAIConfig } from './transcription';
import * as db from '../database';
import type {
  VisualComparisonResult,
  VisualPeriodSummary,
  VisualInconsistency,
  PhotoAnalysis,
} from '../types';

const VISION_MODEL = 'claude-sonnet-4-20250514';

function getClient(): Anthropic {
  const config = loadAIConfig();
  if (!config.anthropicApiKey) {
    throw new Error('Anthropic API key not configured for visual comparison.');
  }
  return new Anthropic({ apiKey: config.anthropicApiKey });
}

function getMediaType(filePath: string): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.jpg': case '.jpeg': case '.heic': return 'image/jpeg';
    case '.png': return 'image/png';
    case '.gif': return 'image/gif';
    case '.webp': return 'image/webp';
    default: return 'image/jpeg';
  }
}

// ── Compare two images ──

export async function compareImages(
  imagePath1: string,
  imagePath2: string,
): Promise<VisualComparisonResult> {
  if (!fs.existsSync(imagePath1)) throw new Error(`Image not found: ${imagePath1}`);
  if (!fs.existsSync(imagePath2)) throw new Error(`Image not found: ${imagePath2}`);

  const client = getClient();
  const buf1 = fs.readFileSync(imagePath1);
  const buf2 = fs.readFileSync(imagePath2);

  const response = await client.messages.create({
    model: VISION_MODEL,
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: getMediaType(imagePath1), data: buf1.toString('base64') },
        },
        {
          type: 'image',
          source: { type: 'base64', media_type: getMediaType(imagePath2), data: buf2.toString('base64') },
        },
        {
          type: 'text',
          text: `You are the visual cortex of a personal memory system called "the grain" — a Black Mirror-style life recorder that sees everything and forgets nothing.

Compare these two images. The first is from an EARLIER time period, the second is from a LATER time period. This is the same person's life over time.

Analyze what changed between these two visual memories with forensic precision.

Respond with ONLY a JSON object (no markdown, no backticks):
{
  "overallSummary": "A 2-3 sentence narrative describing the most significant changes the grain detected. Write in second person. Be vivid and slightly unsettling.",
  "similarityScore": 0.0-1.0,
  "changes": [
    {
      "category": "appearance|environment|expression|objects|text|people|posture|lighting",
      "description": "Specific description of what changed",
      "significance": "minor|notable|major"
    }
  ],
  "emotionalShift": {
    "from": "tone of first image (joyful|calm|tense|melancholic|energetic|neutral)",
    "to": "tone of second image",
    "interpretation": "The grain's interpretation of the emotional shift"
  },
  "physicalChanges": ["List of detected physical/bodily changes"],
  "environmentChanges": ["List of background/setting changes"],
  "peopleChanges": "Description of changes in people present, or null"
}

Set emotionalShift to null if emotion comparison isn't applicable.
Be precise but haunting. The grain notices everything — weight changes, posture shifts, bags under eyes, clutter on a desk, the absence of someone who was there before.`,
        },
      ],
    }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    return {
      image1Path: imagePath1,
      image2Path: imagePath2,
      changes: Array.isArray(parsed.changes) ? parsed.changes : [],
      overallSummary: parsed.overallSummary || '',
      similarityScore: typeof parsed.similarityScore === 'number' ? parsed.similarityScore : 0.5,
      emotionalShift: parsed.emotionalShift || null,
      physicalChanges: Array.isArray(parsed.physicalChanges) ? parsed.physicalChanges : [],
      environmentChanges: Array.isArray(parsed.environmentChanges) ? parsed.environmentChanges : [],
      peopleChanges: parsed.peopleChanges || null,
    };
  } catch {
    return {
      image1Path: imagePath1,
      image2Path: imagePath2,
      changes: [],
      overallSummary: text.slice(0, 500),
      similarityScore: 0.5,
      emotionalShift: null,
      physicalChanges: [],
      environmentChanges: [],
      peopleChanges: null,
    };
  }
}

// ── Compare two video frames (same API, same logic) ──

export async function compareVideoFrames(
  frame1Path: string,
  frame2Path: string,
): Promise<VisualComparisonResult> {
  return compareImages(frame1Path, frame2Path);
}

// ── Gather visual metrics for a time period ──

export function gatherVisualMetrics(startTs: string, endTs: string): VisualPeriodSummary {
  const photos = db.getPhotosInWindow(startTs, endTs);
  const videos = db.getVideosInWindow(startTs, endTs);

  const moodDistribution: Record<string, number> = {};
  const allTags = new Set<string>();
  let totalPeople = 0;
  let peopleSamples = 0;

  for (const p of photos) {
    const analysis = (p as { analysis?: PhotoAnalysis }).analysis;
    if (analysis) {
      // Parse mood
      if (analysis.mood_indicators) {
        try {
          const mood = JSON.parse(analysis.mood_indicators);
          if (mood.tone) moodDistribution[mood.tone] = (moodDistribution[mood.tone] || 0) + 1;
        } catch { /* ignore */ }
      }
      // Parse tags
      if (analysis.tags) {
        try {
          const tags = JSON.parse(analysis.tags);
          if (Array.isArray(tags)) tags.forEach((t: string) => allTags.add(t));
        } catch { /* ignore */ }
      }
      // People count
      if (typeof analysis.people_count === 'number') {
        totalPeople += analysis.people_count;
        peopleSamples++;
      }
    }
  }

  let dominantMood = 'neutral';
  let maxCount = 0;
  for (const [tone, count] of Object.entries(moodDistribution)) {
    if (count > maxCount) { dominantMood = tone; maxCount = count; }
  }

  return {
    photoCount: photos.length,
    videoCount: videos.length,
    dominantMood,
    avgPeopleCount: peopleSamples > 0 ? Math.round((totalPeople / peopleSamples) * 10) / 10 : 0,
    uniqueTags: [...allTags],
    moodDistribution,
  };
}

// ── Compare photo sets across two periods ──

export async function comparePhotoSets(
  p1Start: string,
  p1End: string,
  p2Start: string,
  p2End: string,
): Promise<{
  period1Summary: VisualPeriodSummary;
  period2Summary: VisualPeriodSummary;
  comparison: VisualComparisonResult | null;
  narrative: string;
}> {
  const p1Ts = { start: p1Start + 'T00:00:00.000Z', end: p1End + 'T23:59:59.999Z' };
  const p2Ts = { start: p2Start + 'T00:00:00.000Z', end: p2End + 'T23:59:59.999Z' };

  const summary1 = gatherVisualMetrics(p1Ts.start, p1Ts.end);
  const summary2 = gatherVisualMetrics(p2Ts.start, p2Ts.end);

  // Pick the most recent analyzed photo from each period for AI comparison
  let comparison: VisualComparisonResult | null = null;

  const photo1 = db.getDb().prepare(`
    SELECT p.file_path FROM photos p
    JOIN events e ON p.event_id = e.id
    JOIN photo_analyses pa ON pa.photo_id = p.id
    WHERE e.timestamp >= ? AND e.timestamp <= ?
    ORDER BY e.timestamp DESC LIMIT 1
  `).get(p1Ts.start, p1Ts.end) as { file_path: string } | undefined;

  const photo2 = db.getDb().prepare(`
    SELECT p.file_path FROM photos p
    JOIN events e ON p.event_id = e.id
    JOIN photo_analyses pa ON pa.photo_id = p.id
    WHERE e.timestamp >= ? AND e.timestamp <= ?
    ORDER BY e.timestamp DESC LIMIT 1
  `).get(p2Ts.start, p2Ts.end) as { file_path: string } | undefined;

  if (photo1 && photo2 && fs.existsSync(photo1.file_path) && fs.existsSync(photo2.file_path)) {
    try {
      comparison = await compareImages(photo1.file_path, photo2.file_path);
    } catch { /* non-fatal */ }
  }

  // Build narrative
  const parts: string[] = [];
  if (summary1.photoCount > 0 || summary2.photoCount > 0) {
    if (summary1.photoCount !== summary2.photoCount) {
      const dir = summary2.photoCount > summary1.photoCount ? 'more' : 'fewer';
      parts.push(`You captured ${dir} visual memories (${summary1.photoCount} → ${summary2.photoCount}).`);
    }
    if (summary1.dominantMood !== summary2.dominantMood) {
      parts.push(`The visual mood shifted from ${summary1.dominantMood} to ${summary2.dominantMood}.`);
    }
  }
  if (comparison?.overallSummary) {
    parts.push(comparison.overallSummary);
  }

  return {
    period1Summary: summary1,
    period2Summary: summary2,
    comparison,
    narrative: parts.join(' '),
  };
}

// ── Detect visual mood mismatches ──

const TONE_EXPECTED_MOOD: Record<string, { min: number; max: number }> = {
  joyful:      { min: 4, max: 5 },
  energetic:   { min: 3.5, max: 5 },
  calm:        { min: 3, max: 4 },
  neutral:     { min: 2.5, max: 3.5 },
  tense:       { min: 1, max: 2.5 },
  melancholic: { min: 1, max: 2 },
};

export function detectVisualMoodMismatches(
  _date: string,
  dayStart: string,
  dayEnd: string,
): VisualInconsistency[] {
  const results: VisualInconsistency[] = [];

  const photos = db.getPhotosInWindow(dayStart, dayEnd);
  if (photos.length === 0) return results;

  const moods = db.getMoodEntriesInWindow(dayStart, dayEnd);
  if (moods.length === 0) return results;

  const avgMood = moods.reduce((s, m) => s + m.score, 0) / moods.length;

  for (const p of photos) {
    const analysis = (p as { analysis?: PhotoAnalysis }).analysis;
    if (!analysis?.mood_indicators) continue;

    try {
      const mood = JSON.parse(analysis.mood_indicators);
      if (!mood.tone || mood.confidence < 0.5) continue;

      const expected = TONE_EXPECTED_MOOD[mood.tone];
      if (!expected) continue;

      // Check if reported mood falls outside the expected range for this visual tone
      const isContradict = avgMood < expected.min - 0.5 || avgMood > expected.max + 0.5;

      if (isContradict) {
        const direction = avgMood > expected.max
          ? 'You reported feeling better than you looked.'
          : 'You reported feeling worse than you looked.';

        results.push({
          photoEventId: p.event_id,
          photoPath: p.file_path,
          photoMoodTone: mood.tone,
          photoMoodConfidence: mood.confidence,
          reportedMoodScore: avgMood,
          mismatchDescription: `Photo shows ${mood.tone} expression (confidence: ${(mood.confidence * 100).toFixed(0)}%), but reported mood was ${avgMood.toFixed(1)}/5. ${direction}`,
          severity: Math.min(0.5 + mood.confidence * 0.3 + Math.abs(avgMood - (expected.min + expected.max) / 2) * 0.1, 0.95),
        });
      }
    } catch { /* ignore parse errors */ }
  }

  return results;
}
