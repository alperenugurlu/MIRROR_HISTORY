/**
 * GrainWhisper — The grain speaks.
 * Floating overlay with typewriter effect and mood indicator.
 * Positioned bottom-right, above QuickAdd.
 */

import { useState, useEffect, useRef } from 'react';
import { useGrainVoice } from '../contexts/GrainVoiceContext';
import type { GrainMood } from '../types/grain-voice';

// ── Mood indicator dot ──
function MoodDot({ mood }: { mood: GrainMood }) {
  const config: Record<GrainMood, { color: string; pulse: string }> = {
    watching:   { color: 'bg-grain-cyan',    pulse: 'animate-pulse-slow' },
    suspicious: { color: 'bg-grain-amber',   pulse: 'animate-pulse' },
    amused:     { color: 'bg-grain-purple',  pulse: 'animate-pulse-slow' },
    concerned:  { color: 'bg-grain-rose',    pulse: 'animate-pulse' },
    satisfied:  { color: 'bg-grain-emerald', pulse: 'animate-pulse-slow' },
    silent:     { color: 'bg-grain-rose/30', pulse: '' },
  };
  const c = config[mood];
  return <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1 ${c.color} ${c.pulse}`} />;
}

export default function GrainWhisper() {
  const { currentWhisper, grainMood, dismissWhisper } = useGrainVoice();
  const [displayedText, setDisplayedText] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const charIndexRef = useRef(0);
  const typewriterRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevWhisperId = useRef<string | null>(null);

  // ── Typewriter effect ──
  useEffect(() => {
    // Reset on new whisper
    if (currentWhisper?.id !== prevWhisperId.current) {
      prevWhisperId.current = currentWhisper?.id || null;
      charIndexRef.current = 0;
      setDisplayedText('');
      setIsDismissing(false);

      if (typewriterRef.current) {
        clearTimeout(typewriterRef.current);
        typewriterRef.current = null;
      }
    }

    if (!currentWhisper || currentWhisper.text === null) {
      setIsVisible(!!currentWhisper); // Show dot for silence whispers
      return;
    }

    setIsVisible(true);
    const text = currentWhisper.text;

    const typeNextChar = () => {
      if (charIndexRef.current >= text.length) return;
      charIndexRef.current++;
      setDisplayedText(text.slice(0, charIndexRef.current));

      if (charIndexRef.current < text.length) {
        const char = text[charIndexRef.current - 1];
        let delay = 30;
        if (char === '.' || char === '?' || char === '!') delay = 300;
        else if (char === ',') delay = 150;
        else if (char === '\u2014' || char === '\u2013') delay = 200;
        typewriterRef.current = setTimeout(typeNextChar, delay);
      }
    };

    // Start after brief "thinking" pause
    typewriterRef.current = setTimeout(typeNextChar, 500);

    return () => {
      if (typewriterRef.current) clearTimeout(typewriterRef.current);
    };
  }, [currentWhisper]);

  const handleDismiss = () => {
    setIsDismissing(true);
    setTimeout(() => {
      dismissWhisper();
      setIsDismissing(false);
      setIsVisible(false);
    }, 300);
  };

  // ── Silent whisper: just the mood dot ──
  if (currentWhisper?.text === null && isVisible) {
    return (
      <div className="fixed bottom-20 right-5 z-30 animate-fade-in">
        <div className="flex items-center gap-2 opacity-40 px-2 py-1.5">
          <MoodDot mood={grainMood} />
        </div>
      </div>
    );
  }

  // ── Thinking state: "..." ──
  if (currentWhisper && displayedText === '' && isVisible) {
    return (
      <div className="fixed bottom-20 right-5 z-30 animate-fade-in">
        <div className="flex items-center gap-2 bg-surface-1/90 backdrop-blur-sm rounded-lg border border-surface-3/30 px-3 py-2">
          <MoodDot mood={grainMood} />
          <span className="text-xs font-mono text-text-muted animate-pulse">...</span>
        </div>
      </div>
    );
  }

  // ── No whisper ──
  if (!currentWhisper || !isVisible) {
    // Always show mood dot as ambient presence
    return (
      <div className="fixed bottom-20 right-5 z-30">
        <div className="flex items-center opacity-20 px-2 py-1.5">
          <MoodDot mood={grainMood} />
        </div>
      </div>
    );
  }

  // ── Active whisper with typewriter text ──
  const isStillTyping = charIndexRef.current < (currentWhisper.text?.length ?? 0);

  return (
    <div className={`fixed bottom-20 right-5 z-30 max-w-xs transition-all duration-300 ${
      isDismissing ? 'opacity-0 translate-y-2' : 'opacity-100'
    }`}>
      <div className="bg-surface-1/90 backdrop-blur-sm rounded-lg border border-surface-3/30 px-3 py-2.5 shadow-card animate-fade-in group">
        <div className="flex items-start gap-2">
          <MoodDot mood={grainMood} />
          <p className="text-xs text-text-secondary font-mono leading-relaxed flex-1 italic">
            {displayedText}
            {isStillTyping && (
              <span className="inline-block w-0.5 h-3 bg-text-muted animate-pulse ml-0.5 align-middle" />
            )}
          </p>
          <button
            onClick={handleDismiss}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-text-secondary text-[10px] shrink-0 mt-0.5"
          >
            x
          </button>
        </div>
      </div>
    </div>
  );
}
