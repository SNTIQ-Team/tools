/**
 * Thin client for the Kerf API (api.sntiq.com/kerf). The viewer browses
 * consolidated law and its history; the diff (Synopse) is rendered locally
 * from each patch's old→new text (see ./diff).
 */

import { kerfUrl } from '../../core/config';
import { httpError, kerfGetJson, kerfRequest } from './kerfRequest';
import type { KerfChangeSummary } from './changeHistory';

export interface KerfFinalTextReview {
  status?: string | null;
  article_2_compared?: boolean;
  compared_to?: string | null;
  reviewed_celexes?: string[];
  reviewed_at?: string | null;
  note?: string | null;
}

/** Row in the law index (`GET /acts`). */
export interface KerfAct {
  id: string;
  jurabk: string;
  juris: string;
  title: string;
  source_url?: string | null;
  norms: number;
  build?: string;
  last_change: string | null;
  next_change: string | null;
  pending: number;
  /** number of court decisions touching this act */
  decisions?: number;
  /** Compact change summary (kerf-change-summary/1) when the API serves it. */
  change_summary?: KerfChangeSummary | null;
}

/** Temporal envelope on an act detail. */
export interface KerfTemporal {
  last_change: string | null;
  first_change?: string | null;
  change_count: number;
  next_change: string | null;
  pending: number;
}

/** A single amendment event on an act (`patches[]`). */
export interface KerfPatch {
  status: string;
  op: string;
  para: string | null;
  absatz: string | null;
  proc: string | null;
  doc: string | null;
  stand?: string | null;
  valid_from: string | null;
  valid_from_verified?: boolean;
  valid_from_basis?: string;
  old: string | null;
  new: string | null;
}

/** One §-level change inside a consolidated version. Official snapshot
 * transitions and other evidence-bound old/new pairs are diffed locally. */
export interface KerfChange {
  para: string | null;
  old: string;
  new: string;
  /** Date on which the consolidated wording changes. For Bavarian rows this
   * can differ from the promulgation date of the enclosing version. */
  effective_date?: string;
  source?: string;
  confidence?: string;
}

/** A consolidated version/state transition (`versions[]`). */
export interface KerfVersion {
  date: string;
  text: string;
  url?: string | null;
  /** Retrieval day of an independently captured official source state. This
   * is evidence that the wording was observed on that day, not an inferred
   * legal effective date. */
  observed_at?: string | null;
  /** Machine-readable date semantics, e.g.
   * `retrieval_observation_not_effective_date`. */
  date_basis?: string | null;
  /** Content digest of the complete captured state. */
  state_digest?: string | null;
  /** Direct official source for the captured state. */
  source_url?: string | null;
  /** Source-system build marker retained separately from observed_at. */
  builddate?: string | null;
  verification?: string | null;
  /** Publication day of the final amending act in the Bundesgesetzblatt. */
  published_at?: string | null;
  /** Effective day mechanically resolved for the matched amending command. */
  effective_at?: string | null;
  /** True only after final BGBl wording, commencement clause and the complete
   * official before/after state pair have passed the review gate. */
  legal_effect_verified?: boolean;
  legal_verification?: string | null;
  bgbl?: KerfBgblReference | string | null;
  procedure_id?: string | null;
  /** per-§ old/new text, present for recent amendment versions */
  changes?: KerfChange[];
}

export interface KerfBgblReference {
  document_id?: string | null;
  year?: number | string | null;
  issue?: number | string | null;
  eli?: string | null;
  pdf_url?: string | null;
  pdf_sha256?: string | null;
  text_sha256?: string | null;
  integrity_verified?: boolean;
}

/** One norm in the current consolidated act text. */
export interface KerfActNorm {
  enbez: string;
  titel?: string;
  text?: string;
  glied?: string;
}

/** A secondary discovery/history source used to cross-check Kerf's own
 *  transformed records. It is never a substitute for the official source. */
export interface KerfActCrossCheck {
  source: string;
  url: string;
  label?: string;
  coverage?: string;
  authoritative?: boolean;
}

/** Full act detail (`GET /acts/{id}`). */
export interface KerfActDetail {
  id: string;
  jurabk: string;
  juris: string;
  title: string;
  source_url?: string | null;
  stand?: string | null;
  build?: string;
  norm_count?: number;
  temporal: KerfTemporal;
  patches: KerfPatch[];
  versions: KerfVersion[];
  upcoming?: KerfPatch[];
  norms?: KerfActNorm[];
  cross_checks?: KerfActCrossCheck[];
  bills?: unknown;
  gvbl_events?: unknown;
  official_states?: KerfOfficialState[];
  /** Summary of the official BGBl retrospective ledger for this act. */
  retrospective?: KerfActRetrospectiveSummary | null;
  /** court decisions touching this act, date desc (see KerfActDecisionRef) */
  decisions?: KerfActDecisionRef[];
  /** kerf-change-summary/1 — feature-detected, absent on older APIs. */
  change_summary?: KerfChangeSummary | null;
}

/** `retrospective` on an act detail: how much of the official amendment
 *  ledger exists. `current_events` counts official BGBl amendment records;
 *  it is not a consolidated change count. */
export interface KerfActRetrospectiveSummary {
  available?: boolean;
  history_start?: string | null;
  current_intervals?: number | null;
  current_events?: number | null;
  coverage?: Record<string, unknown> | null;
}

/** A commit in the legislative git graph (`GET /git`). */
export interface KerfCommit {
  hash: string;
  date: string;
  /** index into the `lanes` array: 0=EU, 1=Bund, 2=Bayern, 3=Länder */
  lane: number;
  type: 'commit' | 'open' | 'closed' | 'merge';
  actor: string;
  msg: string;
  acts: string[];
  paras: string[];
  refs: string[];
  merge_ref: string | null;
  doc?: string | null;
  url?: string | null;
  celex?: string | null;
  gvbl?: string | null;
  targets_verified?: boolean;
  target_basis?: string | null;
  observed_at?: string | null;
  published_at?: string | null;
  effective_at?: string | null;
  date_basis?: string | null;
  verification?: string | null;
  legal_effect_verified?: boolean;
  legal_verification?: string | null;
  state_digest?: string | null;
  previous_state_digest?: string | null;
  bgbl?: KerfBgblReference | string | null;
  procedure_id?: string | null;
  checkout?: {
    act_id?: string | null;
    observed_at?: string | null;
    state_digest?: string | null;
  } | null;
}

export interface KerfGit {
  lanes: string[];
  lane?: number | string | null;
  total: number;
  commits: KerfCommit[];
}

/** Every call has a headers deadline and a body deadline (see ./kerfRequest);
 *  failures reject with a typed KerfRequestError. */
function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  return kerfGetJson<T>(kerfUrl(path), { signal });
}

/** Law index — the Wiki / Realtime list. */
export const kerfActs = (signal?: AbortSignal) =>
  get<KerfAct[]>('/acts', signal);

/** Full act with amendment history — the Synopse source. */
export const kerfAct = (id: string, signal?: AbortSignal) =>
  get<KerfActDetail>(`/acts/${encodeURIComponent(id)}`, signal);

