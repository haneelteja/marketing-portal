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
    .from('access_groups')
    .select('id, name, permissions, created_at, user_access_groups(users(id, email, client_role))')
    .eq('id', id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const raw = data as unknown as {
    id: string;
    name: string;
    permissions: Record<string, boolean>;
    created_at: string;
    user_access_groups: { users: { id: string; email: string; client_role: string } | null }[];
  };

  const members = (raw.user_access_groups ?? [])
    .map((r) => r.users)
    .filter((u): u is { id: string; email: string; client_role: string } => u !== null);

  return NextResponse.json({
    id: raw.id,
    name: raw.name,
    permissions: raw.permissions,
    created_at: raw.created_at,
    members,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (session.claims.client_role !== 'brand_admin')
    return NextResponse.json({ error: 'Forbidden — brand_admin required' }, { status: 403 });

  const { id } = await params;
  const body = await req.json() as { name?: string; permissions?: Record<string, boolean> };
  const patch: Record<string, unknown> = {};
  if ('name' in body) patch.name = body.name;
  if ('permissions' in body) patch.permissions = body.permissions;
  if (!Object.keys(patch).length)
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });

  const db = rlsClient(session.accessToken);
  const { data, error } = await db
    .from('access_groups')
    .update(patch)
    .eq('id', id)
    .select('id, name, permissions')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await audit(db, 'access_group.updated', { type: 'access_group', id }, patch);
  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (session.claims.client_role !== 'brand_admin')
    return NextResponse.json({ error: 'Forbidden — brand_admin required' }, { status: 403 });

  const { id } = await params;
  const db = rlsClient(session.accessToken);
  const { error } = await db.from('access_groups').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await audit(db, 'access_group.deleted', { type: 'access_group', id }, undefined);
  return NextResponse.json({ success: true });
}
