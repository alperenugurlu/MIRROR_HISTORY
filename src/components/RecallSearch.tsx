import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { eventTypeIcon, eventTypeLabel } from '../utils';

export default function RecallSearch() {
  const api = useApi();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const search = (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }
    setSearching(true);
    api.semanticSearch(q, 8)
      .then(r => {
        setResults(r);
        setShowResults(true);
      })
      .catch(() => setResults([]))
      .finally(() => setSearching(false));
  };

  const onInput = (value: string) => {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(value), 300);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => onInput(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          placeholder="Recall a memory..."
          className="w-full px-4 py-2.5 pl-10 rounded-xl bg-surface-1 border border-surface-3/50 text-sm text-text-primary placeholder:text-text-muted font-mono focus:outline-none focus:ring-2 focus:ring-grain-cyan/30 focus:border-grain-cyan/50 transition-all"
        />
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        {searching && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-grain-cyan/30 border-t-grain-cyan rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Results dropdown */}
      {showResults && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-surface-1 border border-surface-3/50 rounded-xl shadow-grain-lg z-50 max-h-80 overflow-auto animate-slide-up">
          <div className="p-2 border-b border-surface-3/50">
            <span className="text-[11px] font-mono text-text-muted uppercase tracking-widest px-2">
              {results.length} memories found
            </span>
          </div>
          {results.map((r: any, i: number) => (
            <button
              key={r.event?.id || i}
              onClick={() => {
                setShowResults(false);
                if (r.event?.timestamp) {
                  const date = r.event.timestamp.slice(0, 10);
                  navigate(`/recall?date=${date}`);
                }
              }}
              className="w-full px-4 py-3 flex items-start gap-3 hover:bg-surface-2 transition-colors text-left"
            >
              <span className="text-base shrink-0 mt-0.5">
                {r.event ? eventTypeIcon(r.event.type) : '\uD83D\uDCCC'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-text-primary truncate">
                  {r.event?.summary || r.snippet || 'Memory'}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-text-muted font-mono">
                    {r.event?.timestamp?.slice(0, 10) || ''}
                  </span>
                  <span className="text-xs text-text-muted">
                    {r.event ? eventTypeLabel(r.event.type) : ''}
                  </span>
                </div>
              </div>
              {typeof r.score === 'number' && (
                <span className="text-xs font-mono text-grain-cyan shrink-0">
                  {Math.round(r.score * 100)}%
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
