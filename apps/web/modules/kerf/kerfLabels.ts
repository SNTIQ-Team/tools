/**
 * Pure label / date / count helpers for the Kerf module. No React and no
 * i18n instance: functions return structured values (or i18n key suffixes)
 * and the components translate them. Every helper here encodes an evidence
 * rule — e.g. a GII reporting day is not a promulgation date, a null total is
 * not zero — so each one is unit-tested in kerfLabels.test.ts.
 */

import { formatDay, formatStamp } from '@/core/formatDay';
import type { KerfDecisionEffect, KerfFeedEvent, KerfPatch, KerfSearch } from './client';

// ------------------------------------------------------------------ dates
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/u;

/** Today's calendar day in Germany (YYYY-MM-DD) — legal dates are German days. */
export function berlinToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(now);
}

/** True only when the calendar day of `value` lies strictly after `today`. */
export function isAfterDay(value: string | null | undefined, today: string): boolean {
  const day = value?.slice(0, 10) ?? '';
  return DATE_ONLY.test(day) && day > today.slice(0, 10);
}

/** BCP-47 locale for Intl: the app's Ukrainian code 'ua' is 'uk' there. */
export function intlLocale(language: string | null | undefined): string {
  const short = (language || 'de').slice(0, 2).toLowerCase();
  return short === 'ua' ? 'uk' : short;
}

/** Monitor stamps: a date-only value (YYYY-MM-DD) is a calendar day and is
 *  formatted as such — no timezone conversion, no invented midnight time.
 *  Only real timestamps keep a time of day. */
export function formatWatchStamp(value: string | null | undefined, language: string): string {
  if (!value) return '—';
  // The site's formats in every language (core/formatDay.ts).
  void language;
  const trimmed = value.trim();
  if (DATE_ONLY.test(trimmed)) return formatDay(trimmed);
  if (Number.isNaN(new Date(trimmed).getTime())) return trimmed.slice(0, 16).replace('T', ' ');
  return formatStamp(trimmed);
}

// ------------------------------------------------------------ realtime feed
/** What the date of a feed row means. GII Aktualitätendienst rows for BGBl
 *  carry the RSS item/retrieval day — never present that as a promulgation
 *  date unless the API explicitly says it is the official publication day. */
export type FeedDateBasis = 'official_publication' | 'reported' | 'event';

export function feedDateBasis(event: Pick<KerfFeedEvent, 'source' | 'time_basis'>): FeedDateBasis {
  if (event.time_basis === 'official_publication_date') return 'official_publication';
  if (/^bgbl\b/iu.test((event.source ?? '').trim())) return 'reported';
  return 'event';
}

/** 'BGBl. 2026 I Nr. 273 — Gesetz zur …' → citation + act title. Rows that
 *  only carry the issue citation have no act title. */
export function splitBgblTitle(title: string): { citation: string | null; actTitle: string | null } {
  const text = (title ?? '').trim();
  const match = /^(BGBl\.?\s.+?)\s+[—–]\s+(.+)$/u.exec(text)
    ?? /^(BGBl\.?\s.+?)\s+-\s+(.+)$/u.exec(text);
  if (match) return { citation: match[1].trim(), actTitle: match[2].trim() || null };
  if (/^BGBl\b/u.test(text)) return { citation: text, actTitle: null };
  return { citation: null, actTitle: text || null };
}

export type FeedRow<T extends KerfFeedEvent = KerfFeedEvent> = T & {
  /** exact duplicates (same source + url + title + time) folded into this row */
  duplicates: number;
};

/** Drop exact duplicate rows while keeping order; count what was merged. */
export function dedupeFeedEvents<T extends KerfFeedEvent>(events: T[]): { rows: FeedRow<T>[]; merged: number } {
  const byKey = new Map<string, FeedRow<T>>();
  const rows: FeedRow<T>[] = [];
  let merged = 0;
  for (const event of events) {
    const key = [event.source, event.url ?? '', event.title, event.time].join('\u0000');
    const existing = byKey.get(key);
    if (existing) {
      existing.duplicates += 1;
      merged += 1;
      continue;
    }
    const row = { ...event, duplicates: 0 } as FeedRow<T>;
    byKey.set(key, row);
    rows.push(row);
  }
  return { rows, merged };
}