// ------------------------------------------------ statutory citations
export type KerfCitationDirection = 'in' | 'out';
export type KerfCitationKind = 'self' | 'cross_act';

/** One exact, mechanically extracted reference in the current consolidated
 * corpus. Unresolved rows are first-class evidence: the client must not turn
 * an unknown alias or missing norm into a guessed local link. */
export interface KerfStatutoryCitation {
  id: string;
  status: 'resolved' | 'unresolved' | string;
  unresolved_reason?: string | null;
  kind: KerfCitationKind | string;
  source_act: string;
  source_jurabk: string;
  source_norm: string;
  source_excerpt: string;
  source_snapshot?: string | null;
  date_basis?: string | null;
  citation_text: string;
  matched_aliases: string[];
  target_act?: string | null;
  target_jurabk?: string | null;
  target_norm?: string | null;
  target_pinpoint?: string | null;
  occurrence_count: number;
  machine_extracted: boolean;
  current_state_only: boolean;
  legal_interpretation?: string | null;
}

export interface KerfCitations {
  schema_version?: number | string | null;
  built_at?: string | null;
  machine_extracted: boolean;
  current_state_only: boolean;
  legal_interpretation?: string | null;
  source_policy?: Record<string, unknown> | null;
  source_snapshots?: Record<string, string> | null;
  counts?: Record<string, number> | null;
  direction: KerfCitationDirection;
  total: number;
  matched: number;
  offset: number;
  limit: number;
  citations: KerfStatutoryCitation[];
}

/** Exact current-text references. `direction=out` uses the selected act as
 * source; `direction=in` returns reverse backlinks where it is the target. */
export const kerfCitations = (
  params: {
    act: string;
    norm?: string;
    direction?: KerfCitationDirection;
    kind?: KerfCitationKind;
    limit?: number;
    offset?: number;
  },
  signal?: AbortSignal,
) => {
  const sp = new URLSearchParams({
    act: params.act,
    direction: params.direction ?? 'out',
    limit: String(params.limit ?? 50),
    offset: String(params.offset ?? 0),
  });
  if (params.norm) sp.set('norm', params.norm);
  if (params.kind) sp.set('kind', params.kind);
  return get<KerfCitations>(`/citations?${sp.toString()}`, signal);
};

// ------------------------------------------------------- Markdown archive
export interface KerfActArchiveEntry {
  source?: string | null;
  source_store?: string | null;
  archive_url?: string | null;
  archive_timestamp?: string | null;
  date: string;
  /** Stable row identity. Multiple legal/publication/observation facts may
   * legitimately share one calendar day and must not be collapsed by date. */
  id?: string | null;
  label?: string | null;
  has_changes?: boolean;
  exact?: boolean;
  partial?: boolean;
  /** Official retrieval date. Never display this as an effective date. */
  observed_at?: string | null;
  date_basis?: string | null;
  state_digest?: string | null;
  source_url?: string | null;
  builddate?: string | null;
  review_id?: string | null;
  verification?: string | null;
  published_at?: string | null;
  effective_at?: string | null;
  effective_from?: string | null;
  /** Exclusive end of the legal validity interval; null means open-ended. */
  effective_to?: string | null;
  /** Bitemporal knowledge interval, normally RFC3339 UTC. */
  knowledge_from?: string | null;
  knowledge_to?: string | null;
  text_status?: string | null;
  date_status?: string | null;
  confidence?: string | null;
  legal_effect_verified?: boolean;
  legal_verification?: string | null;
  bgbl?: KerfBgblReference | string | null;
  procedure_id?: string | null;
}

export interface KerfActArchiveNorm {
  id?: string;
  enbez?: string;
  label?: string;
  title?: string;
}

export type KerfActArchiveGap = string | {
  from?: string | null;
  to?: string | null;
  label?: string | null;
  reason?: string | null;
};

/** A source row attached to a retrospective amendment event. These records
 * are evidence links, not claims that every source proves every event field. */
export interface KerfRetrospectiveEvidence {
  source?: string | null;
  url?: string | null;
  document?: string | null;
  procedure?: string | null;
  sha256?: string | null;
  observed_at?: string | null;
  state_sha256?: string | null;
}

export interface KerfRetrospectiveCommandRef {
  para?: string | null;
  paras?: string[] | null;
  absatz?: string | null;
  satz?: string | null;
  nummer?: string | null;
}

/** One mechanically extracted amendment command. Old text is deliberately
 * optional: an event remains useful even before a complete before-state is
 * reconstructed and verified. */
export interface KerfRetrospectiveCommand {
  item?: number | string | null;
  operation?: string | null;
  old_text_constraint?: string | null;
  new_text?: string | null;
  raw?: string | null;
  ref?: KerfRetrospectiveCommandRef | null;
}

/** Publication/effect event from the official retrospective ledger. It is a
 * dated legal fact, but not itself a checkoutable consolidated text state. */
export interface KerfRetrospectiveEvent {
  id?: string | null;
  event_id?: string | null;
  act_id?: string | null;
  act_title?: string | null;
  jurabk?: string | null;
  date: string;
  published_at?: string | null;
  effective_at?: string | null;
  observed_at?: string | null;
  knowledge_from?: string | null;
  knowledge_to?: string | null;
  document_id?: string | null;
  procedure_id?: string | null;
  procedure_title?: string | null;
  amending_article?: string | null;
  article_heading?: string | null;
  affected_norms?: string[];
  commands?: KerfRetrospectiveCommand[];
  command_count?: number;
  official_html_url?: string | null;
  official_pdf_url?: string | null;
  pdf_sha256?: string | null;
  text_sha256?: string | null;
  article_text_sha256?: string | null;
  integrity_basis?: string | null;
  publisher_checksum_available?: boolean;
  fundstelle?: string | null;
  publication_page?: string | null;
  publication_issue?: string | null;
  evidence?: KerfRetrospectiveEvidence[];
  gaps?: KerfActArchiveGap[];
  candidate_only?: boolean;
  future?: boolean;
  historical_text_reconstructed?: boolean;
  retroactive?: boolean;
  date_basis?: string | null;
  date_status?: string | null;
  text_status?: string | null;
  verification?: string | null;
  effective_date_status?: string | null;
  label?: string | null;
}

/** An official state capture. Unlike an event, a capture with a content
 * digest identifies a checkoutable text state for that observation day. */
export interface KerfRetrospectiveObservation {
  source?: string | null;
  source_store?: string | null;
  archive_url?: string | null;
  archive_timestamp?: string | null;
  id?: string | null;
  date?: string | null;
  label?: string | null;
  observed_at?: string | null;
  date_basis?: string | null;
  state_sha256?: string | null;
  state_digest?: string | null;
  source_url?: string | null;
  verification?: string | null;
  knowledge_from?: string | null;
  knowledge_to?: string | null;
}

