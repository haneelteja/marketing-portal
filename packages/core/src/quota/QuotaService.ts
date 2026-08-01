import type { Pool } from 'pg';

export class QuotaExceededError extends Error {
  constructor(clientId: string, requested: number, remaining: number) {
    super(`Quota exceeded: requested ${requested} units, ${remaining} remaining this period.`);
    this.name = 'QuotaExceededError';
  }
}

/**
 * Enforcement point required by spec §5.4 / §8.3: called BEFORE every generation
 * and social connection; actual cost settled after. Ledger semantics
 * (reserve -> settle | release) mean a crashed job cannot permanently leak quota.
 * Billing wires into this interface later without touching call sites.
 */
export class QuotaService {
  constructor(private readonly db: Pool) {}

  private period(): string {
    return new Date().toISOString().slice(0, 7); // YYYY-MM
  }

  async remaining(clientId: string): Promise<number> {
    const { rows } = await this.db.query(
      `select e.ai_generation_quota
              - coalesce((select sum(units) from quota_ledger
                          where client_id = $1 and period = $2), 0) as remaining
         from clients c join client_editions e on e.id = c.edition_id
        where c.id = $1`,
      [clientId, this.period()],
    );
    return Number(rows[0]?.remaining ?? 0);
  }

  /** Atomically reserve units or throw. Returns the ledger entry id for settle/release. */
  async checkAndReserve(clientId: string, jobId: string, units: number): Promise<string> {
    const client = await this.db.connect();
    try {
      await client.query('begin');
      await client.query(
        `select pg_advisory_xact_lock(hashtext($1))`, [clientId]); // serialize per tenant
      const remaining = await this.remaining(clientId);
      if (remaining < units) {
        await client.query('rollback');
        throw new QuotaExceededError(clientId, units, remaining);
      }
      const { rows } = await client.query(
        `insert into quota_ledger (client_id, job_id, entry_type, units, period)
         values ($1, $2, 'reserve', $3, $4) returning id`,
        [clientId, jobId, units, this.period()],
      );
      await client.query('commit');
      return rows[0].id;
    } catch (e) {
      await client.query('rollback').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }

  /** Settle actual cost (may differ from reserve) and release the difference. */
  async settle(clientId: string, jobId: string, reservedUnits: number, actualUnits: number): Promise<void> {
    const delta = actualUnits - reservedUnits;
    if (delta !== 0) {
      await this.db.query(
        `insert into quota_ledger (client_id, job_id, entry_type, units, period)
         values ($1, $2, $3, $4, $5)`,
        [clientId, jobId, delta > 0 ? 'settle' : 'release', delta, this.period()],
      );
    }
  }

  /** Full release on job failure — the user isn't charged for a failed generation. */
  async release(clientId: string, jobId: string, reservedUnits: number): Promise<void> {
    await this.db.query(
      `insert into quota_ledger (client_id, job_id, entry_type, units, period)
       values ($1, $2, 'release', $3, $4)`,
      [clientId, jobId, -reservedUnits, this.period()],
    );
  }
}