/** BGBl rows are reports, not promulgations: one BGBl issue can carry several
 *  acts (and several reports). Count distinct issues by URL (or citation). */
export function feedBgblCounts(events: KerfFeedEvent[]): { reports: number; issues: number } {
  const issues = new Set<string>();
  let reports = 0;
  for (const event of events) {
    if (!/^bgbl\b/iu.test((event.source ?? '').trim())) continue;
    reports += 1;
    issues.add(event.url || splitBgblTitle(event.title).citation || event.title);
  }
  return { reports, issues: issues.size };
}

// ------------------------------------------------------------------- commits
/** The API writes commit messages in German. Known prefixes are parsed so
 *  the UI can localize them and apply future-tense wording. */
export type CommitMessageKind = 'effective' | 'published' | 'observed';

export function parseCommitMessage(msg: string): { kind: CommitMessageKind | null; subject: string } {
  const text = (msg ?? '').trim();
  const rules: [RegExp, CommitMessageKind][] = [
    [/^Amtliche Änderung wirksam(?:\s*·\s*(.*))?$/u, 'effective'],
    [/^Amtliche Änderung veröffentlicht(?:\s*·\s*(.*))?$/u, 'published'],
    [/^Amtlicher konsolidierter Stand beobachtet(?:\s*·\s*(.*))?$/u, 'observed'],
  ];
  for (const [pattern, kind] of rules) {
    const match = pattern.exec(text);
    if (match) return { kind, subject: (match[1] ?? '').trim() };
  }
  return { kind: null, subject: text };
}

/** Effective day of a commit: explicit effective_at, else the commit date. */
export function commitEffectiveDay(commit: { effective_at?: string | null; date: string }): string {
  return (commit.effective_at || commit.date || '').slice(0, 10);
}

/** A commit is upcoming when its effective day is after today: it may be
 *  promulgated, but it must not be described as already in force. */
export function isUpcomingCommit(commit: { effective_at?: string | null; date: string }, today: string): boolean {
  return isAfterDay(commitEffectiveDay(commit), today);
}

// ----------------------------------------------------------------- decisions
const ARTICLE_ACTS = new Set([
  'GG', 'AEUV', 'EUV', 'GRCH', 'GRC', 'EMRK', 'MRK', 'BV', 'BAYVERF', 'BGBEG', 'EGBGB',
]);

/** '§' or 'Art.' for a decision's norm references. Articles: the Basic Law
 *  and other constitutions, EU instruments (RL/VO/CELEX), treaties, Bavarian
 *  statutes (not ordinances), or when the source already says 'Art'. */
export function normDesignator(effect: Pick<KerfDecisionEffect, 'jurabk' | 'paras'> & {
  act_id?: string | null; eu_celex?: string | null;
}): '§' | 'Art.' {
  const paras = effect.paras ?? [];
  if (paras.some((para) => /^\s*Art/iu.test(para))) return 'Art.';
  if (paras.length > 0 && paras.every((para) => /^\s*§/u.test(para))) return '§';
  if (effect.eu_celex) return 'Art.';
  const jurabk = (effect.jurabk ?? '').trim();
  const head = jurabk.split(/\s+/u)[0]?.toUpperCase() ?? '';
  if (ARTICLE_ACTS.has(head)) return 'Art.';
  if (/^(?:RL|VO|Richtlinie|Verordnung)\b/iu.test(jurabk)) return 'Art.';
  if (/\((?:EU|EG|EWG|Euratom)\)|\b\d{2,4}\/\d+\/(?:EU|EG|EWG)\b/iu.test(jurabk)) return 'Art.';
  // Bavarian statutes are divided into articles; its ordinances mostly use §.
  if (effect.act_id?.startsWith('by_') && !/(?:^DV|ZustV|V$|VO\b)/u.test(jurabk)) return 'Art.';
  return '§';
}

/** 'Art. 1, 2 GG', '§§ 1626, 1671 BGB', '§ 256 ZPO' — and just 'SGB 5' when
 *  the source names no section (never an orphan '§ SGB 5'). */
