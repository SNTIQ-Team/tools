import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { createRequire } from 'node:module';
import { renderToStaticMarkup } from 'react-dom/server';
import { acquireShared, dropShared, type SharedCache } from './readerResources';
import { KerfRequestError } from './kerfRequest';

const require = createRequire(import.meta.url);
require.extensions['.css'] = module => { module.exports = {}; };
const loadStatus = () => import('./LoadStatus');

const flush = () => new Promise(resolve => setImmediate(resolve));

test('panes share one request; the last one leaving aborts it after the grace period', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const cache: SharedCache<string> = new Map();
  const signals: AbortSignal[] = [];
  const load = (signal: AbortSignal) => { signals.push(signal); return new Promise<string>(() => {}); };
  const a = acquireShared(cache, 'fed_sgb_2', load);
  const b = acquireShared(cache, 'fed_sgb_2', load);
  assert.equal(signals.length, 1);
  assert.equal(a.promise, b.promise);
  a.release();
  t.mock.timers.tick(5000);
  assert.equal(signals[0].aborted, false, 'still used by the second pane');
  b.release();
  t.mock.timers.tick(1000);
  assert.equal(signals[0].aborted, false, 'grace period: a remount may reuse it');
  const c = acquireShared(cache, 'fed_sgb_2', load);
  t.mock.timers.tick(5000);
  assert.equal(signals.length, 1);
  assert.equal(signals[0].aborted, false);
  c.release();
  t.mock.timers.tick(1600);
  assert.equal(signals[0].aborted, true);
  assert.equal(cache.has('fed_sgb_2'), false);
});

test('a failed load is evicted so Retry issues a new request; a settled one is never aborted', async () => {
  const cache: SharedCache<string> = new Map();
  let calls = 0;
  const failing = acquireShared(cache, 'x', async () => { calls += 1; throw new KerfRequestError('timeout', { timeoutMs: 30000 }); });
  await assert.rejects(failing.promise, { kind: 'timeout' });
  await flush();
  assert.equal(cache.has('x'), false);
  const ok = acquireShared(cache, 'x', async signal => { calls += 1; assert.equal(signal.aborted, false); return 'text'; });
  assert.equal(await ok.promise, 'text');
  ok.release();
  assert.equal(calls, 2);
  assert.equal(cache.has('x'), true, 'results stay cached for other panes');
  dropShared(cache, 'x');
  assert.equal(cache.has('x'), false);
});

test('dropShared keeps a running request that another pane still waits for', () => {
  const cache: SharedCache<string> = new Map();
  let signal: AbortSignal | undefined;
  const a = acquireShared(cache, 'k', s => { signal = s; return new Promise<string>(() => {}); });
  acquireShared(cache, 'k', () => new Promise<string>(() => {}));
  dropShared(cache, 'k');
  assert.equal(signal?.aborted, false);
  a.release();
});

test('load errors are explained, not echoed', async () => {
  const { loadErrorText } = await loadStatus();
  assert.match(loadErrorText(new KerfRequestError('timeout', { timeoutMs: 30000 }), 'de'), /30 Sekunden/);
  assert.match(loadErrorText(new KerfRequestError('http', { status: 503 }), 'en'), /HTTP 503/);
  assert.match(loadErrorText(new KerfRequestError('not_found', { status: 404 }), 'ru'), /404/);
  assert.match(loadErrorText(new KerfRequestError('network'), 'ua'), /Мережева/);
});

test('LoadStatus renders a retryable alert on error and a status while loading', async () => {
  const { default: LoadStatus } = await loadStatus();
  const error = renderToStaticMarkup(<LoadStatus loading={false} error={new KerfRequestError('timeout', { timeoutMs: 30000 })} language="de" title="Dokument konnte nicht geladen werden" onRetry={() => {}} />);
  assert.match(error, /role="alert"/);
  assert.match(error, /data-load-error="timeout"/);
  assert.match(error, /Erneut versuchen/);
  const loading = renderToStaticMarkup(<LoadStatus loading error={null} language="en" label="Loading provisions" />);
  assert.match(loading, /role="status"/);
  assert.match(loading, /Loading provisions/);
  assert.doesNotMatch(loading, /0 provisions/);
  assert.equal(renderToStaticMarkup(<LoadStatus loading={false} error={null} language="en" />), '');
});
