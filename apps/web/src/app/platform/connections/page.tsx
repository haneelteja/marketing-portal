import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session/getSession';
import { platformClient } from '@/lib/db/clients';

export const dynamic = 'force-dynamic';

const WARN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface AccountRow {
  id: string;
  platform: string;
  status: string;
  token_expires_at: string | null;
  last_successful_publish: string | null;
  clients: { name: string; slug: string } | null;
}

function expiryLabel(expiresAt: string | null): { label: string; urgent: boolean } | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff < 0) return { label: 'Expired', urgent: true };
  const days = Math.floor(diff / 86400000);
  if (days === 0) return { label: 'Expires today', urgent: true };
  return { label: `Expires in ${days}d`, urgent: days <= 3 };
}

export default async function ConnectionsPage() {
  const session = await getSession();
  if (!session?.claims.platform_role) redirect('/login?next=/platform/connections');

  const db = platformClient(session.accessToken);
  const warnThreshold = new Date(Date.now() + WARN_EXPIRY_MS).toISOString();

  // Accounts that are not connected OR have tokens expiring within 7 days
  const { data: accounts } = await db
    .from('social_accounts')
    .select('id, platform, status, token_expires_at, last_successful_publish, clients(name, slug)')
    .or(`status.neq.connected,token_expires_at.lte.${warnThreshold}`)
    .order('token_expires_at', { ascending: true, nullsFirst: false });

  const STATUS_COLORS: Record<string, string> = {
    connected: 'bg-green-100 text-green-800',
    disconnected: 'bg-gray-100 text-gray-600',
    error: 'bg-red-100 text-red-800',
    expired: 'bg-red-100 text-red-800',
    pending: 'bg-yellow-100 text-yellow-800',
  };

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-[var(--brand-ink)]">Social Connections</h1>
      <p className="mb-6 text-sm text-black/50">
        Accounts that are disconnected, errored, or have tokens expiring within 7 days.
      </p>
      {!accounts?.length ? (
        <div className="rounded-[var(--brand-radius)] border border-black/10 bg-white px-6 py-12 text-center">
          <p className="text-lg font-semibold text-green-600">All connections healthy</p>
          <p className="mt-1 text-sm text-black/50">
            No accounts require attention right now.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[var(--brand-radius)] border border-black/10 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/10 bg-black/5 text-left">
                <th className="px-4 py-3 font-semibold">Client</th>
                <th className="px-4 py-3 font-semibold">Platform</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Token</th>
                <th className="px-4 py-3 font-semibold">Last Published</th>
              </tr>
            </thead>
            <tbody>
              {(accounts as unknown as AccountRow[]).map(a => {
                const expiry = expiryLabel(a.token_expires_at);
                return (
                  <tr
                    key={a.id}
                    className="border-b border-black/5 last:border-0 hover:bg-black/[0.02]"
                  >
                    <td className="px-4 py-3 font-medium">
                      {a.clients?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 capitalize">{a.platform}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[a.status] ?? 'bg-gray-100 text-gray-600'}`}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {expiry ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${expiry.urgent ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}
                        >
                          {expiry.label}
                        </span>
                      ) : (
                        <span className="text-xs text-black/30">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-black/50">
                      {a.last_successful_publish
                        ? new Date(a.last_successful_publish).toLocaleDateString()
                        : 'Never'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
