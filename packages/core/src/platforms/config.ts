export type SocialPlatform = 'instagram' | 'facebook' | 'youtube' | 'linkedin' | 'tiktok' | 'x';

export interface MediaConstraints {
  maxSizeBytes: number;
  allowedMimeTypes: string[];
  minAspectRatio?: number;
  maxAspectRatio?: number;
  recommendedAspectRatios: string[];
  minWidthPx?: number;
  minHeightPx?: number;
}

export interface PlatformConfig {
  platform: SocialPlatform;
  label: string;
  captionLimit: number;
  hashtagLimit: number;
  mentionLimit: number;
  linkInCaption: boolean;
  supportsCarousel: boolean;
  supportsVideo: boolean;
  supportsAudio: boolean;
  supportsStories: boolean;
  image: MediaConstraints;
  video: MediaConstraints;
  postingNotes: string;
}

export const PLATFORM_CONFIGS: Record<SocialPlatform, PlatformConfig> = {
  instagram: {
    platform: 'instagram',
    label: 'Instagram',
    captionLimit: 2200,
    hashtagLimit: 30,
    mentionLimit: 20,
    linkInCaption: false,
    supportsCarousel: true,
    supportsVideo: true,
    supportsAudio: false,
    supportsStories: true,
    image: {
      maxSizeBytes: 8 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png'],
      recommendedAspectRatios: ['1:1', '4:5', '9:16'],
      minWidthPx: 320,
      minAspectRatio: 0.8,
      maxAspectRatio: 1.91,
    },
    video: {
      maxSizeBytes: 100 * 1024 * 1024,
      allowedMimeTypes: ['video/mp4'],
      recommendedAspectRatios: ['1:1', '4:5', '9:16'],
      minWidthPx: 720,
    },
    postingNotes: 'Links in captions are not clickable — put the link in bio. First comment is a good place for extra hashtags.',
  },

  facebook: {
    platform: 'facebook',
    label: 'Facebook',
    captionLimit: 63206,
    hashtagLimit: 30,
    mentionLimit: 50,
    linkInCaption: true,
    supportsCarousel: true,
    supportsVideo: true,
    supportsAudio: false,
    supportsStories: true,
    image: {
      maxSizeBytes: 10 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif'],
      recommendedAspectRatios: ['1.91:1', '1:1', '4:5'],
      minWidthPx: 200,
    },
    video: {
      maxSizeBytes: 4 * 1024 * 1024 * 1024,
      allowedMimeTypes: ['video/mp4', 'video/mov'],
      recommendedAspectRatios: ['16:9', '1:1', '4:5', '9:16'],
    },
    postingNotes: 'Organic reach is low — boosting is often required. Short video (under 3 min) outperforms long-form.',
  },

  linkedin: {
    platform: 'linkedin',
    label: 'LinkedIn',
    captionLimit: 3000,
    hashtagLimit: 5,
    mentionLimit: 30,
    linkInCaption: true,
    supportsCarousel: true,
    supportsVideo: true,
    supportsAudio: false,
    supportsStories: false,
    image: {
      maxSizeBytes: 5 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif'],
      recommendedAspectRatios: ['1.91:1', '1:1'],
      minWidthPx: 552,
    },
    video: {
      maxSizeBytes: 5 * 1024 * 1024 * 1024,
      allowedMimeTypes: ['video/mp4'],
      recommendedAspectRatios: ['16:9', '1:1', '4:5'],
      minWidthPx: 360,
    },
    postingNotes: 'Keep hashtags to 3–5. Text-only posts often outperform image posts. First 3 lines are shown before "see more" — hook early.',
  },

  youtube: {
    platform: 'youtube',
    label: 'YouTube',
    captionLimit: 5000,
    hashtagLimit: 60,
    mentionLimit: 0,
    linkInCaption: true,
    supportsCarousel: false,
    supportsVideo: true,
    supportsAudio: false,
    supportsStories: false,
    image: {
      maxSizeBytes: 2 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png'],
      recommendedAspectRatios: ['16:9'],
      minWidthPx: 1280,
      minHeightPx: 720,
    },
    video: {
      maxSizeBytes: 256 * 1024 * 1024 * 1024,
      allowedMimeTypes: ['video/mp4', 'video/mov', 'video/avi', 'video/wmv'],
      recommendedAspectRatios: ['16:9'],
      minWidthPx: 1920,
      minHeightPx: 1080,
    },
    postingNotes: 'Thumbnail (16:9, min 1280×720) is the most important click-through driver. First 3 hashtags appear above the title.',
  },

  tiktok: {
    platform: 'tiktok',
    label: 'TikTok',
    captionLimit: 2200,
    hashtagLimit: 30,
    mentionLimit: 20,
    linkInCaption: false,
    supportsCarousel: true,
    supportsVideo: true,
    supportsAudio: true,
    supportsStories: false,
    image: {
      maxSizeBytes: 20 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      recommendedAspectRatios: ['9:16'],
    },
    video: {
      maxSizeBytes: 287 * 1024 * 1024,
      allowedMimeTypes: ['video/mp4', 'video/webm'],
      recommendedAspectRatios: ['9:16', '1:1'],
      minWidthPx: 540,
    },
    postingNotes: 'Vertical 9:16 is mandatory for feed. Hook in the first 1-2 seconds. Original audio dramatically increases discoverability.',
  },

  x: {
    platform: 'x',
    label: 'X (Twitter)',
    captionLimit: 280,
    hashtagLimit: 2,
    mentionLimit: 50,
    linkInCaption: true,
    supportsCarousel: false,
    supportsVideo: true,
    supportsAudio: false,
    supportsStories: false,
    image: {
      maxSizeBytes: 5 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      recommendedAspectRatios: ['16:9', '1:1'],
    },
    video: {
      maxSizeBytes: 512 * 1024 * 1024,
      allowedMimeTypes: ['video/mp4'],
      recommendedAspectRatios: ['16:9', '1:1'],
      minWidthPx: 32,
    },
    postingNotes: 'Character limit includes URLs (t.co shortens to 23 chars). 1-2 hashtags max — more reduces engagement. Thread format performs well for long-form.',
  },
};

export function getPlatformConfig(platform: SocialPlatform): PlatformConfig {
  return PLATFORM_CONFIGS[platform];
}

export function getCaptionLimitForPlatform(platform: SocialPlatform): number {
  return PLATFORM_CONFIGS[platform]?.captionLimit ?? 2200;
}
