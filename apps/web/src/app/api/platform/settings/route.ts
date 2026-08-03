import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session/getSession';
import { platformClient } from '@/lib/db/clients';

/** GET /api/platform/settings — returns platform settings (platform admin only) */
export async function GET() {
  const session = await getSession();
  if (!session?.claims.platform_role)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const db = platformClient(session.accessToken);
  const { data, error } = await db
    .from('platform_settings')
    .select('llm_task_routing, social_credentials, openrouter_api_key_hint, updated_at')
    .eq('id', 'singleton')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

interface SettingsPatch {
  llm_task_routing?: Record<string, { vendor: string; model: string }>;
  openrouter_api_key?: string;
}

/** PATCH /api/platform/settings — partial update (platform admin only) */
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session?.claims.platform_role)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json() as SettingsPatch;
  const db = platformClient(session.accessToken);

  const patch: Record<string, unknown> = { updated_by: session.claims.sub };

  if (body.llm_task_routing !== undefined) {
    patch.llm_task_routing = body.llm_task_routing;
  }

  if (body.openrouter_api_key !== undefined) {
    // Store the key in Supabase vault / env — here we just record the last-4 hint.
    // The real key is passed through to the worker via Render env vars, not stored in DB.
    const key = body.openrouter_api_key.trim();
    patch.openrouter_api_key_hint = key.length >= 4 ? `…${key.slice(-4)}` : '****';
  }

  const { data, error } = await db
    .from('platform_settings')
    .update(patch)
    .eq('id', 'singleton')
    .select('llm_task_routing, social_credentials, openrouter_api_key_hint, updated_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
