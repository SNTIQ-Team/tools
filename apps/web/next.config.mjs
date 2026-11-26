import path from 'node:path';
import { fileURLToPath } from 'node:url';

const monorepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { cpus: 2 },
  // Pin file tracing to the workspace root (stray lockfiles elsewhere confuse the default)
  outputFileTracingRoot: monorepoRoot,
  // Real HTTP status codes are native: notFound() -> 404, error boundaries -> 500
  poweredByHeader: false,
  reactStrictMode: true,
  // Resolve metadata before the shell for every user agent (the option names
  // the agents that get blocking metadata). Streamed metadata put <title>,
  // <meta> and the canonical link into <body>, behind a hidden Suspense
  // outlet revealed later by an inline script; crawlers that read the HTML
  // as served saw no head metadata.
  htmlLimitedBots: /.*/,
  async headers() {
    return [{
      // The pdf.js runtime sits under its version number, so a file there
      // never changes: browsers keep it instead of asking again each visit.
      source: '/pdfjs/:version/:file*',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    }];
  },
};

export default nextConfig;
