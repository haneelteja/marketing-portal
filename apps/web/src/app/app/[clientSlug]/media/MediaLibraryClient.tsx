'use client';
import { useState, useRef } from 'react';

interface MediaAsset {
  id: string;
  name: string;
  url: string;
  mime_type: string;
  size_bytes?: number | null;
  tags?: string[];
  source?: string;
  created_at?: string;
}

const SOURCE_LABELS: Record<string, string> = {
  upload: 'Uploaded',
  ai_generated: 'AI-generated',
  brand_kit: 'Brand kit',
};

function isImage(mime: string) { return mime.startsWith('image/'); }
function isVideo(mime: string) { return mime.startsWith('video/'); }

function formatBytes(bytes?: number | null) {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

type FilterSource = 'all' | 'upload' | 'ai_generated' | 'brand_kit';

export function MediaLibraryClient({ initialAssets, canUpload }: { initialAssets: MediaAsset[]; canUpload: boolean }) {
  const [assets, setAssets] = useState(initialAssets);
  const [filter, setFilter] = useState<FilterSource>('all');
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [selected, setSelected] = useState<MediaAsset | null>(null);
  const [tagsInput, setTagsInput] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const visible = assets.filter(a => {
    if (filter !== 'all' && a.source !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return a.name.toLowerCase().includes(q) || (a.tags ?? []).some(t => t.toLowerCase().includes(q));
    }
    return true;
  });

  async function handleUpload(files: FileList) {
    setUploading(true); setUploadError('');
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append('file', file);
      if (tagsInput) fd.append('tags', tagsInput);
      const res = await fetch('/api/media/upload', { method: 'POST', body: fd });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setUploadError(d.error ?? 'Upload failed');
        break;
      }
    }
    // Refresh list
    const fresh = await fetch('/api/media').then(r => r.json()) as MediaAsset[];
    setAssets(fresh);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  const filterBtn = (val: FilterSource, label: string) => (
    <button
      key={val}
      onClick={() => setFilter(val)}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        filter === val
          ? 'bg-[var(--brand-primary)] text-white'
          : 'bg-black/5 text-black/60 hover:bg-black/10'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      {/* Controls bar */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {filterBtn('all', 'All')}
          {filterBtn('upload', 'Uploads')}
          {filterBtn('ai_generated', 'AI-generated')}
          {filterBtn('brand_kit', 'Brand kit')}
        </div>
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or tag…"
          className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] bg-white w-full sm:w-52"
        />
      </div>

      {/* Upload zone */}
      {canUpload && (
        <div
          className="mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-3 rounded-xl border border-dashed border-black/20 bg-black/2 px-5 py-4 cursor-pointer hover:bg-black/4 transition-colors"
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files); }}
        >
          <div className="flex-1">
            <p className="text-sm font-medium text-[var(--brand-ink)]">
              {uploading ? 'Uploading…' : 'Upload files'}
            </p>
            <p className="mt-0.5 text-xs text-black/40">
              Images, videos, PDFs. Max 50 MB each. Drag & drop or click.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <input
              type="text"
              value={tagsInput}
              onClick={e => e.stopPropagation()}
              onChange={e => setTagsInput(e.target.value)}
              placeholder="Tags (comma-sep)"
              className="rounded-lg border border-black/15 px-3 py-1.5 text-xs w-36 bg-white focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
            />
            <button
              disabled={uploading}
              className="rounded-[var(--brand-radius)] bg-[var(--brand-primary)] px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 flex-shrink-0"
            >
              Browse
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,video/mp4,video/webm,application/pdf"
            className="hidden"
            onChange={e => { if (e.target.files?.length) handleUpload(e.target.files); }}
          />
        </div>
      )}
      {uploadError && <p className="mb-4 text-sm text-red-600">{uploadError}</p>}

      {/* Grid */}
      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/20 p-12 text-center">
          <p className="text-sm text-black/40">
            {search || filter !== 'all' ? 'No assets match your filter.' : 'No media yet. Upload your first file.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map(a => (
            <button
              key={a.id}
              onClick={() => setSelected(a)}
              className="group relative overflow-hidden rounded-xl border border-black/10 bg-white text-left hover:border-[var(--brand-primary)] transition-colors"
            >
              <div className="aspect-square overflow-hidden bg-black/5">
                {isImage(a.mime_type) ? (
                  <img src={a.url} alt={a.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200" />
                ) : isVideo(a.mime_type) ? (
                  <video src={a.url} className="h-full w-full object-cover" muted />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <span className="text-3xl opacity-30">📄</span>
                  </div>
                )}
              </div>
              <div className="p-2">
                <p className="truncate text-xs font-medium text-[var(--brand-ink)]">{a.name}</p>
                <div className="mt-0.5 flex items-center justify-between">
                  <span className="text-[10px] text-black/40">{SOURCE_LABELS[a.source ?? ''] ?? a.source}</span>
                  <span className="text-[10px] text-black/30">{formatBytes(a.size_bytes)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Asset detail panel */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setSelected(null)}
              className="absolute right-4 top-4 rounded-full p-1 text-black/40 hover:bg-black/5 hover:text-black"
              aria-label="Close"
            >
              ✕
            </button>
            {isImage(selected.mime_type) && (
              <img src={selected.url} alt={selected.name} className="mb-4 max-h-96 w-full rounded-xl object-contain bg-black/5" />
            )}
            {isVideo(selected.mime_type) && (
              <video src={selected.url} controls className="mb-4 max-h-72 w-full rounded-xl bg-black" />
            )}
            <h3 className="text-base font-semibold text-[var(--brand-ink)]">{selected.name}</h3>
            <div className="mt-2 grid grid-cols-2 gap-x-8 gap-y-1 text-xs text-black/50">
              <span>Type: {selected.mime_type}</span>
              <span>Size: {formatBytes(selected.size_bytes) ?? '—'}</span>
              <span>Source: {SOURCE_LABELS[selected.source ?? ''] ?? selected.source}</span>
              <span>Added: {selected.created_at ? new Date(selected.created_at).toLocaleDateString() : '—'}</span>
            </div>
            {selected.tags && selected.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {selected.tags.map(t => (
                  <span key={t} className="rounded-full bg-[var(--brand-primary)]/10 px-2 py-0.5 text-[10px] text-[var(--brand-primary)]">{t}</span>
                ))}
              </div>
            )}
            <div className="mt-4 flex gap-3">
              <a
                href={selected.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-[var(--brand-radius)] bg-[var(--brand-primary)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
              >
                Open original
              </a>
              <button
                onClick={() => { navigator.clipboard.writeText(selected.url); }}
                className="rounded-[var(--brand-radius)] border border-black/20 px-4 py-2 text-xs font-medium text-black/60 hover:bg-black/5"
              >
                Copy URL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
