import { useState, useRef, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useGrainVoice } from '../contexts/GrainVoiceContext';

interface VoiceRecorderProps {
  onClose: () => void;
  onRecorded?: () => void;
}

export default function VoiceRecorder({ onClose, onRecorded }: VoiceRecorderProps) {
  const api = useApi();
  const { pushWhisper } = useGrainVoice();
  const [state, setState] = useState<'idle' | 'recording' | 'processing' | 'done' | 'error'>('idle');
  const [duration, setDuration] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Use webm/opus for best compatibility
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        // Stop timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        // Stop mic
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;

        // Build audio blob
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size === 0) {
          setState('error');
          setErrorMsg('No audio recorded');
          return;
        }

        setState('processing');

        try {
          // Convert blob to array buffer, then to base64 for IPC
          const arrayBuffer = await blob.arrayBuffer();
          const uint8 = new Uint8Array(arrayBuffer);
          const base64 = btoa(String.fromCharCode(...uint8));

          const result = await api.saveAudioRecording(base64, duration);
          setTranscript(result.transcript || '(No transcription available)');
          setState('done');
          onRecorded?.();
          // The grain reacts to voice memories
          if (duration >= 30) {
            pushWhisper(`${duration} seconds of audio captured. The grain heard everything.`, 'ambient', 'watching', 'voice');
          }
        } catch (err) {
          setState('error');
          setErrorMsg(err instanceof Error ? err.message : 'Failed to process recording');
        }
      };

      // Start recording
      recorder.start(1000); // Collect data every second
      setState('recording');
      setDuration(0);

      // Start duration timer
      timerRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    } catch (err) {
      setState('error');
      setErrorMsg(
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Microphone permission denied'
          : 'Could not access microphone',
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="bg-surface-1 rounded-2xl shadow-lg border border-surface-3/50 p-5 w-72 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-[11px] uppercase text-text-muted font-mono tracking-widest">Audio Memory</div>
        <button
          onClick={() => { cleanup(); onClose(); }}
          className="text-text-muted hover:text-text-secondary transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Idle state — start button */}
      {state === 'idle' && (
        <div className="text-center space-y-3">
          <p className="text-xs text-text-muted">Tap to start recording an audio memory</p>
          <button
            onClick={startRecording}
            className="w-16 h-16 rounded-full bg-grain-rose hover:bg-grain-rose/80 text-surface-0 flex items-center justify-center mx-auto transition-colors shadow-lg"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="12" y1="19" x2="12" y2="23" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {/* Recording state */}
      {state === 'recording' && (
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-grain-rose animate-pulse" />
            <span className="text-sm font-mono font-medium text-text-primary">
              {formatDuration(duration)}
            </span>
          </div>

          {/* Animated wave */}
          <div className="flex items-center justify-center gap-0.5 h-8">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-grain-rose rounded-full"
                style={{
                  height: `${12 + Math.sin(Date.now() / 200 + i * 0.5) * 10}px`,
                  animation: `wave 0.8s ease-in-out ${i * 0.05}s infinite alternate`,
                }}
              />
            ))}
          </div>

          <button
            onClick={stopRecording}
            className="w-14 h-14 rounded-full bg-surface-3 hover:bg-surface-3/80 text-text-primary flex items-center justify-center mx-auto transition-colors shadow-lg"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
          <p className="text-xs text-text-muted">Tap to stop</p>
        </div>
      )}

      {/* Processing state */}
      {state === 'processing' && (
        <div className="text-center space-y-3 py-2">
          <div className="w-8 h-8 border-2 border-grain-cyan border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-text-secondary">Processing audio memory...</p>
          <p className="text-xs text-text-muted">Duration: {formatDuration(duration)}</p>
        </div>
      )}

      {/* Done state */}
      {state === 'done' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-grain-emerald">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
            <span className="text-xs font-medium text-text-primary">
              Recorded ({formatDuration(duration)})
            </span>
          </div>
          {transcript && (
            <div className="bg-surface-2 rounded-lg p-3 text-xs text-text-secondary max-h-24 overflow-auto">
              {transcript}
            </div>
          )}
          <button
            onClick={() => { cleanup(); onClose(); }}
            className="w-full py-2 rounded-lg bg-surface-2 hover:bg-surface-3 text-xs text-text-secondary transition-colors"
          >
            Done
          </button>
        </div>
      )}

      {/* Error state */}
      {state === 'error' && (
        <div className="space-y-3">
          <div className="bg-grain-rose/10 rounded-lg p-3 text-xs text-grain-rose">
            {errorMsg}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setState('idle'); setErrorMsg(''); }}
              className="flex-1 py-2 rounded-lg bg-surface-2 hover:bg-surface-3 text-xs text-text-secondary transition-colors"
            >
              Try again
            </button>
            <button
              onClick={() => { cleanup(); onClose(); }}
              className="flex-1 py-2 rounded-lg bg-surface-2 hover:bg-surface-3 text-xs text-text-secondary transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
