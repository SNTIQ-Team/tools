'use client';

import { useEffect, useState } from 'react';
import { kerfUrl } from '@/core/config';
import type { KerfActDetail, KerfActNorm, KerfActMarkdown } from './client';
import { archiveNorms } from './readerArchiveStructure';
import { readerDesignator } from './readerOutline';
import { validateReaderBlocks, validateReaderSourceAnnotations, type ReaderNode, type ReaderSourceAnnotations } from './readerStructure';
import { isKerfRequestError, kerfGetJson, type KerfRequestError } from './kerfRequest';

export type StructuredNorm = { text_sha256: string; blocks: ReaderNode[] } & Partial<ReaderSourceAnnotations>;
export type StructuredNorms = Record<string, StructuredNorm>;
type StructureSource = Pick<KerfActDetail, 'id' | 'norms'>;
export type ArchivedStructuredNorms = { act: StructureSource; structures: StructuredNorms; requested_at: string; state_sha256: string };
const structures = new WeakMap<KerfActDetail, Promise<StructuredNorms>>();
const archivedStructures = new WeakMap<KerfActMarkdown, Promise<ArchivedStructuredNorms>>();
const VERIFY_CONCURRENCY = 32;
const INDEX_PREFIX = '@index:';

export function getStructuredNorm(structures: StructuredNorms | undefined, act: StructureSource, norm: KerfActNorm): StructuredNorm | undefined {
  if (!structures) return undefined;
  const index = act.norms?.indexOf(norm) ?? -1;
  if (index < 0) return undefined;
  const indexKey = `${INDEX_PREFIX}${index}`;
  if (Object.hasOwn(structures, indexKey)) return structures[indexKey];
  return !norm.enbez.startsWith(INDEX_PREFIX) && Object.hasOwn(structures, norm.enbez) ? structures[norm.enbez] : undefined;
}

/** Layout may cross editions only when the complete source body and heading
 * are identical. Current source annotations never belong to this return type. */
export function archivedReaderBlocks(act: StructureSource, structures: StructuredNorms | undefined, archived: KerfActNorm[], inventory = archived): (ReaderNode[] | undefined)[] {
  const unique = new Map<string, KerfActNorm | null>();
  for (const norm of act.norms ?? []) {
    const designation = readerDesignator(norm);
    unique.set(designation, unique.has(designation) ? null : norm);
  }
  const counts = new Map<string, number>();
  for (const norm of inventory) {
    const designation = readerDesignator(norm);
    counts.set(designation, (counts.get(designation) ?? 0) + 1);
  }
  return archived.map(norm => {
    const designation = readerDesignator(norm);
    const head = unique.get(designation);
    if (!head || counts.get(designation) !== 1 || (head.titel ?? '') !== (norm.titel ?? '')
      || (head.text ?? '').trim() !== (norm.text ?? '').trim()) return undefined;
    return getStructuredNorm(structures, act, head)?.blocks;
  });
}

const record = (value: unknown): value is Record<string, unknown> => value !== null
  && typeof value === 'object' && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

