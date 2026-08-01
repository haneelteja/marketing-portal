import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session/getSession';
import { rlsClient } from '@/lib/db/clients';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage({ params }: { params: Promise<{ clientSlug: string }> }) {
  const session = await getSession();
  const { clientSlug } = await params;
  if (!session) redirect(`/login?next=/app/${clientSlug}/analytics`);

  const db = rlsClient(session.accessToken);
  const [{ data: snapshots }, { data: posts }] = await Promise.all([
    db.from('analytics_snapshots')
      .select('metric_type, value, platform, captured_at')
      .order('captured_at', { ascending: false })
      .limit(200),
    db.from('scheduled_posts')
      .select('id, platform, caption, published_at, platform_post_id, analytics_snapshots(metric_type, value)')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(20),
  ]);

  // Rollup: sum by metric_type
  const rollup: Record<string, number> = {};
  for (const s of snapshots ?? []) {
    rollup[s.metric_type] = (rollup[s.metric_type] ?? 0) + Number(s.value);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--brand-ink)]">Analytics</h1>
        <a
          href="/api/analytics/export"
          download
          className="rounded-[var(--brand-radius)] bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Export CSV
        </a>
      </div>

      {Object.keys(rollup).length > 0 ? (
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(rollup).map(([metric, total]) => (
            <div key={metric} className="rounded-[var(--brand-radius)] border border-black/10 bg-white p-4">
              <p className="text-2xl font-bold text-[var(--brand-primary)]">{total.toLocaleString()}</p>
              <p className="text-xs text-black/50 capitalize">{metric}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="mb-8 rounded-[var(--brand-radius)] border border-dashed border-black/20 p-8 text-center text-sm text-black/40">
          No analytics data yet. Metrics are collected after posts are published.
        </div>
      )}

      <h2 className="mb-3 text-lg font-semibold">Published posts</h2>
      <div className="flex flex-col gap-3">
        {(posts ?? []).map(post => {
          const metrics = Array.isArray(post.analytics_snapshots) ? post.analytics_snapshots : [];
          return (
            <div key={post.id} className="rounded-[var(--brand-radius)] border border-black/10 bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium capitalize">{post.platform}</p>
                  {post.caption && <p className="mt-0.5 text-xs text-black/50 line-clamp-2">{post.caption}</p>}
                  <p className="mt-1 text-xs text-black/30">{post.published_at ? new Date(post.published_at).toLocaleString() : '—'}</p>
                </div>
                <div className="flex gap-4 text-right">
                  {metrics.map((m: { metric_type: string; value: number }) => (
                    <div key={m.metric_type}>
                      <p className="text-sm font-bold text-[var(--brand-primary)]">{Number(m.value).toLocaleString()}</p>
                      <p className="text-xs text-black/40 capitalize">{m.metric_type}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
        {!posts?.length && <p className="text-sm text-black/40 py-4 text-center">No published posts yet.</p>}
      </div>
    </div>
  );
}