/** Complete independently captured official text; capture time is not legal effect. */
export interface KerfOfficialState extends KerfRetrospectiveObservation {
  act_id?: string;
  jurabk?: string;
  captured_at?: string;
  norm_count?: number;
  original_url?: string;
  source_html_sha256?: string;
}

export interface KerfAmendingActAffectedAct {
  act_id: string;
  jurabk?: string | null;
  title?: string | null;
  event_count: number;
  command_count: number;
  affected_norms: string[];
}

export interface KerfAmendingActArticle {
  article?: string | null;
  heading?: string | null;
  affected_acts: string[];
  affected_norms: string[];
  command_count: number;
  events: KerfRetrospectiveEvent[];
}

/** One final BGBl amending document grouped across all corpus acts and
 * articles. Event-only history is kept distinct from consolidated states. */
export interface KerfAmendingAct {
  schema_version?: number | string | null;
  kind: 'kerf-amending-act';
  built_at?: string | null;
  as_of?: string | null;
  document_id: string;
  published_at?: string | null;
  published_dates: string[];
  procedure_id?: string | null;
  procedure_ids: string[];
  title?: string | null;
  titles: string[];
  official_html_url?: string | null;
  official_pdf_url?: string | null;
  pdf_sha256?: string | null;
  pdf_sha256s: string[];
  event_count: number;
  command_count: number;
  affected_acts: KerfAmendingActAffectedAct[];
  articles: KerfAmendingActArticle[];
  evidence: KerfRetrospectiveEvidence[];
  source_policy?: Record<string, unknown> | null;
  historical_text_reconstructed: boolean;
}

/** One amending BGBl document across all affected acts. */
export const kerfAmendingAct = (
  documentId: string,
  options: { asOf?: string } = {},
  signal?: AbortSignal,
) => {
  const params = new URLSearchParams();
  if (options.asOf) params.set('as_of', options.asOf);
  const query = params.size ? `?${params.toString()}` : '';
  return get<KerfAmendingAct>(
    `/amending-acts/${encodeURIComponent(documentId)}${query}`,
    signal,
  );
};

/** One legal-validity interval from the retrospective store. Legal validity
 * and Kerf knowledge time are separate half-open intervals. */
export interface KerfRetrospectiveInterval {
  id?: string | null;
  segment_id?: string | null;
  version_id?: string | null;
  state_sha256?: string | null;
  previous_state_sha256?: string | null;
  effective_from?: string | null;
  effective_to?: string | null;
  knowledge_from?: string | null;
  knowledge_to?: string | null;
  published_at?: string | null;
  observed_at?: string | null;
  last_observed_at?: string | null;
  verified_through_observed_at?: string | null;
  text_status?: string | null;
  date_status?: string | null;
  date_basis?: string | null;
  verification?: string | null;
  confidence?: string | null;
  exact?: boolean;
  partial?: boolean;
  /** Complete body assembled from a reviewed replay proof. This does not
   * imply that the bytes were captured from the historical source. */
  body_complete?: boolean;
  complete?: boolean;
  source_exact?: boolean;
  verified_reconstruction?: boolean;
  archive_status?: string | null;
  reverse_replay_verified?: boolean;
  gaps?: KerfActArchiveGap[];
  provenance?: Array<Record<string, unknown>> | Record<string, unknown> | null;
}

export interface KerfActRetrospectiveArchive {
  available?: boolean;
  as_of?: string | null;
  built_at?: string | null;
  history_start?: string | null;
  history_end?: string | null;
  date_semantics?: Record<string, unknown>;
  coverage?: {
    observed_from?: string | null;
    observed_through?: string | null;
    verified_legal_from?: string | null;
    exact_state_count?: number;
    accepted_transition_count?: number;
    has_unreviewed_transitions?: boolean;
  } | null;
  intervals: KerfRetrospectiveInterval[];
  events?: KerfRetrospectiveEvent[];
  observations?: KerfRetrospectiveObservation[];
  gaps?: KerfActArchiveGap[];
}

/** Available dated Markdown snapshots for one act. */
export interface KerfActArchive {
  act_id: string;
  head_date: string | null;
  entries: KerfActArchiveEntry[];
  norms?: Array<string | KerfActArchiveNorm>;
  gaps?: KerfActArchiveGap[];
  complete?: boolean;
  retrospective?: KerfActRetrospectiveArchive | null;
}

/** Resolved Markdown at a requested legal date. Retrospective responses name
 * the containing validity interval; conservative reconstructions retain
 * explicit coverage gaps. */
export interface KerfActMarkdown {
  source?: string | null;
  source_store?: string | null;
  archive_url?: string | null;
  archive_timestamp?: string | null;
  act_id: string;
  requested_at: string;
  resolved_at: string | null;
  head_date?: string | null;
  norm?: string | null;
  exact: boolean;
  partial: boolean;
  complete?: boolean;
  source_exact?: boolean;
  verified_reconstruction?: boolean;
  archive_status?: string | null;
  markdown: string;
  gaps?: KerfActArchiveGap[];
  observed_at?: string | null;
  date_basis?: string | null;
  verification?: string | null;
  state_sha256?: string | null;
  source_url?: string | null;
  builddate?: string | null;
  legal_effect_verified?: boolean;
  published_at?: string | null;
  effective_at?: string | null;
  review_id?: string | null;
  procedure_id?: string | null;
  as_of?: string | null;
  effective_from?: string | null;
  effective_to?: string | null;
  knowledge_from?: string | null;
  knowledge_to?: string | null;
  text_status?: string | null;
  date_status?: string | null;
  change_summary?: KerfChangeSummary | null;
}

export const kerfActArchive = (
  id: string,
  options: { asOf?: string } = {},
  signal?: AbortSignal,
) => {
  const params = new URLSearchParams();
  if (options.asOf) params.set('as_of', options.asOf);
  const query = params.size ? `?${params.toString()}` : '';
  return get<KerfActArchive>(
    `/acts/${encodeURIComponent(id)}/archive${query}`,
    signal,
  );
};

export const kerfActMarkdownUrl = (
  id: string,
  options: { at: string; asOf?: string; norm?: string; download?: boolean },
) => {
  const params = new URLSearchParams();
  if (options.at !== 'HEAD') params.set('at', options.at);
  if (options.asOf) params.set('as_of', options.asOf);
  if (options.norm) params.set('norm', options.norm);
  if (options.download) params.set('download', 'true');
  return kerfUrl(`/acts/${encodeURIComponent(id)}/markdown?${params.toString()}`);
};

const isRetrievalDateBasis = (value?: string | null) =>
  Boolean(value && /(?:retrieval|observed|observation|capture)/iu.test(value));

/** The archive serializer writes JSON-quoted scalar strings inside frontmatter.
 * Read only known provenance fields, bounded to the leading metadata block;
 * source text and arbitrary YAML features never become document metadata. */
