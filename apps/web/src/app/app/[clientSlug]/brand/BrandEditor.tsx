'use client';
import { useState } from 'react';

interface BrandProfile {
  brand_voice_doc?: string | null;
  color_palette?: Record<string, string>;
  logo_url?: string | null;
  typography?: Record<string, string>;
  tone_guidelines?: string | null;
  target_audience?: string | null;
}

export function BrandEditor({ initialProfile }: { initialProfile: BrandProfile | null }) {
  const [form, setForm] = useState({
    brand_voice_doc: initialProfile?.brand_voice_doc ?? '',
    tone_guidelines: initialProfile?.tone_guidelines ?? '',
    target_audience: initialProfile?.target_audience ?? '',
    logo_url: initialProfile?.logo_url ?? '',
    color_palette: JSON.stringify(initialProfile?.color_palette ?? {}, null, 2),
    typography: JSON.stringify(initialProfile?.typography ?? {}, null, 2),
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setSaved(false); setError('');
    let color_palette: Record<string, string> = {};
    let typography: Record<string, string> = {};
    try { color_palette = JSON.parse(form.color_palette); } catch { setError('color_palette is not valid JSON'); setSaving(false); return; }
    try { typography = JSON.parse(form.typography); } catch { setError('typography is not valid JSON'); setSaving(false); return; }

    const res = await fetch('/api/brand', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...form, color_palette, typography }),
    });
    if (res.ok) { setSaved(true); }
    else { const d = await res.json(); setError(d.error ?? 'Save failed'); }
    setSaving(false);
  }

  const field = (name: keyof typeof form, label: string, rows = 3) => (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--brand-ink)]">
      {label}
      <textarea rows={rows} value={form[name]} onChange={e => setForm(p => ({ ...p, [name]: e.target.value }))}
        className="rounded-lg border border-black/15 px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] resize-y" />
    </label>
  );

  return (
    <form onSubmit={save} className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <div className="flex flex-col gap-5">
        {field('brand_voice_doc', 'Brand voice', 5)}
        {field('tone_guidelines', 'Tone guidelines', 4)}
        {field('target_audience', 'Target audience', 3)}
        <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--brand-ink)]">
          Logo URL
          <input value={form.logo_url} onChange={e => setForm(p => ({ ...p, logo_url: e.target.value }))}
            placeholder="https://..."
            className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]" />
        </label>
      </div>
      <div className="flex flex-col gap-5">
        {field('color_palette', 'Color palette (JSON)', 6)}
        {field('typography', 'Typography (JSON)', 4)}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-green-600">Brand profile saved.</p>}
        <button type="submit" disabled={saving}
          className="rounded-[var(--brand-radius)] bg-[var(--brand-primary)] px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 self-start">
          {saving ? 'Saving…' : 'Save brand profile'}
        </button>
      </div>
    </form>
  );
}
