'use client';

import { useEffect, useState } from 'react';

/* ─────────────────────────── Types ─────────────────────────────────────── */

interface ModelDescriptor {
  vendor: string;
  vendorLabel: string;
  capability: string;
  model: string;
  label: string;
  description: string;
  costUnitsPerCall: number;
  configured: boolean;
}

type LlmTask = 'strategy' | 'concept' | 'caption' | 'audience' | 'lead_scout';

interface TaskRoute { vendor: string; model: string; }

interface Settings {
  llm_task_routing: Record<string, TaskRoute>;
  openrouter_api_key_hint: string | null;
  updated_at: string | null;
}

/* ─────────────────────────── Constants ─────────────────────────────────── */

const TASKS: LlmTask[] = ['strategy', 'concept', 'caption', 'audience', 'lead_scout'];

const TASK_LABELS: Record<LlmTask, string> = {
  strategy:   'Marketing strategy',
  concept:    'Content concepts',
  caption:    'Captions & hashtags',
  audience:   'Audience analysis',
  lead_scout: 'B2B lead scouting',
};

const DEFAULT_ROUTING: Record<LlmTask, TaskRoute> = {
  strategy:   { vendor: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free' },
  concept:    { vendor: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free' },
  caption:    { vendor: 'openrouter', model: 'google/gemma-3-27b-it:free' },
  audience:   { vendor: 'openrouter', model: 'qwen/qwen-2.5-72b-instruct:free' },
  lead_scout: { vendor: 'openrouter', model: 'mistralai/mistral-7b-instruct:free' },
};

const SOCIAL_PLATFORMS = [
  { id: 'instagram', label: 'Instagram', icon: '📸' },
  { id: 'facebook',  label: 'Facebook',  icon: '👤' },
  { id: 'linkedin',  label: 'LinkedIn',  icon: '💼' },
  { id: 'youtube',   label: 'YouTube',   icon: '▶️' },
];

const VENDOR_ORDER = ['openrouter', 'anthropic', 'openai', 'google'];

/* ─────────────────────────── Helpers ────────────────────────────────────── */

const card: React.CSSProperties = {
  background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0',
  padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
};

function SectionHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#0D1B2A', margin: 0, letterSpacing: '-0.01em' }}>
        {title}
      </h2>
      <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px', marginBottom: 0 }}>{sub}</p>
    </div>
  );
}

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: '20px', fontSize: '11px',
      fontWeight: 600, background: bg, color, letterSpacing: '0.02em',
    }}>
      {label}
    </span>
  );
}

/* ─────────────────────────── Page ──────────────────────────────────────── */

