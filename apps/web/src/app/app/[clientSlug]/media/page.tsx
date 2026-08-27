import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session/getSession';
import { rlsClient } from '@/lib/db/clients';
import { MediaLibraryClient } from './MediaLibraryClient';

export const dynamic = 'force-dynamic';

export default async function MediaPage({ params }: { params: Promise<{ clientSlug: string }> }) {
  const session = await getSession();
  const { clientSlug } = await params;
  if (!session) redirect(`/login?next=/app/${clientSlug}/media`);

  const db = rlsClient(session.accessToken);
  const { data: assets } = await db
    .from('media_library')
    .select('id, name, url, mime_type, size_bytes, tags, source, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  const canUpload = ['brand_admin', 'brand_editor'].includes(session.claims.client_role ?? '');

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--brand-ink)]">Media library</h1>
          <p className="mt-1 text-sm text-black/50">Brand assets, AI-generated media, and uploaded files.</p>
        </div>
      </div>
      <MediaLibraryClient initialAssets={assets ?? []} canUpload={canUpload} />
    </div>
  );
}
