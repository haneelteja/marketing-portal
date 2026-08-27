'use client';
import { useState } from 'react';

interface Product {
  id: string;
  name: string;
  description?: string | null;
  price?: number | null;
  currency?: string;
  image_url?: string | null;
  category?: string | null;
  tags?: string[];
  active?: boolean;
  created_at?: string;
}

interface NewProduct {
  name: string;
  description: string;
  price: string;
  currency: string;
  category: string;
  tags: string;
  image_url: string;
  active: boolean;
}

const EMPTY: NewProduct = {
  name: '', description: '', price: '', currency: 'USD',
  category: '', tags: '', image_url: '', active: true,
};

function formatPrice(price?: number | null, currency?: string) {
  if (price == null) return null;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency ?? 'USD' }).format(price);
}

export function ProductsClient({ initialProducts, canEdit }: { initialProducts: Product[]; canEdit: boolean }) {
  const [products, setProducts] = useState(initialProducts);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewProduct>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const f = (k: keyof NewProduct) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError('');
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        description: form.description || undefined,
        price: form.price ? parseFloat(form.price) : undefined,
        currency: form.currency,
        category: form.category || undefined,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        image_url: form.image_url || undefined,
        active: form.active,
      }),
    });
    if (res.ok) {
      const freshRes = await fetch('/api/products');
      const fresh = await freshRes.json() as Product[];
      setProducts(fresh);
      setForm(EMPTY);
      setShowForm(false);
    } else {
      const d = await res.json() as { error?: string };
      setError(d.error ?? 'Save failed');
    }
    setSaving(false);
  }

  async function toggleActive(product: Product) {
    const res = await fetch(`/api/products/${product.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ active: !product.active }),
    });
    if (res.ok) {
      setProducts(ps => ps.map(p => p.id === product.id ? { ...p, active: !p.active } : p));
    }
  }

  async function deleteProduct(id: string) {
    if (!confirm('Delete this product? This cannot be undone.')) return;
    setDeletingId(id);
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    if (res.ok) setProducts(ps => ps.filter(p => p.id !== id));
    setDeletingId(null);
  }

  const inputCls = 'rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] bg-white w-full';
  const labelCls = 'flex flex-col gap-1 text-xs font-medium text-black/60';

  return (
    <div>
      {canEdit && (
        <div className="mb-5">
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="rounded-[var(--brand-radius)] bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              + Add product
            </button>
          ) : (
            <form onSubmit={submit} className="rounded-xl border border-black/10 bg-white p-6">
              <h3 className="mb-4 text-sm font-semibold text-[var(--brand-ink)]">New product</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className={labelCls}>
                  Name *
                  <input required value={form.name} onChange={f('name')} className={inputCls} placeholder="Product name" />
                </label>
                <label className={labelCls}>
                  Category
                  <input value={form.category} onChange={f('category')} className={inputCls} placeholder="e.g. Services, SaaS" />
                </label>
                <label className={`${labelCls} sm:col-span-2`}>
                  Description
                  <textarea value={form.description} onChange={f('description')} rows={3} className={inputCls} placeholder="What this product/service offers…" />
                </label>
                <label className={labelCls}>
                  Price
                  <input type="number" step="0.01" min="0" value={form.price} onChange={f('price')} className={inputCls} placeholder="0.00" />
                </label>
                <label className={labelCls}>
                  Currency
                  <select value={form.currency} onChange={f('currency')} className={inputCls}>
                    {['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'INR', 'SGD', 'AED'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </label>
                <label className={labelCls}>
                  Tags (comma-separated)
                  <input value={form.tags} onChange={f('tags')} className={inputCls} placeholder="enterprise, annual, popular" />
                </label>
                <label className={labelCls}>
                  Image URL
                  <input value={form.image_url} onChange={f('image_url')} className={inputCls} placeholder="https://…" />
                </label>
                <label className="flex items-center gap-2 text-sm text-[var(--brand-ink)] cursor-pointer sm:col-span-2">
                  <input type="checkbox" checked={form.active} onChange={f('active')} className="rounded" />
                  Active (visible in AI context)
                </label>
              </div>
              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
              <div className="mt-4 flex gap-3">
                <button type="submit" disabled={saving}
                  className="rounded-[var(--brand-radius)] bg-[var(--brand-primary)] px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                  {saving ? 'Saving…' : 'Add product'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setForm(EMPTY); setError(''); }}
                  className="rounded-[var(--brand-radius)] border border-black/20 px-5 py-2 text-sm font-medium text-black/60 hover:bg-black/5">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/20 p-12 text-center">
          <p className="text-sm text-black/40">No products yet. Add your first product or service.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {products.map(p => (
            <div key={p.id} className={`rounded-xl border bg-white transition-all ${p.active ? 'border-black/10' : 'border-black/5 opacity-60'}`}>
              {p.image_url && (
                <div className="h-36 rounded-t-xl overflow-hidden bg-black/5">
                  <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                </div>
              )}
              <div className="p-4">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[var(--brand-ink)] leading-tight">{p.name}</h3>
                  {!p.active && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 flex-shrink-0">Inactive</span>
                  )}
                </div>
                {p.category && <p className="mb-1 text-[10px] text-black/40 uppercase tracking-wide font-medium">{p.category}</p>}
                {p.description && <p className="mb-2 text-xs text-black/60 line-clamp-2">{p.description}</p>}
                {p.tags && p.tags.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1">
                    {p.tags.map(tag => (
                      <span key={tag} className="rounded-full bg-[var(--brand-primary)]/10 px-2 py-0.5 text-[10px] text-[var(--brand-primary)]">{tag}</span>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[var(--brand-ink)]">
                    {formatPrice(p.price, p.currency) ?? <span className="text-black/30 font-normal text-xs">No price</span>}
                  </span>
                  {canEdit && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleActive(p)}
                        className="text-xs text-black/40 hover:text-[var(--brand-primary)] transition-colors"
                      >
                        {p.active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        disabled={deletingId === p.id}
                        onClick={() => deleteProduct(p.id)}
                        className="text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
