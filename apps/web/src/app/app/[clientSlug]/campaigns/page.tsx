import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session/getSession';
import { rlsClient } from '@/lib/db/clients';
import { NewCampaignButton } from './NewCampaignButton';

export const dynamic = 'force-dynamic';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  active: 'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
  archived: 'bg-gray-100 text-gray-500',
};

export default async function CampaignsPage({ params }: { params: Promise<{ clientSlug: string }> }) {
  const session = await getSession();
  const { clientSlug } = await params;
  if (!session) redirect(`/login?next=/app/${clientSlug}/campaigns`);

  const db = rlsClient(session.accessToken);
  const { data: campaigns, error } = await db
    .from('campaigns')
    .select('id, name, objective, start_date, end_date, status, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    return (
      <div>
        <p className="text-sm text-red-600">Failed to load campaigns: {error.message}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--brand-ink)]">Campaigns</h1>
          <p className="mt-1 text-sm text-black/50">Manage your marketing campaigns</p>
        </div>
        <NewCampaignButton />
      </div>

      {campaigns && campaigns.length > 0 ? (
        <div className="overflow-hidden rounded-[var(--brand-radius)] border border-black/10 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/10 bg-black/2">
                <th className="px-4 py-3 text-left font-medium text-black/60">Name</th>
                <th className="px-4 py-3 text-left font-medium text-black/60">Objective</th>
                <th className="px-4 py-3 text-left font-medium text-black/60">Dates</th>
                <th className="px-4 py-3 text-left font-medium text-black/60">Status</th>
                <th className="px-4 py-3 text-left font-medium text-black/60">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {campaigns.map(campaign => (
                <tr key={campaign.id} className="hover:bg-black/2 transition-colors">
                  <td className="px-4 py-3 font-medium text-[var(--brand-ink)]">{campaign.name}</td>
                  <td className="px-4 py-3 text-black/60 max-w-xs truncate">{campaign.objective ?? '—'}</td>
                  <td className="px-4 py-3 text-black/50 whitespace-nowrap">
                    {campaign.start_date || campaign.end_date
                      ? `${campaign.start_date ?? '?'} → ${campaign.end_date ?? '?'}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[campaign.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {campaign.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`/app/${clientSlug}/campaigns/${campaign.id}`}
                      className="text-[var(--brand-primary)] hover:underline text-xs font-medium"
                    >
                      View →
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-[var(--brand-radius)] border border-dashed border-black/20 p-12 text-center">
          <p className="text-sm text-black/40">No campaigns yet. Create your first campaign to get started.</p>
        </div>
      )}
    </div>
  );
}
