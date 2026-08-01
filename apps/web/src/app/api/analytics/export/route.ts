import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session/getSession';
import { rlsClient } from '@/lib/db/clients';

/** Escape a single CSV field: wrap in quotes if it contains commas, quotes, or newlines. */
function escapeField(value: unknown): string {
  const str = value == null ? '' : String(value);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const headerLine = headers.map(escapeField).join(',');
  const dataLines = rows.map((row) =>
    headers.map((h) => escapeField(row[h])).join(','),
  );
  return [headerLine, ...dataLines].join('\r\n');
}

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = rlsClient(session.accessToken);

  // --- Campaign-level rollup ---
  // scheduled_posts → concept_assets → concepts → campaigns
  const { data: campaignMetrics } = await db
    .from('analytics_snapshots')
    .select(
      'metric_type, value, scheduled_posts!inner(concept_assets!inner(concepts!inner(campaigns!inner(id, name))))',
    )
    .not('scheduled_posts', 'is', null);

  type CampaignMetricRow = {
    metric_type: string;
    value: number;
    scheduled_posts: {
      concept_assets: {
        concepts: {
          campaigns: { id: string; name: string };
        };
      };
    };
  };

  // Rollup: campaign_id + metric_type → sum
  const rollupMap: Map<string, { campaign_name: string; metric_type: string; total: number }> = new Map();

  for (const row of (campaignMetrics ?? []) as unknown as CampaignMetricRow[]) {
    const campaign = row.scheduled_posts?.concept_assets?.concepts?.campaigns;
    if (!campaign) continue;
    const key = `${campaign.id}::${row.metric_type}`;
    const existing = rollupMap.get(key);
    if (existing) {
      existing.total += Number(row.value);
    } else {
      rollupMap.set(key, {
        campaign_name: campaign.name,
        metric_type: row.metric_type,
        total: Number(row.value),
      });
    }
  }

  const rollupRows: Record<string, unknown>[] = Array.from(rollupMap.values()).map((r) => ({
    campaign_name: r.campaign_name,
    metric_type: r.metric_type,
    total_value: r.total,
  }));

  // --- Post-level detail rows ---
  const { data: posts } = await db
    .from('scheduled_posts')
    .select(
      'id, platform, caption, published_at, platform_post_id, analytics_snapshots(metric_type, value, captured_at)',
    )
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  type PostRow = {
    id: string;
    platform: string;
    caption: string | null;
    published_at: string | null;
    platform_post_id: string | null;
    analytics_snapshots: { metric_type: string; value: number; captured_at: string }[];
  };

  const detailRows: Record<string, unknown>[] = [];
  for (const post of (posts ?? []) as unknown as PostRow[]) {
    const snapshots = Array.isArray(post.analytics_snapshots) ? post.analytics_snapshots : [];
    if (snapshots.length === 0) {
      detailRows.push({
        post_id: post.id,
        platform: post.platform,
        caption: post.caption ?? '',
        published_at: post.published_at ?? '',
        platform_post_id: post.platform_post_id ?? '',
        metric_type: '',
        value: '',
        captured_at: '',
      });
    } else {
      for (const snap of snapshots) {
        detailRows.push({
          post_id: post.id,
          platform: post.platform,
          caption: post.caption ?? '',
          published_at: post.published_at ?? '',
          platform_post_id: post.platform_post_id ?? '',
          metric_type: snap.metric_type,
          value: snap.value,
          captured_at: snap.captured_at,
        });
      }
    }
  }

  // Build final CSV: campaign rollup section + blank line + post detail section
  const rollupCsv = rollupRows.length > 0
    ? `# Campaign Rollup\r\n${toCsv(rollupRows)}`
    : '# Campaign Rollup\r\n(no campaign data)';

  const detailCsv = detailRows.length > 0
    ? `# Post Detail\r\n${toCsv(detailRows)}`
    : '# Post Detail\r\n(no published posts)';

  const csv = `${rollupCsv}\r\n\r\n${detailCsv}`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="analytics-export.csv"',
      'Cache-Control': 'no-store',
    },
  });
}
