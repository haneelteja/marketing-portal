/**
 * k6 load test — Class B write burst scenario (approvals + scheduling)
 * Target: p95 < 300ms for all write endpoints, 0 5xx responses
 *
 * Usage:
 *   BASE_URL=https://your-app.com JWT=<brand_admin_token> ASSET_ID=<approved_asset_uuid> \
 *     ACCOUNT_ID=<social_account_uuid> k6 run tests/load/publish.js
 *
 * Pre-requisite: the ASSET_ID must already be in 'approved' status. Run this against
 * staging only — it will create and cancel real scheduled_posts rows.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate     = new Rate('errors');
const scheduleTrend = new Trend('schedule_post_p95');
const cancelTrend   = new Trend('cancel_post_p95');
const notifsTrend   = new Trend('mark_read_p95');

export const options = {
  stages: [
    { duration: '15s', target: 10 },
    { duration: '2m',  target: 20 },
    { duration: '15s', target: 0  },
  ],
  thresholds: {
    http_req_failed:   ['rate<0.0001'],  // 0 5xx tolerated
    'http_req_duration{status:5..}': ['count<1'],
    schedule_post_p95: ['p(95)<300'],
    cancel_post_p95:   ['p(95)<300'],
    mark_read_p95:     ['p(95)<200'],
  },
};

const BASE_URL   = __ENV.BASE_URL   || 'http://localhost:3000';
const JWT        = __ENV.JWT        || '';
const ASSET_ID   = __ENV.ASSET_ID   || '';
const ACCOUNT_ID = __ENV.ACCOUNT_ID || '';

const HEADERS = {
  Authorization: `Bearer ${JWT}`,
  'Content-Type': 'application/json',
};

export default function () {
  if (!ASSET_ID || !ACCOUNT_ID) {
    console.error('Set ASSET_ID and ACCOUNT_ID env vars');
    return;
  }

  // Schedule a post ~10 minutes from now
  const scheduledAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  let res = http.post(
    `${BASE_URL}/api/scheduled-posts`,
    JSON.stringify({
      conceptAssetId: ASSET_ID,
      socialAccountId: ACCOUNT_ID,
      scheduledAt,
      caption: 'Load test post',
    }),
    { headers: HEADERS },
  );
  check(res, { 'schedule 201': r => r.status === 201 });
  errorRate.add(res.status >= 500);
  scheduleTrend.add(res.timings.duration);

  let postId = '';
  try { postId = res.json('id'); } catch { /* missing */ }

  sleep(0.5);

  // Cancel it immediately (cleanup)
  if (postId) {
    res = http.del(
      `${BASE_URL}/api/scheduled-posts/${postId}`,
      null,
      { headers: HEADERS },
    );
    check(res, { 'cancel 200': r => r.status === 200 });
    errorRate.add(res.status >= 500);
    cancelTrend.add(res.timings.duration);
  }

  // Mark all notifications read
  res = http.patch(
    `${BASE_URL}/api/notifications`,
    JSON.stringify({ markAllRead: true }),
    { headers: HEADERS },
  );
  check(res, { 'mark-read 200': r => r.status === 200 });
  notifsTrend.add(res.timings.duration);

  sleep(1);
}
