import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import type { VisualComparisonResult } from '../../core/types';

interface VisualComparisonProps {
  result: VisualComparisonResult;
}

const SIGNIFICANCE_COLOR: Record<string, string> = {
  minor: 'text-grain-cyan',
  notable: 'text-amber-400',
  major: 'text-grain-rose',
};

const SIGNIFICANCE_BG: Record<string, string> = {
  minor: 'bg-grain-cyan/10',
  notable: 'bg-amber-400/10',
  major: 'bg-grain-rose/10',
};

const CATEGORY_ICON: Record<string, string> = {
  appearance: '\u{1F9D1}',
  environment: '\u{1F30D}',
  expression: '\u{1F3AD}',
  objects: '\u{1F4E6}',
  text: '\u{1F4DD}',
  people: '\u{1F465}',
  posture: '\u{1F9CD}',
  lighting: '\u{1F4A1}',
};

export default function VisualComparison({ result }: VisualComparisonProps) {
  const api = useApi();
  const [img1, setImg1] = useState<string | null>(null);
  const [img2, setImg2] = useState<string | null>(null);

  useEffect(() => {
    if (result.image1Path) {
      api.getPhotoFile(result.image1Path).then(setImg1).catch(() => {});
    }
    if (result.image2Path) {
      api.getPhotoFile(result.image2Path).then(setImg2).catch(() => {});
    }
  }, [result.image1Path, result.image2Path]);

  const majorChanges = result.changes.filter(c => c.significance === 'major');
  const notableChanges = result.changes.filter(c => c.significance === 'notable');
  const minorChanges = result.changes.filter(c => c.significance === 'minor');

  return (
    <div className="space-y-4">
      {/* Before / After Photos */}
      {(img1 || img2) && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-text-muted font-mono mb-1">Before</div>
            {img1 ? (
              <img src={`data:image/jpeg;base64,${img1}`} alt="Before" className="w-full rounded-lg border border-surface-3" />
            ) : (
              <div className="w-full aspect-square rounded-lg bg-surface-2 flex items-center justify-center text-text-muted text-xs">No image</div>
            )}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-text-muted font-mono mb-1">After</div>
            {img2 ? (
              <img src={`data:image/jpeg;base64,${img2}`} alt="After" className="w-full rounded-lg border border-surface-3" />
            ) : (
              <div className="w-full aspect-square rounded-lg bg-surface-2 flex items-center justify-center text-text-muted text-xs">No image</div>
            )}
          </div>
        </div>
      )}

      {/* Similarity Score */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest text-text-muted font-mono">Similarity</span>
        <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-grain-cyan rounded-full transition-all"
            style={{ width: `${(result.similarityScore * 100).toFixed(0)}%` }}
          />
        </div>
        <span className="text-xs text-text-secondary font-mono">{(result.similarityScore * 100).toFixed(0)}%</span>
      </div>

      {/* Overall Summary */}
      {result.overallSummary && (
        <div className="grain-card border-l-2 border-grain-rose rounded-lg p-3">
          <div className="text-[10px] uppercase tracking-widest text-text-muted font-mono mb-1">{'\u{1F441}'} Grain Observation</div>
          <p className="text-sm text-text-secondary leading-relaxed italic">{result.overallSummary}</p>
        </div>
      )}

      {/* Emotional Shift */}
      {result.emotionalShift && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-1">
          <span className="px-2 py-1 rounded bg-surface-2 text-xs font-medium text-text-primary capitalize">{result.emotionalShift.from}</span>
          <span className="text-grain-rose">{'\u2192'}</span>
          <span className="px-2 py-1 rounded bg-surface-2 text-xs font-medium text-text-primary capitalize">{result.emotionalShift.to}</span>
          <span className="text-xs text-text-muted ml-auto">{result.emotionalShift.interpretation}</span>
        </div>
      )}

      {/* Changes by significance */}
      {majorChanges.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-grain-rose font-mono mb-1.5">Major Changes</div>
          <div className="space-y-1.5">
            {majorChanges.map((c, i) => (
              <div key={i} className={`px-3 py-2 rounded-lg ${SIGNIFICANCE_BG[c.significance]}`}>
                <span className="mr-1.5">{CATEGORY_ICON[c.category] || '\u{1F50D}'}</span>
                <span className={`text-sm ${SIGNIFICANCE_COLOR[c.significance]}`}>{c.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {notableChanges.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-amber-400 font-mono mb-1.5">Notable Changes</div>
          <div className="space-y-1.5">
            {notableChanges.map((c, i) => (
              <div key={i} className={`px-3 py-2 rounded-lg ${SIGNIFICANCE_BG[c.significance]}`}>
                <span className="mr-1.5">{CATEGORY_ICON[c.category] || '\u{1F50D}'}</span>
                <span className={`text-sm ${SIGNIFICANCE_COLOR[c.significance]}`}>{c.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {minorChanges.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-grain-cyan font-mono mb-1.5">Minor Changes</div>
          <div className="space-y-1.5">
            {minorChanges.map((c, i) => (
              <div key={i} className={`px-3 py-2 rounded-lg ${SIGNIFICANCE_BG[c.significance]}`}>
                <span className="mr-1.5">{CATEGORY_ICON[c.category] || '\u{1F50D}'}</span>
                <span className={`text-sm ${SIGNIFICANCE_COLOR[c.significance]}`}>{c.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Physical & Environment tags */}
      {(result.physicalChanges.length > 0 || result.environmentChanges.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {result.physicalChanges.map((c, i) => (
            <span key={`p-${i}`} className="px-2 py-0.5 rounded-full bg-grain-rose/10 text-grain-rose text-xs">{c}</span>
          ))}
          {result.environmentChanges.map((c, i) => (
            <span key={`e-${i}`} className="px-2 py-0.5 rounded-full bg-grain-cyan/10 text-grain-cyan text-xs">{c}</span>
          ))}
        </div>
      )}

      {/* People changes */}
      {result.peopleChanges && (
        <div className="text-xs text-text-muted">
          <span className="mr-1">{'\u{1F465}'}</span>{result.peopleChanges}
        </div>
      )}
    </div>
  );
}
