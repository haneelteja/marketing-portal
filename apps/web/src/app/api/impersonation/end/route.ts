import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session/getSession';
import { serviceClient } from '@/lib/db/clients';
import { audit } from '@/lib/audit/log';

// SERVICE-ROLE JUSTIFICATION: ending impersonation touches impersonation_sessions
// across tenant boundaries; the SECURITY DEFINER audit function handles the log row.
export async function POST(_req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const db = serviceClient();
  await db
    .from('impersonation_sessions')
    .update({ ended_at: new Date().toISOString() })
    .is('ended_at', null)
    .eq('actor_id', session.claims.sub);

  await audit(db, 'impersonation.end', undefined, { actor: session.claims.sub });
  return NextResponse.redirect(new URL('/platform', _req.url));
}