async function verifyStructures(act: StructureSource, payload: unknown, includeAnnotations = true): Promise<StructuredNorms> {
  if (!record(payload) || payload.schema_version !== 1 || payload.act_id !== act.id || !record(payload.norms)
    || (payload.norms_by_index !== undefined && !record(payload.norms_by_index))) {
    throw new Error('Invalid reader structure envelope');
  }
  const candidates = payload.norms;
  const source = new Map<string, string>();
  const ambiguous = new Set<string>();
  const repeatedLabels = new Set<string>();
  for (const norm of act.norms ?? []) {
    const text = norm.text ?? '';
    if (source.has(norm.enbez)) repeatedLabels.add(norm.enbez);
    if (source.has(norm.enbez) && source.get(norm.enbez) !== text) ambiguous.add(norm.enbez);
    else source.set(norm.enbez, text);
  }
  const rows = [...source].filter(([name]) => !name.startsWith(INDEX_PREFIX) && !ambiguous.has(name) && Object.hasOwn(candidates, name))
    .map(([name, text]) => ({ name, text, candidate: candidates[name], indexed: false }));
  if (record(payload.norms_by_index)) for (const [indexText, candidate] of Object.entries(payload.norms_by_index)) {
    if (!/^(?:0|[1-9]\d*)$/.test(indexText)) continue;
    const index = Number(indexText);
    const norm = Number.isSafeInteger(index) ? act.norms?.[index] : undefined;
    if (!norm || !record(candidate) || candidate.enbez !== norm.enbez) continue;
    rows.push({ name: `${INDEX_PREFIX}${index}`, text: norm.text ?? '', candidate, indexed: true });
  }
  const verified: StructuredNorms = Object.create(null);
  const encoder = new TextEncoder();
  let cursor = 0;
  const worker = async () => {
    while (cursor < rows.length) {
      const { name, text, candidate, indexed } = rows[cursor++];
      if (!record(candidate) || typeof candidate.text_sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(candidate.text_sha256)
        || Object.keys(candidate).some(key => key !== 'text_sha256' && key !== 'blocks' && key !== 'source_retrieved_at' && key !== 'source_url' && !['source_annotations', 'source_annotations_text', 'source_annotations_sha256'].includes(key) && !(indexed && key === 'enbez'))) continue;
      if (candidate.source_retrieved_at !== undefined && (typeof candidate.source_retrieved_at !== 'string' || candidate.source_retrieved_at.length > 128)) continue;
      if (candidate.source_url !== undefined && (typeof candidate.source_url !== 'string' || !/^https:\/\/www\.gesetze-(?:im-internet|bayern)\.de\//u.test(candidate.source_url) || candidate.source_url.length > 2000)) continue;
      const blocks = validateReaderBlocks(candidate.blocks, text);
      if (!blocks) continue;
      const hasAnnotations = includeAnnotations && ['source_annotations', 'source_annotations_text', 'source_annotations_sha256'].some(key => Object.hasOwn(candidate, key));
      const annotations = hasAnnotations ? validateReaderSourceAnnotations(candidate) : undefined;
      if (hasAnnotations && !annotations) continue;
      const digest = await crypto.subtle.digest('SHA-256', encoder.encode(text));
      const hash = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
      if (hash !== candidate.text_sha256) continue;
      if (annotations) {
        const digest = await crypto.subtle.digest('SHA-256', encoder.encode(annotations.source_annotations_text));
        const hash = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
        if (hash !== annotations.source_annotations_sha256) continue;
      }
      // Identical duplicate bodies do not prove that editorial notes belong
      // to both source records. Only an indexed match can carry their notes.
      verified[name] = { text_sha256: hash, blocks, ...(indexed || !repeatedLabels.has(name) ? annotations : {}) };
    }
  };
  await Promise.all(Array.from({ length: Math.min(VERIFY_CONCURRENCY, rows.length) }, worker));
  if (!Object.keys(verified).length) throw new Error('No matching reader structures');
  return verified;
}

/** One fetch and verification pass per immutable source snapshot, shared by all panes. */
export function loadStructuredNorms(act: KerfActDetail): Promise<StructuredNorms> {
  const existing = structures.get(act);
  if (existing) return existing;
  const promise = kerfGetJson<unknown>(kerfUrl(`/acts/${encodeURIComponent(act.id)}/reader`))
    .then(payload => verifyStructures(act, payload));
  structures.set(act, promise);
  void promise.catch(() => { if (structures.get(act) === promise) structures.delete(act); });
  return promise;
}

/** Only transport failures deserve a visible retry; a missing or unverifiable
 * structure is a normal absence and the plain source text is shown. */
export const structureLoadFailed = (error: unknown): error is KerfRequestError =>
  isKerfRequestError(error) && ['timeout', 'network', 'http'].includes(error.kind);

export function useStructuredNormsState(act: KerfActDetail | null): { norms: StructuredNorms | undefined; error: KerfRequestError | null; retry: () => void } {
  const [state, setState] = useState<{ act: KerfActDetail; norms?: StructuredNorms; error?: KerfRequestError } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    if (act) void loadStructuredNorms(act).then(norms => { if (alive) setState({ act, norms }); })
      // The canonical plain source remains available when optional structure fails.
      .catch(error => { if (alive) setState({ act, ...(structureLoadFailed(error) ? { error } : {}) }); });
    // A pane's unmount must not cancel the shared request of its sibling panes.
    return () => { alive = false; };
  }, [act, attempt]);
  const current = state?.act === act ? state : null;
  return { norms: current?.norms, error: current?.error ?? null,
    retry: () => { if (act) structures.delete(act); setState(null); setAttempt(value => value + 1); } };
}

export function useStructuredNorms(act: KerfActDetail | null): StructuredNorms | undefined {
  return useStructuredNormsState(act).norms;
}


/** A historical sidecar is trusted only for the same selected CAS and date.
 * Its bodies are verified against the entire selected export, never HEAD. */
export function loadArchivedStructuredNorms(edition: KerfActMarkdown): Promise<ArchivedStructuredNorms> {
  if (!edition.act_id || !/^\d{4}-\d{2}-\d{2}$/.test(edition.requested_at) || !edition.state_sha256
    || !/^[a-f0-9]{64}$/.test(edition.state_sha256) || edition.norm || edition.partial || edition.complete !== true) {
    return Promise.reject(new Error('A complete dated source snapshot is required'));
  }
  const cached = archivedStructures.get(edition);
  if (cached) return cached;
  const act = { id: edition.act_id, norms: archiveNorms(edition.markdown) };
  const promise = kerfGetJson<unknown>(kerfUrl(`/acts/${encodeURIComponent(act.id)}/reader?at=${encodeURIComponent(edition.requested_at)}`))
    .then(async payload => {
      if (!record(payload) || payload.requested_at !== edition.requested_at || payload.state_sha256 !== edition.state_sha256) {
        throw new Error('Archived reader structure snapshot mismatch');
      }
      return { act, structures: await verifyStructures(act, payload, false), requested_at: edition.requested_at, state_sha256: edition.state_sha256! };
    });
  archivedStructures.set(edition, promise);
  void promise.catch(() => { if (archivedStructures.get(edition) === promise) archivedStructures.delete(edition); });
  return promise;
}

export function useArchivedStructuredNorms(edition: KerfActMarkdown | null | undefined): ArchivedStructuredNorms | undefined {
  const [state, setState] = useState<{ edition: KerfActMarkdown; value: ArchivedStructuredNorms } | null>(null);
  useEffect(() => {
    let alive = true;
    if (edition) void loadArchivedStructuredNorms(edition).then(value => { if (alive) setState({ edition, value }); })
      .catch(() => { /* Optional historical layout falls back to exact HEAD matches or source Markdown. */ });
    return () => { alive = false; };
  }, [edition]);
  return state?.edition === edition ? state?.value : undefined;
}
