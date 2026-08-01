/**
 * k6 load test — Class C async generation submission + Class A job-status poll
 * Target: p95 < 500ms for POST /api/generation (202 only), p95 < 100ms for GET /api/jobs/:id
 *
 * Usage:
 *   BASE_URL=https://your-app.com JWT=<brand_editor_token> CAMPAIGN_ID=<uuid> \
 *     k6 run tests/load/generation.js
 *
 * NOTE: Each VU submits one generation job and polls it a few times.
 * Do not run with high concurrency against a real AI provider — set vendor to
 * a provider that returns quickly (e.g. Anthropic text) to avoid quota burn.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate    = new Rate('errors');
const submitTrend  = new Trend('generation_submit_p95');
const pollTrend    = new Trend('job_poll_p95');
const approveTrend = new Trend('approval_write_p95');

export const options = {
  stages: [
    { duration: '20s', target: 5  },   // ramp up gently (AI quota-aware)
    { duration: '2m',  target: 10 },   // sustained
    { duration: '20s', target: 0  },   // ramp down
  ],
  thresholds: {
    http_req_failed:      ['rate<0.001'],
    generation_submit_p95:['p(95)<500'],
    job_poll_p95:         ['p(95)<100'],
    approval_write_p95:   ['p(95)<300'],
  },
};

const BASE_URL   = __ENV.BASE_URL   || 'http://localhost:3000';
const JWT        = __ENV.JWT        || '';
const CAMPAIGN_ID = __ENV.CAMPAIGN_ID || '';

const HEADERS = {
  Authorization: `Bearer ${JWT}`,
  'Content-Type': 'application/json',
};

export default function () {
  if (!CAMPAIGN_ID) {
    console.error('Set CAMPAIGN_ID env var');
    return;
  }

  // Submit a text generation job
  const body = JSON.stringify({
    capability: 'text',
    campaignId: CAMPAIGN_ID,
    objective: 'Load test concept generation',
    platform: 'instagram',
  });

  let res = http.post(`${BASE_URL}/api/generation`, body, { headers: HEADERS });
  check(res, { 'generation 202': r => r.status === 202 });
  errorRate.add(res.status !== 202);
  submitTrend.add(res.timings.duration);

  let jobId = '';
  try { jobId = res.json('jobId'); } catch { /* missing */ }

  if (!jobId) {
    sleep(2);
    return;
  }

  // Poll job status a few times (simulating what the UI does)
  for (let i = 0; i < 3; i++) {
    sleep(1);
    res = http.get(`${BASE_URL}/api/jobs/${jobId}`, { headers: HEADERS });
    check(res, { 'job poll 200': r => r.status === 200 });
    errorRate.add(res.status !== 200);
    pollTrend.add(res.timings.duration);

    try {
      const job = res.json();
      if (job.status === 'succeeded' || job.status === 'failed') break;
    } catch { /* continue */ }
  }

  sleep(2);
}
