import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session/getSession';
import { rlsClient } from '@/lib/db/clients';
import { loadTheme } from '@/lib/theme/loadTheme';

export const dynamic = 'force-dynamic';

export default async function ClientOverviewPage({ params }: { params: Promise<{ clientSlug: string }> }) {
  const session = await getSession();
  const { clientSlug } = await params;
  if (!session) redirect(`/login?next=/app/${clientSlug}`);

  const db = rlsClient(session.accessToken);
  const theme = await loadTheme();

  const [
    { count: campaignCount },
    { count: approvalCount },
    { data: recentConcepts },
    { data: weekPosts },
  ] = await Promise.all([
    db.from('campaigns').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    db.from('approvals').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    db.from('concepts').select('id, title, status, created_at, campaigns(name)').order('created_at', { ascending: false }).limit(5),
    db.from('scheduled_posts').select('id').gte('scheduled_at', new Date().toISOString()).lte('scheduled_at', new Date(Date.now() + 7 * 86400000).toISOString()),
  ]);

  const stats = [
    { label: 'Active campaigns', value: campaignCount ?? 0 },
    { label: 'Pending approvals', value: approvalCount ?? 0 },
    { label: 'Posts this week', value: weekPosts?.length ?? 0 },
  ];

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-[var(--brand-ink)]">Welcome to {theme.clientName}</h1>
      <p className="mb-8 text-sm text-black/50">Your marketing workspace overview</p>
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map(s => (
          <div key={s.label} className="rounded-[var(--brand-radius)] border border-black/10 bg-white p-5">
            <p className="text-3xl font-bold text-[var(--brand-primary)]">{s.value}</p>
            <p className="text-sm text-black/60">{s.label}</p>
          </div>
        ))}
      </div>
      <h2 className="mb-3 text-lg font-semibold text-[var(--brand-ink)]">Recent concepts</h2>
      <div className="flex flex-col gap-2">
        {(recentConcepts ?? []).map(c => (
          <div key={c.id} className="flex items-center justify-between rounded-[var(--brand-radius)] border border-black/10 bg-white px-4 py-3">
            <div>
              <p className="font-medium text-sm">{c.title}</p>
              <p className="text-xs text-black/50">{(c.campaigns as unknown as { name: string } | null)?.name} · {new Date(c.created_at).toLocaleDateString()}</p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.status === 'locked' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{c.status}</span>
          </div>
        ))}
        {!recentConcepts?.length && <p className="text-sm text-black/40 py-4 text-center">No concepts yet. Start by creating a campaign.</p>}
      </div>
    </div>
  );
}
