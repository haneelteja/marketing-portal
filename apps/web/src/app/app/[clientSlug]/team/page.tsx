import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session/getSession';
import { rlsClient } from '@/lib/db/clients';
import { AccessGroupsClient } from './AccessGroupsClient';
import type { Group, User } from './AccessGroupsClient';

export const dynamic = 'force-dynamic';

export default async function TeamPage({ params }: { params: Promise<{ clientSlug: string }> }) {
  const session = await getSession();
  const { clientSlug } = await params;
  if (!session) redirect(`/login?next=/app/${clientSlug}/team`);

  const db = rlsClient(session.accessToken);

  // Fetch access groups with member counts
  const { data: rawGroups } = await db
    .from('access_groups')
    .select('id, name, permissions, created_at, user_access_groups(count)')
    .order('name', { ascending: true });

  const groups: Group[] = (rawGroups ?? []).map((g) => {
    const r = g as unknown as {
      id: string;
      name: string;
      permissions: Record<string, boolean>;
      created_at: string;
      user_access_groups: { count: number }[];
    };
    return {
      id: r.id,
      name: r.name,
      permissions: r.permissions,
      member_count: r.user_access_groups?.[0]?.count ?? 0,
    };
  });

  // Fetch all users for this client, with their group memberships
  const { data: rawUsers } = await db
    .from('users')
    .select('id, email, client_role, user_access_groups(access_groups(id, name))')
    .order('email', { ascending: true });

  const users: User[] = (rawUsers ?? []).map((u) => {
    const r = u as unknown as {
      id: string;
      email: string;
      client_role: string;
      user_access_groups: { access_groups: { id: string; name: string } | null }[];
    };
    return {
      id: r.id,
      email: r.email,
      client_role: r.client_role,
      access_groups: (r.user_access_groups ?? [])
        .map((m) => m.access_groups)
        .filter((ag): ag is { id: string; name: string } => ag !== null),
    };
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--brand-ink)]">Team</h1>
      <p className="mt-1 mb-6 text-sm text-black/50">
        Manage access groups and team member permissions for this workspace.
      </p>

      <AccessGroupsClient clientSlug={clientSlug} groups={groups} users={users} />

      {/* Users table */}
      <section className="mt-10">
        <h2 className="mb-3 text-base font-semibold text-[var(--brand-ink)]">All team members</h2>
        {users.length === 0 ? (
          <p className="text-sm text-black/40">No users found for this workspace.</p>
        ) : (
          <div className="rounded-xl border border-black/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-black/5 text-left text-xs font-semibold text-black/50 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Access groups</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-black/5 transition-colors">
                    <td className="px-4 py-3 text-[var(--brand-ink)]">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-[var(--brand-primary)]/10 px-2.5 py-0.5 text-xs font-medium text-[var(--brand-primary)]">
                        {u.client_role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.access_groups.length === 0 ? (
                        <span className="text-black/30">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {u.access_groups.map((ag) => (
                            <span
                              key={ag.id}
                              className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-black/60"
                            >
                              {ag.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
