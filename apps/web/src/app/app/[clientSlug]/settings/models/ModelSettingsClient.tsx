'use client';
import { useState, useEffect } from 'react';

type Capability = 'text' | 'image' | 'video' | 'audio';
interface ModelDescriptor {
  vendor: string; vendorLabel: string; capability: Capability;
  model: string; label: string; description: string; costUnitsPerCall: number; configured: boolean;
}
interface ModelPref { capability: Capability; vendor: string; model: string }

const CAPABILITY_META: Record<Capability, { label: string; icon: string; description: string }> = {
  text:  { label: 'Text / Concepts', icon: '✍️', description: 'Generates campaign concept ideas, copy, and scripts.' },
  image: { label: 'Image',           icon: '🖼️', description: 'Generates marketing visuals and product imagery.' },
  video: { label: 'Video',           icon: '🎬', description: 'Generates short-form social video reels.' },
  audio: { label: 'Audio',           icon: '🎙️', description: 'Generates voiceovers and audio ads via text-to-speech.' },
};

export function ModelSettingsClient() {
  const [catalog, setCatalog] = useState<ModelDescriptor[]>([]);
  const [prefs, setPrefs] = useState<Record<Capability, { vendor: string; model: string } | null>>({ text: null, image: null, video: null, audio: null });
  const [saving, setSaving] = useState<Capability | null>(null);
  const [saved, setSaved] = useState<Capability | null>(null);

  useEffect(() => {
    fetch('/api/providers/catalog').then(r => r.json()).then((d: ModelDescriptor[]) => { if (Array.isArray(d)) setCatalog(d); }).catch(() => {});
    fetch('/api/model-preferences').then(r => r.json()).then((d: ModelPref[]) => {
      if (!Array.isArray(d)) return;
      const map: Record<Capability, { vendor: string; model: string } | null> = { text: null, image: null, video: null, audio: null };
      for (const p of d) map[p.capability] = { vendor: p.vendor, model: p.model };
      setPrefs(map);
    }).catch(() => {});
  }, []);

  async function selectModel(capability: Capability, vendor: string, model: string) {
    setSaving(capability); setSaved(null);
    setPrefs(prev => ({ ...prev, [capability]: { vendor, model } }));
    await fetch('/api/model-preferences', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ capability, vendor, model }),
    });
    setSaving(null); setSaved(capability);
    setTimeout(() => setSaved(null), 2000);
  }

  return (
    <div className="flex flex-col gap-8">
      {(Object.keys(CAPABILITY_META) as Capability[]).map(cap => {
        const meta = CAPABILITY_META[cap];
        const models = catalog.filter(d => d.capability === cap);
        const currentPref = prefs[cap];
        return (
          <section key={cap}>
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xl">{meta.icon}</span>
              <div>
                <h2 className="font-semibold text-[var(--brand-ink)]">{meta.label}</h2>
                <p className="text-xs text-black/50">{meta.description}</p>
              </div>
              {saving === cap && <span className="ml-auto text-xs text-black/40">Saving…</span>}
              {saved === cap && <span className="ml-auto text-xs text-green-600">✓ Saved</span>}
            </div>
            {models.length === 0 ? (
              <p className="text-sm text-black/40">No providers available for this capability.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {models.map(d => {
                  const isSelected = currentPref?.vendor === d.vendor && currentPref?.model === d.model;
                  return (
                    <div key={`${d.vendor}::${d.model}`}
                      className={`rounded-[var(--brand-radius)] border p-4 transition-all ${isSelected ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5' : 'border-black/10 bg-white hover:border-[var(--brand-primary)]/30'}`}>
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold text-black/40 uppercase tracking-wide">{d.vendorLabel}</p>
                          <p className="font-semibold text-sm">{d.label}</p>
                        </div>
                        {isSelected ? (
                          <span className="shrink-0 rounded-full bg-[var(--brand-primary)] px-2 py-0.5 text-xs font-medium text-white">Selected</span>
                        ) : (
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${d.configured ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            {d.configured ? '✓ Ready' : '⚠ Needs key'}
                          </span>
                        )}
                      </div>
                      <p className="mb-3 text-xs text-black/50 line-clamp-2">{d.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-black/30">{d.costUnitsPerCall} units / call</span>
                        {!isSelected && (
                          <button onClick={() => selectModel(cap, d.vendor, d.model)} disabled={!d.configured || saving === cap}
                            className="rounded-[var(--brand-radius)] border border-[var(--brand-primary)] px-3 py-1 text-xs font-medium text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10 disabled:opacity-40">
                            {d.configured ? 'Select' : 'Not available'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