function markdownProvenance(markdown: string): Partial<Pick<KerfActMarkdown, 'source' | 'source_url' | 'source_store' | 'archive_url' | 'archive_timestamp'>> {
  const frontmatter = /^\uFEFF?---[\t ]*\r?\n([\s\S]*?)\r?\n---[\t ]*(?:\r?\n|$)/u.exec(markdown.slice(0, 65_536));
  if (!frontmatter) return {};
  const result: Record<string, string> = {};
  const seen = new Set<string>();
  for (const match of frontmatter[1].matchAll(/^(source|source_url|source_store|archive_url|archive_timestamp):[\t ]*(.*)$/gmu)) {
    const key = match[1];
    if (seen.has(key)) { delete result[key]; continue; }
    seen.add(key);
    try {
      const value: unknown = JSON.parse(match[2]);
      if (typeof value === 'string' && value.length <= 8192) result[key] = value;
    } catch { /* Unsupported metadata cannot override the source document. */ }
  }
  return result;
}

/** Load a Markdown reconstruction. The API normally returns JSON metadata,
 * but accepting raw text/markdown keeps the client useful for direct-file
 * implementations too. */
export const kerfActMarkdown = (
  id: string,
  options: { at: string; asOf?: string; norm?: string },
  signal?: AbortSignal,
): Promise<KerfActMarkdown> => kerfRequest(kerfActMarkdownUrl(id, options), res => readActMarkdown(res, id, options), { signal });

async function readActMarkdown(
  res: Response,
  id: string,
  options: { at: string; asOf?: string; norm?: string },
): Promise<KerfActMarkdown> {
  if (!res.ok) throw httpError(res.status);

  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('json')) {
    const markdown = await res.text();
    const provenance = markdownProvenance(markdown);
    const resolvedAt = res.headers.get('x-kerf-resolved-date') ?? options.at;
    const exactHeader = res.headers.get('x-kerf-exact');
    const exact = exactHeader == null ? resolvedAt === options.at : exactHeader === 'true';
    const textStatus = res.headers.get('x-kerf-text-status');
    const archiveStatus = res.headers.get('x-kerf-archive-status');
    const verifiedHeader = res.headers.get(
      'x-kerf-verified-reconstruction',
    );
    const verifiedReconstruction = verifiedHeader == null
      ? textStatus === 'derived_verified'
      : verifiedHeader === 'true';
    const completeHeader = res.headers.get('x-kerf-complete');
    const sourceExactHeader = res.headers.get('x-kerf-source-exact');
    let gaps: KerfActArchiveGap[] | undefined;
    const gapsHeader = res.headers.get('x-kerf-archive-gaps');
    if (gapsHeader) {
      try {
        const parsed = JSON.parse(gapsHeader) as unknown;
        if (Array.isArray(parsed)) gaps = parsed as KerfActArchiveGap[];
      } catch {
        // The Markdown itself still contains the complete warning list.
      }
    }
    return {
      act_id: id,
      requested_at: options.at,
      resolved_at: resolvedAt,
      norm: options.norm ?? null,
      exact,
      partial: verifiedReconstruction ? false : !exact,
      complete: completeHeader == null
        ? exact || verifiedReconstruction : completeHeader === 'true',
      source_exact: sourceExactHeader == null
        ? verifiedReconstruction ? false : exact
        : sourceExactHeader === 'true',
      verified_reconstruction: verifiedReconstruction,
      archive_status: archiveStatus,
      markdown,
      gaps,
      observed_at: res.headers.get('x-kerf-observed-date')
        ?? (isRetrievalDateBasis(
          res.headers.get('x-kerf-date-basis'),
        ) ? resolvedAt : null),
      date_basis: res.headers.get('x-kerf-date-basis'),
      verification: res.headers.get('x-kerf-verification')
        ?? (exact ? 'exact' : null),
      state_sha256: res.headers.get('x-kerf-state-sha256'),
      source_url: res.headers.get('x-kerf-source-url') ?? provenance.source_url ?? null,
      source: res.headers.get('x-kerf-source') ?? provenance.source ?? null,
      source_store: provenance.source_store ?? null,
      archive_url: res.headers.get('x-kerf-archive-url') ?? provenance.archive_url ?? null,
      archive_timestamp: res.headers.get('x-kerf-archive-timestamp') ?? provenance.archive_timestamp ?? null,
      legal_effect_verified:
        res.headers.get('x-kerf-legal-effect-verified') === 'true',
      published_at: res.headers.get('x-kerf-published-date'),
      effective_at: res.headers.get('x-kerf-effective-date'),
      review_id: res.headers.get('x-kerf-review-id'),
      procedure_id: res.headers.get('x-kerf-procedure-id'),
      as_of: res.headers.get('x-kerf-as-of') ?? options.asOf ?? null,
      effective_from: res.headers.get('x-kerf-effective-from'),
      effective_to: res.headers.get('x-kerf-effective-to'),
      knowledge_from: res.headers.get('x-kerf-knowledge-from'),
      knowledge_to: res.headers.get('x-kerf-knowledge-to'),
      text_status: textStatus,
      date_status: res.headers.get('x-kerf-date-status'),
    };
  }

  const raw = await res.json() as Record<string, unknown>;
  const stringValue = (...keys: string[]) => {
    for (const key of keys) {
      if (typeof raw[key] === 'string') return raw[key] as string;
    }
    return null;
  };
  const resolvedAt = stringValue('resolved_at', 'date', 'at') ?? options.at;
  const exact = typeof raw.exact === 'boolean'
    ? raw.exact
    : resolvedAt === options.at;
  const textStatus = stringValue('text_status');
  const verifiedReconstruction = raw.verified_reconstruction === true
    || textStatus === 'derived_verified';
  const partial = verifiedReconstruction ? false
    : typeof raw.partial === 'boolean' ? raw.partial : !exact;
  return {
    act_id: stringValue('act_id') ?? id,
    requested_at: stringValue('requested_at', 'requested') ?? options.at,
    resolved_at: resolvedAt,
    head_date: stringValue('head_date'),
    norm: stringValue('norm') ?? options.norm ?? null,
    exact,
    partial,
    complete: typeof raw.complete === 'boolean'
      ? raw.complete : verifiedReconstruction || (exact && !partial),
    source_exact: typeof raw.source_exact === 'boolean'
      ? raw.source_exact : verifiedReconstruction ? false : exact,
    verified_reconstruction: verifiedReconstruction,
    archive_status: stringValue('archive_status'),
    markdown: stringValue('markdown', 'content', 'text') ?? '',
    gaps: Array.isArray(raw.gaps) ? raw.gaps as KerfActArchiveGap[] : undefined,
    observed_at: stringValue('observed_at'),
    date_basis: stringValue('date_basis'),
    verification: stringValue('verification'),
    state_sha256: stringValue('state_sha256', 'state_digest'),
    source_url: stringValue('source_url'),
    source: stringValue('source'),
    source_store: stringValue('source_store'),
    archive_url: stringValue('archive_url'),
    archive_timestamp: stringValue('archive_timestamp'),
    builddate: stringValue('builddate'),
    legal_effect_verified: raw.legal_effect_verified === true,
    published_at: stringValue('published_at'),
    effective_at: stringValue('effective_at'),
    review_id: stringValue('review_id'),
    procedure_id: stringValue('procedure_id'),
    as_of: stringValue('as_of') ?? options.asOf ?? null,
    effective_from: stringValue('effective_from'),
    effective_to: stringValue('effective_to'),
    knowledge_from: stringValue('knowledge_from'),
    knowledge_to: stringValue('knowledge_to'),
    text_status: textStatus,
    date_status: stringValue('date_status'),
    ...(raw.change_summary && typeof raw.change_summary === 'object' ? { change_summary: raw.change_summary as KerfChangeSummary } : {}),
  };
}

