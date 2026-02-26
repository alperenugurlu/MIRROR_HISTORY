import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { moodEmoji } from '../utils';
import { useGrainVoice } from '../contexts/GrainVoiceContext';
import VoiceRecorder from './VoiceRecorder';

export default function QuickAdd() {
  const api = useApi();
  const navigate = useNavigate();
  const { pushWhisper } = useGrainVoice();
  const [open, setOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState<number | null>(null);
  const [showVoice, setShowVoice] = useState(false);

  const recordMood = async (score: number) => {
    setRecording(true);
    try {
      await api.recordMood(score);
      setRecorded(score);
      // The grain reacts to mood recordings
      if (score <= 2) {
        pushWhisper('Low neural state recorded. The grain is paying attention.', 'behavioral', 'concerned', 'mood');
      } else if (score === 5) {
        pushWhisper('Peak neural state. The grain archives this moment.', 'ambient', 'satisfied', 'mood');
      }
      setTimeout(() => {
        setRecorded(null);
        setOpen(false);
      }, 1200);
    } catch {}
    setRecording(false);
  };

  const askAI = () => {
    setOpen(false);
    navigate('/oracle');
  };

  const openVoice = () => {
    setOpen(false);
    setShowVoice(true);
  };

  if (recorded !== null) {
    return (
      <div className="fixed bottom-5 right-5 z-40">
        <div className="bg-surface-1 rounded-2xl shadow-lg border border-surface-3/50 px-5 py-3 flex items-center gap-2 animate-fade-in">
          <span className="text-lg">{moodEmoji(recorded)}</span>
          <span className="text-sm text-text-secondary">Neural state calibrated</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-40">
      {/* Voice Recorder overlay */}
      {showVoice && (
        <div className="mb-3">
          <VoiceRecorder
            onClose={() => setShowVoice(false)}
            onRecorded={() => {}}
          />
        </div>
      )}

      {/* Expanded panel */}
      {open && !showVoice && (
        <div className="mb-3 bg-surface-1 rounded-2xl shadow-lg border border-surface-3/50 p-4 w-64 animate-slide-up">
          {/* Mood recording */}
          <div className="mb-3">
            <div className="text-[11px] uppercase text-text-muted font-mono tracking-widest mb-2">Calibrate Neural State</div>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map(score => (
                <button
                  key={score}
                  onClick={() => recordMood(score)}
                  disabled={recording}
                  className="flex-1 py-2 rounded-lg text-lg bg-surface-2 hover:bg-surface-3 hover:scale-110 transition-all disabled:opacity-50"
                >
                  {moodEmoji(score)}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-surface-3/50 my-2" />

          {/* Quick actions */}
          <button
            onClick={openVoice}
            className="w-full text-left px-3 py-2 rounded-lg text-xs text-text-secondary hover:bg-surface-2 transition-colors flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
            </svg>
            Record Audio Memory
          </button>
          <button
            onClick={askAI}
            className="w-full text-left px-3 py-2 rounded-lg text-xs text-text-secondary hover:bg-surface-2 transition-colors flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Consult Oracle
          </button>
        </div>
      )}

      {/* FAB button */}
      {!showVoice && (
        <button
          onClick={() => setOpen(!open)}
          className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all ${
            open
              ? 'bg-surface-3 text-text-primary rotate-45'
              : 'bg-grain-cyan text-surface-0 hover:bg-grain-cyan/80 hover:shadow-xl'
          }`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      )}
    </div>
  );
}
