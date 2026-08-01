import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session/getSession';
import { rlsClient } from '@/lib/db/clients';

/** Parse @email mentions from comment body. Returns array of unique emails. */
function parseMentionEmails(body: string): string[] {
  const matches = body.match(/@([\w.+\-]+@[\w.\-]+\.[a-zA-Z]{2,})/g) ?? [];
  const emails = matches.map((m) => m.slice(1)); // strip leading @
  return [...new Set(emails)];
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const url = new URL(req.url);
  const targetType = url.searchParams.get('target_type');
  const targetId = url.searchParams.get('target_id');
  if (!targetType || !targetId) {
    return NextResponse.json({ error: 'target_type and target_id are required' }, { status: 400 });
  }

  const db = rlsClient(session.accessToken);
  const { data, error } = await db
    .from('comments')
    .select('id, target_type, target_id, body, parent_id, mentions, created_at, author:users!comments_author_id_fkey(id, email)')
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const { target_type, target_id, body, parent_id } = (await req.json()) as {
    target_type: string;
    target_id: string;
    body: string;
    parent_id?: string;
  };

  if (!target_type) return NextResponse.json({ error: 'target_type is required' }, { status: 400 });
  if (!target_id) return NextResponse.json({ error: 'target_id is required' }, { status: 400 });
  if (!body || !body.trim()) return NextResponse.json({ error: 'body is required' }, { status: 400 });

  const db = rlsClient(session.accessToken);

  // Resolve author_id from users table via auth_id
  const { data: authorRow, error: authorErr } = await db
    .from('users')
    .select('id, email')
    .eq('auth_id', session.claims.sub)
    .maybeSingle();
  if (authorErr || !authorRow) {
    return NextResponse.json({ error: 'Author user not found' }, { status: 404 });
  }

  // Parse @mention emails and resolve to user IDs
  const mentionEmails = parseMentionEmails(body);
  let mentionIds: string[] = [];
  if (mentionEmails.length > 0) {
    const { data: mentionedUsers } = await db
      .from('users')
      .select('id, email')
      .in('email', mentionEmails);
    mentionIds = (mentionedUsers ?? []).map((u: { id: string; email: string }) => u.id);
  }

  // Insert comment
  const { data: comment, error: insertErr } = await db
    .from('comments')
    .insert({
      client_id: session.claims.client_id!,
      target_type,
      target_id,
      author_id: authorRow.id,
      parent_id: parent_id ?? null,
      body: body.trim(),
      mentions: mentionIds,
    })
    .select('id, target_type, target_id, body, parent_id, mentions, created_at')
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 400 });

  // Insert notifications for each mentioned user
  if (mentionIds.length > 0 && comment) {
    const notifications = mentionIds.map((userId) => ({
      user_id: userId,
      client_id: session.claims.client_id!,
      type: 'mention' as const,
      payload: {
        commentId: comment.id,
        targetType: target_type,
        targetId: target_id,
        by: authorRow.email,
      },
    }));
    await db.from('notifications').insert(notifications);
  }

  return NextResponse.json(comment, { status: 201 });
}