// ------------------------------------------------ retrospective comparison
export interface KerfActDiffPoint {
  requested_at?: string | null;
  resolved_at?: string | null;
  effective_from?: string | null;
  effective_to?: string | null;
  published_at?: string | null;
  observed_at?: string | null;
  knowledge_from?: string | null;
  knowledge_to?: string | null;
  state_sha256?: string | null;
  text_status?: string | null;
  date_status?: string | null;
  date_basis?: string | null;
  verification?: string | null;
  retroactive?: boolean;
  exact?: boolean;
  partial?: boolean;
  complete?: boolean;
  body_complete?: boolean;
  source_exact?: boolean;
  verified_reconstruction?: boolean;
  reverse_replay_verified?: boolean;
}

export interface KerfActDiffChange {
  operation: 'add' | 'remove' | 'replace' | string;
  enbez: string;
  title?: string | null;
  old?: string | null;
  new?: string | null;
  old_sha256?: string | null;
  new_sha256?: string | null;
}

export interface KerfActDiff {
  act_id: string;
  jurabk?: string | null;
  norm?: string | null;
  as_of?: string | null;
  from: KerfActDiffPoint;
  to: KerfActDiffPoint;
  exact: boolean;
  partial: boolean;
  complete?: boolean;
  source_exact?: boolean;
  verified_reconstruction?: boolean;
  gaps?: KerfActArchiveGap[];
  changes: KerfActDiffChange[];
}

export const kerfActDiff = (
  id: string,
  options: { from: string; to: string; asOf?: string; norm?: string },
  signal?: AbortSignal,
) => {
  const params = new URLSearchParams({ from: options.from, to: options.to });
  if (options.asOf) params.set('as_of', options.asOf);
  if (options.norm) params.set('norm', options.norm);
  return get<KerfActDiff>(
    `/acts/${encodeURIComponent(id)}/diff?${params.toString()}`,
    signal,
  );
};

// ------------------------------------------------------------- full search
/** A concrete norm hit returned by the corpus full-text index. Snippets are
 *  plain text (the UI highlights the query itself, never server HTML). */
export interface KerfActSearchHit extends KerfAct {
  score: number;
  snippet: string;
  matched_fields: string[];
  source: 'gii' | 'bayern_recht' | string;
  url: string;
}

export interface KerfNormSearchHit {
  act_id: string;
  jurabk: string;
  juris: string;
  act_title: string;
  /** Official norm designator, e.g. "§ 24" or "Art. 10". */
  enbez: string;
  norm_title: string;
  snippet: string;
  score: number;
  matched_fields: string[];
  source: 'gii' | 'bayern_recht' | string;
  url: string;
}

/** A current Bundestag/DIP legislative procedure matched by metadata. This is
 *  a tracked parliamentary process, not an enacted act or consolidated norm. */
export interface KerfProcedureSearchHit {
  id: string;
  title: string;
  date: string | null;
  updated?: string | null;
  status: string;
  gesta?: string | null;
  topics: string[];
  initiators: string[];
  descriptors: string[];
  summary: string;
  watched: boolean;
  watch?: {
    queries?: string[];
    scope?: string;
    draft_only?: boolean;
    relevant_norms?: string[];
  };
  url: string | null;
  score: number;
  matched_fields: string[];
  source: 'DIP' | string;
}

/** An official GII catalogue result outside Kerf's curated deep corpus.
 * It is discovery metadata only: the UI must link to GII and must not offer
 * local full text, history or synopsis controls for this row. */
export interface KerfCatalogSearchHit {
  id: `gii:${string}` | string;
  abbrev: string;
  title: string;
  url: string;
  score: number;
  matched_fields: string[];
  source: 'gii_catalog';
}

/** Search components the API reports on individually. */
export type KerfSearchComponentName =
  | 'acts' | 'norms' | 'procedures' | 'changes' | 'decisions' | 'catalog';

export interface KerfSearchComponentStatus {
  status: 'ok' | 'unavailable' | string;
  reason?: string | null;
  mode?: string | null;
}

/** Every search answers for the current consolidation only; historical
 *  wording is resolved per norm (`historical_text`). */
export interface KerfSearchTemporalScope {
  mode: 'current_consolidation' | string;
  historical_search?: 'unsupported' | string;
  historical_text?: string | null;
  valid_at?: string | null;
  changes?: string | null;
}

/** A recorded official amendment event matching the query (event record,
 *  not historical text). */
export interface KerfChangeSearchHit extends KerfRetrospectiveEvent {
  act_title?: string | null;
  future?: boolean;
}

export interface KerfSearch {
  query: string;
  /** 'partial' whenever at least one component did not answer. */
  status?: 'ok' | 'partial';
  components?: Partial<Record<KerfSearchComponentName, KerfSearchComponentStatus>>;
  /** Legacy title-substring count/rows, kept by the API for compatibility. */
  total: number;
  matches: KerfAct[];
  /** Null whenever a component was unavailable — never read that as 0. */
  result_total: number | null;
  /** Count over the components that did answer (with a partial result). */
  result_total_lower_bound?: number | null;
  result_total_is_partial?: boolean;
  total_semantics?: string;
  act_total: number;
  /** Null when the full-text index was unavailable. */
  norm_total: number | null;
  /** Optional while older API deployments are still in circulation. */
  procedure_total?: number | null;
  /** Additional official GII catalogue matches outside the deep corpus. */
  catalog_total?: number | null;
  /** Recorded amendment events; null when the ledger was unavailable. */
  change_total?: number | null;
  /** Court decisions; null when the decision index was unavailable. */
  decision_total?: number | null;
  /** Ranked title/alias hits. */
  act_matches: KerfActSearchHit[];
  /** Ranked §/Art. hits, grouped visually by act in the client. */
  norm_matches: KerfNormSearchHit[];
  /** Ranked current official DIP procedures. */
  procedure_matches?: KerfProcedureSearchHit[];
  /** Metadata-only federal-law discovery, always rendered as outbound links. */
  catalog_matches?: KerfCatalogSearchHit[];
  /** First page of matching amendment events. */
  change_matches?: KerfChangeSearchHit[];
  /** First page of matching court decisions. */
  decision_matches?: KerfDecision[];
  temporal_scope?: KerfSearchTemporalScope;
}

/** Ranked title + norm-body search. The client keeps its local title filter as
 *  an instant/failure fallback, then enriches it with this debounced request. */
