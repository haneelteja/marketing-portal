import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session/getSession';
import { rlsClient } from '@/lib/db/clients';
import { audit } from '@/lib/audit/log';

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
  const { scheduled_at } = await req.json();
  if (!scheduled_at) return NextResponse.json({ error: 'scheduled_at is required' }, { status: 400 });

  const db = rlsClient(session.accessToken);
  const { data, error } = await db
    .from('scheduled_posts')
    .update({ scheduled_at })
    .eq('id', id)
    .eq('status', 'scheduled')
    .select('id, scheduled_at, status')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: 'Post not found or not reschedulable' }, { status: 404 });
  await audit(db, 'scheduled_post.rescheduled', { type: 'scheduled_post', id }, { scheduled_at });
  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (!['brand_admin', 'brand_editor'].includes(session.claims.client_role ?? '')) {
    return NextResponse.json({ error: 'Insufficient role' }, { status: 403 });
  }
  const { id } = await params;
  const db = rlsClient(session.accessToken);
  const { data, error } = await db
    .from('scheduled_posts')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('status', 'scheduled')
    .select('id, status')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: 'Post not found or already published/cancelled' }, { status: 404 });
  await audit(db, 'scheduled_post.cancelled', { type: 'scheduled_post', id });
  return NextResponse.json(data);
}
