import { useState } from 'react';
import CsvImport from '../components/CsvImport';
import { GrainLogo } from '../components/GrainLogo';

interface Props {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: Props) {
  const [started, setStarted] = useState(false);

  if (!started) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface-0 animate-grain-load">
        <div className="max-w-md text-center space-y-8 px-6">
          {/* Mirror History Logo */}
          <div className="space-y-4">
            <GrainLogo size={48} variant="full" animated className="text-grain-cyan mx-auto" />
            <h1 className="text-3xl font-mono font-bold tracking-[0.3em] text-grain-cyan">
              MIRROR HISTORY
            </h1>
            <p className="text-sm text-text-secondary font-mono tracking-wide">
              Your personal memory recording system
            </p>
          </div>

          {/* How it works stepper */}
          <div className="grid grid-cols-4 gap-3 text-center">
            {[
              { step: '01', title: 'Ingest', desc: 'Feed your data streams', color: 'text-grain-cyan' },
              { step: '02', title: 'Process', desc: 'Patterns are detected', color: 'text-grain-amber' },
              { step: '03', title: 'Detect', desc: 'Anomalies surface', color: 'text-grain-purple' },
              { step: '04', title: 'Respond', desc: 'Take informed action', color: 'text-grain-emerald' },
            ].map((s, i) => (
              <div key={s.step} className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-1">
                  {i > 0 && <span className="text-text-muted text-xs -ml-2 mr-1 font-mono">→</span>}
                  <span className={`text-xs font-mono font-bold ${s.color}`}>{s.step}</span>
                </div>
                <p className={`text-[11px] font-mono font-semibold uppercase tracking-wider ${s.color}`}>{s.title}</p>
                <p className="text-xs text-text-muted leading-tight">{s.desc}</p>
              </div>
            ))}
          </div>

          {/* Grain guarantees */}
          <div className="grain-card p-5 text-left space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-grain-emerald text-sm mt-0.5 font-mono">&#x2713;</span>
              <div>
                <p className="text-sm text-text-primary font-medium">All memories stored locally</p>
                <p className="text-xs text-text-muted">Your grain never leaves your device. Zero cloud dependency.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-grain-emerald text-sm mt-0.5 font-mono">&#x2713;</span>
              <div>
                <p className="text-sm text-text-primary font-medium">No autonomous actions</p>
                <p className="text-xs text-text-muted">Every action requires your explicit neural confirmation.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-grain-emerald text-sm mt-0.5 font-mono">&#x2713;</span>
              <div>
                <p className="text-sm text-text-primary font-medium">Full audit chronicle</p>
                <p className="text-xs text-text-muted">Every ingestion, scan, filter, and response is logged immutably.</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => setStarted(true)}
            className="w-full py-3.5 rounded-xl bg-grain-cyan hover:bg-grain-cyan-glow text-surface-0 text-sm font-mono font-semibold uppercase tracking-wider transition-all grain-glow"
          >
            Initialize Mirror History
          </button>

          <p className="text-xs text-text-muted font-mono">
            v1.0 &middot; Mirror History
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex items-center justify-center bg-surface-0 animate-grain-load">
      <div className="w-full max-w-2xl px-6">
        <div className="text-center mb-6">
          <h2 className="text-[11px] font-mono text-grain-cyan uppercase tracking-widest mb-1">Memory Ingestion</h2>
          <p className="text-xs text-text-muted">Begin by feeding your financial memory stream</p>
        </div>
        <CsvImport onComplete={onComplete} />
      </div>
    </div>
  );
}
