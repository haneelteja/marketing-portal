import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session/getSession';
import { rlsClient } from '@/lib/db/clients';
import { audit } from '@/lib/audit/log';

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const db = rlsClient(session.accessToken);
  const { data, error } = await db
    .from('scheduled_posts')
    .select('id, concept_asset_id, platform, social_account_id, caption, scheduled_at, published_at, platform_post_id, status, created_at')
    .order('scheduled_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (!['brand_admin', 'brand_editor'].includes(session.claims.client_role ?? '')) {
    return NextResponse.json({ error: 'Insufficient role' }, { status: 403 });
  }
  const { concept_asset_id, platform, social_account_id, caption, scheduled_at } = await req.json();
  if (!concept_asset_id) return NextResponse.json({ error: 'concept_asset_id is required' }, { status: 400 });
  if (!platform) return NextResponse.json({ error: 'platform is required' }, { status: 400 });
  if (!scheduled_at) return NextResponse.json({ error: 'scheduled_at is required' }, { status: 400 });

  const db = rlsClient(session.accessToken);

  // Verify the asset is approved
  const { data: asset, error: assetError } = await db
    .from('concept_assets')
    .select('id, status')
    .eq('id', concept_asset_id)
    .single();
  if (assetError || !asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  if (asset.status !== 'approved') {
    return NextResponse.json({ error: 'Asset must be approved before scheduling' }, { status: 422 });
  }

  const { data, error } = await db
    .from('scheduled_posts')
    .insert({
      concept_asset_id,
      client_id: session.claims.client_id!,
      platform,
      social_account_id: social_account_id ?? null,
      caption: caption ?? null,
      scheduled_at,
      status: 'scheduled',
    })
    .select('id, platform, scheduled_at, status')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await audit(db, 'scheduled_post.created', { type: 'scheduled_post', id: data.id }, { platform, scheduled_at });
  return NextResponse.json(data, { status: 201 });
}
