import { NextRequest, NextResponse } from 'next/server';
import PgBoss from 'pg-boss';
import { Pool } from 'pg';
import { getSession } from '@/lib/session/getSession';
import { rlsClient } from '@/lib/db/clients';
import { audit } from '@/lib/audit/log';
import { QuotaService, QuotaExceededError } from '@platform/core/quota/QuotaService';
import { QUEUES, GenerateJobPayload } from '@platform/core/queue/contracts';

const RESERVE_UNITS = { text: 2, image: 3, video: 25, audio: 2 } as const;
type Capability = keyof typeof RESERVE_UNITS;

export const dynamic = 'force-dynamic';

// SERVICE-ROLE JUSTIFICATION: quota ledger + queue enqueue are worker-plane writes
// (tenants are read-only on quota_ledger by design). Tenant identity comes from the
// verified JWT, and the content row the job references is created below through the
// caller's own RLS-scoped client — so no cross-tenant write is possible here.
let _servicePool: Pool | null = null;
let _boss: PgBoss | null = null;
let _bossPromise: Promise<PgBoss> | null = null;

function getServicePool(): Pool {
  if (!_servicePool) _servicePool = new Pool({ connectionString: process.env.DATABASE_URL_SERVICE });
  return _servicePool;
}
function getBoss(): Promise<PgBoss> {
  if (!_bossPromise) {
    const boss = new PgBoss(process.env.DATABASE_URL_SERVICE!);
    _bossPromise = boss.start().then(() => { _boss = boss; return boss; });
  }
  return _bossPromise;
}

/**
 * POST /api/generation/[jobId]/retry — re-runs a single stage without touching
 * other stages or the locked concept. Returns 202 { jobId: newJob.id }.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const session = await getSession();
  if (!session?.claims.client_id) {
    return NextResponse.json({ error: 'Sign in to a client workspace first.' }, { status: 401 });
  }
  if (!['brand_admin', 'brand_editor'].includes(session.claims.client_role ?? '')) {
    return NextResponse.json({ error: 'Your role cannot generate content.' }, { status: 403 });
  }

  const { jobId } = await params;
  const clientId = session.claims.client_id;
  const db = rlsClient(session.accessToken);

  // Read the original job — RLS ensures it belongs to this tenant.
  const { data: originalJob, error: fetchError } = await db
    .from('generation_jobs')
    .select('id, client_id, capability, provider, request_input, status')
    .eq('id', jobId)
    .maybeSingle();

  if (fetchError || !originalJob) {
    return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
  }
  if (originalJob.client_id !== clientId) {
    return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
  }
  if (!['succeeded', 'failed'].includes(originalJob.status as string)) {
    return NextResponse.json(
      { error: 'Can only retry a completed (succeeded or failed) job.' },
      { status: 409 },
    );
  }

  const capability = originalJob.capability as Capability;
  if (!Object.keys(RESERVE_UNITS).includes(capability)) {
    return NextResponse.json({ error: 'Original job has invalid capability.' }, { status: 400 });
  }

  // Edition gate for video and audio.
  if (capability === 'video' || capability === 'audio') {
    const { data: client } = await db
      .from('clients')
      .select('edition_id, client_editions(feature_flags)')
      .single();
    const flags =
      (client?.client_editions as { feature_flags?: Record<string, unknown> })?.feature_flags ?? {};
    if (capability === 'video' && !flags['video_generation']) {
      return NextResponse.json({ error: 'Video generation is not included in your plan.' }, { status: 403 });
    }
    if (capability === 'audio' && !flags['audio_generation']) {
      return NextResponse.json({ error: 'Audio generation is not included in your plan.' }, { status: 403 });
    }
  }

  // Resolve vendor/model: use the original job's provider, then fall back to current model pref.
  let vendor: string | undefined = originalJob.provider !== 'default' ? originalJob.provider : undefined;
  let model: string | undefined = undefined;
  if (!vendor) {
    const { data: pref } = await db
      .from('model_preferences')
      .select('vendor, model')
      .eq('capability', capability)
      .maybeSingle();
    if (pref) { vendor = pref.vendor; model = pref.model; }
  }

  // Preserve the original concept_id from request_input if present.
  const requestInput = originalJob.request_input as {
    brief?: unknown;
    constraints?: unknown;
    options?: unknown;
    conceptId?: string;
  } | null;

  // Insert a fresh job row (proves tenant scope via RLS client).
  const { data: newJob, error: insertError } = await db
    .from('generation_jobs')
    .insert({
      client_id: clientId,
      concept_id: (requestInput as { conceptId?: string } | null)?.conceptId ?? null,
      capability,
      provider: vendor ?? 'default',
      request_input: requestInput,
      requested_by: null,
    })
    .select('id')
    .single();

  if (insertError || !newJob) {
    return NextResponse.json({ error: insertError?.message ?? 'Could not create retry job.' }, { status: 400 });
  }

  const quota = new QuotaService(getServicePool());
  let ledgerEntryId: string;
  try {
    ledgerEntryId = await quota.checkAndReserve(clientId, newJob.id, RESERVE_UNITS[capability]);
  } catch (e) {
    if (e instanceof QuotaExceededError) {
      await db
        .from('generation_jobs')
        .update({ status: 'failed', error_message: (e as Error).message })
        .eq('id', newJob.id);
      return NextResponse.json({ error: (e as Error).message }, { status: 429 });
    }
    throw e;
  }

  const boss = await getBoss();
  const payload: GenerateJobPayload = {
    jobId: newJob.id,
    clientId,
    capability,
    vendor,
    model,
    reservedUnits: RESERVE_UNITS[capability],
    ledgerEntryId,
  };
  await boss.send(QUEUES.GENERATE, payload, { retryLimit: 2, retryDelay: 30 });
  await audit(db, `generation.retry.${capability}`, { type: 'generation_job', id: newJob.id });

  return NextResponse.json({ jobId: newJob.id }, { status: 202 });
}
