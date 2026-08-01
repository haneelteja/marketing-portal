import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session/getSession';
import { rlsClient } from '@/lib/db/clients';
import { audit } from '@/lib/audit/log';

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const db = rlsClient(session.accessToken);
  const { data, error } = await db
    .from('access_groups')
    .select('id, name, permissions, created_at, user_access_groups(count)')
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Flatten the count from the nested aggregate
  const result = (data ?? []).map((g) => {
    const raw = g as unknown as {
      id: string;
      name: string;
      permissions: Record<string, boolean>;
      created_at: string;
      user_access_groups: { count: number }[];
    };
    return {
      id: raw.id,
      name: raw.name,
      permissions: raw.permissions,
      created_at: raw.created_at,
      member_count: raw.user_access_groups?.[0]?.count ?? 0,
    };
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (session.claims.client_role !== 'brand_admin')
    return NextResponse.json({ error: 'Forbidden — brand_admin required' }, { status: 403 });

  const body = await req.json() as { name?: string; permissions?: Record<string, boolean> };
  const { name, permissions } = body;
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const db = rlsClient(session.accessToken);
  const { data, error } = await db
    .from('access_groups')
    .insert({ name, permissions: permissions ?? {} })
    .select('id, name, permissions')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await audit(db, 'access_group.created', { type: 'access_group', id: data.id }, { name });
  return NextResponse.json(data, { status: 201 });
}