export const kerfSearch = (
  q: string,
  params?: { limit?: number; normLimit?: number; lawJurisdiction?: string },
  signal?: AbortSignal,
) => {
  const sp = new URLSearchParams({
    q,
    limit: String(params?.limit ?? 40),
    norm_limit: String(params?.normLimit ?? 80),
  });
  if (params?.lawJurisdiction) sp.set('law_jurisdiction', params.lawJurisdiction);
  return get<KerfSearch>(`/search?${sp.toString()}`, signal);
};

// --------------------------------------------------- monitored procedures
export interface KerfCouncilDevelopment {
  source?: string | null;
  document?: string | null;
  url?: string | null;
  date?: string | null;
  title?: string | null;
  stage?: string | null;
  document_type?: string | null;
  addressee?: string | null;
  meeting_date?: string | null;
  content_accessible?: boolean | null;
  retrieval_status?: string | null;
  terminal?: boolean;
}

/** Official Council communication (e.g. a press release announcing a
 * political agreement). Documents an agreement in principle only — never
 * formal Council adoption, publication or applicable law. */
export interface KerfCouncilCommunication {
  source?: string | null;
  kind?: string | null;
  url?: string | null;
  date?: string | null;
  title?: string | null;
  stage?: string | null;
  body?: string | null;
  retrieval_status?: string | null;
  terminal?: boolean;
}

export interface KerfProcedureEvidence {
  label?: string | null;
  url?: string | null;
  source?: string | null;
  document?: string | null;
  date?: string | null;
}

export interface KerfProcedureAnalysisFact {
  id?: string | null;
  kind?: string | null;
  statement: string;
  statement_i18n?: KerfLocalizedText | null;
  status?: 'verified' | 'unverified' | string;
  source_urls?: string[];
  evidence?: KerfProcedureEvidence[];
  verified?: boolean;
}

export interface KerfProcedureAnalysisInference {
  id?: string | null;
  kind?: string | null;
  statement: string;
  statement_i18n?: KerfLocalizedText | null;
  basis?: string[];
  confidence?: string | null;
  source_urls?: string[];
}

export interface KerfProcedureForecast {
  outcome: string;
  likelihood?: {
    band?: string | null;
    minimum?: number | null;
    maximum?: number | null;
  } | null;
  confidence?: string | null;
  summary?: string | null;
  summary_i18n?: KerfLocalizedText | null;
  /** Always true for generated forecasts. Kept explicit so clients cannot
   * accidentally present an estimate as an official procedural fact. */
  not_a_fact?: boolean;
}

export interface KerfProcedureAnalysisFactor {
  kind?: 'supports' | 'against' | 'uncertainty' | string;
  direction?: 'supports' | 'against' | 'uncertainty' | string;
  label: string;
  label_i18n?: KerfLocalizedText | null;
  detail?: string | null;
  detail_i18n?: KerfLocalizedText | null;
  source_urls?: string[];
  evidence?: KerfProcedureEvidence[];
}

export interface KerfProcedureMilestone {
  kind?: string | null;
  label: string;
  label_i18n?: KerfLocalizedText | null;
  description?: string | null;
  description_i18n?: KerfLocalizedText | null;
  status?: 'expected' | 'pending' | 'completed' | string;
  expected_after?: string | null;
  conditions?: string[];
  source_urls?: string[];
  evidence?: KerfProcedureEvidence[];
}

export interface KerfProcedureAnalysisCheck {
  id?: string | null;
  kind?: 'source' | 'role' | 'transition' | 'final_text' | 'current_law' | 'chain' | string;
  label: string;
  status: 'passed' | 'failed' | 'pending' | 'not_applicable' | string;
  detail?: string | null;
  source_urls?: string[];
  evidence?: KerfProcedureEvidence[];
}

export interface KerfProcedureChronologyEntry {
  date?: string | null;
  label: string;
  kind?: 'official_event' | 'watch_transition' | 'document_chain'
    | 'promulgation' | 'entry_into_force' | string;
  status?: string | null;
  source_urls?: string[];
  evidence?: KerfProcedureEvidence[];
}

/** Deterministic assessment built from official evidence. Facts, inferences
 * and forecasts are intentionally separate API fields and separate UI blocks. */
export interface KerfProcedureAnalysis {
  schema_version?: number;
  as_of?: string | null;
  kind?: string | null;
  method?: string | null;
  summary?: string | null;
  summary_i18n?: KerfLocalizedText | null;
  facts?: KerfProcedureAnalysisFact[];
  inferences?: KerfProcedureAnalysisInference[];
  forecast?: KerfProcedureForecast | null;
  factors?: KerfProcedureAnalysisFactor[];
  next_milestone?: KerfProcedureMilestone | null;
  checks?: KerfProcedureAnalysisCheck[];
  chronology?: KerfProcedureChronologyEntry[];
  warnings?: string[];
}

/** A recorded transition in a monitored legislative procedure. Fields are
 * optional because archived seed records can predate the persistent monitor. */
export interface KerfProcedureWatchHistory {
  event?: string | null;
  checked_at?: string | null;
  changed_at?: string | null;
  observed_at?: string | null;
  from_status?: string | null;
  to_status?: string | null;
  from_stage?: string | null;
  status?: string | null;
  stage?: string | null;
  date?: string | null;
  official_updated?: string | null;
  title?: string | null;
  active?: boolean;
  terminal?: boolean;
  terminal_reason?: string | null;
  tracking_state?: string | null;
  source_stale?: boolean;
  retrieval_status?: string | null;
  retrieval_warning?: string | null;
  url?: string | null;
  adopted_celexes?: string[];
  official_journal?: Array<string | Record<string, unknown>>;
  publication_detected?: boolean;
  awaiting_final_review?: boolean;
  final_text_review?: KerfFinalTextReview | null;
  council_development?: KerfCouncilDevelopment | null;
  council_communication?: KerfCouncilCommunication | null;
}

/** Persistent monitor row. `active=false` means polling has stopped after a
 * terminal official outcome; the record and its history remain available. */
export interface KerfWatchedProcedure {
  id: string;
  watch_id?: string | null;
  source: string;
  jurisdiction?: string | null;
  title: string;
  status?: string | null;
  stage?: string | null;
  date?: string | null;
  updated?: string | null;
  last_checked?: string | null;
  last_changed?: string | null;
  active?: boolean;
  terminal?: boolean;
  tracking_state?: string | null;
  source_stale?: boolean;
  retrieval_status?: string | null;
  retrieval_warning?: string | null;
  url?: string | null;
  official_url?: string | null;
  scope?: string | null;
  draft_only?: boolean;
  relevant_norms?: string[];
  aliases?: string[];
  validation_ids?: string[];
  adopted_celexes?: string[];
  official_journal?: Array<string | Record<string, unknown>>;
  terminal_reason?: string | null;
  terminal_rule?: string | null;
  monitoring_stopped_at?: string | null;
  publication_detected?: boolean;
  awaiting_final_review?: boolean;
  final_text_review?: KerfFinalTextReview | null;
  council_development?: KerfCouncilDevelopment | null;
  council_communication?: KerfCouncilCommunication | null;
  analysis?: KerfProcedureAnalysis | null;
  tracking_hint?: string | null;
  history?: KerfProcedureWatchHistory[];
  watch?: {
    id?: string;
    source?: string;
    jurisdiction?: string;
    scope?: string;
    draft_only?: boolean;
    relevant_norms?: string[];
    validation_ids?: string[];
    official_url?: string;
  };
}

