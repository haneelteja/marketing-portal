import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session/getSession';
import { rlsClient } from '@/lib/db/clients';
import { audit } from '@/lib/audit/log';

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const db = rlsClient(session.accessToken);
  const { data, error } = await db
    .from('campaigns')
    .select('id, name, objective, start_date, end_date, status, created_at')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (!['brand_admin', 'brand_editor'].includes(session.claims.client_role ?? '')) {
    return NextResponse.json({ error: 'Insufficient role' }, { status: 403 });
  }
  const { name, objective, start_date, end_date, status = 'draft' } = await req.json();
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  const db = rlsClient(session.accessToken);
  const { data, error } = await db
    .from('campaigns')
    .insert({ name, objective: objective ?? null, start_date: start_date ?? null, end_date: end_date ?? null, status, client_id: session.claims.client_id })
    .select('id, name').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await audit(db, 'campaign.created', { type: 'campaign', id: data.id }, { name });
  return NextResponse.json(data, { status: 201 });
}
