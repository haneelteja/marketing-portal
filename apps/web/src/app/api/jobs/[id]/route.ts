import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session/getSession';
import { rlsClient } from '@/lib/db/clients';

/** GET /api/jobs/:id — status poll. RLS guarantees a tenant can only see its own jobs. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const { id } = await params;
  const db = rlsClient(session.accessToken);
  const { data, error } = await db
    .from('generation_jobs')
    .select('id, capability, provider, status, error_message, result_asset_id, created_at, started_at, finished_at')
    .eq('id', id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  return NextResponse.json(data);
}
