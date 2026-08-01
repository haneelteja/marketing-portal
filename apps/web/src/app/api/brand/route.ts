import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session/getSession';
import { rlsClient } from '@/lib/db/clients';
import { audit } from '@/lib/audit/log';

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const db = rlsClient(session.accessToken);
  const { data, error } = await db.from('brand_profiles').select('*').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (!['brand_admin', 'brand_editor'].includes(session.claims.client_role ?? '')) {
    return NextResponse.json({ error: 'Insufficient role' }, { status: 403 });
  }
  const body = await req.json();
  const db = rlsClient(session.accessToken);
  const { brand_voice_doc, tone_guidelines, target_audience, logo_url, color_palette, typography } = body;
  const { data, error } = await db
    .from('brand_profiles')
    .upsert({
      client_id: session.claims.client_id!,
      brand_voice_doc: brand_voice_doc ?? null,
      tone_guidelines: tone_guidelines ?? null,
      target_audience: target_audience ?? null,
      logo_url: logo_url ?? null,
      color_palette: color_palette ?? {},
      typography: typography ?? {},
      updated_at: new Date().toISOString(),
    }, { onConflict: 'client_id' })
    .select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await audit(db, 'brand_profile.updated', { type: 'brand_profile', id: data.id });
  return NextResponse.json({ success: true });
}
