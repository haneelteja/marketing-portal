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

// SERVICE-ROLE JUSTIFICATION: quota ledger + queue enqueue are worker-plane writes
// (tenants are read-only on quota_ledger by design). Tenant identity comes from the
// verified JWT, and the content row the job references is created below through the
// caller's own RLS-scoped client — so no cross-tenant write is possible here.
const servicePool = new Pool({ connectionString: process.env.DATABASE_URL_SERVICE });
const quota = new QuotaService(servicePool);
const bossPromise = new PgBoss(process.env.DATABASE_URL_SERVICE!).start();

/**
 * POST /api/generation — spec §8.4: creates a queued job and returns immediately
 * with a job id. The UI polls GET /api/jobs/:id or subscribes via realtime.
 * Never blocks on a provider call.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.claims.client_id) {
    return NextResponse.json({ error: 'Sign in to a client workspace first.' }, { status: 401 });
  }
  if (!['brand_admin', 'brand_editor'].includes(session.claims.client_role ?? '')) {
    return NextResponse.json({ error: 'Your role cannot generate content.' }, { status: 403 });
  }

  const body = await req.json();
  const capability = body.capability as Capability;
  if (!Object.keys(RESERVE_UNITS).includes(capability)) {
    return NextResponse.json({ error: 'capability must be text | image | video | audio' }, { status: 400 });
  }
  const clientId = session.claims.client_id;

  // Edition gate for video and audio (higher-cost capabilities)
  const db = rlsClient(session.accessToken);
  if (capability === 'video' || capability === 'audio') {
    const { data: client } = await db
      .from('clients').select('edition_id, client_editions(feature_flags)').single();
    const flags = (client?.client_editions as { feature_flags?: Record<string, unknown> })?.feature_flags ?? {};
    if (capability === 'video' && !flags['video_generation']) {
      return NextResponse.json({ error: 'Video generation is not included in your plan.' }, { status: 403 });
    }
    if (capability === 'audio' && !flags['audio_generation']) {
      return NextResponse.json({ error: 'Audio generation is not included in your plan.' }, { status: 403 });
    }
  }

  // If no vendor/model specified, fall back to this client's model_preferences
  let vendor = body.vendor as string | undefined;
  let model = body.model as string | undefined;
  if (!vendor || !model) {
    const { data: pref } = await db
      .from('model_preferences')
      .select('vendor, model')
      .eq('capability', capability)
      .maybeSingle();
    if (pref) { vendor = vendor ?? pref.vendor; model = model ?? pref.model; }
  }

  // Create the job row via the RLS client (proves tenant scope), then reserve quota + enqueue.
  const { data: jobRow, error } = await db
    .from('generation_jobs')
    .insert({
      client_id: clientId,
      concept_id: body.conceptId ?? null,
      capability,
      provider: vendor ?? 'default',
      request_input: { brief: body.brief, constraints: body.constraints, options: body.options },
      requested_by: null, // resolved by trigger from auth claims in a later migration
    })
    .select('id').single();
  if (error || !jobRow) {
    return NextResponse.json({ error: error?.message ?? 'Could not create job.' }, { status: 400 });
  }

  let ledgerEntryId: string;
  try {
    ledgerEntryId = await quota.checkAndReserve(clientId, jobRow.id, RESERVE_UNITS[capability]);
  } catch (e) {
    if (e instanceof QuotaExceededError) {
      await db.from('generation_jobs')
        .update({ status: 'failed', error_message: e.message }).eq('id', jobRow.id);
      return NextResponse.json({ error: e.message }, { status: 429 });
    }
    throw e;
  }

  const boss = await bossPromise;
  const payload: GenerateJobPayload = {
    jobId: jobRow.id, clientId, capability, vendor, model,
    reservedUnits: RESERVE_UNITS[capability], ledgerEntryId,
  };
  await boss.send(QUEUES.GENERATE, payload, { retryLimit: 2, retryDelay: 30 });
  await audit(db, `generation.requested.${capability}`, { type: 'generation_job', id: jobRow.id });

  return NextResponse.json({ jobId: jobRow.id, status: 'queued' }, { status: 202 });
}
