'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { kerfAct, kerfActArchive, kerfActMarkdown, kerfCitations, type KerfActArchive, type KerfActMarkdown, type KerfActDetail, type KerfStatutoryCitation } from './client';
import { KERF_SLOW_HINT_MS, KerfRequestError, toKerfRequestError } from './kerfRequest';

/**
 * Shared reader resources. Several panes (and the sidebar) read the same act,
 * so one request serves all of them. Each subscriber holds a reference; when
 * the last one leaves while the request is still running, the request is
 * aborted after a short grace period (tab switches and React's double mount
 * reuse it), which spares the single-worker API work nobody waits for.
 */
type Entry<T> = { promise: Promise<T>; expires: number; controller: AbortController; users: number; settled: boolean; release?: ReturnType<typeof setTimeout> };
export type SharedCache<T> = Map<string, Entry<T>>;
const laws: SharedCache<KerfActDetail> = new Map();
const references: SharedCache<KerfStatutoryCitation[]> = new Map();
const archives: SharedCache<KerfActArchive> = new Map();
const editions: SharedCache<KerfActMarkdown> = new Map();
const TTL_MS = 300_000;
const RELEASE_GRACE_MS = 1_500;
const MAX_ENTRIES = 48;

export function acquireShared<T>(cache: SharedCache<T>, key: string, load: (signal: AbortSignal) => Promise<T>): { promise: Promise<T>; release: () => void } {
  let entry = cache.get(key);
  if (!entry || (entry.settled && entry.expires <= Date.now())) {
    const controller = new AbortController();
    const created: Entry<T> = { promise: load(controller.signal), expires: Date.now() + TTL_MS, controller, users: 0, settled: false };
    created.promise.then(() => { created.settled = true; }, () => { created.settled = true; if (cache.get(key) === created) cache.delete(key); });
    cache.set(key, created);
    if (cache.size > MAX_ENTRIES) {
      for (const [oldKey, old] of cache) { if (old.users === 0 && old !== created) { cache.delete(oldKey); break; } }
    }
    entry = created;
  }
  const current = entry;
  current.users += 1;
  if (current.release) { clearTimeout(current.release); current.release = undefined; }
  let released = false;
  return {
    promise: current.promise,
    release: () => {
      if (released) return;
      released = true;
      current.users -= 1;
      if (current.users > 0 || current.settled) return;
      current.release = setTimeout(() => {
        if (current.users > 0 || current.settled) return;
        current.controller.abort();
        if (cache.get(key) === current) cache.delete(key);
      }, RELEASE_GRACE_MS);
    },
  };
}

/** Forget the shared request for this key. A running request is aborted
 * only when nobody else is waiting for it. */
export function dropShared<T>(cache: SharedCache<T>, key: string) {
  const entry = cache.get(key);
  if (!entry) return;
  if (!entry.settled && entry.users <= 1) entry.controller.abort();
  cache.delete(key);
}

/** Retry and cancel are shared too: every pane waiting on (or failed with)
 * the same key follows the user's action, so the sidebar and the document
 * never disagree about whether a law is still loading. */
type SharedAction = 'retry' | 'cancel';
const actionListeners = new WeakMap<SharedCache<unknown>, Map<string, Set<(action: SharedAction) => void>>>();
export function onSharedAction<T>(cache: SharedCache<T>, key: string, listener: (action: SharedAction) => void): () => void {
  let byKey = actionListeners.get(cache as SharedCache<unknown>);
  if (!byKey) { byKey = new Map(); actionListeners.set(cache as SharedCache<unknown>, byKey); }
  const set = byKey.get(key) ?? new Set();
  set.add(listener); byKey.set(key, set);
  return () => { set.delete(listener); if (!set.size) byKey!.delete(key); };
}
const broadcast = <T,>(cache: SharedCache<T>, key: string, action: SharedAction) => {
  for (const listener of [...actionListeners.get(cache as SharedCache<unknown>)?.get(key) ?? []]) listener(action);
};
export function retryShared<T>(cache: SharedCache<T>, key: string) {
  dropShared(cache, key);
  broadcast(cache, key, 'retry');
}
/** Explicit user cancel: abort the request for everyone waiting on it. */
export function cancelShared<T>(cache: SharedCache<T>, key: string) {
  const entry = cache.get(key);
  if (entry && !entry.settled) { entry.controller.abort(); cache.delete(key); }
  broadcast(cache, key, 'cancel');
}

