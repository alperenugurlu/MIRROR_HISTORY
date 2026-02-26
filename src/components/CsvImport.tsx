import { useState, useCallback } from 'react';
import type { ColumnMapping, CsvPreviewRow, ImportResult } from '../../shared/types';
import { useApi } from '../hooks/useApi';

interface Props {
  onComplete: () => void;
}

type Step = 'upload' | 'preview' | 'importing' | 'done';

export default function CsvImport({ onComplete }: Props) {
  const api = useApi();
  const [step, setStep] = useState<Step>('upload');
  const [filePath, setFilePath] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<CsvPreviewRow[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    date: '',
    merchant: '',
    amount: '',
  });
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelectFile = async () => {
    const path = await api.selectFile();
    if (!path) return;
    await loadPreview(path);
  };

  const loadPreview = async (path: string) => {
    try {
      const data = await api.previewCsv(path);
      setFilePath(path);
      setHeaders(data.headers);
      setPreviewRows(data.rows);

      // Auto-detect mapping
      const autoMapping: ColumnMapping = { date: '', merchant: '', amount: '' };
      for (const h of data.headers) {
        const lower = h.toLowerCase();
        if (!autoMapping.date && (lower.includes('date') || lower.includes('time'))) {
          autoMapping.date = h;
        }
        if (!autoMapping.merchant && (lower.includes('description') || lower.includes('merchant') || lower.includes('name') || lower.includes('payee'))) {
          autoMapping.merchant = h;
        }
        if (!autoMapping.amount && (lower.includes('amount') || lower.includes('sum') || lower.includes('total') || lower.includes('value'))) {
          autoMapping.amount = h;
        }
        if (lower.includes('currency') || lower === 'ccy') {
          autoMapping.currency = h;
        }
        if (lower.includes('category') || lower.includes('type')) {
          autoMapping.category = h;
        }
        if (lower.includes('account') || lower.includes('card') || lower.includes('bank')) {
          autoMapping.account = h;
        }
      }
      setMapping(autoMapping);
      setStep('preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to read file');
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file as any).path) {
      await loadPreview((file as any).path);
    }
  }, []);

  const handleImport = async () => {
    if (!filePath || !mapping.date || !mapping.merchant || !mapping.amount) return;
    setStep('importing');
    setError(null);
    try {
      const importResult = await api.importCsv(filePath, mapping);
      setResult(importResult);
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
      setStep('preview');
    }
  };

  if (step === 'upload') {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-12">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="w-full max-w-md border-2 border-dashed border-surface-3 rounded-xl p-12 text-center hover:border-grain-cyan transition-colors cursor-pointer"
          onClick={handleSelectFile}
        >
          <div className="text-3xl mb-3 opacity-60">📄</div>
          <p className="text-sm text-text-secondary mb-1">Drop a CSV file here</p>
          <p className="text-xs text-text-muted">or click to browse</p>
        </div>
        {error && <p className="text-sm text-grain-rose">{error}</p>}
      </div>
    );
  }

  if (step === 'preview') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-text-primary">Column Mapping</h3>
            <p className="text-xs text-text-muted mt-0.5">Map your CSV columns to Grain fields</p>
          </div>
          <button
            onClick={() => { setStep('upload'); setFilePath(null); }}
            className="text-xs text-text-muted hover:text-text-secondary"
          >
            Change file
          </button>
        </div>

        {/* Mapping selects */}
        <div className="grid grid-cols-3 gap-3">
          {(['date', 'merchant', 'amount'] as const).map((field) => (
            <div key={field}>
              <label className="text-[11px] uppercase text-text-muted font-mono tracking-widest block mb-1">
                {field} *
              </label>
              <select
                value={mapping[field]}
                onChange={(e) => setMapping({ ...mapping, [field]: e.target.value })}
                className="w-full bg-surface-2 text-sm text-text-primary rounded px-2 py-1.5 border border-surface-3/50"
              >
                <option value="">Select...</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          ))}
          {(['currency', 'category', 'account'] as const).map((field) => (
            <div key={field}>
              <label className="text-[11px] uppercase text-text-muted font-mono tracking-widest block mb-1">
                {field}
              </label>
              <select
                value={mapping[field] || ''}
                onChange={(e) => setMapping({ ...mapping, [field]: e.target.value || undefined })}
                className="w-full bg-surface-2 text-sm text-text-primary rounded px-2 py-1.5 border border-surface-3/50"
              >
                <option value="">—</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {/* Preview table */}
        <div className="overflow-auto rounded-lg border border-surface-3/50">
          <table className="w-full text-xs">
            <thead className="bg-surface-2">
              <tr>
                {headers.map((h) => (
                  <th key={h} className="text-left px-3 py-2 text-text-muted font-medium whitespace-nowrap">
                    {h}
                    {h === mapping.date && <span className="text-grain-cyan ml-1">{'\u2190'} date</span>}
                    {h === mapping.merchant && <span className="text-grain-cyan ml-1">{'\u2190'} merchant</span>}
                    {h === mapping.amount && <span className="text-grain-cyan ml-1">{'\u2190'} amount</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.slice(0, 8).map((row, i) => (
                <tr key={i} className="border-t border-surface-3/50">
                  {headers.map((h) => (
                    <td key={h} className="px-3 py-1.5 text-text-secondary whitespace-nowrap">
                      {row[h]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {error && <p className="text-sm text-grain-rose">{error}</p>}

        <button
          onClick={handleImport}
          disabled={!mapping.date || !mapping.merchant || !mapping.amount}
          className="w-full py-2.5 rounded-lg bg-grain-cyan hover:bg-grain-cyan/80 disabled:bg-surface-3 disabled:text-text-muted text-surface-0 text-sm font-medium transition-colors"
        >
          Ingest Transactions
        </button>
      </div>
    );
  }

  if (step === 'importing') {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-grain-cyan border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm text-text-secondary">Processing transactions...</p>
      </div>
    );
  }

  // step === 'done'
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="text-3xl text-grain-emerald">{'\u2713'}</div>
      <div className="text-center">
        <p className="text-sm text-text-primary font-medium">{result?.imported} transactions ingested</p>
        {(result?.skipped ?? 0) > 0 && (
          <p className="text-xs text-text-muted mt-1">{result?.skipped} skipped (duplicates or errors)</p>
        )}
      </div>
      <button
        onClick={onComplete}
        className="px-6 py-2 rounded-lg bg-grain-cyan hover:bg-grain-cyan/80 text-surface-0 text-sm font-medium transition-colors"
      >
        View Your Diff
      </button>
    </div>
  );
}
