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
    .from('concepts')
    .select('id, campaign_id, title, core_message, suggested_format, generated_from_prompt, llm_provider, llm_model, raw_llm_output, status, created_by, created_at, concept_assets(id, type, provider, prompt_used, source_url, raw_output, status, version, created_at)')
    .eq('id', id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(data);
}

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
  const body = await req.json();
  const allowedStatuses = ['draft', 'locked', 'archived'];
  if (body.status && !allowedStatuses.includes(body.status)) {
    return NextResponse.json({ error: `status must be one of: ${allowedStatuses.join(', ')}` }, { status: 400 });
  }
  const updates: Record<string, string | null> = {};
  if (body.status !== undefined) updates.status = body.status;
  if (body.title !== undefined) updates.title = body.title ?? null;
  if (body.core_message !== undefined) updates.core_message = body.core_message ?? null;
  if (body.suggested_format !== undefined) updates.suggested_format = body.suggested_format ?? null;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }
  const db = rlsClient(session.accessToken);
  const { data, error } = await db
    .from('concepts')
    .update(updates)
    .eq('id', id)
    .select('id, title, status')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await audit(db, 'concept.updated', { type: 'concept', id }, updates);
  return NextResponse.json(data);
}