export function effectNormLabel(effect: Pick<KerfDecisionEffect, 'jurabk' | 'paras'> & {
  act_id?: string | null; eu_celex?: string | null;
}): string {
  const jurabk = (effect.jurabk ?? '').trim();
  const paras = (effect.paras ?? [])
    .map((para) => para.replace(/^\s*(?:§+|Art\.?|Artikel)\s*/iu, '').trim())
    .filter(Boolean);
  if (paras.length === 0) return jurabk;
  const designator = normDesignator(effect);
  const sign = designator === '§' && paras.length > 1 ? '§§' : designator;
  return `${sign} ${paras.join(', ')}${jurabk ? ` ${jurabk}` : ''}`;
}

/** Strongest legal effect first; 'cited' (a mere mention) always last. */
export const DECISION_EFFECT_ORDER = [
  'disapplied', 'incompatible', 'referred', 'interpreted', 'applied', 'cited',
] as const;

export function groupEffectsByKind<T extends { kind: string }>(effects: T[]): Array<{
  kind: string; effects: T[]; mention: boolean;
}> {
  const groups = new Map<string, T[]>();
  for (const effect of effects) {
    const kind = effect.kind || 'unknown';
    groups.set(kind, [...(groups.get(kind) ?? []), effect]);
  }
  const rank = (kind: string) => {
    const index = (DECISION_EFFECT_ORDER as readonly string[]).indexOf(kind);
    // unknown kinds sit before plain mentions but after the reviewed effects
    return index < 0 ? DECISION_EFFECT_ORDER.length - 1.5 : index;
  };
  return Array.from(groups.entries())
    .map(([kind, rows], order) => ({ kind, effects: rows, mention: kind === 'cited', order }))
    .sort((a, b) => rank(a.kind) - rank(b.kind) || a.order - b.order)
    .map(({ kind, effects: rows, mention }) => ({ kind, effects: rows, mention }));
}

/** A raw kind the UI does not know yet, made readable (never 'SOME_KIND'). */
export function humanizeKind(kind: string): string {
  return (kind || '').replace(/[_-]+/gu, ' ').trim().toLocaleLowerCase('de');
}

/** Decision summaries sometimes repeat the headline verbatim. */
export function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
  const norm = (value: string | null | undefined) => (value ?? '')
    .replace(/\s+/gu, ' ').replace(/[.\s]+$/u, '').trim().toLocaleLowerCase('de');
  const left = norm(a);
  return left.length > 0 && left === norm(b);
}

// -------------------------------------------------------------------- search
export const SEARCH_COMPONENTS = [
  'acts', 'norms', 'procedures', 'changes', 'decisions', 'catalog',
] as const;
export type SearchComponent = (typeof SEARCH_COMPONENTS)[number];

/** Components the API reports as not answered (anything but status 'ok'). */
export function unavailableSearchComponents(result: Pick<KerfSearch, 'components'> | null | undefined): SearchComponent[] {
  const components = result?.components ?? {};
  return SEARCH_COMPONENTS.filter((name) => {
    const status = components[name]?.status;
    return status != null && status !== 'ok';
  });
}

export function isSearchComponentUnavailable(
  result: Pick<KerfSearch, 'components'> | null | undefined, name: SearchComponent,
): boolean {
  return unavailableSearchComponents(result).includes(name);
}

/** Overall count: exact only when every component answered; otherwise the
 *  API's lower bound; otherwise unknown. A null total is never 0. */
export function searchTotalSummary(result: Pick<KerfSearch,
  'result_total' | 'result_total_lower_bound' | 'result_total_is_partial' | 'status'> | null | undefined,
): { kind: 'exact'; total: number } | { kind: 'lowerBound'; lower: number } | { kind: 'unknown' } {
  if (!result) return { kind: 'unknown' };
  const partial = result.status === 'partial' || result.result_total_is_partial === true;
  if (!partial && typeof result.result_total === 'number' && Number.isFinite(result.result_total)) {
    return { kind: 'exact', total: result.result_total };
  }
  const lower = result.result_total_lower_bound;
  if (typeof lower === 'number' && Number.isFinite(lower)) return { kind: 'lowerBound', lower };
  return { kind: 'unknown' };
}

