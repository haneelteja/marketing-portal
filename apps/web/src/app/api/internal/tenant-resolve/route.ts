import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/db/clients';

// SERVICE-ROLE JUSTIFICATION: tenant resolution is pre-auth (middleware calls this
// before any session exists); read-only; keyed by slug or custom_domain, not any user data.
export async function GET(req: NextRequest) {
  const key = req.headers.get('x-internal-key');
  if (key !== process.env.INTERNAL_API_KEY) {
    return new NextResponse('Forbidden', { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug');
  const customDomain = searchParams.get('customDomain');
  if (!slug && !customDomain) return new NextResponse('Missing param', { status: 400 });

  const db = serviceClient();
  const query = db
    .from('clients')
    .select('id, slug, theme_versions(version)')
    .eq('status', 'active');

  const { data } = slug
    ? await query.eq('slug', slug).maybeSingle()
    : await query.eq('custom_domain', customDomain!).maybeSingle();

  if (!data) return new NextResponse('Not found', { status: 404 });

  const tv = Array.isArray(data.theme_versions) ? data.theme_versions : [data.theme_versions];
  const themeVersion = (tv as Array<{ version: number } | null>)?.[0]?.version ?? 0;
  return NextResponse.json({ id: data.id, slug: data.slug, themeVersion });
}
