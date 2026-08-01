import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session/getSession';
import { rlsClient } from '@/lib/db/clients';

export const dynamic = 'force-dynamic';

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', implemented: true },
  { id: 'facebook', label: 'Facebook', implemented: true },
  { id: 'youtube', label: 'YouTube', implemented: true },
  { id: 'linkedin', label: 'LinkedIn', implemented: true },
  { id: 'tiktok', label: 'TikTok', implemented: false },
  { id: 'x', label: 'X (Twitter)', implemented: false },
] as const;

interface SocialAccount {
  id: string;
  platform: string;
  external_account_id: string;
  status: string;
  token_expires_at: string | null;
  last_successful_publish: string | null;
  scopes_granted: string[] | null;
}

export default async function ConnectionsPage({
  params,
}: {
  params: Promise<{ clientSlug: string }>;
}) {
  const session = await getSession();
  const { clientSlug } = await params;
  if (!session) redirect(`/login?next=/app/${clientSlug}/connections`);

  const db = rlsClient(session.accessToken);
  const { data: accounts } = await db
    .from('social_accounts')
    .select(
      'id, platform, external_account_id, status, token_expires_at, last_successful_publish, scopes_granted',
    );

  const accountMap = new Map<string, SocialAccount>(
    ((accounts ?? []) as SocialAccount[]).map((a) => [a.platform, a]),
  );

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-[var(--brand-ink)]">Social connections</h1>
      <p className="mb-6 text-sm text-black/50">
        Connect your social accounts to publish content directly from your workspace.
      </p>

      <div className="flex flex-col gap-3">
        {PLATFORMS.map(({ id, label, implemented }) => {
          const account = accountMap.get(id);
          const isExpired =
            account?.token_expires_at != null &&
            new Date(account.token_expires_at) < new Date();
          const isConnected = account?.status === 'connected' && !isExpired;

          return (
            <div
              key={id}
              className="flex items-center justify-between rounded-[var(--brand-radius)] border border-black/10 bg-white px-5 py-4"
            >
              <div className="flex items-center gap-4">
                {/* Platform initial avatar */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--brand-radius)] bg-[var(--brand-primary)]/10 text-sm font-bold text-[var(--brand-primary)]">
                  {label.charAt(0)}
                </div>

                <div>
                  <p className="font-medium text-[var(--brand-ink)]">{label}</p>

                  {account ? (
                    <p
                      className={[
                        'text-xs',
                        isConnected
                          ? 'text-green-600'
                          : 'text-red-600',
                      ].join(' ')}
                    >
                      {isExpired
                        ? 'Token expired — reconnect'
                        : account.status === 'connected'
                        ? `Connected · ${account.external_account_id}`
                        : account.status}
                    </p>
                  ) : (
                    <p className="text-xs text-black/40">Not connected</p>
                  )}

                  {account?.last_successful_publish && (
                    <p className="mt-0.5 text-xs text-black/30">
                      Last publish:{' '}
                      {new Date(account.last_successful_publish).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!implemented ? (
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500">
                    Coming soon
                  </span>
                ) : isConnected ? (
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                      Connected
                    </span>
                    <a
                      href={`/api/social/connect/${id}`}
                      className="rounded-[var(--brand-radius)] border border-black/15 px-3 py-1.5 text-xs hover:bg-black/5"
                    >
                      Reconnect
                    </a>
                  </div>
                ) : (
                  <a
                    href={`/api/social/connect/${id}`}
                    className="rounded-[var(--brand-radius)] bg-[var(--brand-primary)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
                  >
                    Connect
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-black/30">
        OAuth tokens are encrypted at rest and never exposed in browser responses.
      </p>
    </div>
  );
}
