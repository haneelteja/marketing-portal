import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session/getSession';
import { rlsClient } from '@/lib/db/clients';

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const db = rlsClient(session.accessToken);
  const { data, error } = await db
    .from('model_preferences')
    .select('capability, vendor, model, options, updated_at')
    .order('capability');
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (!['brand_admin', 'brand_editor'].includes(session.claims.client_role ?? '')) {
    return NextResponse.json({ error: 'Insufficient role' }, { status: 403 });
  }
  const { capability, vendor, model, options = {} } = await req.json();
  if (!capability || !vendor || !model) {
    return NextResponse.json({ error: 'capability, vendor, and model are required' }, { status: 400 });
  }
  const VALID_CAPABILITIES = ['text', 'image', 'video', 'audio'];
  if (!VALID_CAPABILITIES.includes(capability)) {
    return NextResponse.json({ error: `capability must be one of: ${VALID_CAPABILITIES.join(', ')}` }, { status: 400 });
  }
  const db = rlsClient(session.accessToken);
  const { data, error } = await db
    .from('model_preferences')
    .upsert({
      client_id: session.claims.client_id!,
      capability,
      vendor,
      model,
      options,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'client_id,capability' })
    .select('capability, vendor, model')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
