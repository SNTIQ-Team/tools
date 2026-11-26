import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

// The pages import a CSS module (documentPage.module.css): stub stylesheets
// before loading them, as the other module tests do.
const require = createRequire(import.meta.url);
require.extensions['.css'] = module => { module.exports = {}; };
const { default: DecisionPage, generateMetadata: decisionMetadata } = require('../../app/dt/kerf/entscheidungen/[id]/page');
const { default: AmendmentPage, generateMetadata: amendmentMetadata } = require('../../app/dt/kerf/aenderungen/[documentId]/page');

test('permalink pages and metadata reserve not-found behavior for upstream404', async () => {
  const original = globalThis.fetch;
  try {
    for (const invoke of [
      () => DecisionPage({ params: Promise.resolve({ id: 'synthetic' }) }),
      () => AmendmentPage({ params: Promise.resolve({ documentId: 'synthetic' }) }),
    ]) {
      globalThis.fetch = async () => new Response('', { status: 404 });
      await assert.rejects(invoke, { digest: 'NEXT_HTTP_ERROR_FALLBACK;404' });
      globalThis.fetch = async () => new Response('', { status: 503 });
      await assert.rejects(invoke, (error: any) => error.kind === 'http' && error.status === 503);
    }
    for (const invoke of [
      () => decisionMetadata({ params: Promise.resolve({ id: 'synthetic' }) }),
      () => amendmentMetadata({ params: Promise.resolve({ documentId: 'synthetic' }) }),
    ]) {
      globalThis.fetch = async () => { throw new TypeError('network unavailable'); };
      await assert.rejects(invoke, (error: any) => error.kind === 'network');
    }
  } finally { globalThis.fetch = original; }
});

