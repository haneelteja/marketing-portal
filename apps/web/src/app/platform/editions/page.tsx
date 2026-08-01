import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session/getSession';
import { platformClient } from '@/lib/db/clients';

export const dynamic = 'force-dynamic';

export default async function EditionsPage() {
  const session = await getSession();
  if (!session?.claims.platform_role) redirect('/login?next=/platform/editions');

  const db = platformClient(session.accessToken);
  const { data: editions } = await db
    .from('client_editions')
    .select('id, name, feature_flags, seat_limit, social_account_limit, ai_generation_quota')
    .order('ai_generation_quota');

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--brand-ink)]">Editions</h1>
      </div>
      <div className="overflow-hidden rounded-[var(--brand-radius)] border border-black/10 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 bg-black/5 text-left">
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">AI Quota / mo</th>
              <th className="px-4 py-3 font-semibold">Seats</th>
              <th className="px-4 py-3 font-semibold">Social Accounts</th>
              <th className="px-4 py-3 font-semibold">Features</th>
            </tr>
          </thead>
          <tbody>
            {(editions ?? []).map(e => (
              <tr key={e.id} className="border-b border-black/5 last:border-0 hover:bg-black/[0.02]">
                <td className="px-4 py-3 font-medium">{e.name}</td>
                <td className="px-4 py-3 tabular-nums">
                  {e.ai_generation_quota?.toLocaleString() ?? '—'}
                </td>
                <td className="px-4 py-3 tabular-nums">{e.seat_limit ?? 'Unlimited'}</td>
                <td className="px-4 py-3 tabular-nums">
                  {e.social_account_limit ?? 'Unlimited'}
                </td>
                <td className="px-4 py-3">
                  <FeatureFlags flags={e.feature_flags as Record<string, boolean> | null} />
                </td>
              </tr>
            ))}
            {!editions?.length && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-black/40">
                  No editions configured.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FeatureFlags({ flags }: { flags: Record<string, boolean> | null }) {
  if (!flags || !Object.keys(flags).length) {
    return <span className="text-black/30 text-xs">None</span>;
  }
  const enabled = Object.entries(flags)
    .filter(([, v]) => v)
    .map(([k]) => k);
  if (!enabled.length) return <span className="text-black/30 text-xs">None</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {enabled.map(f => (
        <span
          key={f}
          className="rounded-full bg-[var(--brand-primary)]/10 px-2 py-0.5 text-xs font-medium text-[var(--brand-primary)]"
        >
          {f}
        </span>
      ))}
    </div>
  );
}
