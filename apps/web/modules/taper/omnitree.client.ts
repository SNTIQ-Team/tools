'use client';

import { taperUrl } from '../../core/config';
import {
  buildOmnigram, type Built, type RawGraphEdge,
} from './omnitree';

interface CompactGraph {
  nodes: [number, string, string, string | null,
          string | null | undefined][];
  edges: RawGraphEdge[];
  kreise?: Record<string, string>;
}

let cached: Promise<Built> | null = null;

const offThread = (graph: CompactGraph): Promise<Built> => {
  if (typeof Worker === 'undefined') {
    return Promise.resolve(buildOmnigram(
      graph.nodes, graph.edges, graph.kreise ?? {}));
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('./omnitree.worker.ts', import.meta.url),
      { type: 'module', name: 'taper-layout' },
    );
    worker.onmessage = (event: MessageEvent<Built>) => {
      worker.terminate();
      resolve(event.data);
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || 'Taper layout worker failed'));
    };
    worker.postMessage({
      nodes: graph.nodes,
      edges: graph.edges,
      kreise: graph.kreise ?? {},
    });
  });
};

/** Fetch and build the 20k-node index once per page, away from the UI thread. */
export const loadOmnigram = (): Promise<Built> => {
  if (!cached) {
    cached = fetch(taperUrl('/graph?v=5'))
      .then((response) => {
        if (!response.ok) throw new Error(`Taper: HTTP ${response.status}`);
        return response.json() as Promise<CompactGraph>;
      })
      .then(offThread)
      .catch((error) => {
        // A transient request/worker failure must be retryable.
        cached = null;
        throw error;
      });
  }
  return cached;
};
