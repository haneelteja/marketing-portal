import { redirect } from 'next/navigation';
import nextDynamic from 'next/dynamic';
import { getSession } from '@/lib/session/getSession';
import { rlsClient } from '@/lib/db/clients';
import { AddConceptButton } from './AddConceptButton';
import { ApproveButton } from './ApproveButton';

const ConceptComments = nextDynamic(
  () => import('@/components/ConceptComments').then((m) => m.ConceptComments),
  { ssr: false },
);

export const dynamic = 'force-dynamic';

export default async function CampaignDetailPage({ params }: { params: Promise<{ clientSlug: string; id: string }> }) {
  const session = await getSession();
  const { clientSlug, id } = await params;
  if (!session) redirect(`/login?next=/app/${clientSlug}/campaigns/${id}`);

  const db = rlsClient(session.accessToken);
  const [{ data: campaign }, { data: concepts }, { data: clientUsers }] = await Promise.all([
    db.from('campaigns').select('*').eq('id', id).single(),
    db.from('concepts').select('id, title, core_message, suggested_format, status, created_at, concept_assets(id, type, status, source_url)').eq('campaign_id', id).order('created_at'),
    db.from('users').select('id, email').eq('client_id', session.claims.client_id ?? '').limit(50),
  ]);

  if (!campaign) redirect(`/app/${clientSlug}/campaigns`);

  const STATUS_COLORS: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    active: 'bg-green-100 text-green-800',
    completed: 'bg-blue-100 text-blue-800',
    archived: 'bg-gray-100 text-gray-500',
  };

  return (
    <div>
      <div className="mb-6">
        <a href={`/app/${clientSlug}/campaigns`} className="text-sm text-black/50 hover:text-[var(--brand-primary)]">← Campaigns</a>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[var(--brand-ink)]">{campaign.name}</h1>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[campaign.status] ?? ''}`}>{campaign.status}</span>
        </div>
        {campaign.objective && <p className="mt-1 text-sm text-black/60">{campaign.objective}</p>}
        {(campaign.start_date || campaign.end_date) && (
          <p className="mt-1 text-xs text-black/40">{campaign.start_date} → {campaign.end_date}</p>
        )}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Concepts</h2>
        <AddConceptButton campaignId={id} />
      </div>

      <div className="flex flex-col gap-4">
        {(concepts ?? []).map(concept => {
          const assets = Array.isArray(concept.concept_assets) ? concept.concept_assets : [];
          const approvedImages = assets.filter((a: { type: string; status: string }) => a.type === 'image' && a.status === 'approved');
          return (
            <div key={concept.id} className="rounded-[var(--brand-radius)] border border-black/10 bg-white p-5">
              <div className="mb-2 flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold">{concept.title}</h3>
                  {concept.core_message && <p className="mt-1 text-sm text-black/60">{concept.core_message}</p>}
                  {concept.suggested_format && <p className="mt-0.5 text-xs text-black/40">Format: {concept.suggested_format}</p>}
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${concept.status === 'locked' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{concept.status}</span>
              </div>
              {approvedImages.length > 0 && (
                <div className="mb-3 flex gap-2 flex-wrap">
                  {approvedImages.map((a: { id: string; source_url: string }) => (
                    <img key={a.id} src={a.source_url} alt="" className="h-16 w-16 rounded-lg object-cover" />
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                <a href={`/app/${clientSlug}/generate?conceptId=${concept.id}&stage=image`}
                   className="rounded-[var(--brand-radius)] border border-[var(--brand-primary)] px-3 py-1.5 text-xs font-medium text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10">
                  Generate images
                </a>
                <a href={`/app/${clientSlug}/generate?conceptId=${concept.id}&stage=video`}
                   className="rounded-[var(--brand-radius)] border border-[var(--brand-secondary)] px-3 py-1.5 text-xs font-medium text-[var(--brand-secondary)] hover:bg-[var(--brand-secondary)]/10">
                  Generate video
                </a>
                <ApproveButton conceptId={concept.id} />
              </div>

              <details className="mt-4">
                <summary className="cursor-pointer select-none text-xs font-medium text-black/50 hover:text-[var(--brand-primary)] transition-colors">
                  Comments
                </summary>
                <ConceptComments
                  targetType="concept"
                  targetId={concept.id}
                  clientUsers={clientUsers ?? []}
                />
              </details>
            </div>
          );
        })}
        {!concepts?.length && (
          <div className="rounded-[var(--brand-radius)] border border-dashed border-black/20 p-8 text-center text-sm text-black/40">
            No concepts yet. Generate ideas using the Generate tab, or add one manually.
          </div>
        )}
      </div>
    </div>
  );
}
