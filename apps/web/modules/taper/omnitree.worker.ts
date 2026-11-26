/// <reference lib="webworker" />

import { buildOmnigram, type RawGraphEdge } from './omnitree';

interface BuildMessage {
  nodes: [number, string, string, string | null,
          string | null | undefined][];
  edges: RawGraphEdge[];
  kreise: Record<string, string>;
}

const worker = self as unknown as DedicatedWorkerGlobalScope;

worker.onmessage = (event: MessageEvent<BuildMessage>) => {
  const { nodes, edges, kreise } = event.data;
  const built = buildOmnigram(nodes, edges, kreise);
  // The interactive renderers use the indexed maps below, not the legacy
  // pre-batched/spatial-layout payload. Avoid cloning those large duplicate
  // structures back across the worker boundary.
  built.links = [];
  built.batches = [];
  built.grid = new Map();
  worker.postMessage(built);
};

export {};
