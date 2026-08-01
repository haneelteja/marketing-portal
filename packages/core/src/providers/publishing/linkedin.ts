import {
  SocialPublishingProvider,
  ConnectedAccount,
  PublishInput,
  PublishOutcome,
  MetricSample,
  PublishError,
} from './types';

const LI_API = 'https://api.linkedin.com/v2';
const LI_VERSION = '202304';

interface LinkedInRegisterResponse {
  value?: {
    asset?: string;
    uploadMechanism?: {
      'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'?: {
        uploadUrl?: string;
      };
    };
  };
  message?: string;
}

interface LinkedInShareStatistics {
  impressionCount?: number;
  clickCount?: number;
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
}

interface LinkedInStatsResponse {
  elements?: Array<{ totalShareStatistics?: LinkedInShareStatistics }>;
  message?: string;
}

/**
 * LinkedIn organization-page publishing.
 *
 * ADR-0003: uses w_organization_social scope, ugcPosts API.
 * Flow: register upload → binary PUT → create ugcPost.
 */
export class LinkedInProvider implements SocialPublishingProvider {
  readonly platform = 'linkedin' as const;
  readonly implemented = true;

  async publish(account: ConnectedAccount, input: PublishInput): Promise<PublishOutcome> {
    const assetUrn = await this.uploadMedia(account, input);
    return this.createPost(account, input, assetUrn);
  }

  private async uploadMedia(
    account: ConnectedAccount,
    input: PublishInput,
  ): Promise<string> {
    const recipe =
      input.mediaType === 'image'
        ? 'urn:li:digitalmediaRecipe:feedshare-image'
        : 'urn:li:digitalmediaRecipe:feedshare-video';

    // Step 1: register the upload to get an upload URL + asset URN
    const registerRes = await fetch(`${LI_API}/assets?action=registerUpload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': LI_VERSION,
      },
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: [recipe],
          owner: `urn:li:organization:${account.externalAccountId}`,
          serviceRelationships: [
            {
              relationshipType: 'OWNER',
              identifier: 'urn:li:userGeneratedContent',
            },
          ],
        },
      }),
    });

    const registerData = (await registerRes.json()) as LinkedInRegisterResponse;
    if (!registerRes.ok) {
      throw new PublishError(
        this.platform,
        registerRes.status,
        registerData?.message ?? 'LinkedIn media registration failed',
        registerData,
      );
    }

    const uploadUrl =
      registerData.value?.uploadMechanism?.[
        'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
      ]?.uploadUrl;
    const assetUrn = registerData.value?.asset;

    if (!uploadUrl || !assetUrn) {
      throw new PublishError(
        this.platform,
        null,
        'LinkedIn did not return an upload URL or asset URN',
        registerData,
      );
    }

    // Step 2: upload the binary to the signed URL
    const mediaRes = await fetch(input.mediaUrl);
    if (!mediaRes.ok) {
      throw new PublishError(
        this.platform,
        mediaRes.status,
        'Could not fetch media from storage URL',
      );
    }
    const blob = await mediaRes.blob();

    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        'Content-Type': blob.type || 'application/octet-stream',
      },
      body: blob,
    });

    if (!uploadRes.ok) {
      throw new PublishError(
        this.platform,
        uploadRes.status,
        'LinkedIn binary upload failed',
      );
    }

    return assetUrn;
  }

  private async createPost(
    account: ConnectedAccount,
    input: PublishInput,
    assetUrn: string,
  ): Promise<PublishOutcome> {
    const mediaCategory = input.mediaType === 'image' ? 'IMAGE' : 'VIDEO';

    const body = {
      author: `urn:li:organization:${account.externalAccountId}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: input.caption ?? '' },
          shareMediaCategory: mediaCategory,
          media: [
            {
              status: 'READY',
              description: { text: '' },
              media: assetUrn,
            },
          ],
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    };

    const res = await fetch(`${LI_API}/ugcPosts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': LI_VERSION,
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    // LinkedIn returns the post URN in the x-restli-id header
    const postId = res.headers.get('x-restli-id') ?? data?.id;

    if (!res.ok || !postId) {
      throw new PublishError(
        this.platform,
        res.status,
        data?.message ?? 'LinkedIn post creation failed',
        data,
      );
    }

    return { platformPostId: postId, rawResponse: data };
  }

  async fetchMetrics(
    account: ConnectedAccount,
    platformPostId: string,
  ): Promise<MetricSample[]> {
    const encoded = encodeURIComponent(platformPostId);
    const res = await fetch(
      `${LI_API}/organizationalEntityShareStatistics` +
        `?q=organizationalEntity` +
        `&organizationalEntity=urn:li:organization:${account.externalAccountId}` +
        `&shares=List(${encoded})`,
      {
        headers: {
          Authorization: `Bearer ${account.accessToken}`,
          'LinkedIn-Version': LI_VERSION,
        },
      },
    );
    const data = (await res.json()) as LinkedInStatsResponse;
    if (!res.ok) {
      throw new PublishError(
        this.platform,
        res.status,
        data?.message ?? 'LinkedIn metrics failed',
        data,
      );
    }
    const stats = data.elements?.[0]?.totalShareStatistics ?? {};
    return [
      { metricType: 'impressions', value: Number(stats.impressionCount ?? 0) },
      { metricType: 'clicks', value: Number(stats.clickCount ?? 0) },
      { metricType: 'likes', value: Number(stats.likeCount ?? 0) },
      { metricType: 'comments', value: Number(stats.commentCount ?? 0) },
      { metricType: 'shares', value: Number(stats.shareCount ?? 0) },
    ];
  }

  async refreshToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; expiresAt: Date; refreshToken?: string }> {
    const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      }),
    });
    const data = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error_description?: string;
    };
    if (!res.ok || !data.access_token) {
      throw new PublishError(
        this.platform,
        res.status,
        data?.error_description ?? 'Token refresh failed',
        data,
      );
    }
    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
      refreshToken: data.refresh_token,
    };
  }
}
