import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session/getSession';
import { rlsClient } from '@/lib/db/clients';
import { BrandEditor } from './BrandEditor';

export const dynamic = 'force-dynamic';

export default async function BrandPage({ params }: { params: Promise<{ clientSlug: string }> }) {
  const session = await getSession();
  const { clientSlug } = await params;
  if (!session) redirect(`/login?next=/app/${clientSlug}/brand`);

  const db = rlsClient(session.accessToken);
  const { data: profile } = await db
    .from('brand_profiles')
    .select('*')
    .maybeSingle();

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-[var(--brand-ink)]">Brand profile</h1>
      <p className="mb-6 text-sm text-black/50">
        These details are used as context in every AI generation request for your workspace.
      </p>
      <BrandEditor initialProfile={profile} />
    </div>
  );
}
