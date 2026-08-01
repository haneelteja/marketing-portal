import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session/getSession';
import { GenerateClient } from './GenerateClient';

export const dynamic = 'force-dynamic';

export default async function GeneratePage({
  params,
  searchParams,
}: {
  params: Promise<{ clientSlug: string }>;
  searchParams: Promise<{ conceptId?: string; stage?: string }>;
}) {
  const session = await getSession();
  const { clientSlug } = await params;
  if (!session) redirect(`/login?next=/app/${clientSlug}/generate`);
  const sp = await searchParams;
  return (
    <GenerateClient
      clientSlug={clientSlug}
      initialConceptId={sp.conceptId}
      initialStage={sp.stage as 'concept' | 'image' | 'video' | undefined}
    />
  );
}
