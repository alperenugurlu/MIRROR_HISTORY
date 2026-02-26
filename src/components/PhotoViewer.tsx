import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import type { PhotoRecord, PhotoAnalysis } from '../../shared/types';

interface PhotoViewerProps {
  photo: PhotoRecord & { analysis?: PhotoAnalysis };
  inline?: boolean;
}

export default function PhotoViewer({ photo, inline }: PhotoViewerProps) {
  const api = useApi();
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(false);

  useEffect(() => {
    api.getPhotoFile(photo.file_path)
      .then(base64 => {
        const ext = photo.file_path.split('.').pop()?.toLowerCase() || 'jpeg';
        const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        setImageSrc(`data:${mime};base64,${base64}`);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [photo.file_path]);

  const analysis = photo.analysis;
  const tags = analysis ? (() => { try { return JSON.parse(analysis.tags); } catch { return []; } })() : [];

  if (inline) {
    return (
      <div className="space-y-2">
        {loading ? (
          <div className="w-full h-32 bg-surface-3 rounded-lg animate-pulse" />
        ) : imageSrc ? (
          <img
            src={imageSrc}
            alt={analysis?.description || photo.caption || 'Photo'}
            className="w-full max-h-64 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => setLightbox(true)}
          />
        ) : (
          <div className="w-full h-32 bg-surface-3 rounded-lg flex items-center justify-center text-text-muted text-xs">
            Failed to load image
          </div>
        )}

        {analysis && (
          <div className="space-y-1.5">
            <p className="text-xs text-text-secondary leading-relaxed">{analysis.description}</p>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.slice(0, 8).map((tag: string, i: number) => (
                  <span key={i} className="px-1.5 py-0.5 rounded bg-grain-cyan/10 text-grain-cyan text-[10px]">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {analysis.detected_text && (
              <div className="text-[10px] text-text-muted">
                <span className="font-mono">OCR:</span> {analysis.detected_text}
              </div>
            )}
          </div>
        )}

        {!analysis && photo.caption && (
          <p className="text-xs text-text-secondary">{photo.caption}</p>
        )}

        {/* Lightbox */}
        {lightbox && imageSrc && (
          <div
            className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setLightbox(false)}
          >
            <button
              className="absolute top-4 right-4 text-white/60 hover:text-white text-2xl z-10"
              onClick={() => setLightbox(false)}
            >
              {'\u2715'}
            </button>
            <img
              src={imageSrc}
              alt={analysis?.description || 'Photo'}
              className="max-w-full max-h-full object-contain"
              onClick={e => e.stopPropagation()}
            />
            {analysis && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 text-white" onClick={e => e.stopPropagation()}>
                <p className="text-sm mb-2">{analysis.description}</p>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {tags.map((tag: string, i: number) => (
                      <span key={i} className="px-2 py-0.5 rounded-full bg-white/20 text-white/80 text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Compact thumbnail for collapsed timeline event
  return (
    <div className="flex items-center gap-2">
      {loading ? (
        <div className="w-8 h-8 bg-surface-3 rounded animate-pulse shrink-0" />
      ) : imageSrc ? (
        <img
          src={imageSrc}
          alt={analysis?.description || photo.caption || 'Photo'}
          className="w-8 h-8 object-cover rounded shrink-0"
        />
      ) : null}
      <span className="text-sm text-text-primary truncate">
        {analysis?.description || photo.caption || 'Visual memory captured'}
      </span>
    </div>
  );
}
