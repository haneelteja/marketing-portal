'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function NewCampaignButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    objective: '',
    start_date: '',
    end_date: '',
    status: 'draft',
  });

  function reset() {
    setForm({ name: '', objective: '', start_date: '', end_date: '', status: 'draft' });
    setError('');
    setSaving(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          objective: form.objective || undefined,
          start_date: form.start_date || undefined,
          end_date: form.end_date || undefined,
          status: form.status,
        }),
      });
      if (res.ok) {
        setOpen(false);
        reset();
        router.refresh();
      } else {
        const d = await res.json();
        setError(d.error ?? 'Failed to create campaign');
      }
    } catch {
      setError('Network error');
    }
    setSaving(false);
  }

  return (
    <>
      <button
        onClick={() => { reset(); setOpen(true); }}
        className="rounded-[var(--brand-radius)] bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        + New campaign
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-[var(--brand-radius)] bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-[var(--brand-ink)]">New campaign</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--brand-ink)]">
                Name <span className="text-red-500">*</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Campaign name"
                  className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                  required
                />
              </label>

              <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--brand-ink)]">
                Objective
                <textarea
                  rows={2}
                  value={form.objective}
                  onChange={e => setForm(p => ({ ...p, objective: e.target.value }))}
                  placeholder="What is the goal of this campaign?"
                  className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] resize-none"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--brand-ink)]">
                  Start date
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                    className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--brand-ink)]">
                  End date
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                    className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--brand-ink)]">
                Status
                <select
                  value={form.status}
                  onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                  className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                </select>
              </label>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex gap-2 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => { setOpen(false); reset(); }}
                  className="rounded-[var(--brand-radius)] border border-black/15 px-4 py-2 text-sm hover:bg-black/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-[var(--brand-radius)] bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? 'Creating…' : 'Create campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
