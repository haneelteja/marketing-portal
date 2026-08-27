import './sentry';
import { createServer } from 'http';
import PgBoss from 'pg-boss';
import { Pool } from 'pg';
import { QUEUES, PublishJobPayload } from '@platform/core/queue/contracts';
import { decryptToken, encryptToken } from '@platform/core/crypto/tokenVault';
import {
  SocialPublishingProvider, PublishError,
} from '@platform/core/providers/publishing/types';
import { getPublishingProvider } from '@platform/core/providers/publishing/index';
import { sendEmail } from '@platform/core/email/sender';
import { publishSuccessEmail, publishFailedEmail, tokenExpiringEmail } from '@platform/core/email/templates';

/**
 * Publisher workers (spec §9, §11):
 *  - publish.run           fired at scheduled_at; records verbatim platform response
 *  - social.token-refresh  proactive refresh; marks `expired` the moment refresh fails
 *  - analytics.pull        daily for the first week post-publish, weekly after
 *
 * SERVICE-ROLE JUSTIFICATION: all three run outside any user session (cron/queue plane).
 * Rows are addressed by ids carried in job payloads that only RLS-enforced app code can
 * have enqueued; tokens are decrypted here, used, and never logged or returned.
 */
const db = new Pool({ connectionString: process.env.DATABASE_URL_SERVICE });

