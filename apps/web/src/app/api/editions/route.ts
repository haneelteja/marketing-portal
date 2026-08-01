import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session/getSession';
import { platformClient } from '@/lib/db/clients';

export async function GET() {
  const session = await getSession();
  if (!session?.claims.platform_role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const db = platformClient(session.accessToken);
  const { data } = await db
    .from('client_editions')
    .select('id, name, ai_generation_quota, seat_limit')
    .order('ai_generation_quota');
  return NextResponse.json(data ?? []);
}
