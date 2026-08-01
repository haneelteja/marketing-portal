import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session/getSession';
import { platformClient } from '@/lib/db/clients';

export const dynamic = 'force-dynamic';

interface ClientRow {
  id: string;
  name: string;
  slug: string;
  client_editions: { name: string; ai_generation_quota: number | null } | null;
}

interface LedgerRow {
  client_id: string;
  units: number;
}

export default async function QuotasPage() {
  const session = await getSession();
  if (!session?.claims.platform_role) redirect('/login?next=/platform/quotas');

  const db = platformClient(session.accessToken);
  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [{ data: clients }, { data: ledger }] = await Promise.all([
    db
      .from('clients')
      .select('id, name, slug, client_editions(name, ai_generation_quota)')
      .eq('status', 'active')
      .order('name'),
    db
      .from('quota_ledger')
      .select('client_id, units')
      .eq('period', period),
  ]);

  const usageByClient = (ledger as LedgerRow[] | null ?? []).reduce<Record<string, number>>(
    (acc, row) => {
      acc[row.client_id] = (acc[row.client_id] ?? 0) + row.units;
      return acc;
    },
    {}
  );

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--brand-ink)]">Quota Usage</h1>
        <span className="rounded-full bg-black/5 px-3 py-1 text-sm text-black/60">
          Period: {period}
        </span>
      </div>
      <p className="mb-6 text-sm text-black/50">
        AI generation quota consumed this billing period per active client.
      </p>
      <div className="overflow-hidden rounded-[var(--brand-radius)] border border-black/10 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 bg-black/5 text-left">
              <th className="px-4 py-3 font-semibold">Client</th>
              <th className="px-4 py-3 font-semibold">Edition</th>
              <th className="px-4 py-3 font-semibold">Used</th>
              <th className="px-4 py-3 font-semibold">Limit</th>
              <th className="px-4 py-3 font-semibold">Usage</th>
            </tr>
          </thead>
          <tbody>
            {((clients as ClientRow[] | null) ?? []).map(c => {
              const used = usageByClient[c.id] ?? 0;
              const limit = c.client_editions?.ai_generation_quota ?? null;
              const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : null;
              const barColor =
                pct === null
                  ? 'bg-gray-200'
                  : pct >= 90
                  ? 'bg-red-500'
                  : pct >= 70
                  ? 'bg-yellow-400'
                  : 'bg-green-500';

              return (
                <tr key={c.id} className="border-b border-black/5 last:border-0 hover:bg-black/[0.02]">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-black/60">{c.client_editions?.name ?? '—'}</td>
                  <td className="px-4 py-3 tabular-nums">{used.toLocaleString()}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {limit?.toLocaleString() ?? 'Unlimited'}
                  </td>
                  <td className="px-4 py-3 w-40">
                    {pct !== null ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 rounded-full bg-black/10 h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${barColor}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-black/60 w-8 text-right">{pct}%</span>
                      </div>
                    ) : (
                      <span className="text-xs text-black/30">N/A</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!clients?.length && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-black/40">
                  No active clients.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
