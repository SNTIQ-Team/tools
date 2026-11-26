/**
 * Client for Kerf's norm-level Git semantics (log / at / diff / blame).
 *
 * Every response is a typed evidence envelope.  Non-2xx answers (404
 * not_in_corpus, 422 invalid_argument, 503 integrity_check_failed …) still
 * carry an envelope; they are returned, not thrown, so the UI can say *why*
 * nothing is shown instead of rendering an empty success.
 */
import { kerfUrl } from '../../core/config';
import { KerfRequestError, kerfRequest } from './kerfRequest';
import type { KerfAttestation, KerfChangeRecord, KerfCompleteness, KerfCrossVerification } from './changeHistory';

export type KerfEnvelopeStatus =
  | 'ok' | 'partial' | 'unavailable' | 'not_in_corpus' | 'not_found_in_searched_scope'
  | 'ambiguous_identity' | 'temporally_unresolved' | 'unsupported_temporal_request'
  | 'stale_snapshot' | 'integrity_check_failed' | 'upstream_representation_unusable'
  | 'invalid_argument';

export interface KerfSearchedComponent { source: string; status: string; count: number | null }

export interface KerfEnvelope {
  schema?: string;
  status: KerfEnvelopeStatus;
  operation?: string;
  searched: KerfSearchedComponent[];
  warnings: string[];
  failed_components: unknown[];
  total: number | null;
  error?: { status: string; message: string };
}

export interface KerfNormAmendment {
  act?: string | null;
  reference?: string | null;
  document_id?: string | null;
  url?: string | null;
  published_at?: string | null;
  effective_at?: string | null;
  commencement_basis?: string | null;
  basis?: string | null;
  legal_effect_verified?: boolean;
  pending_note?: string | null;
}

export interface KerfNormTemporal {
  valid_from: string | null;
  valid_from_status: string;
  valid_from_basis?: string | null;
  valid_until_exclusive: string | null;
  valid_until_status?: string;
  observed_from: string | null;
  observed_until: string | null;
  /** First time any source is known to have shown this text (contract). */
  known_at?: string | null;
  known_from?: string | null;
  known_until?: string | null;
  promulgated_in?: string | null;
  /** How a text change was attributed to an amendment (core API). */
  attribution?: { status?: string | null; verification?: string | null; note?: string | null } | null;
  resolution?: { resolution: string; note?: string } | null;
}

/** Structure node of a norm text (`/norms/{id}/at`, parser law-structure/1).
 *  `start`/`end` are offsets into the version's `text`. */
export interface KerfStructureUnit {
  type: 'absatz' | 'satz' | 'nummer' | 'buchstabe' | 'doppelbuchstabe' | 'text_block' | string;
  number?: string | null;
  locator?: string;
  start: number;
  end: number;
  text?: string;
  marker?: string | null;
  children?: KerfStructureUnit[];
}
export interface KerfNormStructure {
  parser_version?: string;
  mode?: string;
  numbered_absaetze?: boolean;
  counts?: Record<string, number>;
  units: KerfStructureUnit[];
}

export interface KerfNormVersion {
  id: string;
  canonical_id: string;
  version_id: string;
  pinpoint: { label: string; title: string; unit: string; number: string; sub_unit?: string; sub_unit_label?: string };
  content_hash: { algorithm: string; value: string; text_sha256: string };
  source: { url: string | null; norm_url: string | null; norm_url_status: string; norm_url_basis?: string | null; act_url: string | null; role: string; observed_at: string | null; archive_url?: string | null; capture?: unknown };
  quality: { source_exact: boolean; complete: boolean; reconstruction_status: string; text_history_complete?: boolean | null };
  temporal: KerfNormTemporal;
  amendment: KerfNormAmendment | null;
  text?: string;
  sub_unit_text?: string;
  structure?: KerfNormStructure | null;
  /** Contract additions — feature-detected, absent on older APIs. */
  /** A promulgated amendment not yet in force, reconstructed (never current). */
  future?: boolean;
  source_role?: string | null;
  attestations?: KerfAttestation[];
  completeness?: KerfCompleteness | null;
  verification?: KerfCrossVerification | null;
  change?: KerfChangeRecord | null;
}

export interface KerfNormEvent {
  event_id: string;
  document_id: string | null;
  reference: string | null;
  procedure_title: string | null;
  published_at: string | null;
  effective_at: string | null;
  date_status: string | null;
  url: string | null;
  text_status: string;
  commands: { operation: string | null; text: string; raw: string }[];
}

export interface KerfNormMeta {
  canonical_id: string;
  label: string;
  title: string;
  versions: number;
  present_in_latest_state: boolean;
  act: { id: string; jurabk: string; title: string };
}

