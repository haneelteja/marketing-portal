export { InstagramProvider, FacebookProvider, NotImplementedProvider } from './meta';
export { YouTubeProvider } from './youtube';
export { LinkedInProvider } from './linkedin';
export type {
  SocialPublishingProvider,
  ConnectedAccount,
  PublishInput,
  PublishOutcome,
  MetricSample,
} from './types';
export { PublishError } from './types';

import type { SocialPublishingProvider } from './types';
import { InstagramProvider, FacebookProvider, NotImplementedProvider } from './meta';
import { YouTubeProvider } from './youtube';
import { LinkedInProvider } from './linkedin';

/**
 * Return the correct SocialPublishingProvider implementation for a platform.
 * tiktok and x return a NotImplementedProvider that surfaces an honest error.
 */
export function getPublishingProvider(platform: string): SocialPublishingProvider {
  switch (platform) {
    case 'instagram':
      return new InstagramProvider();
    case 'facebook':
      return new FacebookProvider();
    case 'youtube':
      return new YouTubeProvider();
    case 'linkedin':
      return new LinkedInProvider();
    case 'tiktok':
      return new NotImplementedProvider('tiktok');
    case 'x':
      return new NotImplementedProvider('x');
    default:
      throw new Error(`Unknown platform: ${platform}`);
  }
}