export default function PlatformSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [catalog, setCatalog]   = useState<ModelDescriptor[]>([]);
  const [routing, setRouting]   = useState<Record<string, TaskRoute>>({});
  const [orKey, setOrKey]       = useState('');
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    fetch('/api/platform/settings')
      .then(r => r.json())
      .then((d: Settings) => {
        setSettings(d);
        setRouting(d.llm_task_routing ?? {});
      });
    fetch('/api/providers/catalog')
      .then(r => r.json())
      .then((d: ModelDescriptor[]) => setCatalog(d.filter(m => m.capability === 'text')));
  }, []);

  const save = async () => {
    setSaving(true);
    setError('');
    const body: Record<string, unknown> = { llm_task_routing: routing };
    if (orKey.trim()) body.openrouter_api_key = orKey.trim();
    const res = await fetch('/api/platform/settings', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const d = await res.json() as Settings;
      setSettings(d);
      setOrKey('');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      const d = await res.json() as { error?: string };
      setError(d.error ?? 'Save failed');
    }
    setSaving(false);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 11px', fontSize: '13px', color: '#0D1B2A',
    background: '#FAFBFC', border: '1px solid #E2E8F0', borderRadius: '7px',
    outline: 'none', boxSizing: 'border-box', appearance: 'none',
    fontFamily: "'Inter', sans-serif", transition: 'border-color 0.15s, box-shadow 0.15s',
  };
  const onFocus = (e: React.FocusEvent<HTMLSelectElement | HTMLInputElement>) => {
    e.target.style.borderColor = '#00C4A0';
    e.target.style.boxShadow = '0 0 0 3px rgba(0,196,160,0.12)';
  };
  const onBlur = (e: React.FocusEvent<HTMLSelectElement | HTMLInputElement>) => {
    e.target.style.borderColor = '#E2E8F0';
    e.target.style.boxShadow = 'none';
  };

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0D1B2A', letterSpacing: '-0.02em', margin: 0 }}>
          Platform settings
        </h1>
        <p style={{ fontSize: '13.5px', color: '#64748B', marginTop: '6px' }}>
          Configure AI models, API keys, and social OAuth for the entire platform.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* ── OpenRouter API Key ── */}
        <div style={card}>
          <SectionHead
            title="OpenRouter API key"
            sub="One key for 50+ free and paid models. Required for all free-tier LLM tasks."
          />
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{
                display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151',
                marginBottom: '6px', letterSpacing: '0.06em', textTransform: 'uppercase',
              }}>
                API key
              </label>
              <input
                type="password"
                placeholder={settings?.openrouter_api_key_hint
                  ? `Current: ${settings.openrouter_api_key_hint}`
                  : 'sk-or-…'}
                value={orKey}
                onChange={e => setOrKey(e.target.value)}
                style={{ ...inputStyle, fontFamily: "'SF Mono', 'Fira Code', monospace" }}
                onFocus={onFocus} onBlur={onBlur}
              />
            </div>
            <div style={{ flexShrink: 0, paddingBottom: '2px' }}>
              {settings?.openrouter_api_key_hint
                ? <Badge label="Connected" color="#059669" bg="#D1FAE5" />
                : <Badge label="Not set"   color="#D97706" bg="#FEF3C7" />}
            </div>
          </div>
          <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '8px' }}>
            Get a free key at <strong>openrouter.ai</strong>. Free models cost $0. Set the key in your
            Render worker env vars (<code style={{ fontSize: '11.5px', background: '#F1F5F9', padding: '1px 5px', borderRadius: '4px' }}>OPENROUTER_API_KEY</code>) — it is never stored in the database.
          </p>
        </div>

        {/* ── Task-based LLM routing ── */}
        <div style={card}>
          <SectionHead
            title="LLM routing by task"
            sub="Assign a different model to each AI task. Free models are recommended to start."
          />
          {catalog.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#94A3B8' }}>Loading models…</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {TASKS.map(task => {
                const current = routing[task] ?? DEFAULT_ROUTING[task];
                const isFree  = current.model.endsWith(':free');
                return (
                  <div key={task} style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '12px', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#0D1B2A' }}>
                        {TASK_LABELS[task]}
                      </div>
                      <div style={{ marginTop: '3px' }}>
                        {isFree
                          ? <Badge label="Free" color="#059669" bg="#D1FAE5" />
                          : <Badge label="Paid" color="#7C3AED" bg="#EDE9FE" />}
                      </div>
                    </div>
                    <select
                      value={`${current.vendor}::${current.model}`}
                      onChange={e => {
                        const idx = e.target.value.indexOf('::');
                        const vendor = e.target.value.slice(0, idx);
                        const model  = e.target.value.slice(idx + 2);
                        setRouting(r => ({ ...r, [task]: { vendor, model } }));
                      }}
                      style={inputStyle}
                      onFocus={onFocus} onBlur={onBlur}
                    >
                      {VENDOR_ORDER.map(v => {
                        const group = catalog.filter(m => m.vendor === v);
                        if (!group.length) return null;
                        return (
                          <optgroup key={v} label={group[0].vendorLabel}>
                            {group.map(m => (
                              <option key={m.model} value={`${m.vendor}::${m.model}`}>
                                {m.label}{m.model.endsWith(':free') ? ' (free)' : ''}
                              </option>
                            ))}
                          </optgroup>
                        );
                      })}
                    </select>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Social OAuth placeholders ── */}
        <div style={card}>
          <SectionHead
            title="Social channel connections"
            sub="Clients connect their own social accounts from the Connections page in their workspace."
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: '12px' }}>
            {SOCIAL_PLATFORMS.map(p => (
              <div
                key={p.id}
                style={{
                  padding: '16px', borderRadius: '10px', border: '1px solid #E2E8F0',
                  display: 'flex', flexDirection: 'column', gap: '10px', background: '#FAFBFC',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '20px' }}>{p.icon}</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#0D1B2A' }}>{p.label}</span>
                </div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '4px 10px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 500,
                  background: '#F1F5F9', color: '#64748B', width: 'fit-content',
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#CBD5E1', flexShrink: 0 }} />
                  Per-client OAuth
                </div>
                <p style={{ fontSize: '11.5px', color: '#94A3B8', margin: 0, lineHeight: 1.4 }}>
                  App credentials configured via Render env vars.
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Save bar ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', background: 'white', borderRadius: '10px',
          border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}>
          <div style={{ fontSize: '13px', color: '#64748B' }}>
            {settings?.updated_at
              ? `Last saved ${new Date(settings.updated_at).toLocaleString()}`
              : 'Not yet saved'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {error && <span style={{ fontSize: '13px', color: '#DC2626' }}>{error}</span>}
            {saved && <span style={{ fontSize: '13px', color: '#059669', fontWeight: 500 }}>Saved ✓</span>}
            <button
              onClick={save}
              disabled={saving}
              style={{
                padding: '9px 22px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                background: saving ? '#94A3B8' : '#00C4A0', border: 'none', color: 'white',
                cursor: saving ? 'not-allowed' : 'pointer', transition: 'background 0.15s',
                fontFamily: "'Inter', sans-serif",
              }}
            >
              {saving ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
