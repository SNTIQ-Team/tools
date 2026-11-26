/**
 * One fetch path for every Kerf API call.
 *
 * The API runs single-worker under a tight memory limit and can stall while
 * the host swaps. A request without a deadline then leaves the reader at
 * "Loading" forever, so every call gets two cancellable deadlines:
 *  - `timeoutMs` until the response headers arrive (a stalled server), and
 *  - `bodyTimeoutMs` for reading the body once the server has answered (large
 *    acts on slow links keep a generous budget).
 * Failures are thrown as a typed `KerfRequestError` so the UI can say *why*
 * nothing is shown and offer a retry instead of an endless spinner.
 */

export type KerfRequestErrorKind = 'timeout' | 'network' | 'http' | 'not_found' | 'invalid' | 'aborted';

/** Time until response headers. */
export const KERF_REQUEST_TIMEOUT_MS = 30_000;
/** Time for reading a response body after the headers arrived. */
export const KERF_BODY_TIMEOUT_MS = 120_000;
/** After this long a still-running load shows a "server is slow" hint. */
export const KERF_SLOW_HINT_MS = 8_000;

export class KerfRequestError extends Error {
  readonly kind: KerfRequestErrorKind;
  readonly status: number | null;
  readonly timeoutMs: number | null;
  constructor(kind: KerfRequestErrorKind, options: { status?: number | null; timeoutMs?: number | null; message?: string } = {}) {
    super(options.message ?? `kerf: ${kind}${options.status ? ` (HTTP ${options.status})` : ''}`);
    this.name = 'KerfRequestError';
    this.kind = kind;
    this.status = options.status ?? null;
    this.timeoutMs = options.timeoutMs ?? null;
  }
}

export const isKerfRequestError = (value: unknown): value is KerfRequestError =>
  value instanceof KerfRequestError
  || Boolean(value && typeof value === 'object' && (value as { name?: unknown }).name === 'KerfRequestError' && typeof (value as { kind?: unknown }).kind === 'string');

/** Normalise anything a loader threw into a typed error. */
export function toKerfRequestError(value: unknown): KerfRequestError {
  if (isKerfRequestError(value)) return value;
  if (value && typeof value === 'object' && (value as { name?: unknown }).name === 'AbortError') return new KerfRequestError('aborted');
  if (value instanceof SyntaxError) return new KerfRequestError('invalid', { message: value.message });
  const message = value instanceof Error ? value.message : String(value);
  const status = /HTTP (\d{3})/u.exec(message)?.[1];
  if (status) return new KerfRequestError(status === '404' ? 'not_found' : 'http', { status: Number(status) });
  return new KerfRequestError('network', { message });
}

export const httpError = (status: number) => new KerfRequestError(status === 404 ? 'not_found' : 'http', { status });

export interface KerfRequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  bodyTimeoutMs?: number;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  init?: RequestInit;
}

/**
 * Fetch `url` and hand the response to `read` (which parses the body).
 * `read` runs under the body deadline; aborting the caller's signal cancels
 * the network request and rejects with kind `aborted`.
 */
export async function kerfRequest<T>(url: string, read: (response: Response) => Promise<T>, options: KerfRequestOptions = {}): Promise<T> {
  const { signal, timeoutMs = KERF_REQUEST_TIMEOUT_MS, bodyTimeoutMs = KERF_BODY_TIMEOUT_MS } = options;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  if (signal?.aborted) throw new KerfRequestError('aborted');
  const controller = new AbortController();
  let expired: number | null = null;
  // Deadlines and cancellation reject on their own: a stalled body reader
  // (or a fetch implementation that ignores abort) must never hang the caller.
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rejectEarly: (error: KerfRequestError) => void = () => {};
  const early = new Promise<never>((_, reject) => { rejectEarly = reject; });
  early.catch(() => { /* observed through Promise.race */ });
  const onAbort = () => { controller.abort(); rejectEarly(new KerfRequestError('aborted')); };
  signal?.addEventListener('abort', onAbort, { once: true });
  const arm = (ms: number) => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => { expired = ms; controller.abort(); rejectEarly(new KerfRequestError('timeout', { timeoutMs: ms })); }, ms);
  };
  arm(timeoutMs);
  try {
    const response = await Promise.race([fetchImpl(url, { cache: 'no-cache', ...options.init, signal: controller.signal }), early]);
    arm(bodyTimeoutMs);
    return await Promise.race([read(response), early]);
  } catch (error) {
    if (expired !== null) throw new KerfRequestError('timeout', { timeoutMs: expired });
    if (signal?.aborted) throw new KerfRequestError('aborted');
    throw toKerfRequestError(error);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/** GET JSON; non-2xx answers become typed HTTP errors. */
export const kerfGetJson = <T>(url: string, options: KerfRequestOptions = {}) => kerfRequest<T>(url, async response => {
  if (!response.ok) throw httpError(response.status);
  try { return await response.json() as T; } catch (error) {
    if (isKerfRequestError(error)) throw error;
    throw new KerfRequestError('invalid', { status: response.status });
  }
}, options);
