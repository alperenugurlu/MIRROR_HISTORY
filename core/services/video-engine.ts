import fs from 'fs';
import path from 'path';
import os from 'os';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';

// Set ffmpeg binary path from the bundled installer
ffmpeg.setFfmpegPath(ffmpegPath.path);

const VIDEO_DIR = path.join(os.homedir(), '.mirror-history', 'videos');
const FRAME_DIR = path.join(os.homedir(), '.mirror-history', 'video-frames');

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getVideoDir(): string {
  return VIDEO_DIR;
}

export function getFrameDir(): string {
  return FRAME_DIR;
}

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  codec: string;
}

/**
 * Get video metadata using ffprobe.
 */
export function getVideoMetadata(videoPath: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, data) => {
      if (err) return reject(err);

      const videoStream = data.streams.find(s => s.codec_type === 'video');
      resolve({
        duration: data.format.duration ? parseFloat(String(data.format.duration)) : 0,
        width: videoStream?.width || 0,
        height: videoStream?.height || 0,
        codec: videoStream?.codec_name || 'unknown',
      });
    });
  });
}

/**
 * Calculate frame extraction interval based on video duration.
 * Short videos get more frames, long videos get fewer.
 */
function calculateInterval(durationSeconds: number): number {
  if (durationSeconds <= 30) return 3;
  if (durationSeconds <= 60) return 5;
  if (durationSeconds <= 300) return 15;
  return 30;
}

/**
 * Extract key frames from a video file at regular intervals.
 * Returns an array of frame file paths and the video duration.
 */
export async function extractFrames(
  videoPath: string,
  outputDir: string,
  intervalSeconds?: number,
): Promise<{ frames: string[]; duration: number }> {
  ensureDir(outputDir);

  const metadata = await getVideoMetadata(videoPath);
  const interval = intervalSeconds || calculateInterval(metadata.duration);

  return new Promise((resolve, reject) => {
    const frames: string[] = [];

    ffmpeg(videoPath)
      .outputOptions([
        `-vf`, `fps=1/${interval}`,
        '-q:v', '3',           // JPEG quality (2-31, lower = better)
        '-f', 'image2',
      ])
      .output(path.join(outputDir, 'frame-%04d.jpg'))
      .on('end', () => {
        // Read the output directory to get actual frame files
        const files = fs.readdirSync(outputDir)
          .filter(f => f.startsWith('frame-') && f.endsWith('.jpg'))
          .sort();

        for (const file of files) {
          frames.push(path.join(outputDir, file));
        }

        resolve({ frames, duration: metadata.duration });
      })
      .on('error', reject)
      .run();
  });
}

/**
 * Save a video file to the videos directory.
 * Returns the destination path.
 */
export function saveVideoFile(sourcePath: string, filename: string): string {
  ensureDir(VIDEO_DIR);
  const safeName = `video-${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '')}`;
  const destPath = path.join(VIDEO_DIR, safeName);
  fs.copyFileSync(sourcePath, destPath);
  return destPath;
}
