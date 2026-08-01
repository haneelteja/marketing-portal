'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  campaignId: string;
}

export function AddConceptButton({ campaignId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '',
    core_message: '',
    suggested_format: '',
  });

  function reset() {
    setForm({ title: '', core_message: '', suggested_format: '' });
    setError('');
    setSaving(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/concepts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          campaign_id: campaignId,
          title: form.title,
          core_message: form.core_message || undefined,
          suggested_format: form.suggested_format || undefined,
        }),
      });
      if (res.ok) {
        setOpen(false);
        reset();
        router.refresh();
      } else {
        const d = await res.json();
        setError(d.error ?? 'Failed to create concept');
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
        className="rounded-[var(--brand-radius)] border border-[var(--brand-primary)] px-3 py-1.5 text-sm font-medium text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10"
      >
        + Add concept manually
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-[var(--brand-radius)] bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-[var(--brand-ink)]">Add concept</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--brand-ink)]">
                Title <span className="text-red-500">*</span>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Concept title"
                  className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                  required
                />
              </label>

              <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--brand-ink)]">
                Core message
                <textarea
                  rows={3}
                  value={form.core_message}
                  onChange={e => setForm(p => ({ ...p, core_message: e.target.value }))}
                  placeholder="What is the key message of this concept?"
                  className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] resize-none"
                />
              </label>

              <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--brand-ink)]">
                Suggested format
                <input
                  type="text"
                  value={form.suggested_format}
                  onChange={e => setForm(p => ({ ...p, suggested_format: e.target.value }))}
                  placeholder="e.g. carousel, reel, story"
                  className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                />
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
                  {saving ? 'Adding…' : 'Add concept'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
