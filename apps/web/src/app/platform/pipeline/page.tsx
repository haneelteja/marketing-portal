import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session/getSession';
import { platformClient } from '@/lib/db/clients';

export const dynamic = 'force-dynamic';

export default async function PipelinePage() {
  const session = await getSession();
  if (!session?.claims.platform_role) redirect('/login?next=/platform/pipeline');
  const db = platformClient(session.accessToken);

  const [{ data: clients }, { data: posts }] = await Promise.all([
    db.from('clients').select('id, name, slug, status').eq('status', 'active'),
    db
      .from('scheduled_posts')
      .select('id, platform, scheduled_at, status, clients(name, slug)')
      .gte('scheduled_at', new Date().toISOString())
      .lte('scheduled_at', new Date(Date.now() + 7 * 86400000).toISOString())
      .order('scheduled_at'),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-[var(--brand-ink)]">Content Pipeline</h1>
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Active clients" value={clients?.length ?? 0} />
        <StatCard label="Posts this week" value={posts?.length ?? 0} />
        <StatCard
          label="Platforms active"
          value={[...new Set(posts?.map(p => p.platform))].length}
        />
      </div>
      <h2 className="mb-3 text-lg font-semibold">Upcoming posts (7 days)</h2>
      <div className="overflow-hidden rounded-[var(--brand-radius)] border border-black/10 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-black/5 text-left">
              <th className="px-4 py-3 font-semibold">Client</th>
              <th className="px-4 py-3 font-semibold">Platform</th>
              <th className="px-4 py-3 font-semibold">Scheduled</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {(posts ?? []).map(p => (
              <tr key={p.id} className="border-b border-black/5 last:border-0">
                <td className="px-4 py-3">
                  {(p.clients as unknown as { name: string } | null)?.name ?? '—'}
                </td>
                <td className="px-4 py-3 capitalize">{p.platform}</td>
                <td className="px-4 py-3 text-xs text-black/60">
                  {new Date(p.scheduled_at as string).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={p.status as string} />
                </td>
              </tr>
            ))}
            {!posts?.length && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-black/40">
                  No posts scheduled in the next 7 days.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--brand-radius)] border border-black/10 bg-white p-5">
      <p className="text-3xl font-bold text-[var(--brand-primary)]">{value}</p>
      <p className="text-sm text-black/60">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    scheduled: 'bg-blue-100 text-blue-800',
    published: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    publishing: 'bg-yellow-100 text-yellow-800',
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? 'bg-gray-100'}`}
    >
      {status}
    </span>
  );
}
