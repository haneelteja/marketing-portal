import {
  SocialPublishingProvider,
  ConnectedAccount,
  PublishInput,
  PublishOutcome,
  MetricSample,
  PublishError,
} from './types';

const YT_API = 'https://www.googleapis.com/youtube/v3';
const YT_UPLOAD = 'https://www.googleapis.com/upload/youtube/v3';

interface YouTubeErrorResponse {
  error?: { message?: string };
}

interface YouTubeStatistics {
  viewCount?: string;
  likeCount?: string;
  commentCount?: string;
}

interface YouTubeVideoListResponse {
  items?: Array<{ statistics: YouTubeStatistics }>;
  error?: { message?: string };
}

/**
 * YouTube publishing via Data API v3.
 *
 * Videos use the resumable upload API:
 *   1. POST metadata to initiate session → get upload URL
 *   2. PUT binary to upload URL → get video resource with id
 *
 * Images are not supported as standalone posts on YouTube.
 * Callers should gate this at the schedule layer.
 */
export class YouTubeProvider implements SocialPublishingProvider {
  readonly platform = 'youtube' as const;
  readonly implemented = true;

  async publish(account: ConnectedAccount, input: PublishInput): Promise<PublishOutcome> {
    if (input.mediaType === 'image') {
      throw new PublishError(
        this.platform,
        null,
        'YouTube does not support standalone image posts. Use video content for YouTube.',
      );
    }
    return this.uploadVideo(account, input);
  }

  private async uploadVideo(
    account: ConnectedAccount,
    input: PublishInput,
  ): Promise<PublishOutcome> {
    // Step 1: fetch the video bytes from the signed storage URL
    const mediaRes = await fetch(input.mediaUrl);
    if (!mediaRes.ok) {
      throw new PublishError(
        this.platform,
        mediaRes.status,
        'Could not fetch video from storage URL',
      );
    }
    const mediaBlob = await mediaRes.blob();
    const contentLength = mediaBlob.size;
    const contentType = mediaBlob.type || 'video/mp4';

    // Step 2: initiate resumable upload session
    const metadata = {
      snippet: {
        title: input.caption ?? 'New video',
        description: input.caption ?? '',
      },
      status: { privacyStatus: 'public' },
    };

    const initRes = await fetch(
      `${YT_UPLOAD}/videos?uploadType=resumable&part=snippet,status`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${account.accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': contentType,
          'X-Upload-Content-Length': String(contentLength),
        },
        body: JSON.stringify(metadata),
      },
    );

    if (!initRes.ok) {
      const err = (await initRes.json().catch(() => ({}))) as YouTubeErrorResponse;
      throw new PublishError(
        this.platform,
        initRes.status,
        err?.error?.message ?? 'Resumable upload session initiation failed',
        err,
      );
    }

    const uploadUrl = initRes.headers.get('Location');
    if (!uploadUrl) {
      throw new PublishError(this.platform, null, 'No upload URL returned from YouTube');
    }

    // Step 3: stream the video bytes to the resumable upload URL
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(contentLength),
      },
      body: mediaBlob,
    });

    const uploaded = (await uploadRes.json().catch(() => ({}))) as {
      id?: string;
      error?: { message?: string };
    };

    // 308 Resume Incomplete is not an error — the upload was accepted but not yet complete.
    if (!uploadRes.ok && uploadRes.status !== 308) {
      throw new PublishError(
        this.platform,
        uploadRes.status,
        uploaded?.error?.message ?? 'Video upload failed',
        uploaded,
      );
    }

    const videoId = uploaded.id;
    if (!videoId) {
      throw new PublishError(
        this.platform,
        null,
        'YouTube did not return a video ID',
        uploaded,
      );
    }

    return { platformPostId: videoId, rawResponse: uploaded };
  }

  async fetchMetrics(
    account: ConnectedAccount,
    platformPostId: string,
  ): Promise<MetricSample[]> {
    const res = await fetch(
      `${YT_API}/videos?part=statistics&id=${platformPostId}`,
      { headers: { Authorization: `Bearer ${account.accessToken}` } },
    );
    const data = (await res.json()) as YouTubeVideoListResponse;
    if (!res.ok) {
      throw new PublishError(
        this.platform,
        res.status,
        data?.error?.message ?? 'Stats fetch failed',
        data,
      );
    }
    const stats = data.items?.[0]?.statistics ?? {};
    return [
      { metricType: 'views', value: Number(stats.viewCount ?? 0) },
      { metricType: 'likes', value: Number(stats.likeCount ?? 0) },
      { metricType: 'comments', value: Number(stats.commentCount ?? 0) },
    ];
  }

  async refreshToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; expiresAt: Date; refreshToken?: string }> {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
        client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      }),
    });
    const data = (await res.json()) as {
      access_token?: string;
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
    };
  }
}
