// eslint-disable-next-line @typescript-eslint/no-require-imports
const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'fastly.picsum.photos' },
    ],
    unoptimized: true,
  },
};

// Sentry build-time integration. Active when SENTRY_AUTH_TOKEN is set
// (for source map upload). At runtime, Sentry SDK init is no-op when
// SENTRY_DSN is unset (see sentry.{client,server,edge}.config.ts).
const sentryWebpackPluginOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Don't upload source maps in CI/dev when auth token is unset —
  // skip silently rather than failing the build.
  silent: !process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },

  // Hide source maps from public bundles. Sentry still reads them
  // via the upload path; browsers don't fetch them.
  hideSourceMaps: true,
};

module.exports = withSentryConfig(nextConfig, sentryWebpackPluginOptions);
