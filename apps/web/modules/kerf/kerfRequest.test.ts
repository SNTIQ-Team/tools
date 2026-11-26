import assert from 'node:assert/strict';
import test from 'node:test';
import { KerfRequestError, kerfGetJson, kerfRequest, toKerfRequestError } from './kerfRequest';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
/** A server that accepts the connection and never answers — until aborted. */
const stalled: typeof fetch = (_url, init) => new Promise<Response>((_, reject) => {
  init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
});

test('a stalled server rejects with a typed timeout instead of hanging', async () => {
  const started = Date.now();
  await assert.rejects(kerfGetJson('https://api.test/kerf/acts/fed_sgb_2', { fetchImpl: stalled, timeoutMs: 40 }), (error: unknown) => {
    assert.ok(error instanceof KerfRequestError);
    assert.equal(error.kind, 'timeout');
    assert.equal(error.timeoutMs, 40);
    return true;
  });
  assert.ok(Date.now() - started < 1000);
});

test('the deadline also applies when fetch ignores abort (no endless spinner)', async () => {
  const deaf: typeof fetch = () => new Promise<Response>(() => {});
  await assert.rejects(kerfGetJson('https://api.test/x', { fetchImpl: deaf, timeoutMs: 30 }), { kind: 'timeout' });
});

test('a body that stalls after the headers hits the body deadline', async () => {
  const slowBody: typeof fetch = async (_url, init) => {
    const stream = new ReadableStream({ start(controller) {
      controller.enqueue(new TextEncoder().encode('{"a":'));
      init?.signal?.addEventListener('abort', () => controller.error(new DOMException('aborted', 'AbortError')));
    } });
    return new Response(stream, { headers: { 'content-type': 'application/json' } });
  };
  await assert.rejects(kerfGetJson('https://api.test/x', { fetchImpl: slowBody, timeoutMs: 1000, bodyTimeoutMs: 40 }), (error: unknown) => {
    assert.equal((error as KerfRequestError).kind, 'timeout');
    assert.equal((error as KerfRequestError).timeoutMs, 40);
    return true;
  });
});

test('the caller can cancel: the request is aborted and typed as aborted', async () => {
  const controller = new AbortController();
  let seen: AbortSignal | undefined;
  const capture: typeof fetch = (url, init) => { seen = init?.signal ?? undefined; return stalled(url, init); };
  const pending = kerfGetJson('https://api.test/x', { fetchImpl: capture, signal: controller.signal, timeoutMs: 5000 });
  controller.abort();
  await assert.rejects(pending, { kind: 'aborted' });
  assert.equal(seen?.aborted, true);
});

test('HTTP failures are typed with their status; 404 is not_found', async () => {
  await assert.rejects(kerfGetJson('https://api.test/x', { fetchImpl: async () => json({ detail: 'x' }, 503) }), { kind: 'http', status: 503 });
  await assert.rejects(kerfGetJson('https://api.test/x', { fetchImpl: async () => json({ detail: 'Not Found' }, 404) }), { kind: 'not_found', status: 404 });
  await assert.rejects(kerfGetJson('https://api.test/x', { fetchImpl: async () => new Response('<html>', { headers: { 'content-type': 'text/html' } }) }), { kind: 'invalid' });
  await assert.rejects(kerfGetJson('https://api.test/x', { fetchImpl: async () => { throw new TypeError('Failed to fetch'); } }), { kind: 'network' });
});

test('successful reads resolve and clear their timers', async () => {
  assert.deepEqual(await kerfGetJson('https://api.test/x', { fetchImpl: async () => json({ ok: 1 }), timeoutMs: 20, bodyTimeoutMs: 20 }), { ok: 1 });
  assert.equal(await kerfRequest('https://api.test/x', async res => res.status, { fetchImpl: async () => json({}, 202) }), 202);
});

test('legacy thrown errors are normalised', () => {
  assert.equal(toKerfRequestError(new Error('kerf: HTTP 404')).kind, 'not_found');
  assert.equal(toKerfRequestError(new Error('kerf: HTTP 502')).status, 502);
  assert.equal(toKerfRequestError(new DOMException('x', 'AbortError')).kind, 'aborted');
  assert.equal(toKerfRequestError(new SyntaxError('bad json')).kind, 'invalid');
});
