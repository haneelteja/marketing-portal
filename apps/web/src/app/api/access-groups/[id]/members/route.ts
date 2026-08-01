import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session/getSession';
import { rlsClient } from '@/lib/db/clients';
import { audit } from '@/lib/audit/log';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (session.claims.client_role !== 'brand_admin')
    return NextResponse.json({ error: 'Forbidden — brand_admin required' }, { status: 403 });

  const { id: access_group_id } = await params;
  const body = await req.json() as { userId?: string; email?: string };

  const db = rlsClient(session.accessToken);
  let user_id = body.userId;

  // Resolve email → userId if needed
  if (!user_id && body.email) {
    const { data: found, error: lookupErr } = await db
      .from('users')
      .select('id')
      .eq('email', body.email)
      .maybeSingle();
    if (lookupErr) return NextResponse.json({ error: lookupErr.message }, { status: 400 });
    if (!found) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    user_id = found.id as string;
  }

  if (!user_id) return NextResponse.json({ error: 'userId or email is required' }, { status: 400 });

  const { error } = await db
    .from('user_access_groups')
    .insert({ user_id, access_group_id });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await audit(
    db,
    'access_group.member_added',
    { type: 'access_group', id: access_group_id },
    { user_id },
  );
  return NextResponse.json({ user_id, access_group_id }, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (session.claims.client_role !== 'brand_admin')
    return NextResponse.json({ error: 'Forbidden — brand_admin required' }, { status: 403 });

  const { id: access_group_id } = await params;
  const body = await req.json() as { userId?: string };
  const { userId: user_id } = body;
  if (!user_id) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  const db = rlsClient(session.accessToken);
  const { error } = await db
    .from('user_access_groups')
    .delete()
    .eq('user_id', user_id)
    .eq('access_group_id', access_group_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await audit(
    db,
    'access_group.member_removed',
    { type: 'access_group', id: access_group_id },
    { user_id },
  );
  return NextResponse.json({ success: true });
}
