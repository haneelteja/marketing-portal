import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session/getSession';
import { serviceClient } from '@/lib/db/clients';

/**
 * GET /api/internal/me
 * Returns the current user's client slug and email.
 * Used by the login page to redirect client users to their workspace.
 *
 * SERVICE-ROLE JUSTIFICATION: reads only the client row keyed by client_id
 * from the verified JWT claim — no cross-tenant access possible.
 */
export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const { claims } = session;

  if (!claims.client_id) {
    return NextResponse.json({ error: 'No client workspace assigned' }, { status: 404 });
  }

  const db = serviceClient();
  const { data, error } = await db
    .from('clients')
    .select('slug')
    .eq('id', claims.client_id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  return NextResponse.json({ slug: data.slug, email: claims.email });
}
