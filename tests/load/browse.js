/**
 * k6 load test — Class A read-heavy browse scenario
 * Target: p95 < 200ms for all read endpoints, error rate < 0.1%
 *
 * Usage:
 *   BASE_URL=https://your-app.com JWT=<brand_editor_token> k6 run tests/load/browse.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const campaignsTrend = new Trend('campaigns_p95');
const conceptsTrend = new Trend('concepts_p95');
const notifsTrend = new Trend('notifications_p95');
const catalogTrend = new Trend('catalog_p95');

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // ramp up
    { duration: '4m',  target: 50 },   // sustained load
    { duration: '30s', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_failed:   ['rate<0.001'],  // < 0.1% errors
    campaigns_p95:     ['p(95)<200'],
    concepts_p95:      ['p(95)<200'],
    notifications_p95: ['p(95)<150'],
    catalog_p95:       ['p(95)<50'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const JWT      = __ENV.JWT || '';

const HEADERS = {
  Authorization: `Bearer ${JWT}`,
  'Content-Type': 'application/json',
};

export default function () {
  // Campaigns list
  let res = http.get(`${BASE_URL}/api/campaigns`, { headers: HEADERS });
  check(res, { 'campaigns 200': r => r.status === 200 });
  errorRate.add(res.status !== 200);
  campaignsTrend.add(res.timings.duration);

  // Concepts (first campaign if any)
  let campaigns = [];
  try { campaigns = res.json(); } catch { /* empty */ }
  if (campaigns.length) {
    res = http.get(`${BASE_URL}/api/concepts?campaign_id=${campaigns[0].id}`, { headers: HEADERS });
    check(res, { 'concepts 200': r => r.status === 200 });
    errorRate.add(res.status !== 200);
    conceptsTrend.add(res.timings.duration);
  }

  // Provider catalog (in-process, should be very fast)
  res = http.get(`${BASE_URL}/api/providers/catalog`, { headers: HEADERS });
  check(res, { 'catalog 200': r => r.status === 200 });
  errorRate.add(res.status !== 200);
  catalogTrend.add(res.timings.duration);

  // Notifications
  res = http.get(`${BASE_URL}/api/notifications`, { headers: HEADERS });
  check(res, { 'notifications 200': r => r.status === 200 });
  errorRate.add(res.status !== 200);
  notifsTrend.add(res.timings.duration);

  sleep(1);
}
