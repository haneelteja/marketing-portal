import type { SupabaseClient } from '@supabase/supabase-js';
import type { rlsClient } from '@/lib/db/clients';

export const DEFAULT_PERMISSIONS = {
  create_concepts: false,
  approve: false,
  connect_social: false,
  view_analytics: false,
  manage_campaigns: false,
} as const;

export type Permission = keyof typeof DEFAULT_PERMISSIONS;

/**
 * Check whether a user holds a specific permission.
 * brand_admin always returns true (full access).
 * Otherwise unions permissions across all access groups the user belongs to.
 */
export async function checkAccess(
  db: ReturnType<typeof rlsClient>,
  userId: string,
  permission: Permission,
): Promise<boolean> {
  // Fetch the user's client_role directly from the users table
  const { data: user } = await db
    .from('users')
    .select('client_role')
    .eq('id', userId)
    .maybeSingle();

  if (user?.client_role === 'brand_admin') return true;

  // Union permissions across all access groups this user belongs to
  const { data: memberships } = await db
    .from('user_access_groups')
    .select('access_groups(permissions)')
    .eq('user_id', userId);

  if (!memberships || memberships.length === 0) return false;

  for (const row of memberships) {
    const group = row.access_groups as unknown as { permissions: Record<string, boolean> } | null;
    if (group?.permissions?.[permission] === true) return true;
  }

  return false;
}
