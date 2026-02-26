import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import ImportCard from '../components/ImportCard';
import { useGrainVoice } from '../contexts/GrainVoiceContext';
import type { ImportStats, ImportResult } from '../../shared/types';

export default function Ingest() {
  const api = useApi();
  const { pushWhisper, feedApiData } = useGrainVoice();
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [loadingSource, setLoadingSource] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ source: string; result: ImportResult } | null>(null);

  const loadStats = () => {
    api.getImportStats().then(setStats).catch(() => {});
  };

  useEffect(() => { loadStats(); }, []);

  const handleImport = async (
    source: string,
    importFn: (filePath: string) => Promise<ImportResult>,
    filePath: string,
  ) => {
    setLoadingSource(source);
    setLastResult(null);
    try {
      const result = await importFn(filePath);
      setLastResult({ source, result });
      loadStats();
      // The grain reacts to new data being absorbed
      if (result.imported > 0) {
        pushWhisper(`${result.imported} new memories absorbed. The grain grows.`, 'ambient', 'satisfied', 'ingest');
        feedApiData({ totalMemories: (stats?.transactions.count ?? 0) + result.imported });
      }
    } catch (err) {
      setLastResult({ source, result: { imported: 0, skipped: 0, errors: ['Ingestion failed. Check server logs.'] } });
    } finally {
      setLoadingSource(null);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 animate-grain-load">
      <div>
        <h1 className="text-[11px] font-mono text-grain-cyan uppercase tracking-widest">Memory Ingestion</h1>
        <p className="text-xs text-text-muted mt-0.5">
          Absorb data from external sources into your grain
        </p>
      </div>

      {/* Result banner */}
      {lastResult && (
        <div className={`rounded-lg p-3 text-sm ${
          lastResult.result.errors.length > 0
            ? 'bg-grain-rose/10 text-grain-rose border border-grain-rose/30'
            : 'bg-grain-emerald/10 text-grain-emerald border border-grain-emerald/30'
        }`}>
          <span className="font-medium">{lastResult.source}:</span>{' '}
          {lastResult.result.imported} ingested, {lastResult.result.skipped} skipped
          {lastResult.result.errors.length > 0 && (
            <span> — {lastResult.result.errors[0]}</span>
          )}
        </div>
      )}

      {/* Import cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ImportCard
          title="Financial Memory Feed"
          description="Ingest financial transactions from CSV exports"
          icon={'\u{1F3E6}'}
          count={stats?.transactions.count ?? 0}
          lastImport={stats?.transactions.lastImport ?? null}
          extensions={['csv', 'txt']}
          filterName="CSV Files"
          onSelectFile={api.selectFileWithFilter}
          onImport={(fp) => handleImport('Financial Memory Feed', async (f) => {
            // For CSV, redirect to onboarding/existing flow
            const preview = await api.previewCsv(f);
            if (preview.headers.length > 0) {
              // Auto-map common columns
              const mapping: Record<string, string> = {};
              for (const h of preview.headers) {
                const lower = h.toLowerCase();
                if (lower.includes('date')) mapping.date = h;
                else if (lower.includes('description') || lower.includes('merchant') || lower.includes('payee')) mapping.merchant = h;
                else if (lower.includes('amount')) mapping.amount = h;
                else if (lower.includes('currency')) mapping.currency = h;
                else if (lower.includes('category')) mapping.category = h;
                else if (lower.includes('account')) mapping.account = h;
              }
              if (mapping.date && mapping.merchant && mapping.amount) {
                return api.importCsv(f, mapping as any);
              }
            }
            return { imported: 0, skipped: 0, errors: ['Could not auto-detect CSV columns. Use the Onboarding flow for manual mapping.'] };
          }, fp)}
          loading={loadingSource === 'Financial Memory Feed'}
        />

        <ImportCard
          title="Location Memory Feed"
          description="Google Takeout location history (Records.json)"
          icon={'\u{1F4CD}'}
          count={stats?.locations.count ?? 0}
          lastImport={stats?.locations.lastImport ?? null}
          extensions={['json']}
          filterName="JSON Files"
          onSelectFile={api.selectFileWithFilter}
          onImport={(fp) => handleImport('Location Memory Feed', api.importLocationHistory, fp)}
          loading={loadingSource === 'Location Memory Feed'}
        />

        <ImportCard
          title="Temporal Memory Feed"
          description="Standard calendar files (.ics)"
          icon={'\u{1F4C5}'}
          count={stats?.calendar.count ?? 0}
          lastImport={stats?.calendar.lastImport ?? null}
          extensions={['ics', 'ical']}
          filterName="Calendar Files"
          onSelectFile={api.selectFileWithFilter}
          onImport={(fp) => handleImport('Temporal Memory Feed', api.importCalendarICS, fp)}
          loading={loadingSource === 'Temporal Memory Feed'}
        />

        <ImportCard
          title="Biometric Memory Feed"
          description="Apple Health export (export.xml)"
          icon={'\u2764\uFE0F'}
          count={stats?.health.count ?? 0}
          lastImport={stats?.health.lastImport ?? null}
          extensions={['xml']}
          filterName="XML Files"
          onSelectFile={api.selectFileWithFilter}
          onImport={(fp) => handleImport('Biometric Memory Feed', api.importAppleHealth, fp)}
          loading={loadingSource === 'Biometric Memory Feed'}
        />

        {/* Visual Memory Feed — Photos (multi-file) */}
        <div className="bg-surface-1 rounded-xl border border-surface-3/50 p-5 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{'\uD83D\uDCF7'}</span>
            <div>
              <h3 className="text-sm font-medium text-text-primary">Visual Memory Feed</h3>
              <p className="text-xs text-text-muted">Import photos — the grain learns to see</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span className="font-mono">{stats?.photos?.count ?? 0} photos</span>
            <span className="font-mono">{stats?.photos?.analyzed ?? 0} analyzed</span>
            {stats?.photos?.lastImport && <span>Last: {stats.photos.lastImport}</span>}
          </div>
          <button
            onClick={async () => {
              const filePaths = await api.selectMultipleFiles('Image Files', ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic']);
              if (filePaths.length === 0) return;
              setLoadingSource('Visual Memory Feed');
              setLastResult(null);
              try {
                const result = await api.importPhotos(filePaths);
                setLastResult({ source: 'Visual Memory Feed', result: { imported: result.imported, skipped: 0, errors: result.errors } });
                loadStats();
                if (result.imported > 0) {
                  pushWhisper(`${result.imported} visual memories absorbed. ${result.analyzed} analyzed. The grain now sees.`, 'ambient', 'satisfied', 'ingest');
                  feedApiData({ totalMemories: (stats?.transactions.count ?? 0) + result.imported });
                }
              } catch {
                setLastResult({ source: 'Visual Memory Feed', result: { imported: 0, skipped: 0, errors: ['Photo import failed.'] } });
              } finally {
                setLoadingSource(null);
              }
            }}
            disabled={loadingSource === 'Visual Memory Feed'}
            className="mt-auto px-4 py-2 rounded-lg bg-grain-cyan hover:bg-grain-cyan/80 disabled:bg-surface-3 disabled:text-text-muted text-surface-0 text-sm font-medium transition-colors"
          >
            {loadingSource === 'Visual Memory Feed' ? 'Analyzing...' : 'Import Photos'}
          </button>
        </div>

        {/* Video Memory Feed */}
        <div className="bg-surface-1 rounded-xl border border-surface-3/50 p-5 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{'\uD83C\uDFA5'}</span>
            <div>
              <h3 className="text-sm font-medium text-text-primary">Video Memory Feed</h3>
              <p className="text-xs text-text-muted">Import videos — frame-by-frame visual analysis</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span className="font-mono">{stats?.videos?.count ?? 0} videos</span>
            {stats?.videos?.lastImport && <span>Last: {stats.videos.lastImport}</span>}
          </div>
          <button
            onClick={async () => {
              const filePath = await api.selectFileWithFilter('Video Files', ['mp4', 'mov', 'webm', 'avi']);
              if (!filePath) return;
              setLoadingSource('Video Memory Feed');
              setLastResult(null);
              try {
                const result = await api.importVideo(filePath);
                setLastResult({ source: 'Video Memory Feed', result: { imported: 1, skipped: 0, errors: [] } });
                loadStats();
                pushWhisper(`Video memory captured. ${result.frames_extracted} frames extracted and analyzed.`, 'ambient', 'satisfied', 'ingest');
                feedApiData({ totalMemories: (stats?.transactions.count ?? 0) + 1 });
              } catch {
                setLastResult({ source: 'Video Memory Feed', result: { imported: 0, skipped: 0, errors: ['Video import failed.'] } });
              } finally {
                setLoadingSource(null);
              }
            }}
            disabled={loadingSource === 'Video Memory Feed'}
            className="mt-auto px-4 py-2 rounded-lg bg-grain-cyan hover:bg-grain-cyan/80 disabled:bg-surface-3 disabled:text-text-muted text-surface-0 text-sm font-medium transition-colors"
          >
            {loadingSource === 'Video Memory Feed' ? 'Processing...' : 'Import Video'}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="grain-card rounded-xl border border-surface-3/50 p-4 text-xs text-text-muted space-y-1">
        <p className="font-medium text-text-secondary">How to get your data:</p>
        <p><strong className="text-text-secondary">Location Memory Feed:</strong> Google Takeout &rarr; Location History &rarr; Records.json</p>
        <p><strong className="text-text-secondary">Temporal Memory Feed:</strong> Export from Google Calendar, Apple Calendar, or Outlook as .ics</p>
        <p><strong className="text-text-secondary">Biometric Memory Feed:</strong> Health app &rarr; Profile &rarr; Export All Health Data</p>
      </div>
    </div>
  );
}