export interface KerfNormLog extends KerfEnvelope {
  evidence: KerfNormVersion[];
  change_summary?: unknown;
  norm?: KerfNormMeta & { act: KerfNormMeta['act'] & { stand?: string | null } };
  events?: KerfNormEvent[];
  history?: { text_history_start: string | null; amendment_event_history_start: string | null; consolidated_versions: number; verified_legal_starts: number; note: string };
}

export interface KerfDiffSide { locator: string; label: string; items: { locator: string; short_locator: string; number: string }[] }
export interface KerfSentenceOp {
  op: 'equal' | 'moved' | 'replace' | 'insert' | 'delete';
  old: KerfDiffSide | null;
  new: KerfDiffSide | null;
  text?: string;
  old_text?: string;
  new_text?: string;
  words?: { op: 'equal' | 'insert' | 'delete'; text: string }[];
}

export interface KerfNormDiff extends KerfEnvelope {
  evidence: KerfNormVersion[];
  changes?: KerfSentenceOp[];
  summary?: Record<string, number>;
  identical?: boolean;
  title_change?: { old: string; new: string } | null;
}

export interface KerfBlameLine {
  locator: string;
  label: string;
  text: string;
  status: 'introduced_within_history' | 'predates_text_history';
  introduced_by: null | { version_id: string; valid_from: string | null; valid_from_status: string; observed_from: string | null; amendment: KerfNormAmendment | null };
  present_since?: { version_id: string; observed_from: string | null; valid_from: string | null };
  candidates: { document_id: string | null; reference?: string | null; published_at: string | null; effective_at: string | null; match: string }[];
}

export interface KerfNormBlame extends KerfEnvelope {
  evidence: KerfNormVersion[];
  lines?: KerfBlameLine[];
  summary?: { sentences: number; introduced_within_history: number; predates_text_history: number };
}

export interface KerfMaterialFragment {
  id: string;
  role: string;
  heading: string;
  text: string;
  pinpoint: { drucksache: string; pdf_page: number; printed_page?: number | null; heading: string };
  source: { url: string | null; role: string };
  temporal: { procedure_stage?: string | null; document_date?: string | null };
  legal_status?: { adoption_status?: string | null };
  government_position?: string | null;
  quality: { complete?: boolean };
}

export interface KerfNormMaterials extends KerfEnvelope {
  evidence: KerfMaterialFragment[];
  explains?: KerfMaterialFragment[];
  mentions?: KerfMaterialFragment[];
  drafts?: KerfMaterialFragment[];
}

export interface KerfNormResolve extends KerfEnvelope {
  evidence: { id: string; canonical_id: string; act_id: string; jurabk: string; title: string }[];
}

/** Canonical ids contain slashes; keep them as path segments. */
export const normPath = (canonicalId: string) =>
  canonicalId.split('/').map(encodeURIComponent).join('/');

/** Envelope request with the shared deadlines of ./kerfRequest. A body that
 * is not an envelope (e.g. a framework 404 for a route the deployed API does
 * not have yet) rejects with a typed error so callers can feature-detect. */
function envelope<T extends KerfEnvelope>(path: string, signal?: AbortSignal): Promise<T> {
  return kerfRequest(kerfUrl(path), async res => {
    const type = res.headers.get('content-type') ?? '';
    if (!type.includes('json')) throw new KerfRequestError(res.status === 404 ? 'not_found' : res.ok ? 'invalid' : 'http', { status: res.status });
    let body: Partial<T> & { detail?: unknown };
    try { body = await res.json() as Partial<T> & { detail?: unknown }; } catch { throw new KerfRequestError('invalid', { status: res.status }); }
    if (!body || typeof body !== 'object' || typeof body.status !== 'string') {
      throw new KerfRequestError(res.status === 404 ? 'not_found' : res.ok ? 'invalid' : 'http', { status: res.status });
    }
    return { searched: [], warnings: [], failed_components: [], total: null, evidence: [], ...body } as unknown as T;
  }, { signal });
}

export const kerfResolveNorm = (actId: string, norm: string, signal?: AbortSignal) =>
  envelope<KerfNormResolve>(`/norms/resolve?${new URLSearchParams({ act: actId, norm }).toString()}`, signal);

export const kerfNormLog = (canonicalId: string, signal?: AbortSignal) =>
  envelope<KerfNormLog>(`/norms/${normPath(canonicalId)}/log`, signal);

export const kerfNormDiff = (canonicalId: string, from: string, to: string, signal?: AbortSignal) =>
  envelope<KerfNormDiff>(`/norms/${normPath(canonicalId)}/diff?${new URLSearchParams({ from, to }).toString()}`, signal);

export const kerfNormMaterials = (canonicalId: string, signal?: AbortSignal) =>
  envelope<KerfNormMaterials>(`/norms/${normPath(canonicalId)}/materials`, signal);

