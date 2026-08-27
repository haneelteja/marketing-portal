'use client';
import { useState, useRef } from 'react';

interface BrandProfile {
  brand_voice_doc?: string | null;
  color_palette?: Record<string, string>;
  logo_url?: string | null;
  typography?: Record<string, string>;
  tone_guidelines?: string | null;
  target_audience?: string | null;
}

const FONTS = [
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins',
  'Raleway', 'Playfair Display', 'Merriweather', 'Source Sans Pro',
  'Nunito', 'Work Sans', 'DM Sans', 'Plus Jakarta Sans',
];

const WEIGHTS = ['300', '400', '500', '600', '700', '800'];

const PALETTE_KEYS = [
  { key: 'primary',    label: 'Primary'    },
  { key: 'secondary',  label: 'Secondary'  },
  { key: 'accent',     label: 'Accent'     },
  { key: 'background', label: 'Background' },
  { key: 'surface',    label: 'Surface'    },
  { key: 'ink',        label: 'Text'       },
];

function parseColors(palette?: Record<string, string>) {
  const defaults: Record<string, string> = {
    primary: '#0F4C5C', secondary: '#1A7A8A', accent: '#F4A261',
    background: '#F8FAFC', surface: '#FFFFFF', ink: '#0D1B2A',
  };
  const src = palette ?? {};
  return Object.fromEntries(PALETTE_KEYS.map(({ key }) => [key, src[key] ?? defaults[key]]));
}

function parseTypo(typo?: Record<string, string>) {
  return {
    heading_font: typo?.heading_font ?? 'Poppins',
    body_font: typo?.body_font ?? 'Inter',
    heading_weight: typo?.heading_weight ?? '700',
    body_weight: typo?.body_weight ?? '400',
  };
}

