/** SocialPublishingProvider abstraction (spec §9). One implementation per platform. */

export interface ConnectedAccount {
  socialAccountId: string;
  externalAccountId: string;      // page id / channel id / org urn
  accessToken: string;            // decrypted just-in-time inside the worker only
}

export interface PublishInput {
  caption: string | null;
  mediaUrl: string;               // signed URL to approved asset
  mediaType: 'image' | 'video';
}

export interface PublishOutcome {
  platformPostId: string;
  /** Verbatim platform response, stored in scheduled_posts.publish_response (spec §1.4, §9). */
  rawResponse: unknown;
}

export interface MetricSample {
  metricType: string;             // reach | impressions | likes | clicks | ...
  value: number;
}

export interface SocialPublishingProvider {
  readonly platform: 'instagram' | 'facebook' | 'youtube' | 'linkedin' | 'tiktok' | 'x';
  readonly implemented: boolean;  // false => UI shows "Not yet implemented" (spec §9 note)
  publish(account: ConnectedAccount, input: PublishInput): Promise<PublishOutcome>;
  fetchMetrics(account: ConnectedAccount, platformPostId: string): Promise<MetricSample[]>;
  refreshToken?(refreshToken: string): Promise<{ accessToken: string; expiresAt: Date; refreshToken?: string }>;
}

export class PublishError extends Error {
  constructor(platform: string, public readonly status: number | null, detail: string,
              public readonly rawResponse?: unknown) {
    super(`${platform} publish failed${status ? ` (HTTP ${status})` : ''}: ${detail}`);
    this.name = 'PublishError';
  }
}
