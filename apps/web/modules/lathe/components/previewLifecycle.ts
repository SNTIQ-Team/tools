/** Serialize canvas ownership and await PDF worker disposal across effect updates. */
type LoadingTask = { destroy(): Promise<void> };
type RenderTask = { promise: Promise<unknown>; cancel(): void };
export type PreviewJob = {
  readonly cancelled: boolean;
  wait<T>(promise: Promise<T>): Promise<T>;
  trackLoading(task: LoadingTask): void;
  trackRender(task: RenderTask): void;
};
export type PreviewHandle = { readonly cancelled: boolean; cancel(): void; settled: Promise<void> };

export class PreviewQueue {
  private tail: Promise<void> = Promise.resolve();

  start(work: (job: PreviewJob) => Promise<void>): PreviewHandle {
    let cancelled = false;
    let loading: LoadingTask | undefined;
    let rendering: RenderTask | undefined;
    let renderingDone: Promise<unknown> | undefined;
    let destroying: Promise<void> | undefined;
    let rejectCancelled!: (reason: Error) => void;
    const cancellation = new Promise<never>((_, reject) => { rejectCancelled = reject; });
    void cancellation.catch(() => undefined);
    const destroy = () => {
      if (loading && !destroying) {
        const owned = loading;
        destroying = Promise.resolve().then(() => owned.destroy());
        // Cancellation can precede the awaited loading/render promise settling.
        void destroying.catch(() => undefined);
      }
    };
    const cancelRender = () => {
      const owned = rendering;
      rendering = undefined;
      try { owned?.cancel(); } catch { /* worker disposal still runs */ }
    };
    const job: PreviewJob = {
      get cancelled() { return cancelled; },
      wait<T>(promise: Promise<T>) { return Promise.race([promise, cancellation]); },
      trackLoading(task) {
        loading = task;
        if (cancelled) destroy();
      },
      trackRender(task) {
        rendering = task;
        renderingDone = task.promise;
        const release = () => { if (rendering === task) rendering = undefined; };
        void task.promise.then(release, release);
        if (cancelled) cancelRender();
      },
    };
    const settled = this.tail.then(async () => {
      if (cancelled) return;
      try { await work(job); }
      finally {
        cancelRender();
        destroy();
        // Keep canvas ownership even if disposal fails or cancel() settles
        // asynchronously. A new PDF must never draw over a live old task.
        await renderingDone?.catch(() => undefined);
        await destroying;
      }
    });
    // A failed/cancelled previous job must not poison the next preview.
    this.tail = settled.catch(() => undefined);
    return {
      get cancelled() { return cancelled; },
      settled,
      cancel() {
        cancelled = true;
        rejectCancelled(new DOMException('Preview cancelled', 'AbortError'));
        cancelRender();
        destroy();
      },
    };
  }
}
