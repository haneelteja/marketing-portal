import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session/getSession';
import { platformClient } from '@/lib/db/clients';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getSession();
  if (!session?.claims.platform_role) redirect('/login?next=/platform/audit');

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? '1', 10));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const db = platformClient(session.accessToken);
  const { data: entries, count } = await db
    .from('audit_log')
    .select(
      'id, action, target_type, target_id, diff, created_at, users(email), clients(name)',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, to);

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-[var(--brand-ink)]">Audit Log</h1>
      <div className="overflow-hidden rounded-[var(--brand-radius)] border border-black/10 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 bg-black/5 text-left">
              <th className="px-4 py-3 font-semibold">Timestamp</th>
              <th className="px-4 py-3 font-semibold">Action</th>
              <th className="px-4 py-3 font-semibold">Actor</th>
              <th className="px-4 py-3 font-semibold">Client</th>
              <th className="px-4 py-3 font-semibold">Target</th>
              <th className="px-4 py-3 font-semibold">Diff</th>
            </tr>
          </thead>
          <tbody>
            {(entries ?? []).map(e => (
              <tr key={e.id} className="border-b border-black/5 last:border-0 hover:bg-black/[0.02]">
                <td className="px-4 py-3 text-xs text-black/50 whitespace-nowrap">
                  {new Date(e.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-[var(--brand-radius)] bg-[var(--brand-surface)] px-2 py-0.5 font-mono text-xs">
                    {e.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-black/70">
                  {(e.users as unknown as { email: string } | null)?.email ?? '—'}
                </td>
                <td className="px-4 py-3 text-xs text-black/70">
                  {(e.clients as unknown as { name: string } | null)?.name ?? '—'}
                </td>
                <td className="px-4 py-3 text-xs text-black/60">
                  {e.target_type ? `${e.target_type}:${e.target_id}` : '—'}
                </td>
                <td className="px-4 py-3 max-w-xs truncate text-xs text-black/40">
                  {e.diff ? JSON.stringify(e.diff) : '—'}
                </td>
              </tr>
            ))}
            {!entries?.length && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-black/40">
                  No audit entries found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-black/60">
          <span>
            Page {page} of {totalPages} ({count} entries)
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <a
                href={`/platform/audit?page=${page - 1}`}
                className="rounded-[var(--brand-radius)] border px-3 py-1 hover:bg-black/5"
              >
                Previous
              </a>
            )}
            {page < totalPages && (
              <a
                href={`/platform/audit?page=${page + 1}`}
                className="rounded-[var(--brand-radius)] border px-3 py-1 hover:bg-black/5"
              >
                Next
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
