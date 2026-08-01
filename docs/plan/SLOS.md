# Service Level Objectives

Targets measured under **sustained load** (see `tests/load/` for k6 scripts).
All p95 figures are server-side response times excluding client network latency.
Record actual measurements here after each load-test run.

---

## Endpoint classes

### Class A — Synchronous read (no AI, no queue)

These must be fast on every request; served from Postgres via RLS client.

| Endpoint pattern | p95 target | Notes |
|---|---|---|
| `GET /api/campaigns` | < 200 ms | Paginated, indexed on client_id |
| `GET /api/concepts` | < 200 ms | Filtered by campaign_id |
| `GET /api/analytics/export` | < 800 ms | Full table scan acceptable |
| `GET /api/notifications` | < 150 ms | Unread-first index |
| `GET /api/social/accounts` | < 150 ms | Short list per client |
| `GET /api/providers/catalog` | < 50 ms | In-process computation, no DB |
| `GET /api/model-preferences` | < 150 ms | Single row per capability |

### Class B — Synchronous write (DB only, no queue)

| Endpoint pattern | p95 target | Notes |
|---|---|---|
| `POST /api/campaigns` | < 300 ms | Insert + audit log |
| `PATCH /api/approvals/:id` | < 300 ms | Update + cascade + audit |
| `POST /api/scheduled-posts` | < 300 ms | Validation + insert |
| `POST /api/model-preferences` | < 200 ms | Upsert single row |
| `POST /api/comments` | < 300 ms | Insert + mention notifications |

### Class C — Async job submission (queue-backed)

These endpoints must return **202** immediately; the actual work is async.
Target is the HTTP round-trip only, not job completion.

| Endpoint pattern | p95 target | Notes |
|---|---|---|
| `POST /api/generation` | < 500 ms | Quota reserve + pg-boss enqueue |
| `GET /api/jobs/:id` | < 100 ms | Single-row lookup by PK |

### Class D — OAuth / admin (infrequent, no SLO enforced)

`POST /api/social/connect/*`, `POST /api/impersonation/*`, `GET /api/internal/tenant-resolve`
These are called infrequently; monitor for errors, not latency.

---

## Worker job SLOs

| Job type | p95 completion target | Notes |
|---|---|---|
| Text generation (LLM) | < 30 s | Anthropic/OpenAI latency-bound |
| Image generation | < 60 s | Stability/Ideogram polling |
| Video generation | < 5 min | Runway/Luma async polling |
| Audio generation | < 15 s | ElevenLabs/OpenAI TTS |
| `publish.run` | < 20 s | Social API round-trip |
| `social.token-refresh` | < 10 s | OAuth token endpoint |
| `analytics.pull` | < 30 s | Per-post metrics fetch |

---

## Load test targets

Minimum baseline before production sign-off:

| Scenario | Concurrent users | Duration | Pass criterion |
|---|---|---|---|
| Read-heavy browse | 50 | 5 min | p95 Class A < target, error rate < 0.1% |
| Write burst (approvals) | 20 | 2 min | p95 Class B < target, 0 5xx |
| Generation submission | 10 | 2 min | p95 Class C < target, all jobs enqueued |
| Mixed realistic | 30 | 10 min | All classes within target, no quota deadlocks |

---

## Measurement history

| Date | Scenario | p95 result | Error rate | Notes |
|---|---|---|---|---|
| — | — | — | — | Baseline not yet run |

Run `k6 run tests/load/generation.js` and `k6 run tests/load/browse.js` to populate.
