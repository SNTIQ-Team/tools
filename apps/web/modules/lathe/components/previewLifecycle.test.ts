import test from 'node:test';
import assert from 'node:assert/strict';
import { PreviewQueue } from './previewLifecycle';

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const tick = () => new Promise<void>(resolve => setImmediate(resolve));

test('cancellation stops rendering and waits for document destruction before reusing the canvas', async () => {
  const queue = new PreviewQueue();
  const rendered = deferred();
  const destroyed = deferred();
  let cancelled = 0, destroys = 0, nextStarted = false;
  const first = queue.start(async job => {
    job.trackLoading({ destroy: () => { destroys++; return destroyed.promise; } });
    const task = { promise: rendered.promise, cancel: () => { cancelled++; rendered.reject(new Error('cancelled')); } };
    job.trackRender(task);
    await task.promise;
  });
  await tick();
  first.cancel();
  const failed = assert.rejects(first.settled, /cancelled/);
  const second = queue.start(async () => { nextStarted = true; });
  await tick();
  assert.equal(cancelled, 1);
  assert.equal(destroys, 1);
  assert.equal(nextStarted, false);
  destroyed.resolve();
  await failed;
  await second.settled;
  assert.equal(nextStarted, true);
  assert.equal(destroys, 1);
});

test('cancelled loading and resources registered after cancellation are destroyed exactly once', async () => {
  const queue = new PreviewQueue();
  const delay = deferred();
  let destroys = 0;
  const handle = queue.start(async job => {
    await delay.promise;
    job.trackLoading({ destroy: async () => { destroys++; } });
  });
  await tick();
  handle.cancel();
  delay.resolve();
  await handle.settled;
  handle.cancel();
  assert.equal(destroys, 1);
});

test('cancelling during document loading destroys its worker and preserves queue progress', async () => {
  const queue = new PreviewQueue();
  const loading = deferred();
  let destroys = 0, nextStarted = false;
  const handle = queue.start(async job => {
    job.trackLoading({ destroy: async () => {
      destroys++;
      loading.reject(new Error('Loading aborted'));
    } });
    await loading.promise;
  });
  await tick();
  handle.cancel();
  const next = queue.start(async () => { nextStarted = true; });
  await assert.rejects(handle.settled, /Loading aborted/);
  await next.settled;
  assert.equal(destroys, 1);
  assert.equal(nextStarted, true);
});

test('cancellation does not depend on the loading promise rejecting after worker destruction', async () => {
  const queue = new PreviewQueue();
  let destroys = 0, nextStarted = false;
  const handle = queue.start(async job => {
    job.trackLoading({ destroy: async () => { destroys++; } });
    await job.wait(new Promise<void>(() => {}));
  });
  await tick();
  handle.cancel();
  const next = queue.start(async () => { nextStarted = true; });
  await assert.rejects(handle.settled, { name: 'AbortError' });
  await next.settled;
  assert.equal(destroys, 1);
  assert.equal(nextStarted, true);
});

test('canvas ownership waits for render settlement even when worker destruction fails', async () => {
  const queue = new PreviewQueue();
  const rendered = deferred();
  let nextStarted = false;
  const first = queue.start(async job => {
    job.trackLoading({ destroy: async () => { throw new Error('destroy failed'); } });
    job.trackRender({ promise: rendered.promise, cancel() {} });
    await job.wait(rendered.promise);
  });
  await tick();
  first.cancel();
  const failed = assert.rejects(first.settled, /destroy failed/);
  const next = queue.start(async () => { nextStarted = true; });
  await tick();
  assert.equal(nextStarted, false);
  rendered.resolve();
  await failed;
  await next.settled;
  assert.equal(nextStarted, true);
});

test('successful preview destroys its loading task and a cancelled queued job never starts', async () => {
  const queue = new PreviewQueue();
  const delay = deferred();
  let destroys = 0, skippedStarted = false;
  const first = queue.start(async job => {
    job.trackLoading({ destroy: async () => { destroys++; } });
    await delay.promise;
  });
  const skipped = queue.start(async () => { skippedStarted = true; });
  skipped.cancel();
  delay.resolve();
  await first.settled;
  await skipped.settled;
  assert.equal(destroys, 1);
  assert.equal(skippedStarted, false);
});

test('a loading failure releases the worker and does not block subsequent previews', async () => {
  const queue = new PreviewQueue();
  let destroys = 0, nextStarted = false;
  const failed = queue.start(async job => {
    job.trackLoading({ destroy: async () => { destroys++; } });
    throw new Error('load failed');
  });
  const second = queue.start(async () => { nextStarted = true; });
  await assert.rejects(failed.settled, /load failed/);
  await second.settled;
  assert.equal(destroys, 1);
  assert.equal(nextStarted, true);
});