export interface KerfWatchedProcedures {
  generated_at?: string | null;
  checked_at?: string | null;
  active_count: number;
  terminal_count: number;
  procedures: KerfWatchedProcedure[];
}

/** Load the durable monitor, including archived terminal procedures.
 *
 *  Cache-busted per page load, for the same reason `kerfDigest` is: this
 *  endpoint is republished intra-day (the watch job runs twice daily, and any
 *  correction republishes again), so a cached copy shows a superseded card —
 *  an adopted act still badged "Entwurf". Reloading does not help, because an
 *  XHR answered from cache never reaches the network.
 *
 *  The server now sends `no-cache` here so nothing stores it going forward,
 *  but copies cached under the previous `max-age=3600` stay valid in browsers
 *  and in the nginx proxy cache for up to an hour. A per-load key sidesteps
 *  every one of those layers, and costs nothing once responses revalidate. */
export const kerfWatchedProcedures = (signal?: AbortSignal) =>
  get<KerfWatchedProcedures>(`/procedures/watched?t=${Date.now()}`, signal);

export interface KerfAmendmentFateDocument {
  role: string;
  document?: string | null;
  doc?: string | null;
  title?: string | null;
  date?: string | null;
  status?: string | null;
  disposition?: string | null;
  effect?: string | null;
  finding?: string | null;
  url?: string | null;
  vote_url?: string | null;
}

export interface KerfAmendmentFateCheck {
  type?: string | null;
  label?: string | null;
  passed?: boolean;
  result?: string | null;
  meaning?: string | null;
  act_id?: string | null;
  norm?: string | null;
  url?: string | null;
}

/** A mechanically checked amendment trail: proposal → recommendation →
 * plenary decision → promulgated/current law. */
export interface KerfAmendmentFate {
  id: string;
  procedure_id?: string | null;
  title: string;
  claim?: string | null;
  summary?: string | null;
  conclusion?: string | null;
  review_method?: string | null;
  result?: string | null;
  validated?: boolean;
  checked_at?: string | null;
  validation?: {
    checked_at?: string | null;
    method?: string | null;
    passed?: boolean;
    checks?: KerfAmendmentFateCheck[];
  };
  document_chain?: KerfAmendmentFateDocument[];
  checks?: KerfAmendmentFateCheck[];
  current_sources?: Array<{ label: string; url: string }>;
  case_law_context?: Array<{
    court: string;
    date?: string | null;
    docket?: string | null;
    finding: string;
    limit?: string | null;
    url?: string | null;
  }>;
}

export interface KerfAmendmentFates {
  generated_at?: string | null;
  total?: number;
  records: KerfAmendmentFate[];
}

export const kerfAmendmentFates = (
  procedureId?: string,
  signal?: AbortSignal,
) => get<KerfAmendmentFates>(
  `/amendment-fates${procedureId
    ? `?procedure_id=${encodeURIComponent(procedureId)}`
    : ''}`,
  signal,
);

/** Legislative commit graph — the Git-Log. */
export const kerfGitLog = (limit = 120, lane?: number, signal?: AbortSignal) =>
  get<KerfGit>(
    `/git?limit=${limit}${lane != null ? `&lane=${lane}` : ''}`, signal);

// ---------------------------------------------------------------- feed
/** One event in the realtime legislative feed (`GET /feed`). */
export interface KerfFeedEvent {
  /** Day of the row. For BGBl rows from the GII Aktualitätendienst this is
   *  the RSS/retrieval day unless `time_basis` says otherwise. */
  time: string;
  /** 'official_publication_date' when `time` is the promulgation day. */
  time_basis?: string | null;
  juris: string;
  source: string;
  kind: string;
  /** For BGBl rows: 'BGBl. 2026 I Nr. 273' or 'BGBl. … — <act title>'. */
  title: string;
  url: string | null;
  badge: string | null;
}
export interface KerfFeed { total: number; limit: number; events: KerfFeedEvent[] }

/** Realtime feed — verkündet / veröffentlicht / tritt in Kraft, newest first. */
export const kerfFeed = (limit = 120, signal?: AbortSignal) =>
  get<KerfFeed>(`/feed?limit=${limit}`, signal);

// ------------------------------------------------------------ hierarchy
export interface KerfEuInstrument {
  celex: string; kind: string; title: string;
  deu_mnes?: number; in_force?: boolean; geas?: boolean;
  in_corpus?: boolean;
}
export interface KerfHierAct {
  id: string; jurabk: string; juris: string; title: string;
  norms?: number; build?: string;
}
export interface KerfHierBill { date: string | null; title: string; drs?: string }
export interface KerfLandBill { title: string; date: string | null; url?: string | null }
export interface KerfLegalLayers {
  constitution: KerfHierAct[];
  statutes: KerfHierAct[];
  ordinances: KerfHierAct[];
}

/** Competence-aware legal structure; the sections are not a total rank order. */
export interface KerfHierarchy {
  meta?: {
    schema_version: number;
    model: string;
    not_a_total_order: boolean;
    coverage?: {
      laender_monitor?: 'origin_verification_required' | 'research_only';
      laender_keys?: number;
    };
  };
  eu: {
    /** Flat v1-compatible curated secondary-law list. */
    instruments: KerfEuInstrument[];
    primary?: { indexed: boolean; references: KerfEuInstrument[] };
    secondary?: {
      directives: KerfEuInstrument[];
      regulations: KerfEuInstrument[];
      other: KerfEuInstrument[];
    };
  };
  bund: {
    acts: KerfHierAct[];
    layers?: KerfLegalLayers;
    pipeline: Record<string, KerfHierBill[]>;
  };
  bayern: {
    acts: KerfHierAct[];
    layers?: KerfLegalLayers;
    pipeline: Record<string, KerfHierBill[]>;
  };
  laender: Record<string, KerfLandBill[]>;
}
export const kerfHierarchy = (signal?: AbortSignal) =>
  get<KerfHierarchy>('/hierarchy', signal);

// ----------------------------------------------------------- decisions
/** One norm (or EU instrument) a decision touches (`effects[]`). */
export interface KerfDecisionEffect {
  /** act id in the corpus (e.g. 'fed_asylblg') — clickable when present */
  act_id?: string;
  /** CELEX number for EU instruments */
  eu_celex?: string;
  jurabk: string;
  paras: string[];
  kind: 'disapplied' | 'incompatible' | 'referred' | 'interpreted' | 'applied' | 'cited';
  note: string;
}

/** Cross-reference between decisions (Vorlage → Urteil → Folgebeschluss). */
export interface KerfDecisionRelated {
  rel: 'follows' | 'answers' | 'cites';
  /** decision id */
  ref: string;
  label: string;
}

