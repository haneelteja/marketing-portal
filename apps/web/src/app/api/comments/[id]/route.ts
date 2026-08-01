import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session/getSession';
import { rlsClient } from '@/lib/db/clients';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const { id } = await params;
  const db = rlsClient(session.accessToken);

  // Fetch the comment to check authorship
  const { data: comment, error: fetchErr } = await db
    .from('comments')
    .select('id, author_id, body')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 400 });
  if (!comment) return NextResponse.json({ error: 'Comment not found' }, { status: 404 });

  // Resolve the requesting user's users.id
  const { data: userRow } = await db
    .from('users')
    .select('id')
    .eq('auth_id', session.claims.sub)
    .maybeSingle();

  const isAuthor = userRow?.id === comment.author_id;
  const isBrandAdmin = session.claims.client_role === 'brand_admin';

  if (!isAuthor && !isBrandAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Soft-delete: set body to '[deleted]'
  const { data, error: updateErr } = await db
    .from('comments')
    .update({ body: '[deleted]' })
    .eq('id', id)
    .select('id, body')
    .single();

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 });
  return NextResponse.json(data);
}
