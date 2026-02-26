import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import * as db from '../database';
import { broadcast } from '../event-bus';
import { analyzeImage, isVisionConfigured } from './vision-engine';
import { embedEventIfConfigured } from './embedding-engine';

const PHOTO_DIR = path.join(os.homedir(), '.mirror-history', 'photos');

const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic']);

function ensurePhotoDir(): void {
  if (!fs.existsSync(PHOTO_DIR)) {
    fs.mkdirSync(PHOTO_DIR, { recursive: true });
  }
}

/**
 * Compute content hash for deduplication.
 */
function fileHash(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Save a photo from a buffer and create corresponding event + DB record.
 */
export function savePhoto(
  buffer: Buffer,
  filename: string,
  caption: string = '',
  source: string = 'telegram',
): { event_id: string; filePath: string; photoId: string } {
  ensurePhotoDir();

  const timestamp = new Date().toISOString();
  const safeName = `photo-${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '')}`;
  const filePath = path.join(PHOTO_DIR, safeName);

  fs.writeFileSync(filePath, buffer);

  const contentHash = crypto.createHash('sha256').update(buffer).digest('hex');

  const summary = caption
    ? `Photo: ${caption.length > 80 ? caption.slice(0, 80) + '...' : caption}`
    : `Photo captured`;

  const event = db.insertEvent(
    'photo',
    timestamp,
    summary,
    { source, has_photo: true, file_path: filePath, caption },
    1.0,
    'local_private',
    contentHash,
  );

  const photo = db.insertPhoto(event.id, filePath, caption, source);

  const searchContent = ['photo', caption].filter(Boolean).join(' ');
  db.indexForSearch(event.id, searchContent);

  db.logActivity('photo_saved', summary, {
    event_id: event.id,
    source,
    file_path: filePath,
  });

  broadcast('photo_saved', { event_id: event.id, source });

  return { event_id: event.id, filePath, photoId: photo.id };
}

/**
 * Run vision analysis on a photo and store the results.
 */
async function analyzeAndStore(eventId: string, photoId: string, filePath: string): Promise<void> {
  if (!isVisionConfigured()) return;

  try {
    const result = await analyzeImage(filePath);

    db.insertPhotoAnalysis(
      photoId,
      result.description,
      result.tags,
      result.detected_text,
      result.mood_indicators,
      result.people_count,
      'claude-sonnet-4-20250514',
    );

    // Update event summary with AI description
    const summary = result.description.length > 100
      ? `Photo: ${result.description.slice(0, 100)}...`
      : `Photo: ${result.description}`;
    db.getDb().prepare('UPDATE events SET summary = ? WHERE id = ?').run(summary, eventId);

    // Update FTS index with description + tags
    const searchContent = [
      'photo',
      result.description,
      ...result.tags,
      result.detected_text,
    ].filter(Boolean).join(' ');
    db.indexForSearch(eventId, searchContent);

    // Trigger embedding
    embedEventIfConfigured(eventId).catch(() => {});
  } catch (err) {
    console.error(`Vision analysis failed for photo ${photoId}:`, err);
  }
}

/**
 * Batch import photos from file paths.
 * Each photo: validate → save → analyze.
 */
export async function importPhotos(filePaths: string[]): Promise<{
  imported: number;
  analyzed: number;
  errors: string[];
}> {
  let imported = 0;
  let analyzed = 0;
  const errors: string[] = [];

  for (const filePath of filePaths) {
    try {
      const ext = path.extname(filePath).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.has(ext)) {
        errors.push(`Unsupported format: ${path.basename(filePath)}`);
        continue;
      }

      if (!fs.existsSync(filePath)) {
        errors.push(`File not found: ${path.basename(filePath)}`);
        continue;
      }

      // Check for duplicates via content hash
      const hash = fileHash(filePath);
      const existing = db.getDb().prepare(
        'SELECT id FROM events WHERE content_hash = ?'
      ).get(hash) as { id: string } | undefined;

      if (existing) {
        errors.push(`Duplicate: ${path.basename(filePath)}`);
        continue;
      }

      // Read file and save
      const buffer = fs.readFileSync(filePath);
      const filename = path.basename(filePath);
      const { event_id } = savePhoto(buffer, filename, '', 'import');
      imported++;

      // Run vision analysis using the saved file path
      if (isVisionConfigured()) {
        try {
          const photo = db.getPhotoByEvent(event_id);
          if (photo) {
            await analyzeAndStore(event_id, photo.id, photo.file_path);
            analyzed++;
          }
        } catch {
          // Analysis failure is non-fatal
        }
      }
    } catch (err) {
      errors.push(`Error: ${path.basename(filePath)} - ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  return { imported, analyzed, errors };
}

/**
 * Analyze an existing photo by event ID (for re-analysis or delayed analysis).
 */
export async function analyzePhotoByEvent(eventId: string): Promise<void> {
  const photo = db.getPhotoByEvent(eventId);
  if (!photo) throw new Error(`No photo found for event ${eventId}`);
  await analyzeAndStore(eventId, photo.id, photo.file_path);
}

export function getPhotoCount(): number {
  return db.getPhotoCount();
}

export function getPhotoDir(): string {
  return PHOTO_DIR;
}