/** A court decision — Rechtsprechung that changes how an act applies,
 *  even before parliament amends it (`GET /decisions`). */
export interface KerfDecision {
  id: string;
  court: string;
  court_short: string;
  /** 'EuGH' | 'BVerfG' | 'BSG' | 'LSG' | 'SG' | … */
  level: string;
  az: string;
  date: string;
  kind: string;
  proc: string;
  juris: string;
  /** German headline */
  title: string;
  summary: { de: string; en?: string; ru?: string; ua?: string };
  outcome: string | null;
  effects: KerfDecisionEffect[];
  related: KerfDecisionRelated[];
  quote: string | null;
  url: string | null;
  source: string;
  /** anonymized full text, when available */
  text: string | null;
}

/** Per-act embedding: decisions on an act detail (`acts/{id}.decisions`),
 *  effects reduced to those touching that act. */
export interface KerfActDecisionRef {
  id: string;
  court_short: string;
  level: string;
  az: string;
  date: string;
  kind: string;
  title: string;
  effects: KerfDecisionEffect[];
}

export interface KerfDecisions {
  query: string | null;
  act: string | null;
  total: number;
  decisions: KerfDecision[];
}

/** Case law index — optionally filtered by free text and/or act id. */
export const kerfDecisions = (
  params?: { q?: string; act?: string; limit?: number },
  signal?: AbortSignal,
) => {
  const sp = new URLSearchParams();
  if (params?.q) sp.set('q', params.q);
  if (params?.act) sp.set('act', params.act);
  if (params?.limit != null) sp.set('limit', String(params.limit));
  const qs = sp.toString();
  return get<KerfDecisions>(`/decisions${qs ? `?${qs}` : ''}`, signal);
};

export interface FederalDecisionHit {
  id: string;
  document: string;
  ecli: string;
  court: string;
  decision_date: string;
  docket: string;
  source_url: string;
}

export interface FederalDecisionMatches {
  revision: string;
  items: FederalDecisionHit[];
  next: string | null;
}

export function kerfFederalDecisionSearch(query: string, after: string | null, signal: AbortSignal) {
  const params = new URLSearchParams({ q: query, limit: '20' });
  if (after) params.set('after', after);
  return get<FederalDecisionMatches>(`/courts/decisions/search?${params}`, signal);
}

export interface RiiDecisionMetadata {
  document: string;
  court: string;
  date: string;
  docket: string;
  ecli: string;
  form: string;
  source_page: string;
}

export interface RiiPassage {
  anchor: string;
  section: string;
  printed_number: string | null;
  text: string;
}

export function kerfRiiMetadata(document: string, signal: AbortSignal) {
  return get<{ revision: string; metadata: RiiDecisionMetadata }>(
    `/rii/decisions/${encodeURIComponent(document)}`, signal);
}

export function kerfRiiPassages(document: string, offset: number, signal: AbortSignal) {
  const params = new URLSearchParams({ offset: String(offset), limit: '100' });
  return get<{ revision: string; document: string; offset: number; total: number; passages: RiiPassage[] }>(
    `/rii/decisions/${encodeURIComponent(document)}/passages?${params}`, signal);
}

/** One decision by id. */
export const kerfDecision = (id: string, signal?: AbortSignal) =>
  get<KerfDecision>(`/decisions/${encodeURIComponent(id)}`, signal);

// ------------------------------------------------------------- EU index
/** One in-force directive or basic regulation (`GET /eu-index`). */
export interface KerfEuIndexRow {
  celex: string;
  /** 'DIR' | 'DIR_DEL' | 'DIR_IMPL' | 'REG' */
  type: string;
  date: string;
  title: string;
}
export interface KerfEuIndex {
  built_at: string;
  total: number;
  matched: number;
  offset: number;
  limit: number;
  instruments: KerfEuIndexRow[];
}

/** Server-side search over ~8k in-force directives/regulations. */
export const kerfEuIndex = (
  params?: { q?: string; kind?: 'DIR' | 'REG'; offset?: number; limit?: number },
  signal?: AbortSignal,
) => {
  const sp = new URLSearchParams({ limit: String(params?.limit ?? 200) });
  if (params?.q) sp.set('q', params.q);
  if (params?.kind) sp.set('kind', params.kind);
  if (params?.offset) sp.set('offset', String(params.offset));
  return get<KerfEuIndex>(`/eu-index?${sp.toString()}`, signal);
};

// --------------------------------------------------------------- stats
export interface KerfStats {
  built_at: string;
  acts_fed: number; acts_by: number;
  patches: Record<string, number>;
  vorgaenge: number; bay_bills: number; bay_verkuendet: number;
  eu_instruments: number; transpositions: number; feed_events: number;
  eu_index_total?: number;
  gii_catalog_total?: number;
  decisions?: number;
  search?: { acts: number; norms: number };
  data_policy?: {
    public_build: boolean;
    includes_quarantined_sources: boolean;
    excluded_snapshot_families?: string[];
  };
  graph: { nodes: number; edges: number; beliefs: number; ticks: number; worlds: number };
}
export const kerfStats = (signal?: AbortSignal) =>
  get<KerfStats>('/stats', signal);

/** Per-language texts the analysis emits alongside its flat German field. */
export type KerfLocalizedText = Partial<Record<'de' | 'en' | 'ru' | 'ua', string>>;

/** Prefer the reader's language, then German, then the legacy flat string.
 *
 *  The analysis pipeline emitted German prose as data and the UI printed it
 *  verbatim in every language. It now ships `<field>_i18n` beside each field;
 *  strings not yet in the message table simply have no twin and still render
 *  their German original, so conversion can proceed without a flag day. */
export const localizedAnalysisText = (
  flat: string | null | undefined,
  i18n: KerfLocalizedText | null | undefined,
  language: string,
): string => {
  const short = (language || 'de').slice(0, 2).toLowerCase();
  const key = (short === 'en' || short === 'ru' || short === 'ua' || short === 'uk')
    ? (short === 'uk' ? 'ua' : short) as 'en' | 'ru' | 'ua'
    : 'de';
  return i18n?.[key] ?? i18n?.de ?? flat ?? '';
};

// -------------------------------------------------------------- digest
/** LLM-generated corpus digest (`GET /digest`) — one text per UI language
 *  and period. Optional: the endpoint 404s until a digest has been built. */
export interface KerfDigest {
  generated_at: string;
  model: string;
  llm: boolean;
  periods: {
    year: Record<'de' | 'en' | 'ru' | 'ua', string>;
    month: Record<'de' | 'en' | 'ru' | 'ua', string>;
    upcoming: Record<'de' | 'en' | 'ru' | 'ua', string>;
  };
}
export const kerfDigest = (signal?: AbortSignal) => {
  // Daily cache-buster: the endpoint is served with max-age=3600, which kept
  // yesterday's digest in browsers for up to an hour after the nightly
  // regeneration. A date-keyed URL stays cacheable within the day.
  const day = new Date().toISOString().slice(0, 10);
  return get<KerfDigest>(`/digest?d=${day}`, signal);
};
