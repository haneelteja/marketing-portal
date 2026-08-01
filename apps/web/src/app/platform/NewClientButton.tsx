'use client';
import { useState, useEffect } from 'react';

interface Edition {
  id: string;
  name: string;
}

export function NewClientButton() {
  const [open, setOpen] = useState(false);
  const [editions, setEditions] = useState<Edition[]>([]);
  const [form, setForm] = useState({ name: '', slug: '', edition_id: '', custom_domain: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      setError(d.error ?? 'Failed');
    }
    setLoading(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-[var(--brand-radius)] bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        + New client
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-bold">Create client workspace</h2>
            <form onSubmit={submit} className="flex flex-col gap-3">
              {(['name', 'slug', 'custom_domain'] as const).map(f => (
                <label key={f} className="flex flex-col gap-1 text-sm font-medium capitalize">
                  {f.replace('_', ' ')}
                  {f !== 'custom_domain' && <span className="text-red-500">*</span>}
                  <input
                    value={form[f]}
                    onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))}
                    placeholder={
                      f === 'slug'
                        ? 'acme-corp'
                        : f === 'custom_domain'
                        ? 'Optional — e.g. portal.acme.com'
                        : ''
                    }
                    className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                  />
                </label>
              ))}
              <label className="flex flex-col gap-1 text-sm font-medium">
                Edition<span className="text-red-500">*</span>
                <select
                  value={form.edition_id}
                  onChange={e => setForm(p => ({ ...p, edition_id: e.target.value }))}
                  className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none"
                >
                  <option value="">Select edition…</option>
                  {editions.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </label>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border px-4 py-2 text-sm hover:bg-black/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
