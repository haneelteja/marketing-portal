import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session/getSession';
import { rlsClient } from '@/lib/db/clients';

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const db = rlsClient(session.accessToken);
  const { data, error } = await db
    .from('notifications')
    .select('id, type, payload, read_at, created_at, client_id')
    .eq('user_id', session.claims.sub)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const action = url.searchParams.get('action');
  if (!id) return NextResponse.json({ error: 'id query param is required' }, { status: 400 });
  if (action !== 'read') return NextResponse.json({ error: 'action must be "read"' }, { status: 400 });

  const db = rlsClient(session.accessToken);
  const { data, error } = await db
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', session.claims.sub)
    .select('id, read_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
  return NextResponse.json(data);
}
