import {
  SocialPublishingProvider, ConnectedAccount, PublishInput, PublishOutcome,
  MetricSample, PublishError,
} from './types';

const GRAPH = 'https://graph.facebook.com/v21.0';

/**
 * Instagram publishing via Meta Graph API (Business/Creator account linked to a FB Page).
 * Two-step: create media container -> poll ready -> publish. The real platform response
 * is returned verbatim for the audit trail.
 */
export class InstagramProvider implements SocialPublishingProvider {
  readonly platform = 'instagram' as const;
  readonly implemented = true;

  async publish(account: ConnectedAccount, input: PublishInput): Promise<PublishOutcome> {
    const igUserId = account.externalAccountId;

    const containerRes = await fetch(`${GRAPH}/${igUserId}/media`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...(input.mediaType === 'video'
          ? { media_type: 'REELS', video_url: input.mediaUrl }
          : { image_url: input.mediaUrl }),
        caption: input.caption ?? '',
        access_token: account.accessToken,
      }),
    });
    const container = await containerRes.json();
    if (!containerRes.ok || !container.id) {
      throw new PublishError(this.platform, containerRes.status,
        container?.error?.message ?? 'container creation failed', container);
    }

    // Videos process asynchronously — poll container status before publishing.
    if (input.mediaType === 'video') {
      await this.waitForContainer(container.id, account.accessToken);
    }

    const publishRes = await fetch(`${GRAPH}/${igUserId}/media_publish`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ creation_id: container.id, access_token: account.accessToken }),
    });
    const published = await publishRes.json();
    if (!publishRes.ok || !published.id) {
      throw new PublishError(this.platform, publishRes.status,
        published?.error?.message ?? 'media_publish failed', published);
    }
    return { platformPostId: published.id, rawResponse: { container, published } };
  }

  private async waitForContainer(containerId: string, token: string): Promise<void> {
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 4000));
      const res = await fetch(`${GRAPH}/${containerId}?fields=status_code&access_token=${token}`);
      const data = await res.json();
      if (data.status_code === 'FINISHED') return;
      if (data.status_code === 'ERROR') {
        throw new PublishError(this.platform, null, 'media container processing failed', data);
      }
    }
    throw new PublishError(this.platform, null, 'media container timed out');
  }

  async fetchMetrics(account: ConnectedAccount, platformPostId: string): Promise<MetricSample[]> {
    const res = await fetch(
      `${GRAPH}/${platformPostId}/insights?metric=reach,likes,comments,shares,saved` +
      `&access_token=${account.accessToken}`);
    const data = await res.json();
    if (!res.ok) {
      throw new PublishError(this.platform, res.status,
        data?.error?.message ?? 'insights fetch failed', data);
    }
    return (data.data ?? []).map((m: { name: string; values: Array<{ value: number }> }) => ({
      metricType: m.name,
      value: m.values?.[0]?.value ?? 0,
    }));
  }
}

/** Facebook Page publishing — same Graph API surface, page-level (never personal profile). */
export class FacebookProvider implements SocialPublishingProvider {
  readonly platform = 'facebook' as const;
  readonly implemented = true;

  async publish(account: ConnectedAccount, input: PublishInput): Promise<PublishOutcome> {
    const endpoint = input.mediaType === 'video' ? 'videos' : 'photos';
    const res = await fetch(`${GRAPH}/${account.externalAccountId}/${endpoint}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...(input.mediaType === 'video'
          ? { file_url: input.mediaUrl, description: input.caption ?? '' }
          : { url: input.mediaUrl, caption: input.caption ?? '' }),
        access_token: account.accessToken,
      }),
    });
    const data = await res.json();
    const id = data.post_id ?? data.id;
    if (!res.ok || !id) {
      throw new PublishError(this.platform, res.status,
        data?.error?.message ?? 'page publish failed', data);
    }
    return { platformPostId: id, rawResponse: data };
  }

  async fetchMetrics(account: ConnectedAccount, platformPostId: string): Promise<MetricSample[]> {
    const res = await fetch(
      `${GRAPH}/${platformPostId}/insights?metric=post_impressions,post_clicks` +
      `&access_token=${account.accessToken}`);
    const data = await res.json();
    if (!res.ok) {
      throw new PublishError(this.platform, res.status,
        data?.error?.message ?? 'insights fetch failed', data);
    }
    return (data.data ?? []).map((m: { name: string; values: Array<{ value: number }> }) => ({
      metricType: m.name,
      value: m.values?.[0]?.value ?? 0,
    }));
  }
}

/** Not-yet-implemented platforms surface honestly (spec §9): UI reads `implemented`. */
export class NotImplementedProvider implements SocialPublishingProvider {
  readonly implemented = false;
  constructor(readonly platform: 'tiktok' | 'x') {}
  async publish(): Promise<never> {
    throw new PublishError(this.platform, null,
      `${this.platform} publishing is not yet implemented.`);
  }
  async fetchMetrics(): Promise<never> {
    throw new PublishError(this.platform, null,
      `${this.platform} analytics is not yet implemented.`);
  }
}
