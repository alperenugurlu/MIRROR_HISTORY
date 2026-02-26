import { useState, useRef, useEffect } from 'react';
import { useApi } from '../hooks/useApi';

interface AudioPlayerProps {
  filePath: string;
  duration: number;
  compact?: boolean;
}

export default function AudioPlayer({ filePath, duration, compact }: AudioPlayerProps) {
  const api = useApi();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Load audio data via IPC when play is first requested
  const loadAudio = async () => {
    if (audioUrl) return audioUrl;
    try {
      const base64 = await api.getVoiceFile(filePath);
      const ext = filePath.split('.').pop() || 'ogg';
      const mime = ext === 'ogg' ? 'audio/ogg' : ext === 'mp3' ? 'audio/mpeg' : `audio/${ext}`;
      const url = `data:${mime};base64,${base64}`;
      setAudioUrl(url);
      setLoaded(true);
      return url;
    } catch {
      setError(true);
      return null;
    }
  };

  const togglePlay = async () => {
    if (!audioRef.current) {
      const url = await loadAudio();
      if (!url) return;

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.addEventListener('timeupdate', () => {
        setCurrentTime(audio.currentTime);
      });
      audio.addEventListener('ended', () => {
        setPlaying(false);
        setCurrentTime(0);
      });
    }

    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      await audioRef.current.play();
      setPlaying(true);
    }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = pct * (audioRef.current.duration || duration);
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (error) {
    return (
      <div className={`flex items-center gap-2 text-gray-400 ${compact ? 'text-xs' : 'text-xs'}`}>
        <span>{'\u{1F50A}'}</span>
        <span>Audio unavailable</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${compact ? 'gap-1.5' : 'gap-2'}`}>
      {/* Play/Pause button */}
      <button
        onClick={togglePlay}
        className={`shrink-0 flex items-center justify-center rounded-full bg-purple-500 hover:bg-purple-400 text-white transition-colors ${
          compact ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm'
        }`}
      >
        {playing ? '\u{23F8}' : '\u{25B6}'}
      </button>

      {/* Progress bar */}
      <div className="flex-1 min-w-0">
        <div
          className={`w-full bg-gray-200 rounded-full cursor-pointer ${compact ? 'h-1' : 'h-1.5'}`}
          onClick={seek}
        >
          <div
            className="bg-purple-400 rounded-full h-full transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Time */}
      <span className={`shrink-0 font-mono text-gray-500 ${compact ? 'text-[11px]' : 'text-xs'}`}>
        {fmt(currentTime)}/{fmt(duration)}
      </span>
    </div>
  );
}