export const kerfNormBlame = (canonicalId: string, signal?: AbortSignal) =>
  envelope<KerfNormBlame>(`/norms/${normPath(canonicalId)}/blame`, signal);

export interface KerfNormAt extends KerfEnvelope {
  evidence: KerfNormVersion[];
  change_summary?: unknown;
  norm?: KerfNormMeta;
  resolution?: { resolution: string; note?: string } | null;
}

/** `version=` support is detected once per page: the deployed API rejects
 *  unknown arguments with 422 invalid_argument. */
let atVersionSupport: boolean | null = null;
const rejectsVersion = (body: KerfEnvelope) => body.status === 'invalid_argument'
  && /\bversion\b/u.test(`${body.error?.message ?? ''} ${body.warnings.join(' ')}`);

/** Text of one norm version. Prefers the exact version id; falls back to the
 *  date selector, whose result the caller must compare with the request. */
export async function kerfNormAt(canonicalId: string, request: { date: string; version?: string | null }, signal?: AbortSignal): Promise<KerfNormAt & { selectedBy: 'version' | 'date' }> {
  const base = `/norms/${normPath(canonicalId)}/at`;
  if (request.version && atVersionSupport !== false) {
    const body = await envelope<KerfNormAt>(`${base}?${new URLSearchParams({ version: request.version }).toString()}`, signal);
    if (!rejectsVersion(body)) { atVersionSupport = true; return { ...body, selectedBy: 'version' }; }
    atVersionSupport = false;
  }
  const body = await envelope<KerfNormAt>(`${base}?${new URLSearchParams({ date: request.date }).toString()}`, signal);
  return { ...body, selectedBy: 'date' };
}

export interface KerfChanges extends KerfEnvelope {
  evidence: unknown[];
  change_summary?: unknown;
}

const withPage = (path: string, page?: { limit?: number; offset?: number }) => {
  const params = new URLSearchParams();
  if (page?.limit !== undefined) params.set('limit', String(page.limit));
  if (page?.offset) params.set('offset', String(page.offset));
  return params.size ? `${path}?${params.toString()}` : path;
};

/** Paged change list; an API that rejects paging arguments is asked again
 *  without them. A missing route rejects with kind `not_found`. */
async function changes(path: string, page: { limit?: number; offset?: number } | undefined, signal?: AbortSignal): Promise<KerfChanges> {
  const body = await envelope<KerfChanges>(withPage(path, page), signal);
  if (body.status === 'invalid_argument' && page && /\b(limit|offset)\b/u.test(`${body.error?.message ?? ''} ${body.warnings.join(' ')}`)) {
    return envelope<KerfChanges>(path, signal);
  }
  return body;
}

export const kerfNormChanges = (canonicalId: string, page?: { limit?: number; offset?: number }, signal?: AbortSignal) =>
  changes(`/norms/${normPath(canonicalId)}/changes`, page, signal);

export const kerfActChanges = (actId: string, page?: { limit?: number; offset?: number }, signal?: AbortSignal) =>
  changes(`/acts/${encodeURIComponent(actId)}/changes`, page, signal);

/** One consolidated state of an act (`/acts/{id}/versions`, core API). */
export interface KerfActVersionRow {
  seq?: number; state?: string; source?: string; source_role?: string | null;
  known_from?: string | null; known_until?: string | null; url?: string | null; archive_url?: string | null;
  sha256?: string | null; complete?: boolean | null; valid_from?: string | null; valid_from_status?: string | null;
  valid_until_exclusive?: string | null; act_stand_note?: { text?: string | null } | null; documentation_notes?: { kind?: string; text?: string }[];
}
export interface KerfActVersions extends KerfEnvelope { evidence: KerfActVersionRow[] }

export const kerfActVersions = (actId: string, page?: { limit?: number; offset?: number }, signal?: AbortSignal) =>
  changes(`/acts/${encodeURIComponent(actId)}/versions`, page, signal) as unknown as Promise<KerfActVersions>;

/** Diff selector: the contract accepts `version_id` (the deployed API too). */
export const versionSelector = (version: KerfNormVersion) => version.version_id;

/** Legal-date wording: a verified start, an archived official start, or none. */
export type ValidityKind = 'verified' | 'commencement' | 'archived' | 'dated' | 'unresolved';
export const validityKind = (temporal: KerfNormTemporal): ValidityKind =>
  !temporal.valid_from || temporal.valid_from_status === 'unresolved' || temporal.valid_from_status === 'unknown' ? 'unresolved'
    : temporal.valid_from_status === 'official_verified' ? 'verified'
    : /commencement/u.test(temporal.valid_from_status) ? 'commencement'
    : temporal.valid_from_status === 'official_archived_version_date' ? 'archived' : 'dated';

export const isFutureDate = (value: string | null | undefined, today = new Date().toISOString().slice(0, 10)) =>
  Boolean(value && value.slice(0, 10) > today);
