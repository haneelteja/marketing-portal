/**
 * Supabase Storage upload utility for worker processes.
 * Uses the REST API directly (no SDK dependency) so orchestrator/publisher
 * workers don't need @supabase/supabase-js.
 *
 * Requires env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

const BUCKET = 'generated-assets';

function storageBase(): string {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error('SUPABASE_URL is required for storage upload');
  return url;
}

function serviceKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for storage upload');
  return key;
}

/**
 * Upload a base64-encoded binary asset to Supabase Storage.
 * Returns the public URL of the uploaded file.
 */
export async function uploadBase64Asset(
  base64: string,
  mimeType: string,
  filename: string,
): Promise<string> {
  const binary = Buffer.from(base64, 'base64');
  return uploadBinaryAsset(binary, mimeType, filename);
}

/**
 * Upload a raw Buffer to Supabase Storage.
 * Returns the public URL of the uploaded file.
 */
export async function uploadBinaryAsset(
  binary: Buffer,
  mimeType: string,
  filename: string,
): Promise<string> {
  const base = storageBase();
  const key = serviceKey();
  const path = `${Date.now()}-${filename}`;

  const res = await fetch(`${base}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': mimeType,
      'x-upsert': 'true',
    },
    body: binary,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`Supabase Storage upload failed (${res.status}): ${detail}`);
  }

  return `${base}/storage/v1/object/public/${BUCKET}/${path}`;
}
