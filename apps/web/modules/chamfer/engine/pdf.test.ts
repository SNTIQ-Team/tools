import assert from 'node:assert/strict';
import test from 'node:test';
import { downloadLetterPdf } from './pdf';
import type { ComposedLetter } from './compose';
const letter = { layout: 'letter', senderBlock: ['Synthetic'], recipientBlock: ['Synthetic'], body: 'Synthetic', date: '30.09.2026', subject: 'Test', signatureName: 'Test' } as ComposedLetter;
test('stalled document response headers and body release caller with unavailable', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const original = globalThis.fetch;
  try {
    for (const phase of ['headers', 'body']) {
      let signal: AbortSignal | undefined;
      globalThis.fetch = async (_url, options) => {
        signal = options?.signal as AbortSignal;
        if (phase === 'headers') return new Promise<Response>(() => {});
        return { ok: true, blob: () => new Promise<Blob>(() => {}) } as Response;
      };
      let completed: unknown;
      const promise = downloadLetterPdf(letter).then(result => { completed = result; });
      await Promise.resolve(); await Promise.resolve();
      t.mock.timers.tick(120_000);
      await new Promise<void>(resolve => setImmediate(resolve));
      assert.equal(completed, 'unavailable', phase + ' deadline');
      assert.equal(signal?.aborted, true);
      await promise;
    }
  } finally { globalThis.fetch = original; }
});

