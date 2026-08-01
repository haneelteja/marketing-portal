import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session/getSession';
import { serviceClient } from '@/lib/db/clients';
import { audit } from '@/lib/audit/log';

// SERVICE-ROLE JUSTIFICATION: impersonation session creation is a platform-admin
// action that requires inserting across tenant boundaries. Audit is appended via
// SECURITY DEFINER function.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.claims.platform_role) {
    return NextResponse.json({ error: 'Platform role required' }, { status: 403 });
  }
  const { clientId } = await req.json() as { clientId?: string };
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });

  const db = serviceClient();
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2h
  const { data, error } = await db
    .from('impersonation_sessions')
    .insert({ actor_id: session.claims.sub, client_id: clientId, expires_at: expiresAt })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await audit(db, 'impersonation.start', { type: 'client', id: clientId }, { sessionId: data.id, expiresAt });
  return NextResponse.json({ sessionId: data.id, expiresAt });
}
