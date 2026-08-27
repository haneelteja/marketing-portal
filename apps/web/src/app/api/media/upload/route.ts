import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session/getSession';
import { rlsClient } from '@/lib/db/clients';

const ALLOWED_MIME = new Set([
  'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml',
  'video/mp4', 'video/webm',
  'application/pdf',
]);

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

// SERVICE-ROLE JUSTIFICATION: file upload to Supabase Storage requires the service key;
// the Supabase anon key cannot write to private buckets from the server.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (!['brand_admin', 'brand_editor'].includes(session.claims.client_role ?? '')) {
    return NextResponse.json({ error: 'Insufficient role' }, { status: 403 });
  }
  if (!session.claims.client_id) return NextResponse.json({ error: 'No workspace' }, { status: 400 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large (max 50 MB)' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${session.claims.client_id}/${timestamp}-${safeName}`;

  const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/media-library/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      'Content-Type': file.type,
    },
    body: buffer,
  });

  if (!uploadRes.ok) {
    const msg = await uploadRes.text();
    return NextResponse.json({ error: `Storage upload failed: ${msg}` }, { status: 502 });
  }

  const publicUrl = `${supabaseUrl}/storage/v1/object/public/media-library/${path}`;

  // Record in media_library table
  const db = rlsClient(session.accessToken);
  const tagsHeader = formData.get('tags') as string | null;
  const tags = tagsHeader ? tagsHeader.split(',').map(t => t.trim()).filter(Boolean) : [];

  const { data, error } = await db
    .from('media_library')
    .insert({
      client_id: session.claims.client_id,
      name: file.name,
      url: publicUrl,
      mime_type: file.type,
      size_bytes: buffer.byteLength,
      tags,
      source: 'upload',
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ id: data.id, url: publicUrl }, { status: 201 });
}
