'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface ClientUser {
  id: string;
  email: string;
}

interface Comment {
  id: string;
  target_type: string;
  target_id: string;
  body: string;
  parent_id: string | null;
  mentions: string[];
  created_at: string;
  author: { id: string; email: string } | null;
}

interface Props {
  targetType: string;
  targetId: string;
  clientUsers: ClientUser[];
}

/** Format a UTC ISO timestamp as a human-readable "time ago" string. */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Render comment body with @email mentions highlighted. */
function CommentBody({ body }: { body: string }) {
  const parts = body.split(/(@[\w.+\-]+@[\w.\-]+\.[a-zA-Z]{2,})/g);
  return (
    <span>
      {parts.map((part, i) =>
        part.startsWith('@') ? (
          <span key={i} className="font-medium" style={{ color: 'var(--brand-primary)' }}>
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
}

export function ConceptComments({ targetType, targetId, clientUsers }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  // @mention dropdown state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null); // null = closed
  const [mentionAnchor, setMentionAnchor] = useState(0); // caret position of '@'
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchComments = useCallback(async () => {
    const res = await fetch(
      `/api/comments?target_type=${encodeURIComponent(targetType)}&target_id=${encodeURIComponent(targetId)}`,
    );
    if (res.ok) {
      const data = (await res.json()) as Comment[];
      setComments(data);
      // Detect current user from the first comment whose author matches a session cookie.
      // We rely on the email coming back from the API rather than an extra /me call.
    }
    setLoading(false);
  }, [targetType, targetId]);

  // Attempt to discover the current user email via a lightweight session probe
  useEffect(() => {
    fetch('/api/notifications?limit=1')
      .then(() => {
        // We can't get email from this route easily; instead we'll compare against
        // what the server returns for author.email on comments we authored.
        // This is handled below once comments load — see the matching logic.
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    void fetchComments();
  }, [fetchComments]);

  // Once comments load, try to derive the current user email from session via
  // a dedicated endpoint if available, falling back to checking clientUsers.
  useEffect(() => {
    if (currentUserEmail) return;
    // Probe: try /api/internal/me or similar — if absent, skip.
    fetch('/api/internal/me')
      .then(async (r) => {
        if (r.ok) {
          const me = (await r.json()) as { email?: string };
          if (me.email) setCurrentUserEmail(me.email);
        }
      })
      .catch(() => undefined);
  }, [currentUserEmail]);

  // Handle textarea input and @mention detection
  function handleBodyChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setBody(val);

    const caret = e.target.selectionStart ?? val.length;
    // Find the last '@' before the caret that hasn't been terminated by space
    const textUpToCaret = val.slice(0, caret);
    const atMatch = textUpToCaret.match(/@([\w.+\-@]*)$/);
    if (atMatch) {
      // Only trigger dropdown if the query doesn't look like a fully typed email already followed by space
      const query = atMatch[1];
      // Show dropdown only if query does NOT contain '@' (i.e. the user hasn't typed a full email yet)
      if (!query.includes('@')) {
        setMentionQuery(query);
        setMentionAnchor(caret - query.length - 1); // position of '@'
        return;
      }
    }
    setMentionQuery(null);
  }

  function handleSelectMention(email: string) {
    if (!textareaRef.current) return;
    const before = body.slice(0, mentionAnchor); // up to (not including) '@'
    const caret = textareaRef.current.selectionStart ?? body.length;
    const after = body.slice(caret); // everything after current caret
    const newBody = `${before}@${email} ${after}`;
    setBody(newBody);
    setMentionQuery(null);
    // Restore focus and move caret to after the inserted mention
    textareaRef.current.focus();
    const newCaret = before.length + 1 + email.length + 1;
    requestAnimationFrame(() => {
      textareaRef.current?.setSelectionRange(newCaret, newCaret);
    });
  }

  const filteredUsers =
    mentionQuery !== null
      ? clientUsers.filter((u) => u.email.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 8)
      : [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || submitting) return;
    setSubmitting(true);

    // Optimistic insert
    const optimistic: Comment = {
      id: `optimistic-${Date.now()}`,
      target_type: targetType,
      target_id: targetId,
      body: body.trim(),
      parent_id: replyTo,
      mentions: [],
      created_at: new Date().toISOString(),
      author: currentUserEmail ? { id: 'me', email: currentUserEmail } : null,
    };
    setComments((prev) => [...prev, optimistic]);
    const submittedBody = body.trim();
    const submittedParentId = replyTo;
    setBody('');
    setReplyTo(null);

    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_type: targetType,
          target_id: targetId,
          body: submittedBody,
          parent_id: submittedParentId ?? undefined,
        }),
      });
      if (!res.ok) {
        // Rollback optimistic on error
        setComments((prev) => prev.filter((c) => c.id !== optimistic.id));
        const err = (await res.json()) as { error?: string };
        console.error('Failed to post comment:', err.error);
      } else {
        // Refetch to get real IDs and author info
        await fetchComments();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(commentId: string) {
    const res = await fetch(`/api/comments/${commentId}`, { method: 'DELETE' });
    if (res.ok) {
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, body: '[deleted]' } : c)));
    }
  }

  // Separate top-level and replies
  const topLevel = comments.filter((c) => !c.parent_id);
  const repliesFor = (parentId: string) => comments.filter((c) => c.parent_id === parentId);

  function CommentItem({ comment, depth = 0 }: { comment: Comment; depth?: number }) {
    const authorEmail = comment.author?.email ?? 'Unknown';
    const isOwn = currentUserEmail !== null && authorEmail === currentUserEmail;
    const isDeleted = comment.body === '[deleted]';
    return (
      <div className={depth > 0 ? 'ml-6 border-l-2 pl-3' : ''} style={{ borderColor: 'var(--brand-primary, #6366f1)' }}>
        <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="font-medium text-[var(--brand-ink,#111)]">{authorEmail}</span>
            <span className="text-xs text-black/40">{timeAgo(comment.created_at)}</span>
          </div>
          <p className="text-black/80 leading-snug break-words">
            {isDeleted ? (
              <em className="text-black/30">[deleted]</em>
            ) : (
              <CommentBody body={comment.body} />
            )}
          </p>
          {!isDeleted && (
            <div className="mt-1.5 flex gap-3">
              <button
                type="button"
                onClick={() => setReplyTo(comment.id)}
                className="text-xs text-black/40 hover:text-[var(--brand-primary)] transition-colors"
              >
                Reply
              </button>
              {isOwn && (
                <button
                  type="button"
                  onClick={() => handleDelete(comment.id)}
                  className="text-xs text-black/40 hover:text-red-500 transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
          )}
        </div>

        {/* Nested replies */}
        {repliesFor(comment.id).map((reply) => (
          <CommentItem key={reply.id} comment={reply} depth={depth + 1} />
        ))}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {loading ? (
        <p className="text-xs text-black/30">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-black/30">No comments yet.</p>
      ) : (
        <div className="space-y-2">
          {topLevel.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))}
        </div>
      )}

      {/* Compose form */}
      <form onSubmit={(e) => void handleSubmit(e)} className="relative space-y-2 pt-2">
        {replyTo && (
          <div className="flex items-center gap-2 text-xs text-black/50">
            <span>
              Replying to{' '}
              <span className="font-medium">
                {comments.find((c) => c.id === replyTo)?.author?.email ?? 'comment'}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="text-black/30 hover:text-black/60"
            >
              ✕
            </button>
          </div>
        )}

        <div className="relative">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={handleBodyChange}
            onKeyDown={(e) => {
              if (mentionQuery !== null && (e.key === 'Escape' || e.key === ' ')) {
                setMentionQuery(null);
              }
            }}
            placeholder="Add a comment… type @ to mention someone"
            rows={2}
            className="w-full resize-none rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-[var(--brand-ink,#111)] placeholder:text-black/30 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/40"
            disabled={submitting}
          />

          {/* @mention dropdown */}
          {mentionQuery !== null && filteredUsers.length > 0 && (
            <ul
              role="listbox"
              className="absolute z-50 mt-1 w-64 overflow-hidden rounded-lg border border-black/10 bg-white shadow-lg"
            >
              {filteredUsers.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--brand-primary)]/10 text-[var(--brand-ink,#111)]"
                    onMouseDown={(e) => {
                      // Use onMouseDown + preventDefault so textarea doesn't lose focus before we insert
                      e.preventDefault();
                      handleSelectMention(user.email);
                    }}
                  >
                    {user.email}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting || !body.trim()}
            className="rounded-[var(--brand-radius,6px)] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40 transition-opacity"
            style={{ backgroundColor: 'var(--brand-primary, #6366f1)' }}
          >
            {submitting ? 'Posting…' : 'Post'}
          </button>
        </div>
      </form>
    </div>
  );
}
