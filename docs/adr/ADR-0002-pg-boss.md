# ADR-0002: pg-boss over Redis+BullMQ
**Status:** Accepted

Postgres-backed queue: one fewer stateful service, transactional enqueue with the rows
jobs reference, retention for audit. Revisit if sustained job volume exceeds ~50 jobs/s
or sub-second latency is needed — the QUEUES contract in packages/core is transport-agnostic,
so a swap touches workers only.
