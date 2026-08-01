import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session/getSession';
import { rlsClient } from '@/lib/db/clients';

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const db = rlsClient(session.accessToken);
  const { data, error } = await db
    .from('social_accounts')
    .select(
      'id, platform, external_account_id, status, token_expires_at, last_successful_publish, scopes_granted, created_at',
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data ?? []);
}
