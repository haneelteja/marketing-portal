import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session/getSession';

const ALLOWED_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
};

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

// SERVICE-ROLE JUSTIFICATION: logo upload writes to Supabase Storage on behalf of
// the authenticated user; service role is required to bypass Storage RLS from the
// Next.js server (no user-scoped Storage JWT is available server-side).
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (!['brand_admin', 'brand_editor'].includes(session.claims.client_role ?? '')) {
    return NextResponse.json({ error: 'Insufficient role' }, { status: 403 });
  }
  if (!session.claims.client_id) {
    return NextResponse.json({ error: 'No client workspace' }, { status: 400 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  const ext = ALLOWED_MIME[file.type];
  if (!ext) return NextResponse.json({ error: 'Unsupported file type. Use PNG, JPG, SVG, or WebP.' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large (max 5 MB)' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const path = `${session.claims.client_id}/logo.${ext}`;

  const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/brand-assets/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      'Content-Type': file.type,
      'x-upsert': 'true',
    },
    body: buffer,
  });

  if (!uploadRes.ok) {
    const msg = await uploadRes.text();
    return NextResponse.json({ error: `Storage upload failed: ${msg}` }, { status: 502 });
  }

  const publicUrl = `${supabaseUrl}/storage/v1/object/public/brand-assets/${path}`;
  return NextResponse.json({ url: publicUrl });
}
