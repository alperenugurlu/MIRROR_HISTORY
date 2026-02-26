import { useState } from 'react';

interface Props {
  onClose: () => void;
}

const steps = [
  {
    icon: '📄',
    title: 'Ingest',
    desc: 'Drop a CSV from your bank. All data stays on your device — nothing is sent anywhere.',
  },
  {
    icon: '🔍',
    title: 'Process',
    desc: 'Grain compares your transactions against spending baselines to find patterns and anomalies.',
  },
  {
    icon: '⌥',
    title: 'Detect',
    desc: 'Diff cards show what changed — new subscriptions, price increases, missing refunds — with evidence for each finding.',
  },
  {
    icon: '⚡',
    title: 'Respond',
    desc: 'Draft a refund email, set a follow-up reminder, or mark a pattern to ignore. Every action is logged in your audit trail.',
  },
];

export default function HowItWorks({ onClose }: Props) {
  const [activeGuide, setActiveGuide] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-surface-1 rounded-xl p-6 w-full max-w-md border border-surface-3/50 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-text-primary">How Grain Works</h3>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-secondary text-lg leading-none"
          >
            {'\u2715'}
          </button>
        </div>

        <div className="space-y-4">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center text-base shrink-0">
                {step.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-text-muted">{i + 1}.</span>
                  <p className="text-sm font-medium text-text-primary">{step.title}</p>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed mt-0.5">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Feature Guide */}
        <div className="mt-6 border-t border-surface-3/50 pt-4">
          <div className="text-xs uppercase text-text-muted font-mono tracking-widest mb-3">Feature Guide</div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {[
              { id: 'recording', label: '🎤 Recording' },
              { id: 'search', label: '🔍 Search' },
              { id: 'telegram', label: '📱 Telegram' },
              { id: 'privacy', label: '🔒 Privacy' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveGuide(activeGuide === tab.id ? null : tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                  activeGuide === tab.id
                    ? 'bg-grain-cyan/15 text-grain-cyan border border-grain-cyan/30'
                    : 'bg-surface-2 text-text-muted hover:text-text-secondary border border-surface-3/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeGuide === 'recording' && (
            <div className="bg-surface-2 rounded-lg p-4 text-sm text-text-secondary space-y-2 animate-fade-in">
              <div className="font-medium text-text-primary">Voice & Text Recording</div>
              <ul className="space-y-1.5 text-xs">
                <li>• <span className="text-text-primary">Quick Note:</span> Type notes, thoughts, or decisions directly from Cortex</li>
                <li>• <span className="text-text-primary">Voice Memo:</span> Record audio — automatically transcribed via Whisper</li>
                <li>• <span className="text-text-primary">Mood:</span> Calibrate your neural state (1-5 scale) at any time</li>
                <li>• <span className="text-text-primary">Telegram:</span> Send text, voice, photos, or location via Telegram bot</li>
              </ul>
            </div>
          )}

          {activeGuide === 'search' && (
            <div className="bg-surface-2 rounded-lg p-4 text-sm text-text-secondary space-y-2 animate-fade-in">
              <div className="font-medium text-text-primary">Semantic Memory Search</div>
              <ul className="space-y-1.5 text-xs">
                <li>• <span className="text-text-primary">Recall bar:</span> Type any phrase to search across all memories</li>
                <li>• <span className="text-text-primary">AI-powered:</span> Uses embeddings to find semantically similar memories</li>
                <li>• <span className="text-text-primary">Confidence:</span> Each result shows a similarity score (0-100%)</li>
                <li>• <span className="text-text-primary">Oracle:</span> Ask the AI deeper questions about your life data</li>
              </ul>
            </div>
          )}

          {activeGuide === 'telegram' && (
            <div className="bg-surface-2 rounded-lg p-4 text-sm text-text-secondary space-y-2 animate-fade-in">
              <div className="font-medium text-text-primary">Telegram Integration</div>
              <ul className="space-y-1.5 text-xs">
                <li>• <span className="text-text-primary">Setup:</span> Create a bot via @BotFather, enter token in Neural settings</li>
                <li>• <span className="text-text-primary">Commands:</span> /note, /thought, /decision, /mood, /remember, /ask, /weekly</li>
                <li>• <span className="text-text-primary">Auto-capture:</span> Plain text, voice, photos, and location are auto-saved</li>
                <li>• <span className="text-text-primary">Scheduled:</span> Mood prompts (10AM, 7PM) + daily summary (10PM)</li>
              </ul>
            </div>
          )}

          {activeGuide === 'privacy' && (
            <div className="bg-surface-2 rounded-lg p-4 text-sm text-text-secondary space-y-2 animate-fade-in">
              <div className="font-medium text-text-primary">Privacy & Data Control</div>
              <ul className="space-y-1.5 text-xs">
                <li>• <span className="text-text-primary">100% Local:</span> All data stored on your device, never sent to cloud</li>
                <li>• <span className="text-text-primary">Retention:</span> Set auto-delete policy (30d, 90d, 1yr, or forever)</li>
                <li>• <span className="text-text-primary">Export:</span> Download all your data as JSON anytime</li>
                <li>• <span className="text-text-primary">Panic Wipe:</span> Instantly delete all data with one button</li>
              </ul>
            </div>
          )}
        </div>

        <div className="mt-5 pt-4 border-t border-surface-3/50">
          <p className="text-xs text-text-muted text-center font-mono">
            All memories stored locally in your grain.
          </p>
        </div>
      </div>
    </div>
  );
}
