import { useState, useEffect, useRef } from 'react';
import { useApi } from '../hooks/useApi';
import type { Video, VideoFrame } from '../../shared/types';

interface VideoPlayerProps {
  video: Video & { frames?: VideoFrame[] };
  inline?: boolean;
}

export default function VideoPlayer({ video, inline }: VideoPlayerProps) {
  const api = useApi();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [frameThumbs, setFrameThumbs] = useState<{ src: string; ts: number; desc: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredFrame, setHoveredFrame] = useState<number | null>(null);

  // Load video
  useEffect(() => {
    api.getVideoFile(video.file_path)
      .then(base64 => {
        const ext = video.file_path.split('.').pop()?.toLowerCase() || 'mp4';
        const mime = ext === 'webm' ? 'video/webm' : ext === 'mov' ? 'video/quicktime' : 'video/mp4';
        setVideoSrc(`data:${mime};base64,${base64}`);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [video.file_path]);

  // Load frame thumbnails
  useEffect(() => {
    if (!video.frames || video.frames.length === 0) return;

    const loadFrames = async () => {
      const thumbs: { src: string; ts: number; desc: string }[] = [];
      // Load max 10 frame thumbnails
      const framesToLoad = video.frames!.filter((_, i) =>
        video.frames!.length <= 10 || i % Math.ceil(video.frames!.length / 10) === 0
      );

      for (const frame of framesToLoad) {
        try {
          const base64 = await api.getPhotoFile(frame.frame_path);
          thumbs.push({
            src: `data:image/jpeg;base64,${base64}`,
            ts: frame.timestamp_seconds,
            desc: frame.description,
          });
        } catch {
          // Skip failed frames
        }
      }
      setFrameThumbs(thumbs);
    };

    loadFrames();
  }, [video.frames]);

  const seekTo = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (inline) {
    return (
      <div className="space-y-3">
        {/* Video player */}
        {loading ? (
          <div className="w-full h-48 bg-surface-3 rounded-lg animate-pulse" />
        ) : videoSrc ? (
          <video
            ref={videoRef}
            src={videoSrc}
            controls
            className="w-full max-h-64 rounded-lg bg-black"
          />
        ) : (
          <div className="w-full h-48 bg-surface-3 rounded-lg flex items-center justify-center text-text-muted text-xs">
            Failed to load video
          </div>
        )}

        {/* AI Summary */}
        {video.summary && (
          <div className="grain-card border-l-2 border-grain-cyan rounded-lg p-3">
            <div className="text-[10px] uppercase text-grain-cyan font-mono tracking-widest mb-1">Visual Summary</div>
            <p className="text-xs text-text-secondary leading-relaxed">{video.summary}</p>
          </div>
        )}

        {/* Frame strip */}
        {frameThumbs.length > 0 && (
          <div>
            <div className="text-[10px] uppercase text-text-muted font-mono tracking-widest mb-1.5">
              Key Frames ({video.frame_count})
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {frameThumbs.map((frame, i) => (
                <div
                  key={i}
                  className="relative shrink-0 cursor-pointer group"
                  onClick={() => seekTo(frame.ts)}
                  onMouseEnter={() => setHoveredFrame(i)}
                  onMouseLeave={() => setHoveredFrame(null)}
                >
                  <img
                    src={frame.src}
                    alt={frame.desc || `Frame at ${formatTime(frame.ts)}`}
                    className="w-20 h-14 object-cover rounded border border-surface-3/50 group-hover:border-grain-cyan transition-colors"
                  />
                  <span className="absolute bottom-0.5 right-0.5 text-[9px] font-mono bg-black/60 text-white px-1 rounded">
                    {formatTime(frame.ts)}
                  </span>
                  {/* Frame description tooltip */}
                  {hoveredFrame === i && frame.desc && (
                    <div className="absolute bottom-full left-0 mb-1 w-48 bg-surface-1 border border-surface-3 rounded-lg p-2 text-[10px] text-text-secondary shadow-lg z-10">
                      {frame.desc}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="text-[10px] text-text-muted flex items-center gap-3">
          <span>{formatTime(video.duration_seconds)}</span>
          <span>{video.frame_count} frames extracted</span>
          <span>Source: {video.source}</span>
        </div>
      </div>
    );
  }

  // Compact view for collapsed timeline
  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 bg-surface-3 rounded shrink-0 flex items-center justify-center text-xs">
        {'\u25B6'}
      </div>
      <span className="text-sm text-text-primary truncate">
        {video.summary
          ? (video.summary.length > 100 ? video.summary.slice(0, 100) + '...' : video.summary)
          : `Video (${formatTime(video.duration_seconds)})`
        }
      </span>
    </div>
  );
}