/** '40 of 155' when the total is known; the shown count alone otherwise. */
export function shownOfTotal(shown: number, total: number | null | undefined): {
  shown: number; total: number | null; complete: boolean;
} {
  const known = typeof total === 'number' && Number.isFinite(total);
  return { shown, total: known ? total : null, complete: known && shown >= (total as number) };
}

const finiteOr = (value: unknown, fallback: number | null): number | null => {
  if (value === null) return null;
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

/** Normalize a /search payload for rendering. Explicit nulls (a component
 *  that did not answer) stay null; only fields an older API does not send at
 *  all fall back to the length of the returned rows. */
export function normalizeSearchResult(result: KerfSearch, query: string): KerfSearch & { enriched: boolean } {
  const enriched = Array.isArray(result.norm_matches);
  const matches = Array.isArray(result.matches) ? result.matches : [];
  const actMatches = Array.isArray(result.act_matches)
    ? result.act_matches
    : matches.map((act) => ({
        ...act, score: 0, snippet: '', matched_fields: [], source: '',
        url: `/acts/${encodeURIComponent(act.id)}`,
      }));
  const normMatches = enriched ? result.norm_matches : [];
  const procedureMatches = Array.isArray(result.procedure_matches) ? result.procedure_matches : [];
  const catalogMatches = Array.isArray(result.catalog_matches) ? result.catalog_matches : [];
  const changeMatches = Array.isArray(result.change_matches) ? result.change_matches : [];
  const decisionMatches = Array.isArray(result.decision_matches) ? result.decision_matches : [];
  const hasComponents = Boolean(result.components && Object.keys(result.components).length);
  const legacyTotal = actMatches.length + normMatches.length + procedureMatches.length
    + catalogMatches.length;
  return {
    ...result,
    enriched,
    query: result.query || query,
    total: finiteOr(result.total, matches.length) ?? matches.length,
    // Legacy APIs without component reporting: the old row-count sum.
    result_total: hasComponents || result.result_total === null
      ? finiteOr(result.result_total, null)
      : finiteOr(result.result_total, legacyTotal),
    act_total: finiteOr(result.act_total, actMatches.length) ?? actMatches.length,
    norm_total: finiteOr(result.norm_total, enriched ? normMatches.length : null),
    procedure_total: finiteOr(result.procedure_total, procedureMatches.length),
    catalog_total: finiteOr(result.catalog_total, catalogMatches.length),
    change_total: finiteOr(result.change_total, result.change_matches ? changeMatches.length : null),
    decision_total: finiteOr(result.decision_total, result.decision_matches ? decisionMatches.length : null),
    matches,
    act_matches: actMatches,
    norm_matches: normMatches,
    procedure_matches: procedureMatches,
    catalog_matches: catalogMatches,
    change_matches: changeMatches,
    decision_matches: decisionMatches,
  };
}

// ---------------------------------------------------------------- act header
/** What the act header may claim about amendments. `/acts` and the temporal
 *  envelope often carry no consolidated change count (0/null) although the
 *  official BGBl ledger lists amendments — 0 must not be shown as a fact. */
export function actChangeSummary(act: {
  temporal?: { change_count?: number | null } | null;
  retrospective?: { available?: boolean | null; current_events?: number | null } | null;
}): { kind: 'changes'; count: number } | { kind: 'bgblRecords'; count: number } | { kind: 'unknown' } {
  const count = act.temporal?.change_count;
  if (typeof count === 'number' && count > 0) return { kind: 'changes', count };
  const events = act.retrospective?.current_events;
  if (act.retrospective?.available && typeof events === 'number' && events > 0) {
    return { kind: 'bgblRecords', count: events };
  }
  return { kind: 'unknown' };
}

// ------------------------------------------------------------- draft patches
/** Location chip of a draft PatchInstruction. A patch without a section is
 *  act-level or its target was not extracted — never an orphan 'Abs. 2'. */
export function patchLocation(patch: Pick<KerfPatch, 'para' | 'absatz'>):
  | { kind: 'section'; label: string }
  | { kind: 'unknownSection'; absatz: string | null } {
  const para = patch.para?.trim();
  const absatz = patch.absatz?.trim() || null;
  if (!para) return { kind: 'unknownSection', absatz };
  const section = /^(?:§|Art)/u.test(para) ? para : `§ ${para}`;
  return { kind: 'section', label: absatz ? `${section} Abs. ${absatz}` : section };
}

// ----------------------------------------------------------------- hierarchy
/** A layer whose coverage is marked unavailable must not report '0 bills'. */
export function coverageCount(count: number, coverage: string | null | undefined):
  | { kind: 'count'; count: number; partial: boolean }
  | { kind: 'notCovered' } {
  const limited = Boolean(coverage) && !['complete', 'ok', 'full'].includes(String(coverage));
  if (limited && count === 0) return { kind: 'notCovered' };
  return { kind: 'count', count, partial: limited };
}

// --------------------------------------------------------- watched procedures
/** Known official status/stage values (EUR-Lex English, DIP German) mapped
 *  to i18n key suffixes under 'watch.statusValue.'. Unknown → null. */
export function procedureStatusValue(raw: string | null | undefined): {
  key: string; params?: Record<string, string>;
} | null {
  const text = (raw ?? '').replace(/\s+/gu, ' ').trim();
  if (!text) return null;
  const adopted = /^Completed\s*\(Adopted act:\s*([^)]+?)\s*\)$/iu.exec(text);
  if (adopted) return { key: 'completedAdopted', params: { act: adopted[1] } };
  const table: Record<string, string> = {
    ongoing: 'ongoing',
    completed: 'completed',
    'adoption by commission': 'commissionAdoption',
    'discussions within the council or its preparatory bodies': 'councilDiscussions',
    'preparation for a political agreement': 'preparingAgreement',
    'political agreement': 'politicalAgreement',
    'political agreement — formal council adoption pending': 'politicalAgreementPending',
    überwiesen: 'referred',
    verkündet: 'promulgated',
    verabschiedet: 'passed',
    abgelehnt: 'rejected',
    'noch nicht beraten': 'notDeliberated',
  };
  const key = table[text.toLocaleLowerCase('de')];
  return key ? { key } : null;
}

