import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session/getSession';
import { platformClient } from '@/lib/db/clients';
import { audit } from '@/lib/audit/log';

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session?.claims.platform_role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const db = platformClient(session.accessToken);
  const { data, error } = await db
    .from('clients')
    .select('id, name, slug, custom_domain, status, created_at, client_editions(name, ai_generation_quota)')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.claims.platform_role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await req.json() as { name?: string; slug?: string; edition_id?: string; custom_domain?: string };
  const { name, slug, edition_id, custom_domain } = body;
  if (!name || !slug || !edition_id)
    return NextResponse.json({ error: 'name, slug, edition_id required' }, { status: 400 });

  const db = platformClient(session.accessToken);
  const { data, error } = await db
    .from('clients')
    .insert({ name, slug, edition_id, custom_domain: custom_domain || null, status: 'active' })
    .select('id, name, slug')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await audit(db, 'client.created', { type: 'client', id: data.id }, { name, slug });
  return NextResponse.json(data, { status: 201 });
}
