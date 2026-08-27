import './sentry';
import { createServer } from 'http';
import PgBoss from 'pg-boss';
import { Pool } from 'pg';
import { QUEUES, GenerateJobPayload } from '@platform/core/queue/contracts';
import { resolveProvider } from '@platform/core/providers/generation/registry';
import { PromptContextBuilder } from '@platform/core/prompt/PromptContextBuilder';
import { QuotaService } from '@platform/core/quota/QuotaService';
import { uploadBase64Asset } from '@platform/core/storage/upload';

/**
 * Generation worker (spec §8.4): consumes queued jobs, calls providers, updates
 * generation_jobs + concept_assets, settles quota. No provider call ever runs
 * inside a user-facing HTTP request.
 *
 * SERVICE-ROLE JUSTIFICATION: workers run outside a user session; there is no JWT
 * to satisfy RLS. Every row touched is looked up by the job's own client_id, and
 * the enqueue path (web, RLS-enforced) is the only way a job enters this queue.
 */
const db = new Pool({ connectionString: process.env.DATABASE_URL_SERVICE });
const quota = new QuotaService(db);

export async function start(): Promise<void> {
  const boss = new PgBoss(process.env.DATABASE_URL_SERVICE!);
  await boss.start();

  await boss.work<GenerateJobPayload>(QUEUES.GENERATE, {}, async (jobs) => {
    const [job] = jobs;
    const p = job.data;
    await db.query(
      `update generation_jobs set status='running', started_at=now() where id=$1`, [p.jobId]);

    try {
      const { rows: [jobRow] } = await db.query(
        `select gj.*, bp.brand_voice_doc, bp.tone_guidelines, bp.target_audience,
                bp.color_palette, bp.typography, bp.logo_url
           from generation_jobs gj
           join brand_profiles bp on bp.client_id = gj.client_id
          where gj.id = $1`, [p.jobId]);

      const builder = new PromptContextBuilder({
        clientId: p.clientId,
        brandVoice: jobRow.brand_voice_doc,
        toneGuidelines: jobRow.tone_guidelines,
        targetAudience: jobRow.target_audience,
        colorPalette: jobRow.color_palette ?? {},
        typography: jobRow.typography ?? {},
        logoUrl: jobRow.logo_url,
      }, jobRow.request_input.constraints);

      const provider = resolveProvider(p.capability, p.vendor, p.model);
      const brief = jobRow.request_input.brief;
      let actualUnits = p.reservedUnits;

      if (p.capability === 'text') {
        const prompt = builder.buildConceptPrompt(brief);
        const result = await provider.generateText!({
          prompt, context: builder['brand'] as never, model: p.model,
        });
        await db.query(
          `insert into concepts (campaign_id, client_id, title, core_message, suggested_format,
                                 generated_from_prompt, llm_provider, llm_model, raw_llm_output, created_by)
           select $1, $2, c->>'title', c->>'coreMessage', c->>'suggestedFormat',
                  $3, $4, $5, $6::jsonb, $7
             from jsonb_array_elements($8::jsonb) c`,
          [brief.campaignId, p.clientId, prompt, result.provider, result.model,
           JSON.stringify(result.rawOutput), jobRow.requested_by,
           JSON.stringify(result.concepts)]);
        actualUnits = Math.max(1, Math.ceil((result.usage.inputTokens + result.usage.outputTokens) / 1000));

      } else if (p.capability === 'image') {
        const prompt = builder.buildImagePrompt(brief);
        const result = await provider.generateImage!({
          prompt, context: builder['brand'] as never,
          constraints: jobRow.request_input.constraints, model: p.model,
          options: jobRow.request_input.options,
        });
        actualUnits = result.costUnits;

        // Upload binary assets that providers couldn't return as direct URLs
        let url = result.images[0].url;
        if (url.startsWith('storage://')) {
          const raw = result.rawOutput as Record<string, unknown>;
          const b64 = (raw.imageBase64 ?? (raw.data as Array<{b64_json?: string}>)?.[0]?.b64_json) as string | undefined;
          if (!b64) throw new Error(`Provider ${p.vendor} returned a storage:// placeholder but no base64 data in rawOutput`);
          url = await uploadBase64Asset(b64, 'image/png', `${p.jobId}.png`);
        }

        const { rows: [asset] } = await db.query(
          `insert into concept_assets (concept_id, client_id, type, provider, prompt_used,
                                       source_url, raw_output, created_by, creation_method, version)
           values ($1,$2,'image',$3,$4,$5,$6::jsonb,$7,'ai_generated',
                   coalesce((select max(version)+1 from concept_assets
                             where concept_id=$1 and type='image'), 1))
           returning id`,
          [jobRow.concept_id, p.clientId, result.provider, prompt,
           url, JSON.stringify(result.rawOutput), jobRow.requested_by]);
        await db.query(
          `update generation_jobs set result_asset_id=$2 where id=$1`, [p.jobId, asset.id]);

      } else if (p.capability === 'video') {
        const prompt = builder.buildVideoPrompt(brief);
        const result = await provider.generateVideo!({
          prompt, context: builder['brand'] as never,
          constraints: jobRow.request_input.constraints, model: p.model,
          options: jobRow.request_input.options,
        });
        actualUnits = result.costUnits;
        const { rows: [asset] } = await db.query(
          `insert into concept_assets (concept_id, client_id, type, provider, prompt_used,
                                       source_url, raw_output, created_by, creation_method, version)
           values ($1,$2,'video',$3,$4,$5,$6::jsonb,$7,'ai_generated',
                   coalesce((select max(version)+1 from concept_assets
                             where concept_id=$1 and type='video'), 1))
           returning id`,
          [jobRow.concept_id, p.clientId, result.provider, prompt,
           result.videoUrl, JSON.stringify(result.rawOutput), jobRow.requested_by]);
        await db.query(
          `update generation_jobs set result_asset_id=$2 where id=$1`, [p.jobId, asset.id]);

      } else if (p.capability === 'audio') {
        const prompt = builder.buildAudioPrompt(brief);
        const result = await provider.generateAudio!({
          prompt, context: builder['brand'] as never,
          constraints: jobRow.request_input.constraints, model: p.model,
          options: jobRow.request_input.options,
        });
        actualUnits = result.costUnits;

        // Upload audio binary (ElevenLabs, OpenAI TTS) — providers store base64 in rawOutput
        let audioUrl = result.audioUrl;
        if (audioUrl.startsWith('storage://')) {
          const raw = result.rawOutput as Record<string, unknown>;
          const b64 = raw.audioBase64 as string | undefined;
          if (!b64) throw new Error(`Provider ${p.vendor} returned a storage:// placeholder but no audioBase64 in rawOutput`);
          const ext = result.mimeType.split('/')[1] ?? 'mp3';
          audioUrl = await uploadBase64Asset(b64, result.mimeType, `${p.jobId}.${ext}`);
        }

        const { rows: [asset] } = await db.query(
          `insert into concept_assets (concept_id, client_id, type, provider, prompt_used,
                                       source_url, raw_output, created_by, creation_method, version)
           values ($1,$2,'audio',$3,$4,$5,$6::jsonb,$7,'ai_generated',
                   coalesce((select max(version)+1 from concept_assets
                             where concept_id=$1 and type='audio'), 1))
           returning id`,
          [jobRow.concept_id, p.clientId, result.provider, prompt,
           audioUrl, JSON.stringify(result.rawOutput), jobRow.requested_by]);
        await db.query(
          `update generation_jobs set result_asset_id=$2 where id=$1`, [p.jobId, asset.id]);
      }

      await quota.settle(p.clientId, p.jobId, p.reservedUnits, actualUnits);
      await db.query(
        `update generation_jobs set status='succeeded', finished_at=now() where id=$1`, [p.jobId]);
    } catch (err) {
      // Failure is surfaced, never swallowed (spec §8.5); reserved quota released.
      await quota.release(p.clientId, p.jobId, p.reservedUnits).catch(() => {});
      await db.query(
        `update generation_jobs set status='failed', finished_at=now(), error_message=$2 where id=$1`,
        [p.jobId, (err as Error).message]);
      throw err; // let pg-boss record the failure too
    }
  });
}

if (require.main === module) {
  // Health server starts first so Render's health check passes while pg-boss connects
  const port = parseInt(process.env.PORT ?? '10000', 10);
  createServer((_, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ service: 'orchestrator', status: 'ok' }));
  }).listen(port, () => {
    console.log(`[orchestrator] health on :${port}`);
    // Start worker after health server is bound
    if (!process.env.DATABASE_URL_SERVICE) {
      console.warn('[orchestrator] DATABASE_URL_SERVICE not set — skipping pg-boss start');
      return;
    }
    start().catch((e) => { console.error('[orchestrator] fatal:', e); });
  });
}