export type WatchTransition =
  | { kind: 'first'; to: string | null }
  | { kind: 'status'; from: string; to: string }
  | { kind: 'stage'; from: string; to: string }
  | { kind: 'evidence' }
  | { kind: 'event'; event: string }
  | { kind: 'label'; label: string };

/** Describe one monitor history row without inventing a '— → X' transition. */
export function describeWatchTransition(event: {
  event?: string | null; from_status?: string | null; to_status?: string | null;
  from_stage?: string | null; stage?: string | null; status?: string | null; title?: string | null;
}): WatchTransition | null {
  const from = event.from_status?.trim() || null;
  const to = event.to_status?.trim() || null;
  const fromStage = event.from_stage?.trim() || null;
  const stage = event.stage?.trim() || null;
  if (event.event === 'first_seen') return { kind: 'first', to: stage || to };
  if (from && to && from !== to) return { kind: 'status', from, to };
  if (fromStage && stage && fromStage !== stage) return { kind: 'stage', from: fromStage, to: stage };
  if (event.event === 'evidence_changed') return { kind: 'evidence' };
  if (!from && to) return { kind: 'first', to };
  if (event.event) return { kind: 'event', event: event.event };
  const label = stage || event.status?.trim() || event.title?.trim();
  return label ? { kind: 'label', label } : null;
}

/** Fold consecutive monitor observations without a status change (same
 *  label, or flagged `noChange`, e.g. only the evidence was refreshed) into
 *  the preceding observation, remembering how many and until when. */
export function collapseRepeatedObservations<T extends {
  label: string; kind?: string | null; date?: string | null; noChange?: boolean;
}>(
  rows: T[],
): Array<T & { repeats: number; lastDate: string | null }> {
  const out: Array<T & { repeats: number; lastDate: string | null }> = [];
  for (const row of rows) {
    const previous = out[out.length - 1];
    if (previous && row.kind === 'watch_transition' && previous.kind === 'watch_transition'
        && (previous.label === row.label || row.noChange === true)) {
      previous.repeats += 1;
      previous.lastDate = row.date ?? previous.lastDate;
      continue;
    }
    out.push({ ...row, repeats: 0, lastDate: null });
  }
  return out;
}