export function BrandEditor({ initialProfile }: { initialProfile: BrandProfile | null }) {
  const [form, setForm] = useState({
    brand_voice_doc: initialProfile?.brand_voice_doc ?? '',
    tone_guidelines: initialProfile?.tone_guidelines ?? '',
    target_audience: initialProfile?.target_audience ?? '',
    logo_url: initialProfile?.logo_url ?? '',
  });
  const [colors, setColors] = useState(parseColors(initialProfile?.color_palette));
  const [typo, setTypo] = useState(parseTypo(initialProfile?.typography));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleLogoUpload(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/brand/logo', { method: 'POST', body: fd });
    if (res.ok) {
      const { url } = await res.json() as { url: string };
      setForm(p => ({ ...p, logo_url: url }));
    } else {
      const d = await res.json() as { error?: string };
      setError(d.error ?? 'Logo upload failed');
    }
    setUploading(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setSaved(false); setError('');
    const res = await fetch('/api/brand', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...form,
        color_palette: colors,
        typography: typo,
      }),
    });
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    else { const d = await res.json() as { error?: string }; setError(d.error ?? 'Save failed'); }
    setSaving(false);
  }

  const labelCls = 'flex flex-col gap-1.5 text-sm font-medium text-[var(--brand-ink)]';
  const inputCls = 'rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] bg-white';
  const textareaCls = `${inputCls} resize-y font-normal`;

  return (
    <form onSubmit={save} className="grid grid-cols-1 gap-8 lg:grid-cols-2">

      {/* LEFT COLUMN */}
      <div className="flex flex-col gap-6">

        {/* Logo */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-[var(--brand-ink)]">Logo</span>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-xl border border-black/10 bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
              {form.logo_url ? (
                <img src={form.logo_url} alt="Logo" className="h-full w-full object-contain p-1" />
              ) : (
                <span className="text-2xl font-bold text-black/20">?</span>
              )}
            </div>
            <div className="flex flex-col gap-2 flex-1 min-w-0">
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="rounded-lg border border-black/20 px-4 py-2 text-sm font-medium text-[var(--brand-ink)] hover:bg-black/5 disabled:opacity-50 self-start"
              >
                {uploading ? 'Uploading…' : 'Upload logo'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden"
                onChange={e => { if (e.target.files?.[0]) handleLogoUpload(e.target.files[0]); }}
              />
              <input
                value={form.logo_url}
                onChange={e => setForm(p => ({ ...p, logo_url: e.target.value }))}
                placeholder="Or paste a URL…"
                className={`${inputCls} text-xs`}
              />
            </div>
          </div>
        </div>

        {/* Brand voice */}
        <label className={labelCls}>
          Brand voice
          <span className="font-normal text-xs text-black/40">Describe the character and personality of your brand's writing.</span>
          <textarea
            rows={5}
            value={form.brand_voice_doc}
            onChange={e => setForm(p => ({ ...p, brand_voice_doc: e.target.value }))}
            placeholder="e.g. Authoritative but approachable. We use clear, concise sentences and avoid jargon."
            className={textareaCls}
          />
        </label>

        {/* Tone guidelines */}
        <label className={labelCls}>
          Tone guidelines
          <textarea
            rows={3}
            value={form.tone_guidelines}
            onChange={e => setForm(p => ({ ...p, tone_guidelines: e.target.value }))}
            placeholder="e.g. Warm and professional on LinkedIn, casual and energetic on Instagram."
            className={textareaCls}
          />
        </label>

        {/* Target audience */}
        <label className={labelCls}>
          Target audience
          <textarea
            rows={3}
            value={form.target_audience}
            onChange={e => setForm(p => ({ ...p, target_audience: e.target.value }))}
            placeholder="e.g. B2B SaaS founders and marketing managers, 30–50, tech-savvy."
            className={textareaCls}
          />
        </label>
      </div>

      {/* RIGHT COLUMN */}
      <div className="flex flex-col gap-6">

        {/* Color palette */}
        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium text-[var(--brand-ink)]">Color palette</span>
          <div className="grid grid-cols-2 gap-3">
            {PALETTE_KEYS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3 rounded-lg border border-black/10 bg-white px-3 py-2.5 cursor-pointer">
                <input
                  type="color"
                  value={colors[key] ?? '#000000'}
                  onChange={e => setColors(p => ({ ...p, [key]: e.target.value }))}
                  className="h-8 w-8 cursor-pointer rounded border-0 p-0"
                  style={{ minWidth: 32 }}
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-medium text-[var(--brand-ink)]">{label}</span>
                  <span className="text-[10px] font-mono text-black/40 uppercase">{colors[key]}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Typography */}
        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium text-[var(--brand-ink)]">Typography</span>
          <div className="grid grid-cols-2 gap-3">
            <label className={`${labelCls} text-xs`}>
              Heading font
              <select
                value={typo.heading_font}
                onChange={e => setTypo(p => ({ ...p, heading_font: e.target.value }))}
                className={inputCls}
              >
                {FONTS.map(f => <option key={f}>{f}</option>)}
              </select>
            </label>
            <label className={`${labelCls} text-xs`}>
              Heading weight
              <select
                value={typo.heading_weight}
                onChange={e => setTypo(p => ({ ...p, heading_weight: e.target.value }))}
                className={inputCls}
              >
                {WEIGHTS.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </label>
            <label className={`${labelCls} text-xs`}>
              Body font
              <select
                value={typo.body_font}
                onChange={e => setTypo(p => ({ ...p, body_font: e.target.value }))}
                className={inputCls}
              >
                {FONTS.map(f => <option key={f}>{f}</option>)}
              </select>
            </label>
            <label className={`${labelCls} text-xs`}>
              Body weight
              <select
                value={typo.body_weight}
                onChange={e => setTypo(p => ({ ...p, body_weight: e.target.value }))}
                className={inputCls}
              >
                {WEIGHTS.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </label>
          </div>

          {/* Live preview */}
          <div className="rounded-xl border border-black/10 bg-white p-4">
            <p
              style={{ fontFamily: typo.heading_font, fontWeight: typo.heading_weight, color: colors.ink }}
              className="text-base leading-tight"
            >
              Heading preview
            </p>
            <p
              style={{ fontFamily: typo.body_font, fontWeight: typo.body_weight, color: colors.ink, opacity: 0.7 }}
              className="mt-1 text-sm"
            >
              Body text preview — the quick brown fox jumps over the lazy dog.
            </p>
          </div>
        </div>

        {/* Save bar */}
        {error && <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}
        {saved && <p className="rounded-lg bg-green-50 px-4 py-2.5 text-sm text-green-700">Brand profile saved.</p>}
        <button
          type="submit"
          disabled={saving || uploading}
          className="rounded-[var(--brand-radius)] bg-[var(--brand-primary)] px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 self-start"
        >
          {saving ? 'Saving…' : 'Save brand profile'}
        </button>
      </div>
    </form>
  );
}
