import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session/getSession';
import { rlsClient } from '@/lib/db/clients';
import { audit } from '@/lib/audit/log';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const db = rlsClient(session.accessToken);
  const { data, error } = await db
    .from('product_catalog')
    .select('id, name, description, price, currency, image_url, category, tags, active, created_at')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (!['brand_admin', 'brand_editor'].includes(session.claims.client_role ?? '')) {
    return NextResponse.json({ error: 'Insufficient role' }, { status: 403 });
  }
  const body = await req.json() as {
    name?: string; description?: string; price?: number; currency?: string;
    image_url?: string; category?: string; tags?: string[]; active?: boolean;
  };
  if (!body.name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const db = rlsClient(session.accessToken);
  const { data, error } = await db
    .from('product_catalog')
    .insert({
      client_id: session.claims.client_id!,
      name: body.name.trim(),
      description: body.description ?? null,
      price: body.price ?? null,
      currency: body.currency ?? 'USD',
      image_url: body.image_url ?? null,
      category: body.category ?? null,
      tags: body.tags ?? [],
      active: body.active ?? true,
    })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await audit(db, 'product.created', { type: 'product', id: data.id });
  return NextResponse.json(data, { status: 201 });
}
