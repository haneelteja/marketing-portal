import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session/getSession';
import { rlsClient } from '@/lib/db/clients';
import { audit } from '@/lib/audit/log';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const db = rlsClient(session.accessToken);
  const campaignId = new URL(req.url).searchParams.get('campaign_id');
  let query = db
    .from('concepts')
    .select('id, campaign_id, title, core_message, suggested_format, status, created_at')
    .order('created_at', { ascending: false });
  if (campaignId) query = query.eq('campaign_id', campaignId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (!['brand_admin', 'brand_editor'].includes(session.claims.client_role ?? '')) {
    return NextResponse.json({ error: 'Insufficient role' }, { status: 403 });
  }
  const { campaign_id, title, core_message, suggested_format } = await req.json();
  if (!campaign_id) return NextResponse.json({ error: 'campaign_id is required' }, { status: 400 });
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });
  const db = rlsClient(session.accessToken);
  const { data, error } = await db
    .from('concepts')
    .insert({
      campaign_id,
      client_id: session.claims.client_id!,
      title,
      core_message: core_message ?? null,
      suggested_format: suggested_format ?? null,
      status: 'draft',
      created_by: session.claims.sub,
    })
    .select('id, title, status')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await audit(db, 'concept.created', { type: 'concept', id: data.id }, { title, campaign_id });
  return NextResponse.json(data, { status: 201 });
}
