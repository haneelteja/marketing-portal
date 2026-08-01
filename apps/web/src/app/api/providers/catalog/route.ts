import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session/getSession';
import { getProviderCatalog } from '@platform/core/providers/generation/registry';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  // Return full catalog; configured flag tells UI which providers are ready
  const catalog = getProviderCatalog();
  return NextResponse.json(catalog);
}
