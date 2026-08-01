import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session/getSession';
import { platformClient } from '@/lib/db/clients';
import { audit } from '@/lib/audit/log';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.claims.platform_role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const db = platformClient(session.accessToken);
  const { data, error } = await db
    .from('clients')
    .select('id, name, slug, custom_domain, edition_id, status, created_at, client_editions(id, name, ai_generation_quota, seat_limit)')
    .eq('id', id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.claims.platform_role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const body = await req.json() as {
    name?: string;
    status?: string;
    custom_domain?: string | null;
    edition_id?: string;
  };
  const allowed = ['name', 'status', 'custom_domain', 'edition_id'] as const;
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }
  if (!Object.keys(patch).length)
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });

  const db = platformClient(session.accessToken);
  const { data, error } = await db
    .from('clients')
    .update(patch)
    .eq('id', id)
    .select('id, name, slug, status')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await audit(db, 'client.updated', { type: 'client', id }, patch);
  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.claims.platform_role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const db = platformClient(session.accessToken);
  const { error } = await db
    .from('clients')
    .update({ status: 'archived' })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await audit(db, 'client.archived', { type: 'client', id }, undefined);
  return NextResponse.json({ success: true });
}
