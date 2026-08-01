import type { SupabaseClient } from '@supabase/supabase-js';

/** Thin wrapper over the SECURITY DEFINER audit function — app code cannot forge rows. */
export async function audit(
  db: SupabaseClient,
  action: string,
  target?: { type: string; id: string },
  diff?: Record<string, unknown>,
): Promise<void> {
  const { error } = await db.rpc('write_audit', {
    p_action: action,
    p_target_type: target?.type ?? null,
    p_target_id: target?.id ?? null,
    p_diff: diff ?? null,
  });
  if (error) {
    // Audit failures are loud in logs but never block the user action itself.
    console.error('[audit] failed', { action, error: error.message });
  }
}
