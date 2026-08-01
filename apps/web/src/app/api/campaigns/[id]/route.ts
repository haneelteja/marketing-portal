import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session/getSession';
import { rlsClient } from '@/lib/db/clients';
import { audit } from '@/lib/audit/log';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const { id } = await params;
  const db = rlsClient(session.accessToken);
  const { data, error } = await db
    .from('campaigns')
    .select('id, name, objective, start_date, end_date, status, created_at')
    .eq('id', id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (!['brand_admin', 'brand_editor'].includes(session.claims.client_role ?? '')) {
    return NextResponse.json({ error: 'Insufficient role' }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();
  const allowed = ['name', 'objective', 'start_date', 'end_date', 'status'] as const;
  const updates: Partial<Record<(typeof allowed)[number], string | null>> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key] ?? null;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }
  const db = rlsClient(session.accessToken);
  const { data, error } = await db
    .from('campaigns')
    .update(updates)
    .eq('id', id)
    .select('id, name, status')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await audit(db, 'campaign.updated', { type: 'campaign', id }, updates);
  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (!['brand_admin'].includes(session.claims.client_role ?? '')) {
    return NextResponse.json({ error: 'Insufficient role' }, { status: 403 });
  }
  const { id } = await params;
  const db = rlsClient(session.accessToken);
  const { data, error } = await db
    .from('campaigns')
    .update({ status: 'archived' })
    .eq('id', id)
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await audit(db, 'campaign.archived', { type: 'campaign', id });
  return NextResponse.json(data);
}