export async function start(): Promise<void> {
  const boss = new PgBoss(process.env.DATABASE_URL_SERVICE!);
  await boss.start();

  // ---- publish ------------------------------------------------------------
  await boss.work<PublishJobPayload>(QUEUES.PUBLISH, {}, async (jobs) => {
    const [job] = jobs;
    const { scheduledPostId } = job.data;
    const { rows: [post] } = await db.query(
      `select sp.*, sa.platform, sa.external_account_id, sa.access_token_encrypted,
              sa.status as account_status, ca.type as media_type, ca.source_url,
              ca.status as asset_status
         from scheduled_posts sp
         join social_accounts sa on sa.id = sp.social_account_id
         join concept_assets ca on ca.id = sp.concept_asset_id
        where sp.id = $1 and sp.status = 'scheduled'`, [scheduledPostId]);
    if (!post) return; // already handled or cancelled

    const fail = async (message: string, raw?: unknown) => {
      await db.query(
        `update scheduled_posts
            set status='failed', error_message=$2, publish_response=$3::jsonb
          where id=$1`,
        [scheduledPostId, message, JSON.stringify(raw ?? null)]);
      await db.query(
        `insert into notifications (user_id, client_id, type, payload)
         select connected_by, $2, 'post_failed', jsonb_build_object('scheduledPostId', $1, 'reason', $3)
           from social_accounts where id = $4`,
        [scheduledPostId, post.client_id, message, post.social_account_id]);
      // Email brand admins on publish failure
      const { rows: failAdmins } = await db.query(
        `select u.email from users u
           join clients c on c.id = $1
          where u.client_id = $1 and u.client_role = 'brand_admin'`,
        [post.client_id],
      );
      for (const admin of failAdmins) {
        const { subject, html } = publishFailedEmail({
          platform: post.platform,
          reason: message,
          workspaceUrl: '',
        });
        await sendEmail({ to: admin.email as string, subject, html });
      }
    };

    // Guardrails: only approved assets publish (§6.3); dead connections fail loudly (§9).
    if (post.asset_status !== 'approved') {
      return fail('Asset is no longer approved; publishing blocked.');
    }
    if (post.account_status !== 'connected') {
      return fail(`Social connection is ${post.account_status}; reconnect the account.`);
    }
    const provider = getPublishingProvider(post.platform);
    if (!provider || !provider.implemented) {
      return fail(`${post.platform} publishing is not yet implemented.`);
    }

    await db.query(`update scheduled_posts set status='publishing' where id=$1`, [scheduledPostId]);
    try {
      const outcome = await provider.publish(
        {
          socialAccountId: post.social_account_id,
          externalAccountId: post.external_account_id,
          accessToken: decryptToken(post.access_token_encrypted),
        },
        { caption: post.caption, mediaUrl: post.source_url, mediaType: post.media_type },
      );
      await db.query(
        `update scheduled_posts
            set status='published', published_at=now(),
                platform_post_id=$2, publish_response=$3::jsonb
          where id=$1`,
        [scheduledPostId, outcome.platformPostId, JSON.stringify(outcome.rawResponse)]);
      await db.query(
        `update social_accounts set last_successful_publish=now() where id=$1`,
        [post.social_account_id]);
      // Email brand admins on publish success
      const { rows: admins } = await db.query(
        `select u.email from users u
           join clients c on c.id = $1
          where u.client_id = $1 and u.client_role = 'brand_admin'`,
        [post.client_id],
      );
      for (const admin of admins) {
        const { subject, html } = publishSuccessEmail({
          platform: post.platform,
          caption: post.caption?.slice(0, 100) as string | undefined,
          platformPostId: outcome.platformPostId,
          workspaceUrl: '',
        });
        await sendEmail({ to: admin.email as string, subject, html });
      }
      // First analytics pull ~1h after publish, then the cron cadence takes over.
      await boss.send(QUEUES.ANALYTICS_PULL, { scheduledPostId }, { startAfter: 3600 });
    } catch (err) {
      const e = err as PublishError;
      await fail(e.message, e.rawResponse);
      throw err;
    }
  });

  // ---- proactive token refresh (cron, hourly) -----------------------------
  await boss.schedule(QUEUES.TOKEN_REFRESH, '0 * * * *');
  await boss.work(QUEUES.TOKEN_REFRESH, async () => {
    const { rows } = await db.query(
      `select id, platform, refresh_token_encrypted
         from social_accounts
        where status='connected'
          and token_expires_at is not null
          and token_expires_at < now() + interval '48 hours'`);
    for (const acct of rows) {
      const provider = getPublishingProvider(acct.platform);
      if (!provider?.refreshToken || !acct.refresh_token_encrypted) continue;
      try {
        const fresh = await provider.refreshToken(decryptToken(acct.refresh_token_encrypted));
        await db.query(
          `update social_accounts
              set access_token_encrypted=$2, token_expires_at=$3,
                  refresh_token_encrypted=coalesce($4, refresh_token_encrypted)
            where id=$1`,
          [acct.id, encryptToken(fresh.accessToken), fresh.expiresAt,
           fresh.refreshToken ? encryptToken(fresh.refreshToken) : null]);
      } catch {
        // Failure is never silent (§9): mark expired now so the UI flags it immediately,
        // long before a publish attempt would have hit the dead token.
        await db.query(`update social_accounts set status='expired' where id=$1`, [acct.id]);
        await db.query(
          `insert into notifications (user_id, client_id, type, payload)
           select connected_by, client_id, 'token_expired',
                  jsonb_build_object('socialAccountId', id, 'platform', platform)
             from social_accounts where id=$1`, [acct.id]);
        // Email the user who connected the account
        const { rows: [connector] } = await db.query(
          `select u.email from users u
             join social_accounts sa on sa.connected_by = u.id
            where sa.id = $1`,
          [acct.id],
        );
        if (connector) {
          const { subject, html } = tokenExpiringEmail({
            platform: acct.platform as string,
            expiresAt: new Date().toISOString(),
            reconnectUrl: '',
          });
          await sendEmail({ to: connector.email as string, subject, html });
        }
      }
    }
  });

  // ---- analytics pull (cron daily + per-post kicks) -----------------------
  await boss.schedule(QUEUES.ANALYTICS_PULL, '30 2 * * *'); // daily sweep
  await boss.work<{ scheduledPostId?: string }>(QUEUES.ANALYTICS_PULL, async ([job]) => {
    // Cadence (§11): daily for the first 7 days after publish, weekly after.
    const { rows: posts } = await db.query(
      job.data?.scheduledPostId
        ? { text: `select sp.*, sa.external_account_id, sa.access_token_encrypted, sa.platform as p
                     from scheduled_posts sp join social_accounts sa on sa.id=sp.social_account_id
                    where sp.id=$1 and sp.status='published'`,
            values: [job.data.scheduledPostId] }
        : { text: `select sp.*, sa.external_account_id, sa.access_token_encrypted, sa.platform as p
                     from scheduled_posts sp join social_accounts sa on sa.id=sp.social_account_id
                    where sp.status='published' and (
                      sp.published_at > now() - interval '7 days'
                      or extract(dow from now()) = 1)`,
            values: [] });
    for (const post of posts) {
      const provider = getPublishingProvider(post.p);
      if (!provider?.implemented || !post.platform_post_id) continue;
      try {
        const metrics = await provider.fetchMetrics(
          { socialAccountId: post.social_account_id,
            externalAccountId: post.external_account_id,
            accessToken: decryptToken(post.access_token_encrypted) },
          post.platform_post_id);
        for (const m of metrics) {
          // ON CONFLICT uses the unique index added in migration 0007
          await db.query(
            `insert into analytics_snapshots (client_id, scheduled_post_id, platform, metric_type, value)
             values ($1,$2,$3,$4,$5)
             on conflict (scheduled_post_id, metric_type)
             do update set value = excluded.value, captured_at = now()`,
            [post.client_id, post.id, post.p, m.metricType, m.value]);
        }
      } catch (e) {
        console.error('[analytics] pull failed', { post: post.id, error: (e as Error).message });
      }
    }
  });
}

if (require.main === module) {
  // Health server starts first so Render's health check passes while pg-boss connects
  const port = parseInt(process.env.PORT ?? '10000', 10);
  createServer((_, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ service: 'publisher', status: 'ok' }));
  }).listen(port, () => {
    console.log(`[publisher] health on :${port}`);
    // Start worker after health server is bound
    if (!process.env.DATABASE_URL_SERVICE) {
      console.warn('[publisher] DATABASE_URL_SERVICE not set — skipping pg-boss start');
      return;
    }
    start().catch((e) => { console.error('[publisher] fatal:', e); });
  });
}
