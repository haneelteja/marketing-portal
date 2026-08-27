import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session/getSession';
import { rlsClient } from '@/lib/db/clients';
import { ProductsClient } from './ProductsClient';

export const dynamic = 'force-dynamic';

export default async function ProductsPage({ params }: { params: Promise<{ clientSlug: string }> }) {
  const session = await getSession();
  const { clientSlug } = await params;
  if (!session) redirect(`/login?next=/app/${clientSlug}/products`);

  const db = rlsClient(session.accessToken);
  const { data: products } = await db
    .from('product_catalog')
    .select('id, name, description, price, currency, image_url, category, tags, active, created_at')
    .order('created_at', { ascending: false });

  const canEdit = ['brand_admin', 'brand_editor'].includes(session.claims.client_role ?? '');

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--brand-ink)]">Product catalog</h1>
          <p className="mt-1 text-sm text-black/50">
            Products and services used as context in AI content generation.
          </p>
        </div>
      </div>
      <ProductsClient initialProducts={products ?? []} canEdit={canEdit} />
    </div>
  );
}
