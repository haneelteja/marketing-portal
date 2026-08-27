import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session/getSession';
import { rlsClient } from '@/lib/db/clients';
import { audit } from '@/lib/audit/log';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (!['brand_admin', 'brand_editor'].includes(session.claims.client_role ?? '')) {
    return NextResponse.json({ error: 'Insufficient role' }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json() as Record<string, unknown>;
  const allowed = ['name', 'description', 'price', 'currency', 'image_url', 'category', 'tags', 'active'];
  const patch = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const db = rlsClient(session.accessToken);
  const { error } = await db.from('product_catalog').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await audit(db, 'product.updated', { type: 'product', id });
  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (session.claims.client_role !== 'brand_admin') {
    return NextResponse.json({ error: 'brand_admin required' }, { status: 403 });
  }
  const { id } = await params;
  const db = rlsClient(session.accessToken);
  const { error } = await db.from('product_catalog').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await audit(db, 'product.deleted', { type: 'product', id });
  return NextResponse.json({ success: true });
}