export interface ReaderResource<T> {
  data: T | null;
  error: KerfRequestError | null;
  loading: boolean;
  retry: () => void;
  cancel: () => void;
}

function useShared<T>(cache: SharedCache<T>, key: string | null, load: (signal: AbortSignal) => Promise<T>): ReaderResource<T> {
  const [state, setState] = useState<{ key: string; data?: T; error?: KerfRequestError } | null>(null);
  const [attempt, setAttempt] = useState(0);
  // A cancelled key stays idle (and releases its subscription) until retried.
  const [cancelled, setCancelled] = useState<string | null>(null);
  const latest = useRef(state);
  latest.current = state;
  const idle = !key || cancelled === key;
  useEffect(() => {
    if (idle || !key) return;
    let alive = true;
    const { promise, release } = acquireShared(cache, key, load);
    promise.then(data => { if (alive) setState({ key, data }); }, error => { if (alive) setState({ key, error: toKerfRequestError(error) }); });
    return () => { alive = false; release(); };
    // `load` is derived from `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt, cache, idle]);
  useEffect(() => key ? onSharedAction(cache, key, action => {
    if (action === 'retry') { setCancelled(null); setState(null); setAttempt(value => value + 1); return; }
    // Only a subscriber that is still waiting is cancelled; loaded panes keep their text.
    const previous = latest.current;
    if (previous?.key === key && (previous.data !== undefined || previous.error)) return;
    setCancelled(key); setState({ key, error: new KerfRequestError('aborted') });
  }) : undefined, [cache, key]);
  const current = key && state?.key === key ? state : null;
  const retry = useCallback(() => { if (key) retryShared(cache, key); }, [cache, key]);
  const cancel = useCallback(() => { if (key) cancelShared(cache, key); }, [cache, key]);
  return { data: current?.data ?? null, error: current?.error ?? null, loading: !idle && !current, retry, cancel };
}

export function useReaderArchive(id: string | null): ReaderResource<KerfActArchive> {
  return useShared(archives, id, signal => kerfActArchive(id!, {}, signal));
}

export function useReaderEdition(id: string | null, at: string | undefined, norm: string | null): ReaderResource<KerfActMarkdown> {
  return useShared(editions, id && at ? JSON.stringify([id, at, norm]) : null, signal => kerfActMarkdown(id!, { at: at!, norm: norm ?? undefined }, signal));
}

export const loadReaderAct = (id: string) => {
  const { promise, release } = acquireShared(laws, id, signal => kerfAct(id, signal));
  void promise.finally(release).catch(() => {});
  return promise;
};

async function loadReferences(id: string, signal: AbortSignal): Promise<KerfStatutoryCitation[]> {
  const rows: KerfStatutoryCitation[] = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await kerfCitations({ act: id, direction: 'out', limit: 1000, offset }, signal);
    rows.push(...page.citations);
    if (rows.length >= page.matched || page.citations.length === 0) return rows;
  }
}

export function useReaderAct(id: string | null): ReaderResource<KerfActDetail> {
  return useShared(laws, id, signal => kerfAct(id!, signal));
}

export function useReaderReferences(id: string | null) {
  const resource = useShared(references, id, signal => loadReferences(id!, signal));
  return { id, rows: resource.data ?? [], error: Boolean(resource.error) };
}

/** True once a load has been running for `delay` ms (the "server is slow" hint). */
export function useSlowFlag(active: boolean, resetKey: unknown = null, delay = KERF_SLOW_HINT_MS): boolean {
  const [slow, setSlow] = useState<{ key: unknown; slow: boolean }>({ key: resetKey, slow: false });
  useEffect(() => {
    setSlow({ key: resetKey, slow: false });
    if (!active) return;
    const timer = setTimeout(() => setSlow({ key: resetKey, slow: true }), delay);
    return () => clearTimeout(timer);
  }, [active, resetKey, delay]);
  return active && slow.key === resetKey && slow.slow;
}
