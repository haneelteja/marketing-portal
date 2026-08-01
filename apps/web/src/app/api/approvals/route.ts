import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session/getSession';
import { rlsClient } from '@/lib/db/clients';
import { audit } from '@/lib/audit/log';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const db = rlsClient(session.accessToken);
  const status = new URL(req.url).searchParams.get('status');
  let query = db.from('approvals').select('id, target_type, target_id, status, comment, created_at, decided_at').order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const { target_type, target_id } = await req.json();
  if (!target_type || !target_id) return NextResponse.json({ error: 'target_type and target_id required' }, { status: 400 });

  const db = rlsClient(session.accessToken);
  // Get user row for requested_by
  const { data: userRow } = await db.from('users').select('id').eq('auth_id', session.claims.sub).maybeSingle();

  const { data, error } = await db
    .from('approvals')
    .insert({ client_id: session.claims.client_id!, target_type, target_id, requested_by: userRow?.id, status: 'pending' })
    .select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Update asset status to pending_approval
  if (target_type === 'concept_asset') {
    await db.from('concept_assets').update({ status: 'pending_approval' }).eq('id', target_id);
  }
  await audit(db, 'approval.requested', { type: target_type, id: target_id });
  return NextResponse.json(data, { status: 201 });
}
