import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session/getSession';
import { platformClient } from '@/lib/db/clients';
import { NewClientButton } from './NewClientButton';

export const dynamic = 'force-dynamic';

export default async function PlatformClientsPage() {
  const session = await getSession();
  if (!session?.claims.platform_role) redirect('/login?next=/platform');

  const db = platformClient(session.accessToken);
  const { data: clients } = await db
    .from('clients')
    .select('id, name, slug, status, created_at, client_editions(name)')
    .order('created_at', { ascending: false });

  const STATUS = {
    active: 'bg-green-100 text-green-800',
    suspended: 'bg-yellow-100 text-yellow-800',
    archived: 'bg-gray-100 text-gray-600',
  } as const;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--brand-ink)]">Clients</h1>
        <NewClientButton />
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-hidden rounded-[var(--brand-radius)] border border-black/10 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 bg-black/5 text-left">
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Slug</th>
              <th className="px-4 py-3 font-semibold hidden md:table-cell">Edition</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold hidden md:table-cell">Created</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(clients ?? []).map((c) => (
              <tr key={c.id} className="border-b border-black/5 last:border-0 hover:bg-black/[0.02]">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-black/60">{c.slug}</td>
                <td className="px-4 py-3 hidden md:table-cell">
                  {(c.client_editions as unknown as { name: string } | null)?.name ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[c.status as keyof typeof STATUS] ?? 'bg-gray-100'}`}
                  >
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-black/50 hidden md:table-cell">
                  {new Date(c.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <a
                    href={`/app/${c.slug}`}
                    className="rounded-[var(--brand-radius)] border border-[var(--brand-primary)] px-3 py-1 text-xs text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10"
                  >
                    Open workspace
                  </a>
                </td>
              </tr>
            ))}
            {!clients?.length && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-black/40">
                  No clients yet. Create one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="flex flex-col gap-3 md:hidden">
        {(clients ?? []).map((c) => (
          <div key={c.id} className="rounded-[var(--brand-radius)] border border-black/10 bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-sm text-[var(--brand-ink)] truncate">{c.name}</p>
                <p className="font-mono text-xs text-black/50 mt-0.5">{c.slug}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[c.status as keyof typeof STATUS] ?? 'bg-gray-100'}`}
              >
                {c.status}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-black/40">{new Date(c.created_at).toLocaleDateString()}</p>
              <a
                href={`/app/${c.slug}`}
                className="rounded-[var(--brand-radius)] border border-[var(--brand-primary)] px-3 py-1 text-xs text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10"
              >
                Open workspace
              </a>
            </div>
          </div>
        ))}
        {!clients?.length && (
          <p className="py-8 text-center text-sm text-black/40">
            No clients yet. Create one to get started.
          </p>
        )}
      </div>
    </div>
  );
}
