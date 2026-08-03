'use client';
import { useState, useEffect } from 'react';

interface Edition { id: string; name: string; }

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', fontSize: '13.5px',
  color: '#0D1B2A', background: '#FAFBFC',
  border: '1px solid #E2E8F0', borderRadius: '7px',
  outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.15s, box-shadow 0.15s',
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151',
  marginBottom: '6px', letterSpacing: '0.06em', textTransform: 'uppercase',
};

export function NewClientButton() {
  const [open, setOpen]       = useState(false);
  const [editions, setEditions] = useState<Edition[]>([]);
  const [form, setForm]       = useState({ name: '', slug: '', edition_id: '', custom_domain: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (open && !editions.length) {
      fetch('/api/editions')
        .then(r => r.json())
        .then((d: Edition[]) => setEditions(d))
        .catch(() => {});
    }
  }, [open, editions.length]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setOpen(false);
      window.location.reload();
    } else {
      const d = await res.json() as { error?: string };
      setError(d.error ?? 'Failed to create client');
    }
    setLoading(false);
  }

  const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.target.style.borderColor = '#00C4A0';
    e.target.style.boxShadow   = '0 0 0 3px rgba(0,196,160,0.1)';
  };
  const onBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.target.style.borderColor = '#E2E8F0';
    e.target.style.boxShadow   = 'none';
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '9px 16px', borderRadius: '8px',
          background: '#0D1B2A', color: 'white',
          fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          letterSpacing: '0.01em', transition: 'background 0.15s',
        }}
        onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = '#1B2A41')}
        onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = '#0D1B2A')}
      >
        <span style={{ fontSize: '16px', lineHeight: 1, marginTop: '-1px' }}>+</span>
        New client
      </button>

      {open && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px', background: 'rgba(13,27,42,0.6)',
          backdropFilter: 'blur(4px)',
        }}
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div style={{
            width: '100%', maxWidth: '460px', background: 'white',
            borderRadius: '14px', padding: '32px',
            boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#0D1B2A', letterSpacing: '-0.015em', margin: 0 }}>
                  Create client workspace
                </h2>
                <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
                  Set up a new workspace for your client.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  background: '#F1F5F9', border: 'none', cursor: 'pointer',
                  width: '28px', height: '28px', borderRadius: '6px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#64748B', fontSize: '14px',
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Client name <span style={{ color: '#EF4444' }}>*</span></label>
                <input
                  required
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Acme Corporation"
                  style={inputStyle}
                  onFocus={onFocus} onBlur={onBlur}
                />
              </div>

              <div>
                <label style={labelStyle}>Slug <span style={{ color: '#EF4444' }}>*</span></label>
                <input
                  required
                  value={form.slug}
                  onChange={e => setForm(p => ({ ...p, slug: e.target.value }))}
                  placeholder="acme-corp"
                  style={{ ...inputStyle, fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace", fontSize: '13px' }}
                  onFocus={onFocus} onBlur={onBlur}
                />
              </div>

              <div>
                <label style={labelStyle}>Edition <span style={{ color: '#EF4444' }}>*</span></label>
                <select
                  required
                  value={form.edition_id}
                  onChange={e => setForm(p => ({ ...p, edition_id: e.target.value }))}
                  style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}
                  onFocus={onFocus} onBlur={onBlur}
                >
                  <option value="">Select edition…</option>
                  {editions.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Custom domain <span style={{ color: '#94A3B8', fontWeight: 400, textTransform: 'none', fontSize: '11px', letterSpacing: 0 }}>(optional)</span></label>
                <input
                  value={form.custom_domain}
                  onChange={e => setForm(p => ({ ...p, custom_domain: e.target.value }))}
                  placeholder="portal.acme.com"
                  style={inputStyle}
                  onFocus={onFocus} onBlur={onBlur}
                />
              </div>

              {error && (
                <div style={{
                  padding: '10px 12px', borderRadius: '7px', fontSize: '13px',
                  background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626',
                }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  style={{
                    padding: '9px 18px', borderRadius: '7px', fontSize: '13px',
                    fontWeight: 500, cursor: 'pointer',
                    background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#475569',
                    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '9px 22px', borderRadius: '7px', fontSize: '13px',
                    fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                    background: loading ? '#94A3B8' : '#0D1B2A',
                    border: 'none', color: 'white',
                    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                    transition: 'background 0.15s',
                  }}
                >
                  {loading ? 'Creating…' : 'Create workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
