import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@platform/core'],
  serverExternalPackages: ['pg', 'pg-boss'],
};

export default withSentryConfig(config, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: '/monitoring',
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: false,
});
