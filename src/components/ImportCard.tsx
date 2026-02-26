interface ImportCardProps {
  title: string;
  description: string;
  icon: string;
  count: number;
  lastImport: string | null;
  extensions: string[];
  filterName: string;
  onImport: (filePath: string) => void;
  onSelectFile: (filterName: string, extensions: string[]) => Promise<string | null>;
  loading?: boolean;
}

export default function ImportCard({
  title, description, icon, count, lastImport,
  extensions, filterName, onImport, onSelectFile, loading,
}: ImportCardProps) {
  const handleClick = async () => {
    const filePath = await onSelectFile(filterName, extensions);
    if (filePath) onImport(filePath);
  };

  return (
    <div className="bg-surface-1 rounded-xl border border-surface-3/50 p-5 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <h3 className="text-sm font-medium text-text-primary">{title}</h3>
          <p className="text-xs text-text-muted">{description}</p>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-text-muted">
        <span className="font-mono">{count.toLocaleString()} records</span>
        {lastImport && <span>Last: {lastImport}</span>}
      </div>

      <button
        onClick={handleClick}
        disabled={loading}
        className="mt-auto px-4 py-2 rounded-lg bg-grain-cyan hover:bg-grain-cyan/80 disabled:bg-surface-3 disabled:text-text-muted text-surface-0 text-sm font-medium transition-colors"
      >
        {loading ? 'Ingesting...' : `Import ${title}`}
      </button>
    </div>
  );
}
