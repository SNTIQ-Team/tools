'use client';

/**
 * Kerf — consolidated German and EU law, amendment history and the
 * official procedures that can change it. Three views:
 *
 *   Wiki / Realtime — the law index (/acts) as a searchable list; opening a
 *                     law loads /acts/{id} and shows its temporal header.
 *   Synopse         — the signature feature: each amendment's old→new text
 *                     as a LOCAL word-level diff (red <del> / green <ins>),
 *                     newest first, with §§ chips and status.
 *   Git-Log         — /git commits as a lane-coloured log (EU/Bund/Bayern/
 *                     Länder); merges (EU → DE) are marked.
 *
 * A thin API client (client.ts) and the diff (diff.ts) do the heavy lifting;
 * this file is presentation + tab state only.
 */

import { formatDay } from '@/core/formatDay';
import { IsoDateField } from '@/core/DateField';
import NightBand from '@/core/shell/NightBand';
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';
import {
  Archive, ArrowDownLeft, ArrowRight, ArrowUpRight, BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock3, Copy, Download, ExternalLink, FileDiff, FileText, GitBranch, GitCommitHorizontal, GitMerge, History, Library, Link2, ListTree, Loader2, Scale, Search, TriangleAlert, Waypoints,
} from 'lucide-react';
import { useModuleActions } from '@/core/shell/ModuleActions';
import {
  kerfAct, kerfActArchive, kerfActDiff, kerfActMarkdown, kerfActMarkdownUrl, kerfActs,
  kerfAmendmentFates, kerfDecisions, kerfDigest, kerfEuIndex, kerfFeed, kerfGitLog,
  kerfCitations, kerfHierarchy, kerfStats,
  kerfSearch, type KerfAct, type KerfActArchive, type KerfActArchiveGap,
  kerfWatchedProcedures, type KerfActDetail, type KerfActDiff, type KerfActMarkdown,
  type KerfAmendmentFate, type KerfCommit, type KerfDecision,
  type KerfCitationDirection, type KerfCitations, type KerfStatutoryCitation,
  localizedAnalysisText,
  type KerfCatalogSearchHit, type KerfDigest, type KerfEuIndex, type KerfFeedEvent, type KerfGit,
  type KerfChangeSearchHit, type KerfHierarchy, type KerfNormSearchHit, type KerfPatch,
  type KerfProcedureChronologyEntry, type KerfProcedureSearchHit, type KerfSearch, type KerfVersion,
  type KerfRetrospectiveCommand, type KerfRetrospectiveEvent, type KerfStats,
  type KerfWatchedProcedure, type KerfWatchedProcedures,
} from './client';
import { DiffLimitError, wordDiff, wordDiffSplit } from './diff';
import KerfReader from './KerfReader';
import FederalDecisionResults from './FederalDecisionResults';
import { toKerfRequestError, type KerfRequestError } from './kerfRequest';
import { readerCopy } from './readerI18n';
import workbench from './workbench.module.css';
import { laneLabel, workbenchLabels } from './workbenchLabels';
import { buildSynopsisTimeline, commandMatchesNorm, normKey } from './synopsisTimeline';
import ArchiveCoverageSummary from './ArchiveCoverageSummary';
import { officialActSource as actSourceUrl } from './officialSources';
import { readerDesignator, readerNormMatches } from './readerOutline';
import { decodeWorkspace } from './readerWorkspace';
import {
  buildArchiveTimeline, resolveArchiveTimelineItem,
  type ArchiveTimelineItem,
} from './retrospectiveTimeline';
import {
  groupLawIndexActs, type LawIndexGroupId, type LawIndexSubgroupId,
} from './lawIndexGroups';
import {
  actChangeSummary, berlinToday, collapseRepeatedObservations, coverageCount,
  dedupeFeedEvents, describeWatchTransition, effectNormLabel, feedBgblCounts,
  feedDateBasis, formatWatchStamp, groupEffectsByKind, humanizeKind, isAfterDay,
  isUpcomingCommit, commitEffectiveDay,
  normalizeSearchResult, parseCommitMessage, patchLocation, procedureStatusValue,
  sameText, searchTotalSummary, shownOfTotal, splitBgblTitle,
  unavailableSearchComponents, type FeedRow as FeedRowModel, type SearchComponent,
  type WatchTransition,
} from './kerfLabels';
import './i18n/register';

// force-directed QFS arena — canvas + physics, client-only
const KerfArenaGraph = dynamic(() => import('./KerfArenaGraph'), { ssr: false });

type Tab = 'reader' | 'wiki' | 'synopse' | 'decisions' | 'gitlog' | 'hierarchy' | 'graph';

/** Lanes: 0=EU, 1=Bund, 2=Bayern, 3=Länder. A lane is named in text; the dot
 *  is only a second cue. Literal classes so the Tailwind scanner keeps them. */
const LANE_META = [
  { text: 'text-main', border: 'border-[var(--panel-border)]', bg: '', dot: 'bg-indigo-500' },
  { text: 'text-main', border: 'border-[var(--panel-border)]', bg: '', dot: 'bg-blue-500' },
  { text: 'text-main', border: 'border-[var(--panel-border)]', bg: '', dot: 'bg-sky-500' },
  { text: 'text-main', border: 'border-[var(--panel-border)]', bg: '', dot: 'bg-violet-500' },
] as const;
const laneMeta = (i: number) => LANE_META[i] ?? LANE_META[3];

const STATUS_META: Record<string, string> = {
  proposed: 'text-[var(--c-warn)] border-[var(--panel-border)] ',
  adopted: 'text-[var(--c-link)] border-[var(--panel-border)] ',
  published: 'text-[var(--c-ok)] border-[var(--panel-border)] ',
  rejected: 'text-[var(--c-bad)] border-[var(--panel-border)] ',
  not_merged: 'text-muted border-[var(--panel-border)] bg-transparent',
};
const statusChip = (s: string) =>
  STATUS_META[s] ?? 'text-[var(--c-link)] border-[var(--panel-border)]';

const DIFF_CSS = `
.kerf-diff { line-height: 1.75; word-break: break-word; }
.kerf-diff del { background: color-mix(in srgb, var(--c-bad) 13%, transparent); color: var(--c-bad); text-decoration: line-through; text-decoration-color: color-mix(in srgb, currentColor 55%, transparent); border-radius: 2px; padding: 0 1px; }
.kerf-diff ins { background: color-mix(in srgb, var(--c-ok) 15%, transparent); color: var(--c-ok); text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: .22em; text-decoration-color: color-mix(in srgb, currentColor 45%, transparent); border-radius: 2px; padding: 0 1px; }
`;

// A day for reading: the site's DD.MM.YYYY (core/formatDay.ts).
const fmtDate = (d: string | null | undefined) => (d ? formatDay(d.slice(0, 10)) : '—');

/** Highlight query words without trusting or rendering server-provided HTML. */
const SearchExcerpt: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  const parts = useMemo(() => {
    const terms = Array.from(new Set(
      query.trim().split(/\s+/u).map((term) => term.trim()).filter(Boolean),
    )).sort((a, b) => b.length - a.length);
    if (terms.length === 0) return [text];
    const pattern = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    return text.split(new RegExp(`(${pattern})`, 'giu'));
  }, [text, query]);
  const needles = useMemo(
    () => new Set(query.trim().split(/\s+/u).filter(Boolean).map((term) => term.toLocaleLowerCase())),
    [query],
  );
  return <>{parts.map((part, i) => (
    needles.has(part.toLocaleLowerCase())
      ? <mark key={`${i}-${part}`} className="rounded-sm px-0.5 text-inherit ">{part}</mark>
      : <React.Fragment key={`${i}-${part}`}>{part}</React.Fragment>
  ))}</>;
};

/** small pill */
/** Inline metadata label. No pill, no uppercase: sentence case, and the
 *  colour passed in (status tokens only) always accompanies a text label. */
const Chip: React.FC<{
  className?: string; title?: string; children: React.ReactNode;
}> = ({
  className = '', title, children,
}) => (
  <span
    title={title}
    className={`kerf-chip inline-flex items-center gap-1 text-xs font-semibold ${className}`}
  >
    {children}
  </span>
);

const compactProcedureSummary = (text: string, limit = 560) => {
  const normalized = text.replace(/\s+/gu, ' ').trim();
  return normalized.length <= limit
    ? normalized
    : `${normalized.slice(0, limit - 1).trimEnd()}…`;
};

/** One reusable result section; semantic and literal hits differ only in
    their heading and ordering, not in controls or provenance. */
const NormSearchSection: React.FC<{
  id: string;
  title: string;
  hits: KerfNormSearchHit[];
  /** norm_total of the whole search (null: full-text index unavailable) */
  total: number | null | undefined;
  query: string;
  onSelect: (id: string, norm?: string | null) => void;
  onOpenSynopse: (id: string, norm?: string | null) => void;
}> = ({ id, title, hits, total, query, onSelect, onOpenSynopse }) => {
  const { t } = useTranslation('kerf');
  const count = shownOfTotal(hits.length, total);
  return (
    <section className="mt-5" aria-labelledby={id}>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h3 id={id} className="text-[13px] font-semibold text-main">
          {title}
        </h3>
        <span className="text-[11px] tabular-nums text-muted">
          {count.total != null
            ? t('searchShownOf', { shown: count.shown, total: count.total })
            : t('searchShownTotalUnknown', { shown: count.shown })}
        </span>
      </div>
      <ul className="space-y-2">
        {hits.map((hit, index) => {
          const officialUrl = actSourceUrl({
            id: hit.act_id, juris: hit.juris, jurabk: hit.jurabk,
          });
          return (
            <li
              key={`${hit.act_id}-${hit.enbez}-${index}`}
              className="rounded-xl border border-[var(--c-link)]/20 bg-[var(--c-link)]/[0.035] p-3.5"
            >
              <button
                type="button"
                onClick={() => onSelect(hit.act_id, hit.enbez)}
                className="w-full text-left group"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Chip className="text-[var(--c-link)] border-[var(--c-link)]/30 bg-[var(--c-link)]/10 shrink-0">
                    {hit.jurabk}
                  </Chip>
                  <span className="tabular-nums text-[11px] font-bold text-[var(--c-link)] shrink-0">
                    {hit.enbez}
                  </span>
                  <span className="text-xs font-semibold text-main truncate group-hover:text-[var(--c-link)] transition-colors">
                    {hit.act_title}
                  </span>
                </span>
                {hit.norm_title && (
                  <span className="block mt-1.5 text-xs font-medium text-main">
                    <SearchExcerpt text={hit.norm_title} query={query} />
                  </span>
                )}
                <span className="block mt-1.5 text-xs leading-relaxed text-muted line-clamp-3 whitespace-pre-wrap break-words">
                  <SearchExcerpt text={hit.snippet} query={query} />
                </span>
              </button>
              <div className="flex flex-wrap justify-end gap-2 mt-2">
                {officialUrl && (
                  <a
                    href={officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-muted hover:text-[var(--c-link)] hover:bg-[var(--panel-bg)] transition-colors"
                  >
                    <ExternalLink className="inline-block w-3.5 h-3.5 mr-1 align-[-2px]" />
                    {t('source')}
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => onSelect(hit.act_id, hit.enbez)}
                  className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-muted hover:text-main hover:bg-[var(--panel-bg)] transition-colors"
                >
                  <BookOpen className="inline-block w-3.5 h-3.5 mr-1 align-[-2px]" />
                  {t('searchSelectLaw')}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenSynopse(hit.act_id, hit.enbez)}
                  className="rounded-lg border border-[var(--c-link)]/30 bg-[var(--c-link)]/10 px-2.5 py-1.5 text-[11px] font-bold text-[var(--c-link)] hover:bg-[var(--c-link)]/15 transition-colors"
                > {t('viewSynopse')}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

/** Current official DIP procedures are deliberately separate from laws and
    norms: a tracked proposal can still change or fail. */
const ProcedureSearchSection: React.FC<{
  hits: KerfProcedureSearchHit[];
  total: number | null | undefined;
  query: string;
}> = ({ hits, total, query }) => {
  const { t } = useTranslation('kerf');
  return (
    <section className="mt-5" aria-labelledby="kerf-procedure-search-title">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3
            id="kerf-procedure-search-title"
            className="text-[13px] font-semibold text-main"
          >
            {t('searchTrackedProcedures')}
          </h3>
          <p className="mt-1 text-[11px] text-muted">{t('searchProcedureDisclaimer')}</p>
        </div>
        <span className="text-[11px] tabular-nums text-muted">
          {total != null
            ? t('searchShownOf', { shown: hits.length, total })
            : t('searchShownTotalUnknown', { shown: hits.length })}
        </span>
      </div>
      <ul className="space-y-2">
        {hits.map((hit) => (
          <li
            key={hit.id}
            className="rounded-xl border border-[var(--panel-border)] p-3.5"
          >
            <div className="flex flex-wrap items-center gap-1.5">
              {hit.watched && (
                <Chip className="border-[var(--panel-border)] text-[var(--c-warn)] ">
                  {t('searchWatched')}
                </Chip>
              )}
              {hit.watch?.draft_only && (
                <Chip className="border-[var(--panel-border)] text-[var(--c-bad)] ">
                  {t('searchDraftOnly')}
                </Chip>
              )}
              <Chip className="border-[var(--panel-border)] text-[var(--c-link)] ">
                {hit.source || 'DIP'}
              </Chip>
              <Chip className="border-[var(--panel-border)] bg-[var(--panel-bg)] text-main">
                {hit.status || '—'}
              </Chip>
            </div>
            <h4 className="mt-2 text-sm font-bold leading-snug text-main">
              <SearchExcerpt text={hit.title} query={query} />
            </h4>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] tabular-nums text-muted">
              {hit.gesta && <span>GESTA {hit.gesta}</span>}
              {hit.date && (
                <span>{t('searchProcedureStatusDate')}: {fmtDate(hit.date)}</span>
              )}
              {hit.updated && (
                <span>{t('searchProcedureUpdated')}: {fmtDate(hit.updated)}</span>
              )}
            </div>
            {hit.watch?.scope && (
              <p className="mt-2 line-clamp-3 text-[11px] leading-relaxed text-muted">
                <span className="font-semibold text-main">{t('searchProcedureScope')}:</span>{' '}
                <SearchExcerpt text={hit.watch.scope} query={query} />
              </p>
            )}
            {(hit.watch?.relevant_norms?.length ?? 0) > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="mr-0.5 text-[11px] font-semibold text-muted">
                  {t('searchRelevantNorms')}:
                </span>
                {hit.watch?.relevant_norms?.map((norm) => (
                  <span
                    key={norm}
                    className="inline-flex rounded border border-[var(--panel-border)] px-1.5 py-0.5 text-[11px] tabular-nums text-main "
                  >
                    {norm}
                  </span>
                ))}
              </div>
            )}
            {hit.summary && (
              <p className="mt-2 line-clamp-5 whitespace-pre-wrap break-words text-xs leading-relaxed text-muted">
                <SearchExcerpt text={compactProcedureSummary(hit.summary)} query={query} />
              </p>
            )}
            {hit.url && (
              <div className="mt-2 flex justify-end">
                <a
                  href={hit.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--panel-border)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--c-link)] transition-colors hover:bg-[var(--panel-bg)] "
                >
                  <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                  {t(hit.source.toLocaleLowerCase().includes('eur')
                    ? 'searchOpenEurLex'
                    : 'searchOpenDip')}
                </a>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};

/** Broad official discovery stays visually and semantically distinct from
    the locally indexed corpus: these rows have no local text or history. */
const CatalogSearchSection: React.FC<{
  hits: KerfCatalogSearchHit[];
  total: number | null | undefined;
  query: string;
}> = ({ hits, total, query }) => {
  const { t } = useTranslation('kerf');
  return (
    <section className="mt-5" aria-labelledby="kerf-catalog-search-title">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3
            id="kerf-catalog-search-title"
            className="text-[13px] font-semibold text-main"
          >
            {t('searchCatalogTitle')}
          </h3>
          <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-muted">
            {t('searchCatalogDisclaimer')}
          </p>
        </div>
        <span className="shrink-0 text-[11px] tabular-nums text-muted">
          {total != null
            ? t('searchCatalogShown', { shown: hits.length, total })
            : t('searchShownTotalUnknown', { shown: hits.length })}
        </span>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {hits.map((hit) => (
          <li key={hit.id} className="min-w-0">
            <a
              href={hit.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex h-full min-w-0 items-start gap-3 rounded-xl border border-[var(--panel-border)] p-3.5 transition-colors hover:border-[var(--c-text-main)] hover:bg-[var(--panel-bg)]"
            >
              <span className="mt-1 text-muted">
                <BookOpen aria-hidden="true" className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-snug text-main group-hover:text-[var(--c-link)] ">
                  <SearchExcerpt text={hit.title} query={query} />
                </span>
                <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] tabular-nums text-muted">
                  <span className="break-all">{hit.abbrev}</span>
                  <span aria-hidden="true">·</span>
                  <span>{t('searchCatalogMetadataOnly')}</span>
                </span>
              </span>
              <ExternalLink aria-hidden="true" className="mt-1 h-3.5 w-3.5 shrink-0 text-muted transition-colors group-hover:text-[var(--c-link)]" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
};

/** Overall search status: exact total, or a lower bound when a component did
    not answer — plus which components those were and the temporal scope. A
    null total is never shown as 0. */
const SearchStatusPanel: React.FC<{ result: KerfSearch }> = ({ result }) => {
  const { t } = useTranslation('kerf');
  const summary = searchTotalSummary(result);
  const unavailable = unavailableSearchComponents(result);
  const partial = result.status === 'partial' || result.result_total_is_partial === true
    || unavailable.length > 0;
  const counts: Array<[SearchComponent, number, number | null | undefined]> = [
    ['acts', result.act_matches.length, result.act_total],
    ['norms', result.norm_matches.length, result.norm_total],
    ['procedures', result.procedure_matches?.length ?? 0, result.procedure_total],
    ['changes', result.change_matches?.length ?? 0, result.change_total],
    ['decisions', result.decision_matches?.length ?? 0, result.decision_total],
    ['catalog', result.catalog_matches?.length ?? 0, result.catalog_total],
  ];
  return (
    <div className="mb-3 space-y-1.5">
      {partial && (
        <p role="status" className="flex items-start gap-2 rounded-xl border border-[var(--panel-border)] px-3 py-2 text-[11px] leading-relaxed text-[var(--c-warn)] ">
          <TriangleAlert aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--c-warn)]" />
          <span>{t('searchPartialBanner', {
            components: unavailable.map((name) => t(`searchComponent.${name}`)).join(', ') || '—',
          })}</span>
        </p>
      )}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[11px] tabular-nums text-muted">
        <span className="font-semibold text-main">
          {summary.kind === 'exact'
            ? t('searchResultTotal', { count: summary.total })
            : summary.kind === 'lowerBound'
              ? t('searchResultLowerBound', { count: summary.lower })
              : t('searchResultUnknown')}
        </span>
        {counts.map(([name, shown, total]) => {
          const missing = unavailable.includes(name);
          const count = shownOfTotal(shown, total);
          // An unreported total is never shown as 0: at most as '≥ shown'.
          if (!missing && count.total == null && shown === 0) return null;
          return (
            <span
              key={name}
              title={count.total != null
                ? t('searchShownOf', { shown: count.shown, total: count.total })
                : undefined}
              className={missing ? 'text-[var(--c-warn)] ' : undefined}
            >
              {t(`searchComponent.${name}`)}:{' '}
              {missing
                ? t('searchComponentUnavailable')
                : count.total == null
                  ? `≥ ${count.shown}`
                  : count.complete ? `${count.total}` : `${count.shown}/${count.total}`}
            </span>
          );
        })}
      </div>
      {result.temporal_scope && (
        <p className="text-[11px] leading-relaxed text-muted">{t('searchTemporalScope')}</p>
      )}
    </div>
  );
};

/** Recorded official amendment events matching the query: dated event
    records with their commands, not historical wording. */
const ChangeSearchSection: React.FC<{
  hits: KerfChangeSearchHit[];
  total: number | null | undefined;
  query: string;
  onOpenSynopse: (id: string, norm?: string | null) => void;
}> = ({ hits, total, query, onOpenSynopse }) => {
  const { t } = useTranslation('kerf');
  const today = berlinToday();
  return (
    <section className="mt-5" aria-labelledby="kerf-change-search-title">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="kerf-change-search-title" className="text-[13px] font-semibold text-main">
            {t('searchChangesTitle')}
          </h3>
          <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-muted">{t('searchChangesDisclaimer')}</p>
        </div>
        <span className="shrink-0 text-[11px] tabular-nums text-muted">
          {total != null
            ? t('searchShownOf', { shown: hits.length, total })
            : t('searchShownTotalUnknown', { shown: hits.length })}
        </span>
      </div>
      <ul className="space-y-2">
        {hits.map((hit, index) => {
          const upcoming = isAfterDay(hit.effective_at, today);
          const source = safeExternalHttpUrl(hit.official_html_url ?? '')
            ?? safeExternalHttpUrl(hit.official_pdf_url ?? '');
          const norms = hit.affected_norms ?? [];
          return (
            <li key={hit.id ?? hit.event_id ?? index} className="min-w-0 rounded-xl border border-[var(--panel-border)] p-3">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] tabular-nums text-muted">
                {hit.jurabk && (
                  <Chip className="text-[var(--c-link)] border-[var(--c-link)]/30 bg-[var(--c-link)]/10">{hit.jurabk}</Chip>
                )}
                {hit.published_at && <span>{t('archivePublishedAt', { date: hit.published_at })}</span>}
                <span className={upcoming ? 'text-main ' : undefined}>
                  {hit.effective_at
                    ? t(upcoming ? 'willTakeEffect' : 'validFrom', { date: hit.effective_at })
                    : t('archiveEffectiveUnresolved')}
                </span>
                {upcoming && (
                  <Chip className="text-main border-[var(--panel-border)] ">
                    <Clock3 aria-hidden="true" className="h-3 w-3" /> {t('gitUpcoming')}
                  </Chip>
                )}
              </div>
              <p className="mt-1.5 break-words text-xs font-semibold leading-snug text-main">
                <SearchExcerpt text={hit.procedure_title ?? hit.article_heading ?? hit.document_id ?? '—'} query={query} />
              </p>
              {hit.article_heading && hit.procedure_title && (
                <p className="mt-0.5 break-words text-[11px] text-muted">
                  {t('archiveAmendingArticle')} {hit.amending_article}: {hit.article_heading}
                </p>
              )}
              {norms.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {norms.slice(0, 10).map((norm, normIndex) => (
                    <Chip key={`${norm}-${normIndex}`} className="border-[var(--panel-border)] text-main">{norm}</Chip>
                  ))}
                  {norms.length > 10 && <span className="text-[11px] tabular-nums text-muted">+{norms.length - 10}</span>}
                </div>
              )}
              <div className="mt-2 flex flex-wrap justify-end gap-x-4 gap-y-1 text-[11px] font-bold text-[var(--c-link)]">
                {hit.act_id && (
                  <button type="button" onClick={() => onOpenSynopse(hit.act_id!)} className="inline-flex items-center gap-1 hover:underline"> {t('viewSynopse')}
                  </button>
                )}
                {hit.document_id && (
                  <Link href={`/dt/kerf/aenderungen/${encodeURIComponent(hit.document_id)}`} className="inline-flex items-center gap-1 hover:underline">
                    <FileText aria-hidden="true" className="h-3.5 w-3.5" />{hit.document_id}
                  </Link>
                )}
                {source && (
                  <a href={source} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
                    <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />{t('archiveOfficialSource')}
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

/** Court decisions matching the query: metadata rows linking to the
    decision permalink. */
const DecisionSearchSection: React.FC<{
  hits: KerfDecision[];
  total: number | null | undefined;
  query: string;
}> = ({ hits, total, query }) => {
  const { t } = useTranslation('kerf');
  return (
    <section className="mt-5" aria-labelledby="kerf-decision-search-title">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
        <h3 id="kerf-decision-search-title" className="text-[13px] font-semibold text-main">
          {t('searchDecisionsTitle')}
        </h3>
        <span className="shrink-0 text-[11px] tabular-nums text-muted">
          {total != null
            ? t('searchShownOf', { shown: hits.length, total })
            : t('searchShownTotalUnknown', { shown: hits.length })}
        </span>
      </div>
      <ul className="space-y-1.5">
        {hits.map((hit) => (
          <li key={hit.id} className="min-w-0">
            <Link
              href={`/dt/kerf/entscheidungen/${encodeURIComponent(hit.id)}`}
              className="group flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-xl border border-[var(--panel-border)] px-3 py-2 hover:border-[var(--c-text-main)]"
            >
              <Chip className={levelChip(hit.level)}>{hit.level}</Chip>
              <span className="text-[11px] tabular-nums text-muted">{hit.az}</span>
              <span className="text-[11px] tabular-nums text-muted">{fmtDate(hit.date)}</span>
              <span className="min-w-0 basis-full break-words text-xs font-semibold text-main group-hover:text-[var(--c-link)] sm:basis-auto">
                <SearchExcerpt text={hit.title} query={query} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};

// ---------------------------------------------------- persistent monitoring
const procedureStableId = (procedure: KerfWatchedProcedure) =>
  procedure.watch_id || procedure.watch?.id || procedure.id;

const procedureScope = (
  procedure: KerfWatchedProcedure,
  t: (key: string) => string,
  locale: string,
) => {
  /* The API ledger is German today. It is authoritative in German and after
   * the final EU wording has actually been reviewed; before that, known rows
   * use an explicit localized description rather than presenting German text
   * as though it were a translation. Unknown rows still fall back to API. */
  const officialScope = procedure.scope || procedure.watch?.scope;
  const id = procedureStableId(procedure);
  const knownId = id === 'ukraine-military-obligations-temporary-protection'
    || procedure.id === 'eu-2026-0186-nle'
    || id === 'ukraine-rechtskreiswechsel' || procedure.id === '329468'
    || id === 'stag-untaetigkeitsklage-amendment-fate' || procedure.id === '322125';
  const finalReviewPassed = procedure.final_text_review?.status?.toLocaleLowerCase() === 'passed'
    && procedure.final_text_review.article_2_compared === true;
  if (officialScope && (locale.toLocaleLowerCase().startsWith('de')
      || finalReviewPassed || !knownId)) return officialScope;
  if (id === 'ukraine-military-obligations-temporary-protection'
      || procedure.id === 'eu-2026-0186-nle') {
    return t('watch.scope.ukraineMilitary');
  }
  if (id === 'ukraine-rechtskreiswechsel' || procedure.id === '329468') {
    return t('watch.scope.ukraineBenefits');
  }
  if (id === 'stag-untaetigkeitsklage-amendment-fate'
      || procedure.id === '322125') {
    return t('watch.scope.stagDelay');
  }
  return officialScope || '';
};

const procedureNorms = (procedure: KerfWatchedProcedure) =>
  procedure.relevant_norms || procedure.watch?.relevant_norms || [];

const procedureValidationIds = (procedure: KerfWatchedProcedure) =>
  procedure.validation_ids || procedure.watch?.validation_ids || [];

const procedureOfficialUrl = (procedure: KerfWatchedProcedure) =>
  procedure.url || procedure.official_url || procedure.watch?.official_url || null;

const procedureIsActive = (procedure: KerfWatchedProcedure) => {
  if (typeof procedure.active === 'boolean') return procedure.active;
  if (procedure.terminal) return false;
  return !['archived', 'terminal', 'stopped'].includes(
    (procedure.tracking_state || '').toLocaleLowerCase(),
  );
};

const journalReference = (value: string | Record<string, unknown>) => {
  if (typeof value === 'string') return { label: value, url: null as string | null };
  const label = ['citation', 'celex', 'title', 'number']
    .map((key) => value[key])
    .find((item): item is string => typeof item === 'string' && item.length > 0)
    || 'Official Journal';
  const rawUrl = value.eli || value.url;
  return { label, url: typeof rawUrl === 'string' ? rawUrl : null };
};

const OfficialOutcomeRefs: React.FC<{
  celexes?: string[];
  journal?: Array<string | Record<string, unknown>>;
}> = ({ celexes = [], journal = [] }) => {
  const { t } = useTranslation('kerf');
  if (celexes.length === 0 && journal.length === 0) return null;
  return (
    <div className="mt-2.5 flex min-w-0 flex-wrap items-center gap-1.5">
      {celexes.map((celex) => (
        <a
          key={celex}
          href={`https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:${encodeURIComponent(celex)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-1 whitespace-normal break-words rounded border border-[var(--panel-border)] px-1.5 py-0.5 text-[11px] tabular-nums text-[var(--c-link)] [overflow-wrap:anywhere] hover:bg-[var(--panel-bg)] "
        >
          {t('watch.adoptedCelex')} {celex}
          <ExternalLink aria-hidden="true" className="h-2.5 w-2.5" />
        </a>
      ))}
      {journal.map((raw, index) => {
        const ref = journalReference(raw);
        const body = <>{t('watch.officialJournal')}: {ref.label}</>;
        return ref.url ? (
          <a
            key={`${ref.label}-${index}`}
            href={ref.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-1 whitespace-normal break-words rounded border border-[var(--panel-border)] px-1.5 py-0.5 text-[11px] tabular-nums text-[var(--c-ok)] [overflow-wrap:anywhere] hover:bg-[var(--panel-bg)] "
          >
            {body}<ExternalLink aria-hidden="true" className="h-2.5 w-2.5" />
          </a>
        ) : (
          <span key={`${ref.label}-${index}`} className="min-w-0 max-w-full whitespace-normal break-words rounded border border-[var(--panel-border)] px-1.5 py-0.5 text-[11px] tabular-nums text-[var(--c-ok)] [overflow-wrap:anywhere] ">
            {body}
          </span>
        );
      })}
    </div>
  );
};

const AmendmentValidation: React.FC<{ fate: KerfAmendmentFate }> = ({ fate }) => {
  const { t } = useTranslation('kerf');
  const chain = fate.document_chain ?? [];
  const checks = fate.validation?.checks ?? fate.checks ?? [];
  const validated = fate.validation?.passed ?? fate.validated ?? false;
  const knownSummary = fate.id === 'stag6-untaetigkeitsklage-12-months'
    ? t('watch.validation.stagDelay')
    : fate.summary || fate.claim || '';
  return (
    <div className="mt-3 min-w-0 overflow-hidden rounded-xl border border-[var(--panel-border)] ">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--panel-border)] px-3.5 py-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[var(--c-ok)] ">
            {t('watch.validationTitle')}
          </p>
          <h5 className="mt-1 max-w-full whitespace-normal break-words text-xs font-bold leading-snug text-main [overflow-wrap:anywhere]">{fate.title}</h5>
        </div>
        <Chip className={validated
          ? 'border-[var(--panel-border)] text-[var(--c-ok)] '
          : 'border-[var(--panel-border)] text-[var(--c-warn)] '}>
          {validated && <Check aria-hidden="true" className="h-3 w-3" />}
          {t(validated ? 'watch.validated' : 'watch.validationPending')}
        </Chip>
      </div>
      {knownSummary && (
        <p className="max-w-full whitespace-normal break-words px-3.5 pt-3 text-[11px] leading-relaxed text-muted [overflow-wrap:anywhere]">{knownSummary}</p>
      )}
      {chain.length > 0 && (
        <ol className="relative mx-3.5 my-3 space-y-2 border-l border-[var(--panel-border)] pl-4">
          {chain.map((document, index) => (
            <li key={`${document.document || document.doc || document.title}-${index}`} className="relative min-w-0">
              <span className="absolute -left-[1.21rem] top-1.5 h-2 w-2 rounded-full border border-[var(--panel-border)] bg-[var(--panel-bg)]" />
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-[13px] font-semibold text-[var(--c-ok)] ">
                  {t(`watch.role.${document.role}`, { defaultValue: document.role.replaceAll('_', ' ') })}
                </span>
                {document.url ? (
                  <a
                    href={document.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-1 whitespace-normal break-words text-[11px] tabular-nums font-bold text-main [overflow-wrap:anywhere] hover:text-[var(--c-link)]"
                  >
                    {document.document || document.doc || document.title || t('source')}
                    <ExternalLink aria-hidden="true" className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="min-w-0 max-w-full whitespace-normal break-words text-[11px] tabular-nums font-bold text-main [overflow-wrap:anywhere]">
                    {document.document || document.doc || document.title}
                  </span>
                )}
                {document.vote_url && (
                  <a
                    href={document.vote_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-1 whitespace-normal break-words text-[11px] font-bold text-[var(--c-link)] [overflow-wrap:anywhere] hover:underline "
                  >
                    {t('watch.officialVote')}
                    <ExternalLink aria-hidden="true" className="h-2.5 w-2.5" />
                  </a>
                )}
              </div>
              {(document.finding || document.effect) && (
                <p className="mt-0.5 max-w-full whitespace-normal break-words text-[11px] leading-relaxed text-muted [overflow-wrap:anywhere]">
                  {document.finding || document.effect}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
      {(fate.current_sources?.length ?? 0) > 0 && (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 px-3.5 pb-3">
          <span className="mr-0.5 text-[11px] font-semibold text-muted">{t('watch.currentLawSources')}:</span>
          {fate.current_sources?.map((source) => (
            <a
              key={source.url}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-1 whitespace-normal break-words rounded border border-[var(--panel-border)] px-1.5 py-0.5 text-[11px] tabular-nums text-[var(--c-link)] [overflow-wrap:anywhere] hover:bg-[var(--panel-bg)] "
            >
              {source.label}<ExternalLink aria-hidden="true" className="h-2.5 w-2.5" />
            </a>
          ))}
        </div>
      )}
      {checks.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3.5 pb-3">
          {checks.map((check, index) => (
            <span
              key={`${check.type}-${check.norm}-${index}`}
              className={`inline-flex min-w-0 max-w-full flex-wrap items-center gap-1 whitespace-normal break-words rounded-md border px-2 py-1 text-[11px] tabular-nums [overflow-wrap:anywhere] ${
                check.passed
                  ? 'border-[var(--panel-border)] text-[var(--c-ok)] '
                  : 'border-[var(--panel-border)] text-[var(--c-warn)] '
              }`}
            >
              {check.passed && <Check aria-hidden="true" className="h-3 w-3" />}
              {check.label || check.meaning || check.norm || check.result || check.type}
            </span>
          ))}
        </div>
      )}
      {(fate.case_law_context?.length ?? 0) > 0 && (
        <details className="group border-t border-[var(--panel-border)]">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-[11px] font-bold text-main marker:hidden">
            <Scale aria-hidden="true" className="h-3.5 w-3.5 text-[var(--c-ok)] " />
            {t('watch.caseLawContext', { count: fate.case_law_context?.length ?? 0 })}
            <ChevronDown aria-hidden="true" className="ml-auto h-3.5 w-3.5 text-muted transition-transform group-open:rotate-180" />
          </summary>
          <ul className="space-y-2 border-t border-[var(--panel-border)] px-3.5 py-3">
            {fate.case_law_context?.map((item, index) => (
              <li key={`${item.court}-${item.docket}-${index}`} className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)]/55 p-2.5">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-[11px] font-bold text-main">
                    {item.court}{item.docket ? ` · ${item.docket}` : ''}
                  </span>
                  {item.date && <span className="text-[11px] tabular-nums text-muted">{fmtDate(item.date)}</span>}
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={t('source')}
                      className="text-[var(--c-link)] hover:text-[var(--c-link)] "
                    >
                      <ExternalLink aria-hidden="true" className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-muted">{item.finding}</p>
                {item.limit && (
                  <p className="mt-1.5 rounded-md border border-[var(--panel-border)] px-2 py-1.5 text-[11px] leading-relaxed text-[var(--c-warn)] ">
                    <span className="font-bold">{t('watch.caseLimit')}:</span> {item.limit}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};

const WATCH_WRAP = 'min-w-0 max-w-full whitespace-normal break-words [overflow-wrap:anywhere]';

const sourceLabel = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./u, '');
  } catch {
    return url;
  }
};

const WatchSourceLinks: React.FC<{
  urls?: string[];
  evidence?: Array<{ label?: string | null; source?: string | null; document?: string | null; url?: string | null }>;
}> = ({ urls = [], evidence = [] }) => {
  const { t } = useTranslation('kerf');
  const links = [
    ...urls.map((url) => ({ url, label: sourceLabel(url) })),
    ...evidence
      .filter((item): item is typeof item & { url: string } => Boolean(item.url))
      .map((item) => ({
        url: item.url,
        label: item.label || item.document || item.source || sourceLabel(item.url),
      })),
  ].filter((item, index, all) => all.findIndex((other) => other.url === item.url) === index);
  if (links.length === 0) return null;
  return (
    <div className="mt-1.5 flex min-w-0 flex-wrap gap-1.5">
      {links.map((item) => (
        <a
          key={item.url}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex ${WATCH_WRAP} items-center gap-1 rounded border border-[var(--panel-border)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--c-link)] hover:bg-[var(--panel-bg)] `}
          aria-label={`${t('source')}: ${item.label}`}
        >
          <ExternalLink aria-hidden="true" className="h-2.5 w-2.5 shrink-0" />
          <span className={WATCH_WRAP}>{item.label}</span>
        </a>
      ))}
    </div>
  );
};

const likelihoodLabel = (
  likelihood: { band?: string | null; minimum?: number | null; maximum?: number | null } | null | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
) => {
  if (!likelihood) return null;
  return likelihood.band
    ? t(`watch.likelihood.${likelihood.band}`, { defaultValue: likelihood.band.replaceAll('_', ' ') })
    : null;
};

/** The backend deliberately separates verified facts, deterministic
 * inferences and a rules-based forecast. Keep those epistemic labels visible
 * here too: an estimate must never look like an official procedural status. */
const ProcedureAssessment: React.FC<{ procedure: KerfWatchedProcedure }> = ({ procedure }) => {
  const { t, i18n } = useTranslation('kerf');
  /* Analysis prose ships per-language beside its German original;
     unconverted strings still fall back to that German. */
  const L = (flat: string | null | undefined,
             i18nText: Parameters<typeof localizedAnalysisText>[1]) =>
    localizedAnalysisText(flat, i18nText, i18n.language);
  const analysis = procedure.analysis;
  if (!analysis) return null;
  const forecast = analysis.forecast;
  const factors = analysis.factors ?? [];
  const checks = analysis.checks ?? [];
  const facts = analysis.facts ?? [];
  const inferences = analysis.inferences ?? [];
  const milestone = analysis.next_milestone;
  const likelihood = likelihoodLabel(forecast?.likelihood, t);
  const analysisText = L(analysis.summary, analysis.summary_i18n)
    || L(inferences[0]?.statement, inferences[0]?.statement_i18n)
    || t('watch.analysisPending');
  const forecastSummary = L(forecast?.summary, forecast?.summary_i18n)
    || (forecast?.outcome && !forecast.outcome.includes('_') ? forecast.outcome : null);
  /* The API often repeats the analysis sentence as the forecast summary; the
     forecast box then leads with the likelihood instead of the same text. */
  const forecastRepeats = sameText(forecastSummary, analysisText);
  const forecastHeadline = (!forecastRepeats && forecastSummary)
    || likelihood || t('watch.forecastPending');

  return (
    <section className="mt-3 min-w-0 overflow-hidden rounded-xl border border-[var(--panel-border)] ">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2 border-b border-[var(--panel-border)] px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-main ">
            {t('watch.assessmentTitle')}
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
            {t('watch.assessmentMethod')}
          </p>
        </div>
        {analysis.as_of && (
          <span className={`max-w-full text-[11px] tabular-nums text-muted ${WATCH_WRAP}`}>
            {formatWatchStamp(analysis.as_of, i18n.language)}
          </span>
        )}
      </div>

      <div className="grid min-w-0 gap-2 p-2.5 lg:grid-cols-3">
        <div className="min-w-0 rounded-lg border border-[var(--panel-border)] p-2.5">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--c-ok)] ">
            <Check aria-hidden="true" className="h-3 w-3 shrink-0" /> {t('watch.fact')}
          </p>
          <p className={`mt-1.5 text-[11px] font-semibold leading-relaxed text-main ${WATCH_WRAP}`}>
            {L(facts[0]?.statement, facts[0]?.statement_i18n)
              || procedure.stage || procedure.status || t('watch.statusChecked')}
          </p>
          {facts.length > 0 && (
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              {t('watch.verifiedFacts', { count: facts.filter((item) =>
                item.status === 'verified' || item.verified === true).length })}
            </p>
          )}
        </div>

        <div className="min-w-0 rounded-lg border border-[var(--panel-border)] p-2.5">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-main ">
            {t('watch.analysis')}
          </p>
          <p className={`mt-1.5 text-[11px] leading-relaxed text-muted ${WATCH_WRAP}`}>
            {analysisText}
          </p>
        </div>

        <div className="min-w-0 rounded-lg border border-[var(--panel-border)] p-2.5">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-1.5">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--c-warn)] ">
              <Clock3 aria-hidden="true" className="h-3 w-3 shrink-0" /> {t('watch.forecast')}
            </p>
            {forecast?.confidence && (
              <span className={`rounded border border-[var(--panel-border)] px-1.5 py-0.5 text-[13px] tabular-nums text-[var(--c-warn)] ${WATCH_WRAP}`}>
                {t('watch.confidence', {
                  value: t(`watch.confidence.${forecast.confidence}`, { defaultValue: forecast.confidence }),
                })}
              </span>
            )}
          </div>
          <p className={`mt-1.5 text-[11px] font-semibold leading-relaxed text-main ${WATCH_WRAP}`}>
            {forecastHeadline}
          </p>
          {likelihood && forecastHeadline !== likelihood && (
            <p className={`mt-1 text-[11px] tabular-nums text-[var(--c-warn)] ${WATCH_WRAP}`}>
              {likelihood}
            </p>
          )}
          <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--c-warn)] ">
            {t('watch.forecastDisclaimer')}
          </p>
        </div>
      </div>

      {milestone && (
        <div className="mx-2.5 mb-2.5 min-w-0 rounded-lg border border-[var(--panel-border)] p-2.5">
          <p className="text-[13px] font-semibold text-[var(--c-link)] ">
            {t('watch.nextMilestone')}
          </p>
          <p className={`mt-1 text-[11px] font-semibold leading-relaxed text-main ${WATCH_WRAP}`}>{L(milestone.label, milestone.label_i18n)}</p>
          {milestone.description && (
            <p className={`mt-1 text-[11px] leading-relaxed text-muted ${WATCH_WRAP}`}>{L(milestone.description, milestone.description_i18n)}</p>
          )}
          <WatchSourceLinks urls={milestone.source_urls} evidence={milestone.evidence} />
        </div>
      )}

      {(facts.length > 0 || inferences.length > 0 || factors.length > 0 || checks.length > 0
        || (analysis.warnings?.length ?? 0) > 0) && (
        <details className="group min-w-0 border-t border-[var(--panel-border)]">
          <summary className="flex min-w-0 cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-[11px] font-bold text-main marker:hidden">
            <Scale aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-main " />
            <span className={`min-w-0 ${WATCH_WRAP}`}>{t('watch.showReasoning')}</span>
            <ChevronDown aria-hidden="true" className="ml-auto h-3.5 w-3.5 shrink-0 text-muted transition-transform group-open:rotate-180" />
          </summary>
          <div className="min-w-0 space-y-3 border-t border-[var(--panel-border)] p-3">
            {facts.length > 0 && (
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-[var(--c-ok)] ">{t('watch.facts')}</p>
                <ul className="mt-1.5 space-y-2">
                  {facts.map((fact, index) => (
                    <li key={fact.id || index} className="min-w-0 text-[11px] leading-relaxed text-muted">
                      <span className={fact.status === 'verified' || fact.verified
                        ? 'text-[var(--c-ok)] ' : 'text-[var(--c-warn)] '}>●</span>{' '}
                      <span className={WATCH_WRAP}>{L(fact.statement, fact.statement_i18n)}</span>
                      <WatchSourceLinks urls={fact.source_urls} evidence={fact.evidence} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {inferences.length > 0 && (
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-main ">{t('watch.inferences')}</p>
                <ul className="mt-1.5 space-y-2">
                  {inferences.map((item, index) => (
                    <li key={item.id || index} className={`min-w-0 text-[11px] leading-relaxed text-muted ${WATCH_WRAP}`}>
                      {L(item.statement, item.statement_i18n)}
                      {item.confidence && (
                        <span className="ml-1 text-[11px] tabular-nums text-main ">
                          · {t('watch.confidence', {
                            value: t(`watch.confidence.${item.confidence}`, { defaultValue: item.confidence }),
                          })}
                        </span>
                      )}
                      <WatchSourceLinks urls={item.source_urls} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {factors.length > 0 && (
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-main">{t('watch.factors')}</p>
                <ul className="mt-1.5 grid min-w-0 gap-1.5 sm:grid-cols-2">
                  {factors.map((factor, index) => {
                    const kind = factor.kind || factor.direction || 'uncertainty';
                    return (
                      <li key={`${factor.label}-${index}`} className="min-w-0 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)]/55 p-2">
                        <p className={`text-[13px] font-semibold ${kind === 'supports'
                          ? 'text-[var(--c-ok)] '
                          : kind === 'against' ? 'text-[var(--c-bad)] ' : 'text-[var(--c-warn)] '}`}>
                          {t(`watch.factor.${kind}`, { defaultValue: kind })}
                        </p>
                        <p className={`mt-0.5 text-[11px] font-semibold leading-relaxed text-main ${WATCH_WRAP}`}>{L(factor.label, factor.label_i18n)}</p>
                        {factor.detail && <p className={`mt-0.5 text-[11px] leading-relaxed text-muted ${WATCH_WRAP}`}>{L(factor.detail, factor.detail_i18n)}</p>}
                        <WatchSourceLinks urls={factor.source_urls} evidence={factor.evidence} />
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {checks.length > 0 && (
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-main">{t('watch.checks')}</p>
                <ul className="mt-1.5 space-y-1.5">
                  {checks.map((check, index) => (
                    <li key={check.id || index} className="flex min-w-0 items-start gap-2 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)]/55 p-2">
                      {check.status === 'passed'
                        ? <Check aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0 text-[var(--c-ok)]" />
                        : <Clock3 aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0 text-[var(--c-warn)]" />}
                      <div className="min-w-0">
                        <p className={`text-[11px] font-semibold leading-relaxed text-main ${WATCH_WRAP}`}>{check.label}</p>
                        {check.detail && <p className={`mt-0.5 text-[11px] leading-relaxed text-muted ${WATCH_WRAP}`}>{check.detail}</p>}
                        <WatchSourceLinks urls={check.source_urls} evidence={check.evidence} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(analysis.warnings?.length ?? 0) > 0 && (
              <ul className="space-y-1 rounded-lg border border-[var(--panel-border)] p-2 text-[11px] leading-relaxed text-[var(--c-warn)] ">
                {analysis.warnings?.map((warning, index) => <li key={index} className={WATCH_WRAP}>{warning}</li>)}
              </ul>
            )}
          </div>
        </details>
      )}
    </section>
  );
};

type WatchTimelineEntry = KerfProcedureChronologyEntry & { key: string; noChange?: boolean };

type WatchT = (key: string, options?: Record<string, unknown>) => string;

/** Official status/stage values arrive in the source language (EUR-Lex
 *  English, DIP German); known ones are localized, unknown ones kept. */
const watchStatusText = (raw: string | null | undefined, t: WatchT) => {
  const known = procedureStatusValue(raw);
  return known
    ? t(`watch.statusValue.${known.key}`, { ...known.params, defaultValue: raw ?? '' })
    : (raw ?? '—');
};

/** 'A → B' labels (from the monitor) are localized part by part. */
const watchTransitionText = (label: string, t: WatchT) =>
  label.split(/\s+→\s+/u).map((part) => watchStatusText(part, t)).join(' → ');

const watchHistoryLabel = (transition: WatchTransition | null, t: WatchT) => {
  if (!transition) return null;
  switch (transition.kind) {
    case 'first':
      return transition.to
        ? `${t('watch.event.first_seen')}: ${watchStatusText(transition.to, t)}`
        : t('watch.event.first_seen');
    case 'status':
    case 'stage':
      return `${watchStatusText(transition.from, t)} → ${watchStatusText(transition.to, t)}`;
    case 'evidence':
      return t('watch.event.evidence_changed');
    case 'event':
      return t(`watch.event.${transition.event}`, { defaultValue: humanizeKind(transition.event) });
    default:
      return watchStatusText(transition.label, t);
  }
};

/** Raw entry statuses ('verified', 'first_seen', …) are never shown as-is;
 *  free text (a source name) is kept, machine tokens are made readable. */
const watchEntryStatus = (status: string, t: WatchT) =>
  t(`watch.entryStatus.${status}`, {
    defaultValue: t(`watch.role.${status}`, {
      defaultValue: t(`watch.event.${status}`, {
        defaultValue: /\s/u.test(status) ? status : humanizeKind(status),
      }),
    }),
  });

const ProcedureChronology: React.FC<{
  procedure: KerfWatchedProcedure;
  fates: KerfAmendmentFate[];
}> = ({ procedure, fates }) => {
  const { t, i18n } = useTranslation('kerf');
  const rows: WatchTimelineEntry[] = [];
  const add = (entry: KerfProcedureChronologyEntry & { noChange?: boolean }) => {
    const date = entry.date || '';
    const label = entry.label?.trim();
    if (!label) return;
    const duplicate = rows.some((row) =>
      (row.date || '').slice(0, 10) === date.slice(0, 10)
      && row.label.toLocaleLowerCase() === label.toLocaleLowerCase());
    if (!duplicate) rows.push({ ...entry, key: `${date}-${entry.kind || 'event'}-${label}` });
  };

  (procedure.analysis?.chronology ?? []).forEach(add);
  /* The analysis chronology already records each monitor observation (same
     timestamp); history rows only fill in where it has none. */
  const observed = new Set(rows
    .filter((row) => row.kind === 'watch_transition' && row.date)
    .map((row) => row.date as string));
  (procedure.history ?? []).forEach((event) => {
    const date = event.changed_at || event.observed_at || event.checked_at || event.date;
    if (date && observed.has(date)) return;
    const described = describeWatchTransition(event);
    const transition = watchHistoryLabel(described, t);
    if (!transition) return;
    // The label already names the monitor event; no second status line.
    add({
      date,
      label: transition,
      kind: 'watch_transition',
      source_urls: event.url ? [event.url] : [],
      noChange: described?.kind === 'evidence',
    });
  });
  /* The analysis chronology already carries Council evidence as official
   * events (one entry per real-world step). These direct adds are only a
   * fallback for rows without an analysis block — re-adding the same source
   * under its longer title would render one step as two timeline entries. */
  const hasSource = (url?: string | null) =>
    Boolean(url) && rows.some((row) => (row.source_urls ?? []).includes(url as string));
  if (procedure.council_development && !hasSource(procedure.council_development.url)) {
    const council = procedure.council_development;
    add({
      date: council.date || council.meeting_date,
      label: council.title || council.stage || council.document || t('watch.councilDevelopment'),
      kind: 'official_event',
      status: council.document_type,
      source_urls: council.url ? [council.url] : [],
    });
  }
  if (procedure.council_communication && !hasSource(procedure.council_communication.url)) {
    const communication = procedure.council_communication;
    add({
      date: communication.date,
      label: communication.title || communication.stage || t('watch.councilCommunication'),
      kind: 'official_event',
      status: communication.source || communication.kind,
      source_urls: communication.url ? [communication.url] : [],
    });
  }
  fates.flatMap((fate) => fate.document_chain ?? []).forEach((document) => {
    add({
      date: document.date,
      label: [document.document || document.doc || document.title, document.finding || document.effect]
        .filter(Boolean).join(' · '),
      kind: document.role === 'promulgated_law' ? 'promulgation' : 'document_chain',
      status: document.status || document.disposition || document.role,
      source_urls: [document.url, document.vote_url].filter((url): url is string => Boolean(url)),
    });
  });

  rows.sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });
  if (rows.length === 0) return null;
  // Twice-daily checks without a status change collapse into one row.
  const shownRows = collapseRepeatedObservations(rows);

  return (
    <section className="mt-3 min-w-0 overflow-hidden rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)]/40">
      <div className="flex min-w-0 flex-wrap items-center gap-2 border-b border-[var(--panel-border)] px-3 py-2.5">
        <History aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[var(--c-link)]" />
        <h5 className="min-w-0 text-[11px] font-bold text-main">{t('watch.chronology')}</h5>
        <span className="rounded border border-[var(--panel-border)] px-1.5 py-0.5 text-[13px] font-semibold text-[var(--c-ok)] ">
          {t('watch.fact')}
        </span>
        <span className="ml-auto text-[11px] tabular-nums text-muted">{shownRows.length}</span>
      </div>
      <ol className="relative ml-4 max-h-[32rem] min-w-0 space-y-0 overflow-x-hidden overflow-y-auto border-l border-[var(--c-link)]/25 py-2.5 pr-2 sm:ml-5 sm:pr-3">
        {shownRows.map((entry) => (
          <li key={entry.key} className="relative min-w-0 pb-3 pl-4 last:pb-0 sm:pl-5">
            <span className="absolute -left-[4.5px] top-1.5 h-2 w-2 rounded-full border border-[var(--c-link)]/70 bg-[var(--panel-bg)]" />
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <time className={`text-[11px] tabular-nums font-semibold text-[var(--c-link)] ${WATCH_WRAP}`}>
                {entry.date ? formatWatchStamp(entry.date, i18n.language) : '—'}
              </time>
              {entry.kind && (
                <span className={`max-w-full rounded border border-[var(--panel-border)] px-1 py-0.5 text-[13px] tabular-nums text-muted ${WATCH_WRAP}`}>
                  {t(`watch.chronology.${entry.kind}`, {
                    defaultValue: entry.kind.replaceAll('_', ' '),
                  })}
                </span>
              )}
            </div>
            <p className={`mt-0.5 text-[11px] font-semibold leading-relaxed text-main ${WATCH_WRAP}`}>
              {entry.kind === 'watch_transition' || entry.kind === 'official_event'
                ? watchTransitionText(entry.label, t) : entry.label}
            </p>
            {entry.repeats > 0 && (
              <p className={`mt-0.5 text-[11px] leading-relaxed text-muted ${WATCH_WRAP}`}>
                {t('watch.repeatedObservations', {
                  count: entry.repeats,
                  date: formatWatchStamp(entry.lastDate, i18n.language),
                })}
              </p>
            )}
            {entry.status && <p className={`mt-0.5 text-[11px] leading-relaxed text-muted ${WATCH_WRAP}`}>{watchEntryStatus(entry.status, t)}</p>}
            <WatchSourceLinks urls={entry.source_urls} evidence={entry.evidence} />
          </li>
        ))}
      </ol>
    </section>
  );
};

const TrackedProcedureCard: React.FC<{
  procedure: KerfWatchedProcedure;
  fates: KerfAmendmentFate[];
}> = ({ procedure, fates }) => {
  const { t, i18n } = useTranslation('kerf');
  const active = procedureIsActive(procedure);
  const validationIds = new Set(procedureValidationIds(procedure));
  const matchedFates = fates.filter((fate) =>
    validationIds.has(fate.id) || fate.procedure_id === procedure.id);
  const url = procedureOfficialUrl(procedure);
  const status = procedure.stage || procedure.status || '—';
  const displayedStatus = status === 'Political agreement — formal Council adoption pending'
    ? t('watch.stage.politicalAgreementPending')
    : status === 'Political agreement'
      ? t('watch.stage.politicalAgreement') : watchStatusText(status, t);
  const council = procedure.council_development;
  const communication = procedure.council_communication;
  const scope = procedureScope(procedure, t, i18n.language);
  const norms = procedureNorms(procedure);
  const trackingState = (procedure.tracking_hint || procedure.tracking_state || '')
    .toLocaleLowerCase();
  const sourceMissing = trackingState === 'source_missing';
  // Once the act is published, the Council-stage caveats below stop being
  // true: they assert that adoption and OJ publication are still pending.
  const published = Boolean(procedure.publication_detected);
  const sourceStale = procedure.source_stale === true;
  const awaitingFinalReview = procedure.awaiting_final_review === true
    || trackingState === 'pending_final_review';
  const finalReviewPassed = procedure.final_text_review?.status?.toLocaleLowerCase() === 'passed'
    && procedure.final_text_review.article_2_compared === true;

  return (
    <article className="min-w-0 overflow-hidden rounded-xl border border-[var(--panel-border)] p-3 sm:p-5" data-active={active}>
      <div className="flex min-w-0 flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <Chip className={active
              ? `${WATCH_WRAP} border-[var(--panel-border)] text-[var(--c-warn)] `
              : `${WATCH_WRAP} border-[var(--panel-border)] bg-[var(--panel-bg)] text-muted`}>
              {t(active ? 'watch.active' : 'watch.archived')}
            </Chip>
            <Chip className={`${WATCH_WRAP} border-[var(--panel-border)] text-[var(--c-link)] `}>
              {procedure.source || procedure.watch?.source || '—'}
            </Chip>
            {(procedure.jurisdiction || procedure.watch?.jurisdiction) && (
              <Chip className={`${WATCH_WRAP} border-[var(--panel-border)] text-main `}>
                {procedure.jurisdiction || procedure.watch?.jurisdiction}
              </Chip>
            )}
            {(procedure.draft_only ?? procedure.watch?.draft_only) && (
              <Chip className={`${WATCH_WRAP} border-[var(--panel-border)] text-[var(--c-bad)] `}>
                {t('searchDraftOnly')}
              </Chip>
            )}
            {sourceMissing && (
              <Chip className={`${WATCH_WRAP} border-[var(--panel-border)] text-[var(--c-warn)] `}>
                <TriangleAlert aria-hidden="true" className="h-3 w-3" />
                {t('watch.sourceMissing')}
              </Chip>
            )}
            {sourceStale && (
              <Chip className={`${WATCH_WRAP} border-[var(--panel-border)] text-[var(--c-warn)] `}>
                <TriangleAlert aria-hidden="true" className="h-3 w-3" />
                {t('watch.sourceStale')}
              </Chip>
            )}
            {awaitingFinalReview && (
              <Chip className={`${WATCH_WRAP} border-[var(--panel-border)] text-[var(--c-link)] `}>
                <Clock3 aria-hidden="true" className="h-3 w-3" />
                {t('watch.pendingFinalReview')}
              </Chip>
            )}
            {finalReviewPassed && (
              <Chip className={`${WATCH_WRAP} border-[var(--panel-border)] text-[var(--c-ok)] `}>
                <Check aria-hidden="true" className="h-3 w-3" />
                {t('watch.finalTextValidated')}
              </Chip>
            )}
            {procedure.publication_detected && !awaitingFinalReview && !finalReviewPassed && (
              <Chip className={`${WATCH_WRAP} border-[var(--panel-border)] text-[var(--c-ok)] `}>
                {t('watch.publicationDetected')}
              </Chip>
            )}
          </div>
          <h4 className={`mt-2.5 text-sm font-bold leading-snug text-main sm:text-[15px] ${WATCH_WRAP}`}>
            {procedure.title}
          </h4>
        </div>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex w-full min-w-0 items-center justify-center gap-1.5 rounded-lg border border-[var(--panel-border)] px-2.5 py-1.5 text-center text-[11px] font-bold text-[var(--c-link)] transition-colors hover:bg-[var(--panel-bg)] sm:w-auto ${WATCH_WRAP}`}
          >
            <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
            {t('watch.officialRecord')}
          </a>
        )}
      </div>

      <dl className="mt-3 grid min-w-0 gap-2 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)]/60 p-3 sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-[13px] font-semibold text-muted">{t('watch.currentStage')}</dt>
          <dd className={`mt-0.5 text-[11px] font-semibold leading-snug text-main ${WATCH_WRAP}`}>{displayedStatus}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[13px] font-semibold text-muted">{t('watch.lastChecked')}</dt>
          <dd className={`mt-0.5 text-[11px] tabular-nums text-main ${WATCH_WRAP}`}>
            {formatWatchStamp(procedure.last_checked || procedure.updated, i18n.language)}
          </dd>
        </div>
      </dl>

      <ProcedureAssessment procedure={procedure} />

      {communication && (
        <div className="mt-3 min-w-0 overflow-hidden rounded-xl border border-[var(--panel-border)] ">
          <div className="flex min-w-0 flex-col items-stretch gap-2 border-b border-[var(--panel-border)] px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-[var(--c-link)] ">
                  {t('watch.councilCommunication')}
                </p>
                <p className={`mt-0.5 text-[11px] tabular-nums text-muted ${WATCH_WRAP}`}>
                  {[communication.source, communication.date]
                    .filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
            {communication.url && (
              <a
                href={communication.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex w-full min-w-0 items-center justify-center gap-1 rounded-md border border-[var(--panel-border)] px-2 py-1 text-center text-[11px] font-bold text-[var(--c-link)] hover:bg-[var(--panel-bg)] sm:w-auto ${WATCH_WRAP}`}
              >
                {t('watch.councilCommunicationLink')}
                <ExternalLink aria-hidden="true" className="h-3 w-3" />
              </a>
            )}
          </div>
          <div className="space-y-2.5 px-3 py-3">
            {communication.title && (
              <p className={`text-[11px] font-semibold leading-relaxed text-main ${WATCH_WRAP}`}>{communication.title}</p>
            )}
            {communication.body && (
              <p className={`text-[11px] leading-relaxed text-muted ${WATCH_WRAP}`}>{communication.body}</p>
            )}
            <p className="rounded-lg border border-[var(--panel-border)] px-2.5 py-2 text-[11px] leading-relaxed text-[var(--c-warn)] ">
              {t(published ? 'watch.councilCommunicationNoteSuperseded'
                           : 'watch.councilCommunicationNote')}
            </p>
          </div>
        </div>
      )}

      {council && (
        <div className="mt-3 min-w-0 overflow-hidden rounded-xl border border-[var(--panel-border)] ">
          <div className="flex min-w-0 flex-col items-stretch gap-2 border-b border-[var(--panel-border)] px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <Scale aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[var(--c-link)] " />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-[var(--c-link)] ">
                  {t('watch.councilDevelopment')}
                </p>
                <p className={`mt-0.5 text-[11px] tabular-nums text-muted ${WATCH_WRAP}`}>
                  {[council.document, council.document_type, council.date]
                    .filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
            {council.url && (
              <a
                href={council.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex w-full min-w-0 items-center justify-center gap-1 rounded-md border border-[var(--panel-border)] px-2 py-1 text-center text-[11px] font-bold text-[var(--c-link)] hover:bg-[var(--panel-bg)] sm:w-auto ${WATCH_WRAP}`}
              >
                {t('watch.councilRegisterDocument')}
                <ExternalLink aria-hidden="true" className="h-3 w-3" />
              </a>
            )}
          </div>
          <div className="space-y-2.5 px-3 py-3">
            {council.title && (
              <p className={`text-[11px] font-semibold leading-relaxed text-main ${WATCH_WRAP}`}>{council.title}</p>
            )}
            <dl className="grid gap-2 sm:grid-cols-2">
              {council.addressee && (
                <div>
                  <dt className="text-[13px] font-semibold text-muted">
                    {t('watch.councilAddressee')}
                  </dt>
                  <dd className={`mt-0.5 text-[11px] text-main ${WATCH_WRAP}`}>{council.addressee}</dd>
                </div>
              )}
              {council.meeting_date && (
                <div>
                  <dt className="text-[13px] font-semibold text-muted">
                    {t('watch.councilMeeting')}
                  </dt>
                  <dd className={`mt-0.5 text-[11px] tabular-nums text-main ${WATCH_WRAP}`}>{fmtDate(council.meeting_date)}</dd>
                </div>
              )}
            </dl>
            {council.content_accessible === false && (
              <p className="text-[11px] leading-relaxed text-muted">
                {t('watch.councilContentRestricted')}
              </p>
            )}
            <p className="rounded-lg border border-[var(--panel-border)] px-2.5 py-2 text-[11px] leading-relaxed text-[var(--c-warn)] ">
              {t(published ? 'watch.councilNotEnactedSuperseded'
                           : 'watch.councilNotEnacted')}
            </p>
          </div>
        </div>
      )}

      {sourceMissing && (
        <p className="mt-3 rounded-xl border border-[var(--panel-border)] p-3 text-[11px] leading-relaxed text-[var(--c-warn)] ">
          {t('watch.sourceMissingDetail')}
        </p>
      )}
      {awaitingFinalReview && (
        <p className="mt-3 rounded-xl border border-[var(--panel-border)] p-3 text-[11px] leading-relaxed text-[var(--c-link)] ">
          {t('watch.pendingFinalReviewDetail')}
        </p>
      )}
      {finalReviewPassed && (
        <p className="mt-3 rounded-xl border border-[var(--panel-border)] p-3 text-[11px] leading-relaxed text-[var(--c-ok)] ">
          {t('watch.finalTextValidatedDetail', {
            celex: procedure.final_text_review?.reviewed_celexes?.join(', ') || '—',
          })}
        </p>
      )}

      {scope && (
        <div className="mt-3 rounded-xl border border-[var(--panel-border)] p-3">
          <p className="text-[13px] font-semibold text-main ">
            {t('watch.exactScope')}
          </p>
          <p className={`mt-1.5 text-[11px] leading-relaxed text-muted ${WATCH_WRAP}`}>{scope}</p>
        </div>
      )}

      {norms.length > 0 && (
        <div className="mt-3 flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="mr-0.5 text-[11px] font-semibold text-muted">{t('searchRelevantNorms')}:</span>
          {norms.map((norm) => (
            <span
              key={norm}
              className={`inline-flex rounded border border-[var(--panel-border)] px-1.5 py-0.5 text-[11px] tabular-nums text-main ${WATCH_WRAP}`}
            >
              {norm}
            </span>
          ))}
        </div>
      )}

      <OfficialOutcomeRefs
        celexes={procedure.adopted_celexes}
        journal={procedure.official_journal}
      />

      {procedure.terminal_reason && (
        <p className="mt-2.5 rounded-lg border border-[var(--panel-border)] px-2.5 py-2 text-[11px] leading-relaxed text-[var(--c-ok)] ">
          <span className="font-bold">{t('watch.terminalReason')}:</span>{' '}
          {procedure.terminal_reason}
        </p>
      )}
      {!active && procedure.monitoring_stopped_at && (
        <p className="mt-2 text-[11px] tabular-nums text-muted">
          {t('watch.monitoringStopped')}: {formatWatchStamp(procedure.monitoring_stopped_at, i18n.language)}
        </p>
      )}

      {matchedFates.map((fate) => <AmendmentValidation key={fate.id} fate={fate} />)}
      <ProcedureChronology procedure={procedure} fates={matchedFates} />
    </article>
  );
};

/** Compact monitor summary above the index/realtime switch. The detailed
 * evidence is intentionally collapsed on every fresh page mount: it remains
 * discoverable without taking over the law index. */
const TrackedProceduresPanel: React.FC = () => {
  const { t } = useTranslation('kerf');
  const [watched, setWatched] = useState<KerfWatchedProcedures | null>(null);
  const [fates, setFates] = useState<KerfAmendmentFate[]>([]);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const ctl = new AbortController();
    Promise.allSettled([
      kerfWatchedProcedures(ctl.signal),
      kerfAmendmentFates(undefined, ctl.signal),
    ]).then(([watchedResult, fatesResult]) => {
      if (ctl.signal.aborted) return;
      if (watchedResult.status === 'fulfilled') {
        const value = watchedResult.value;
        const procedures = Array.isArray(value)
          ? value as unknown as KerfWatchedProcedure[]
          : value.procedures ?? [];
        setWatched({
          ...(Array.isArray(value) ? {} : value),
          active_count: procedures.filter(procedureIsActive).length,
          terminal_count: procedures.filter((row) => !procedureIsActive(row)).length,
          procedures,
        });
      } else {
        setFailed(true);
      }
      if (fatesResult.status === 'fulfilled') {
        const value = fatesResult.value;
        setFates(Array.isArray(value)
          ? value as unknown as KerfAmendmentFate[]
          : value.records ?? []);
      }
    });
    return () => ctl.abort();
  }, []);

  const active = (watched?.procedures ?? []).filter(procedureIsActive);
  const archived = (watched?.procedures ?? []).filter((row) => !procedureIsActive(row));

  return (
    <section aria-labelledby="kerf-watched-procedures-title" className={workbench.block}>
      <header className={workbench.blockHead} data-wide="true">
        <div className="min-w-0">
          <h3 id="kerf-watched-procedures-title" className={WATCH_WRAP}>{t('watch.title')}</h3>
          <p className={WATCH_WRAP}>{expanded ? t('watch.intro') : t('watch.collapsedIntro')}</p>
        </div>
        <div className={workbench.blockTools}>
          <span className={`${workbench.tag} ${WATCH_WRAP}`} data-tone="warn">
            <Clock3 aria-hidden="true" className="h-3.5 w-3.5" /> {t('watch.twiceDaily')}
          </span>
          {watched && (
            <span className={`${workbench.tag} ${WATCH_WRAP}`}>
              {t('watch.activeCount', { count: active.length })}
            </span>
          )}
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-controls="kerf-watched-procedures-content"
            className={`sntiq-btn !min-h-9 !py-1.5 !px-3 !text-[13px] ${WATCH_WRAP}`}
          >
            <span className={WATCH_WRAP}>{t(expanded ? 'watch.collapse' : 'watch.expand')}</span>
            <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </header>

      {expanded && <div id="kerf-watched-procedures-content" className="relative min-w-0 space-y-3 overflow-hidden pt-4">
        {!watched && !failed && (
          <div className="flex items-center gap-2 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)]/55 p-4 text-xs text-muted" role="status">
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-[var(--c-warn)]" />
            {t('watch.loading')}
          </div>
        )}
        {failed && (
          <p className="flex items-center gap-2 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)]/55 p-4 text-xs text-muted" role="status">
            <TriangleAlert aria-hidden="true" className="h-4 w-4 text-[var(--c-warn)]" />
            {t('watch.unavailable')}
          </p>
        )}
        {active.map((procedure) => (
          <TrackedProcedureCard key={`${procedure.source}-${procedure.id}`} procedure={procedure} fates={fates} />
        ))}
        {watched && active.length === 0 && (
          <p className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)]/55 p-4 text-xs text-muted">
            {t('watch.noActive')}
          </p>
        )}
        {archived.length > 0 && (
          <details className="group min-w-0 overflow-hidden rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)]/40">
            <summary className="flex min-w-0 cursor-pointer list-none flex-wrap items-center gap-2 px-3 py-3 text-xs font-bold text-main marker:hidden sm:px-3.5">
              <Archive aria-hidden="true" className="h-4 w-4 shrink-0 text-muted" />
              <span className={WATCH_WRAP}>{t('watch.archiveTitle', { count: archived.length })}</span>
              <span className={`text-[11px] font-normal text-muted ${WATCH_WRAP}`}>{t('watch.archiveKept')}</span>
              <ChevronDown aria-hidden="true" className="ml-auto h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-3 border-t border-[var(--panel-border)] p-3">
              {archived.map((procedure) => (
                <TrackedProcedureCard key={`${procedure.source}-${procedure.id}`} procedure={procedure} fates={fates} />
              ))}
            </div>
          </details>
        )}
      </div>}
    </section>
  );
};

// ---------------------------------------------------------------- Wiki
const TemporalHeader: React.FC<{
  act: KerfActDetail;
  onSynopse: () => void;
  onDecisions: (jurabk: string) => void;
}> = ({ act, onSynopse, onDecisions }) => {
  const { t } = useTranslation('kerf');
  const tp = act.temporal;
  const changes = actChangeSummary(act);
  const buzerCrossChecks = (act.cross_checks ?? [])
    .filter((crossCheck) => crossCheck.source.toLocaleLowerCase() === 'buzer')
    .map((crossCheck) => ({
      ...crossCheck,
      safeUrl: safeExternalHttpUrl(crossCheck.url),
    }))
    .filter((crossCheck) => crossCheck.safeUrl !== null);
  return (
    <div className={workbench.block} style={{ borderTop: '1px solid var(--c-text-main)', paddingTop: 16, marginBottom: 28 }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className={workbench.tag}>{act.jurabk} · {act.juris}</p>
          <h3 className="mt-1 text-xl font-semibold leading-tight text-main break-words" style={{ letterSpacing: '-.025em' }}>{act.title}</h3>
        </div>
        <button
          onClick={onSynopse}
          className="sntiq-btn sntiq-btn-primary shrink-0 !min-h-9 !py-1.5 !px-3 !text-[13px]"
        > {t('viewSynopse')}
        </button>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3 text-xs">
        <span className="text-muted" title={tp.last_change ? undefined : t('lastChangeUnknownHint')}>
          {t('lastChange')}:{' '}
          <span className="text-main tabular-nums">{fmtDate(tp.last_change)}</span>
        </span>
        {/* A missing consolidated count is not '0 amendments': fall back to
            the official BGBl ledger, else say that it is not established. */}
        {changes.kind === 'changes' ? (
          <span className="text-muted">{t('amendments', { count: changes.count })}</span>
        ) : changes.kind === 'bgblRecords' ? (
          <span
            className="text-muted"
            title={t('bgblRecordsHint', { date: act.retrospective?.history_start ?? '—' })}
          >
            {t('bgblRecords', { count: changes.count })}
          </span>
        ) : (
          <span className="text-muted italic">{t('amendmentsUnknown')}</span>
        )}
        {tp.pending > 0 && (
          <span className="text-[var(--c-warn)] font-medium" title={t('pendingHint')}>
            {t('pendingCount', { count: tp.pending })}
          </span>
        )}
        {(act.decisions?.length ?? 0) > 0 && (
          <button
            onClick={() => onDecisions(act.jurabk)}
            title={t('dec.forAct', { count: act.decisions!.length })}
            className="inline-flex items-center gap-1 text-[13px] tabular-nums text-[var(--c-link)] hover:underline underline-offset-4 font-semibold"
          >
            <Scale aria-hidden="true" className="h-3.5 w-3.5" /> {act.decisions!.length}
          </button>
        )}
        {tp.next_change && (
          <span className="text-muted">
            {t('nextChange')}:{' '}
            <span className="text-main tabular-nums">{fmtDate(tp.next_change)}</span>
          </span>
        )}
        {(() => {
          const src = actSourceUrl(act);
          return src && (
            <a href={src} target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center gap-1 tabular-nums text-[var(--c-link)] hover:underline">
              {act.juris === 'DE-BY' ? 'BAYERN.RECHT' : 'gesetze-im-internet.de'}
              <ExternalLink className="w-3 h-3" />
            </a>
          );
        })()}
        {buzerCrossChecks.map((crossCheck) => (
          <a
            key={`${crossCheck.source}:${crossCheck.safeUrl}`}
            href={crossCheck.safeUrl!}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 tabular-nums text-muted underline decoration-dotted underline-offset-2 hover:text-main"
          >
            {t('sourceBuzerCrossCheck')}
            <ExternalLink aria-hidden="true" className="w-3 h-3" />
          </a>
        ))}
      </div>
    </div>
  );
};

const citationNormLabel = (
  norm?: string | null,
  pinpoint?: string | null,
) => {
  const parts = [norm?.trim(), pinpoint?.trim()].filter(Boolean) as string[];
  return Array.from(new Set(parts)).join(' · ') || '—';
};

const CitationEndpoint: React.FC<{
  actId?: string | null;
  jurabk?: string | null;
  norm?: string | null;
  pinpoint?: string | null;
  selectedActId: string;
  onOpenAct: (id: string) => void;
}> = ({ actId, jurabk, norm, pinpoint, selectedActId, onOpenAct }) => {
  const { t } = useTranslation('kerf');
  const actLabel = jurabk?.trim() || actId?.trim() || t('citationsUnknownAct');
  const localTarget = Boolean(actId && actId !== selectedActId);
  return (
    <div className="min-w-0">
      {localTarget ? (
        <button
          type="button"
          onClick={() => onOpenAct(actId!)}
          title={t('citationsOpenAct', { act: actLabel })}
          className="inline-flex max-w-full items-center gap-1 text-left text-xs font-bold text-[var(--c-link)] hover:underline"
        >
          <span className="min-w-0 break-words">{actLabel}</span>
        </button>
      ) : (
        <p className="break-words text-xs font-bold text-main">{actLabel}</p>
      )}
      <p className="mt-0.5 break-words tabular-nums text-[11px] leading-relaxed text-muted">
        {citationNormLabel(norm, pinpoint)}
      </p>
      {actId && actId !== jurabk && (
        <p className="mt-0.5 truncate font-mono text-[11px] text-muted/80" title={actId}>
          {actId}
        </p>
      )}
    </div>
  );
};

const CitationRow: React.FC<{
  row: KerfStatutoryCitation;
  selectedActId: string;
  onOpenAct: (id: string) => void;
}> = ({ row, selectedActId, onOpenAct }) => {
  const { t } = useTranslation('kerf');
  const resolved = row.status === 'resolved';
  return (
    <li className={workbench.item}>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <span className={`rounded-full border px-2 py-0.5 text-[13px] font-semibold ${
          resolved
            ? 'border-[var(--panel-border)] text-[var(--c-ok)] '
            : 'border-[var(--panel-border)] text-[var(--c-warn)] '
        }`} title={row.unresolved_reason ?? undefined}>
          {t(resolved ? 'citationsResolved' : 'citationsUnresolved')}
        </span>
        <span className="rounded-full border border-[var(--panel-border)] bg-[var(--panel-bg)] px-2 py-0.5 text-[11px] tabular-nums text-muted">
          {t(row.kind === 'self' ? 'citationsSelf' : 'citationsCrossAct')}
        </span>
        {row.occurrence_count > 1 && (
          <span className="text-[11px] tabular-nums text-muted">
            {t('citationsOccurrences', { count: row.occurrence_count })}
          </span>
        )}
      </div>

      <div className="mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2 sm:gap-3">
        <div className="min-w-0">
          <p className="mb-1 text-[13px] tabular-nums text-muted font-semibold">
            {t('citationsSource')}
          </p>
          <CitationEndpoint
            actId={row.source_act}
            jurabk={row.source_jurabk}
            norm={row.source_norm}
            selectedActId={selectedActId}
            onOpenAct={onOpenAct}
          />
        </div>
        <ArrowUpRight aria-hidden="true" className="mt-5 h-3.5 w-3.5 shrink-0 text-[var(--c-link)]" />
        <div className="min-w-0">
          <p className="mb-1 text-[13px] tabular-nums text-muted font-semibold">
            {t('citationsTarget')}
          </p>
          <CitationEndpoint
            actId={row.target_act}
            jurabk={row.target_jurabk}
            norm={row.target_norm}
            pinpoint={row.target_pinpoint}
            selectedActId={selectedActId}
            onOpenAct={onOpenAct}
          />
        </div>
      </div>

      <div className="mt-3 min-w-0 rounded-lg bg-[var(--c-link)]/[0.045] px-2.5 py-2">
        <p className="break-words tabular-nums text-[11px] font-semibold text-[var(--c-link)]">
          {row.citation_text}
        </p>
        {row.source_excerpt && (
          <blockquote className="mt-1.5 break-words text-[11px] leading-relaxed text-muted">
            {row.source_excerpt}
          </blockquote>
        )}
      </div>
      {!resolved && row.unresolved_reason && (
        <p className="mt-2 break-words text-[11px] leading-relaxed text-[var(--c-warn)] ">
          {t('citationsUnresolvedReason')}: <code>{row.unresolved_reason}</code>
        </p>
      )}
    </li>
  );
};

/** Exact forward and reverse references for the current consolidated state.
 * The endpoint is deliberately lazy: a closed panel performs no request, and
 * each direction is loaded at most once per selected act. */
const ActCitationsPanel: React.FC<{
  act: KerfActDetail;
  onOpenAct: (id: string) => void;
}> = ({ act, onOpenAct }) => {
  const { t } = useTranslation('kerf');
  const [expanded, setExpanded] = useState(false);
  const [direction, setDirection] = useState<KerfCitationDirection>('out');
  const [responses, setResponses] = useState<Partial<Record<KerfCitationDirection, KerfCitations>>>({});
  const [loading, setLoading] = useState<Partial<Record<KerfCitationDirection, boolean>>>({});
  const [errors, setErrors] = useState<Partial<Record<KerfCitationDirection, boolean>>>({});
  const [retry, setRetry] = useState(0);
  const response = responses[direction];

  useEffect(() => {
    setExpanded(false);
    setDirection('out');
    setResponses({});
    setLoading({});
    setErrors({});
    setRetry(0);
  }, [act.id]);

  useEffect(() => {
    if (!expanded || response) return undefined;
    const ctl = new AbortController();
    setLoading((current) => ({ ...current, [direction]: true }));
    setErrors((current) => ({ ...current, [direction]: false }));
    kerfCitations({ act: act.id, direction, limit: 50 }, ctl.signal)
      .then((value) => {
        if (!ctl.signal.aborted) {
          setResponses((current) => ({ ...current, [direction]: value }));
        }
      })
      .catch(() => {
        if (!ctl.signal.aborted) {
          setErrors((current) => ({ ...current, [direction]: true }));
        }
      })
      .finally(() => {
        if (!ctl.signal.aborted) {
          setLoading((current) => ({ ...current, [direction]: false }));
        }
      });
    return () => ctl.abort();
  }, [act.id, direction, expanded, response, retry]);

  const rows = response?.citations ?? [];
  const tabLabel = (value: KerfCitationDirection) => (
    <>
      {value === 'out'
        ? <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        : <ArrowDownLeft aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}
      <span className="min-w-0 break-words">
        {t(value === 'out' ? 'citationsOutgoing' : 'citationsInbound')}
      </span>
      {responses[value] && (
        <span className="shrink-0 rounded-full bg-current/10 px-1.5 py-0.5 tabular-nums text-[11px]">
          {responses[value]!.matched}
        </span>
      )}
    </>
  );

  return (
    <section className="mb-5 overflow-hidden rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)]/60">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={`kerf-citations-${act.id}`}
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full min-w-0 items-start gap-3 px-3.5 py-3.5 text-left transition-colors hover:bg-[var(--c-link)]/[0.035] sm:px-4"
      >
        <span className="mt-1 text-muted">
          <Link2 aria-hidden="true" className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-main">{t('citationsTitle')}</span>
          <span className="mt-1 block break-words text-[11px] leading-relaxed text-muted">
            {t('citationsDisclaimer')}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`mt-1 h-4 w-4 shrink-0 text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div id={`kerf-citations-${act.id}`} className="border-t border-[var(--panel-border)] p-3 sm:p-4">
          <div className="grid min-w-0 grid-cols-2 gap-1 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-1" role="tablist">
            {(['out', 'in'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={direction === value}
                onClick={() => setDirection(value)}
                className={`flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[13px] font-semibold transition-colors sm:text-xs ${
                  direction === value
                    ? 'bg-[var(--c-link)]/12 text-[var(--c-link)]'
                    : 'text-muted hover:text-main'
                }`}
              >
                {tabLabel(value)}
              </button>
            ))}
          </div>

          <div className="mt-3" role="tabpanel">
            {loading[direction] && (
              <p className="flex items-center gap-2 py-6 text-xs text-muted" role="status">
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-[var(--c-link)]" />
                {t('loading')}
              </p>
            )}
            {errors[direction] && !loading[direction] && (
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--panel-border)] p-3" role="alert">
                <p className="min-w-0 break-words text-xs text-muted">{t('citationsUnavailable')}</p>
                <button
                  type="button"
                  onClick={() => setRetry((value) => value + 1)}
                  className="shrink-0 rounded-lg border border-[var(--panel-border)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--c-warn)] "
                >
                  {t('citationsRetry')}
                </button>
              </div>
            )}
            {response && !loading[direction] && rows.length === 0 && (
              <p className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)]/70 p-4 text-xs text-muted">
                {t(direction === 'out' ? 'citationsNoOutgoing' : 'citationsNoInbound')}
              </p>
            )}
            {rows.length > 0 && (
              <ul className="space-y-2.5">
                {rows.map((row) => (
                  <CitationRow
                    key={row.id}
                    row={row}
                    selectedActId={act.id}
                    onOpenAct={onOpenAct}
                  />
                ))}
              </ul>
            )}
            {response && response.matched > rows.length && (
              <p className="mt-3 text-[11px] tabular-nums text-muted">
                {t('citationsLimited', { shown: rows.length, total: response.matched })}
              </p>
            )}
            {response && (
              <p className="mt-3 break-words text-[11px] leading-relaxed text-muted">
                {t('citationsEvidenceNote', {
                  date: response.built_at?.slice(0, 10) ?? '—',
                })}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

const gapText = (gap: KerfActArchiveGap, fallback: string) => {
  if (typeof gap === 'string') return gap;
  if (gap.label) return gap.label;
  if (gap.reason) return gap.reason;
  const range = [gap.from, gap.to].filter(Boolean).join(' → ');
  return range || fallback;
};

const isRetrievalObservation = (dateBasis?: string | null) =>
  Boolean(dateBasis && /(?:retrieval|observed|observation|capture)/iu.test(dateBasis));

const shortDigest = (digest?: string | null) => {
  const value = digest?.replace(/^sha256:/iu, '').trim();
  return value ? value.slice(0, 12) : null;
};

const isVerifiedLegalEffect = (value: {
  legal_effect_verified?: boolean;
  effective_at?: string | null;
}) => value.legal_effect_verified === true && Boolean(value.effective_at);

const bgblReference = (bgbl?: KerfVersion['bgbl']) => {
  if (!bgbl) return { label: null, url: null };
  if (typeof bgbl === 'string') {
    const url = safeExternalHttpUrl(bgbl);
    return { label: url ? 'BGBl' : bgbl, url };
  }
  const label = bgbl.document_id
    || (bgbl.year && bgbl.issue ? `BGBl. ${bgbl.year} I Nr. ${bgbl.issue}` : 'BGBl');
  return {
    label,
    url: safeExternalHttpUrl(bgbl.pdf_url) ?? safeExternalHttpUrl(bgbl.eli),
  };
};

const dipProcedureSourceUrl = (procedureId?: string | null) => {
  const id = procedureId?.replace(/^dip-vorgang:/iu, '').trim();
  return id && /^\d+$/u.test(id)
    ? `https://dip.bundestag.de/vorgang/_/${encodeURIComponent(id)}`
    : null;
};

const normalizedNormRef = (value?: string | null) => {
  if (value && /^Art\.?\s*\d+[a-z]*\s+§\s*\d+[a-z]*$/iu.test(value.trim())) return normKey(value);
  const match = value?.match(/(?:§|Art\.?)[\s.]*(\d+[a-z]*)/iu);
  return match?.[1]?.toLocaleLowerCase('de') ?? '';
};

const amendmentCommandNorm = (command: KerfRetrospectiveCommand) => {
  const paras = command.ref?.paras?.filter(Boolean);
  if (paras?.length) return `${paras.length > 1 ? '§§' : '§'} ${paras.join(', ')}`;
  const para = command.ref?.para?.trim();
  return para ? `§ ${para}` : '';
};

const commandTouchesNorm = commandMatchesNorm;

const eventCitation = (event: KerfRetrospectiveEvent) => [
  event.procedure_title ?? event.article_heading ?? event.document_id
    ?? event.event_id ?? event.id,
  event.document_id,
  event.published_at ? `published ${event.published_at}` : null,
  event.effective_at ? `effective ${event.effective_at}` : null,
  event.official_html_url ?? event.official_pdf_url,
].filter(Boolean).join(' · ');

/** Dated, plain-Markdown reconstruction of the selected act. It deliberately
 * renders source text, not HTML: users can inspect/copy exactly what the API
 * generated, including explicit gaps in a partial reconstruction. */
export const ActArchivePanel: React.FC<{ act: KerfActDetail }> = ({ act }) => {
  const { t, i18n } = useTranslation('kerf');
  const [activated, setActivated] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [archive, setArchive] = useState<KerfActArchive | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(true);
  const [archiveError, setArchiveError] = useState(false);
  const [archiveAttempt, setArchiveAttempt] = useState(0);
  // Keep this request constraint while the archive body is cleared/reloaded.
  const [knowledgeHorizon, setKnowledgeHorizon] = useState<string | undefined>();
  const [dateSelection, setDateSelection] = useState({ date: '', timelineId: '' });
  const { date: selectedDate, timelineId: selectedTimelineId } = dateSelection;
  const [selectedNorm, setSelectedNorm] = useState('');
  const [knowledgeAt, setKnowledgeAt] = useState('');
  const [markdown, setMarkdown] = useState<KerfActMarkdown | null>(null);
  const [markdownLoading, setMarkdownLoading] = useState(false);
  const [markdownError, setMarkdownError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [eventCitationCopied, setEventCitationCopied] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [compareFrom, setCompareFrom] = useState('');
  const [compareTo, setCompareTo] = useState('');
  const [comparison, setComparison] = useState<KerfActDiff | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState(false);
  const requestedKnowledgeAsOf = knowledgeAt
    ? `${knowledgeAt}T23:59:59.999Z` : undefined;
  // A date input denotes "known by the end of that day". On the current
  // build day that instant may lie a few hours beyond the immutable manifest;
  // clamp it to the advertised knowledge horizon instead of issuing a request
  // the fail-closed API must reject as future knowledge.
  const knowledgeAsOf = requestedKnowledgeAsOf && knowledgeHorizon
    && Date.parse(requestedKnowledgeAsOf) > Date.parse(knowledgeHorizon)
    ? knowledgeHorizon : requestedKnowledgeAsOf;

  useEffect(() => {
    setDateSelection({ date: '', timelineId: '' });
    setSelectedNorm('');
    setKnowledgeAt('');
    setKnowledgeHorizon(undefined);
    setComparisonOpen(false);
    setComparison(null);
    setEventCitationCopied(false);
  }, [act.id]);

  useEffect(() => {
    if (!activated) return undefined;
    const ctl = new AbortController();
    setArchive(null);
    setArchiveLoading(true);
    setArchiveError(false);
    setMarkdown(null);
    setMarkdownError(false);
    kerfActArchive(
      act.id,
      { asOf: knowledgeAsOf },
      ctl.signal,
    )
      .then((value) => {
        if (ctl.signal.aborted) return;
        const entries = Array.isArray(value.entries) ? value.entries : [];
        const headDate = value.head_date
          ?? entries.map((entry) => entry.date).sort().at(-1)
          ?? null;
        const normalized = { ...value, entries, head_date: headDate };
        const timeline = buildArchiveTimeline(normalized);
        const defaultDate = headDate ?? timeline.at(-1)?.date ?? '';
        const earliest = timeline[0]?.date;
        setArchive(normalized);
        setKnowledgeHorizon(value.retrospective?.built_at ?? undefined);
        // Preserve a legal-date choice without making it an archive-query
        // dependency. act.id changes clear it in the effect above.
        setDateSelection(current => {
          const date = current.date
            && (!earliest || current.date >= earliest)
            && (!headDate || current.date <= headDate) ? current.date : defaultDate;
          const item = resolveArchiveTimelineItem(timeline, '', date);
          return { date, timelineId: item?.id ?? '' };
        });
      })
      .catch(() => {
        if (!ctl.signal.aborted) setArchiveError(true);
      })
      .finally(() => {
        if (!ctl.signal.aborted) setArchiveLoading(false);
    });
    return () => ctl.abort();
  }, [act.id, activated, archiveAttempt, knowledgeAsOf]);

  const timeline = useMemo(() => buildArchiveTimeline(archive), [archive]);
  const selectedTimelineItem = useMemo(() => resolveArchiveTimelineItem(
    timeline, selectedTimelineId, selectedDate,
  ), [selectedDate, selectedTimelineId, timeline]);
  const canCheckoutSelectedDate = Boolean(selectedDate) && Boolean(
    selectedTimelineItem?.checkoutable
    || (!archive?.retrospective && !selectedTimelineId),
  );

  const normOptions = useMemo(() => {
    const byValue = new Map<string, { value: string; label: string }>();
    const add = (value: string | undefined, title?: string) => {
      const normalized = value?.trim();
      if (!normalized || !/^(?:§|Art\.?)\s*\d/iu.test(normalized)) return;
      byValue.set(normalized, {
        value: normalized,
        label: title ? `${normalized} — ${title}` : normalized,
      });
    };
    for (const norm of act.norms ?? []) add(readerDesignator(norm), norm.titel);
    for (const norm of archive?.norms ?? []) {
      if (typeof norm === 'string') add(norm);
      else add(norm.enbez ?? norm.label ?? norm.id, norm.title);
    }
    return Array.from(byValue.values()).sort((a, b) =>
      a.value.localeCompare(b.value, 'de', { numeric: true }));
  }, [act.norms, archive?.norms]);

  useEffect(() => {
    if (!expanded || !selectedDate || !canCheckoutSelectedDate) {
      if (!selectedDate) setMarkdown(null);
      if (!canCheckoutSelectedDate) setMarkdown(null);
      setMarkdownLoading(false);
      setMarkdownError(false);
      return undefined;
    }
    const ctl = new AbortController();
    setMarkdown(null);
    setMarkdownLoading(true);
    setMarkdownError(false);
    setCopied(false);
    setCopyError(false);
    kerfActMarkdown(
      act.id,
      {
        at: selectedDate,
        asOf: knowledgeAsOf,
        norm: selectedNorm || undefined,
      },
      ctl.signal,
    )
      .then((value) => {
        if (!ctl.signal.aborted) setMarkdown(value);
      })
      .catch(() => {
        if (!ctl.signal.aborted) setMarkdownError(true);
      })
      .finally(() => {
        if (!ctl.signal.aborted) setMarkdownLoading(false);
      });
    return () => ctl.abort();
  }, [
    act.id, canCheckoutSelectedDate, expanded, knowledgeAsOf, selectedDate,
    selectedNorm,
  ]);

  useEffect(() => {
    if (!comparisonOpen || !compareFrom || !compareTo
        || compareFrom === compareTo) {
      setComparison(null);
      setComparisonLoading(false);
      setComparisonError(false);
      return undefined;
    }
    const ctl = new AbortController();
    setComparison(null);
    setComparisonLoading(true);
    setComparisonError(false);
    kerfActDiff(act.id, {
      from: compareFrom,
      to: compareTo,
      asOf: knowledgeAsOf,
      norm: selectedNorm || undefined,
    }, ctl.signal)
      .then((value) => {
        if (!ctl.signal.aborted) setComparison(value);
      })
      .catch(() => {
        if (!ctl.signal.aborted) setComparisonError(true);
      })
      .finally(() => {
        if (!ctl.signal.aborted) setComparisonLoading(false);
      });
    return () => ctl.abort();
  }, [
    act.id, compareFrom, compareTo, comparisonOpen, knowledgeAsOf, selectedNorm,
  ]);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    if (!eventCitationCopied) return undefined;
    const timer = window.setTimeout(() => setEventCitationCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [eventCitationCopied]);

  const selectedInterval = selectedTimelineItem?.interval;
  const selectedVerifiedReconstruction = Boolean(
    selectedTimelineItem?.verifiedReconstruction
    || markdown?.verified_reconstruction,
  );
  const selectedEvent = selectedTimelineItem?.event;
  const selectedAmendingActHref = selectedEvent?.document_id
    ? `/dt/kerf/aenderungen/${encodeURIComponent(selectedEvent.document_id)}`
    : null;
  const selectedObservation = selectedTimelineItem?.observation;
  const selectedEntry = selectedTimelineItem?.entry ?? (selectedObservation ? {
    id: selectedObservation.id,
    date: selectedObservation.date ?? selectedObservation.observed_at ?? selectedDate,
    label: selectedObservation.label,
    observed_at: selectedObservation.observed_at,
    date_basis: selectedObservation.date_basis,
    state_digest: selectedObservation.state_sha256 ?? selectedObservation.state_digest,
    source_url: selectedObservation.source_url,
    verification: selectedObservation.verification,
    knowledge_from: selectedObservation.knowledge_from,
    knowledge_to: selectedObservation.knowledge_to,
    exact: /exact/iu.test(selectedObservation.verification ?? ''),
  } : selectedInterval ? {
    id: selectedInterval.segment_id ?? selectedInterval.version_id ?? selectedInterval.id,
    date: selectedInterval.effective_from,
    effective_at: selectedInterval.effective_from,
    effective_from: selectedInterval.effective_from,
    effective_to: selectedInterval.effective_to,
    published_at: selectedInterval.published_at,
    observed_at: selectedInterval.observed_at,
    knowledge_from: selectedInterval.knowledge_from,
    knowledge_to: selectedInterval.knowledge_to,
    state_digest: selectedInterval.state_sha256,
    date_basis: selectedInterval.date_basis,
    verification: selectedInterval.verification,
    text_status: selectedInterval.text_status,
    date_status: selectedInterval.date_status,
    confidence: selectedInterval.confidence,
    exact: selectedInterval.exact
      ?? selectedInterval.text_status?.startsWith('official_exact'),
    partial: selectedInterval.partial
      ?? selectedInterval.text_status === 'partial',
    legal_effect_verified: selectedInterval.date_status?.startsWith('verified_legal'),
  } : undefined);
  const selectedTimelineIndex = selectedTimelineItem
    ? timeline.findIndex((item) => item.id === selectedTimelineItem.id)
    : -1;
  const previous = selectedTimelineIndex > 0
    ? timeline[selectedTimelineIndex - 1]
    : [...timeline].reverse().find((item) => item.date < selectedDate);
  const next = selectedTimelineIndex >= 0
    ? timeline[selectedTimelineIndex + 1]
    : timeline.find((item) => item.date > selectedDate);
  const isHead = Boolean(archive?.head_date && selectedDate === archive.head_date);
  const isObservedState = Boolean(selectedEntry?.observed_at
    || isRetrievalObservation(selectedEntry?.date_basis));
  const isExactObservedState = isObservedState && selectedEntry?.exact !== false
    && (selectedEntry?.exact === true
      || /exact/iu.test(selectedEntry?.verification ?? ''));
  const observedSourceUrl = safeExternalHttpUrl(selectedEntry?.source_url);
  const observedDigest = shortDigest(selectedEntry?.state_digest);
  const legalEffectVerified = Boolean(selectedEntry
    && isVerifiedLegalEffect(selectedEntry));
  const selectedBgbl = bgblReference(selectedEntry?.bgbl);
  const selectedProcedureUrl = dipProcedureSourceUrl(selectedEntry?.procedure_id);
  const archiveGaps = [
    ...(archive?.gaps ?? []),
    ...(archive?.retrospective?.gaps ?? []),
  ];
  const snapshotGaps = [
    ...(selectedInterval?.gaps ?? []),
    ...(markdown?.gaps ?? []),
  ];
  const selectedEventCommands = (selectedEvent?.commands ?? []).filter(
    (command) => commandTouchesNorm(command, selectedNorm),
  );
  const selectedEventCitation = selectedEvent ? eventCitation(selectedEvent) : '';
  const eventEvidenceLinks = selectedEvent?.evidence?.flatMap((evidence, index) => {
    const url = safeExternalHttpUrl(evidence.url);
    return url ? [{
      id: `${evidence.source ?? 'source'}:${url}:${index}`,
      label: evidence.document ?? evidence.source ?? t('archiveOfficialSource'),
      url,
      digest: evidence.sha256,
    }] : [];
  }) ?? [];
  const eventOfficialLinks = selectedEvent ? [
    {
      id: 'official-html', label: 'HTML',
      url: safeExternalHttpUrl(selectedEvent.official_html_url),
      digest: selectedEvent.text_sha256 ?? selectedEvent.article_text_sha256,
    },
    {
      id: 'official-pdf', label: 'PDF',
      url: safeExternalHttpUrl(selectedEvent.official_pdf_url),
      digest: selectedEvent.pdf_sha256,
    },
  ].filter((source): source is {
    id: string; label: string; url: string; digest: string | null | undefined;
  } => Boolean(source.url)) : [];
  const apiUrl = selectedDate && canCheckoutSelectedDate
    ? kerfActMarkdownUrl(act.id, {
        at: selectedDate,
        asOf: knowledgeAsOf,
        norm: selectedNorm || undefined,
      })
    : '';
  const downloadUrl = selectedDate && canCheckoutSelectedDate
    ? kerfActMarkdownUrl(act.id, {
        at: selectedDate,
        asOf: knowledgeAsOf,
        norm: selectedNorm || undefined,
        download: true,
      })
    : '';
  const fileName = `${act.jurabk}-${selectedNorm || 'complete'}-${selectedDate || 'head'}`
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  const retrospectiveAvailable = Boolean(
    archive?.retrospective?.available !== false
    && ((archive?.retrospective?.intervals?.length ?? 0) > 0
      || (archive?.retrospective?.events?.length ?? 0) > 0
      || (archive?.retrospective?.observations?.length ?? 0) > 0),
  );
  const comparisonAvailable = timeline.filter(
    (item) => item.kind === 'legal' && item.interval?.effective_from,
  ).length >= 2;

  const selectTimeline = (item: ArchiveTimelineItem) => {
    setDateSelection({ date: item.date, timelineId: item.id });
  };

  const selectFreeDate = (date: string) => {
    setDateSelection({ date, timelineId: '' });
  };

  const openComparison = () => {
    const legalDates = timeline
      .filter((item) => item.kind === 'legal')
      .map((item) => item.date);
    const to = selectedDate || archive?.head_date || legalDates.at(-1) || '';
    const from = [...legalDates].reverse().find((date) => date < to)
      ?? legalDates.at(-2)
      ?? timeline.at(-2)?.date
      ?? '';
    setCompareFrom(from);
    setCompareTo(to);
    setComparisonOpen(true);
  };

  const copyMarkdown = async () => {
    if (!markdown?.markdown) return;
    try {
      await navigator.clipboard.writeText(markdown.markdown);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  };

  const copyEventCitation = async () => {
    if (!selectedEventCitation) return;
    try {
      await navigator.clipboard.writeText(selectedEventCitation);
      setEventCitationCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  };

  const downloadEventJson = () => {
    if (!selectedEvent) return;
    const blob = new Blob([
      `${JSON.stringify(selectedEvent, null, 2)}\n`,
    ], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${act.jurabk}-${selectedEvent.document_id
      ?? selectedEvent.event_id ?? selectedEvent.id ?? selectedDate}-event.json`
      .replace(/[^\p{L}\p{N}._-]+/gu, '-');
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <details
      aria-labelledby={`kerf-archive-${act.id}`}
      onToggle={(event) => {
        const open = event.currentTarget.open;
        setExpanded(open);
        if (open) setActivated(true);
      }}
      className="group rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] overflow-hidden mb-5"
    >
      <summary className="flex items-start gap-3 cursor-pointer list-none p-4 sm:p-5">
        <span className="mt-1 text-muted">
          <History className="w-4 h-4 text-[var(--c-link)]" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={`kerf-archive-${act.id}`} className="font-bold text-main">
            {t('archiveTitle')}
          </h3>
          <p className="text-xs text-muted mt-1">{t('archiveIntro')}</p>
        </div>
        <span className="flex items-center gap-2 shrink-0">
          {archive && (
            <span className="hidden sm:inline text-[13px] tabular-nums text-muted font-semibold">
              {t('archiveSnapshots', { count: timeline.length })}
            </span>
          )}
          <ChevronRight className="w-4 h-4 mt-1 text-muted transition-transform group-open:rotate-90" />
        </span>
      </summary>

      {expanded && (
        <div className="border-t border-[var(--panel-border)] p-4 sm:p-5">
          {archive && <ArchiveCoverageSummary archive={archive} language={i18n.language} />}

          {archiveLoading && (
            <div className="flex items-center gap-2 text-xs text-muted py-3" role="status">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('loading')}
            </div>
          )}
          {archiveError && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted py-3" role="alert">
              <TriangleAlert className="w-3.5 h-3.5 text-[var(--c-warn)]" /> {t('archiveUnavailable')}
              <button type="button" className="underline text-[var(--c-link)]"
                onClick={() => setArchiveAttempt(value => value + 1)}>{readerCopy(i18n.language).retry}</button>
              {knowledgeAt && <button type="button" className="underline text-[var(--c-link)]"
                onClick={() => setKnowledgeAt('')}>{t('archiveKnowledgeLatest')}</button>}
            </div>
          )}

          {archive && (
            <>
              {archiveGaps.length > 0 && (
                <div className="mb-3 rounded-lg border border-[var(--panel-border)] px-3 py-2.5">
                  <p className="text-[13px] font-semibold text-[var(--c-warn)] ">
                    {t('archiveCoverageGaps')}
                  </p>
                  <ul className="mt-1 list-disc pl-4 text-xs text-muted space-y-0.5">
                    {archiveGaps.map((gap, index) => (
                      <li key={`${JSON.stringify(gap)}-${index}`}>
                        {gapText(gap, t('archiveGapUnknown'))}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
          <div className="mb-3">
            <div className="mb-1.5 flex min-w-0 items-center justify-between gap-2">
              <p className="text-[13px] font-semibold text-muted">
                {t('archiveTimeline')}
              </p>
              <span className="flex min-w-0 flex-wrap justify-end gap-1.5">
                {archive.retrospective?.coverage?.has_unreviewed_transitions && (
                  <Chip className="text-[var(--c-warn)] border-[var(--panel-border)] ">
                    {t('archiveUnreviewedTransitions')}
                  </Chip>
                )}
                {retrospectiveAvailable && (
                  <Chip className="text-[var(--c-link)] border-[var(--c-link)]/25 bg-[var(--c-link)]/[0.07]">
                    {t('archiveBitemporal')}
                  </Chip>
                )}
              </span>
            </div>
            <div className="-mx-1 max-w-full overflow-x-auto overscroll-x-contain px-1 pb-2 [scrollbar-width:thin]">
              <div className="inline-flex min-w-full max-w-none snap-x snap-mandatory gap-2">
                {timeline.map((item) => {
                  const active = selectedTimelineItem?.id === item.id;
                  const interval = item.interval;
                  const entry = item.entry;
                  const event = item.event;
                  const observation = item.observation;
                  const documentHref = event?.document_id
                    ? `/dt/kerf/aenderungen/${encodeURIComponent(event.document_id)}`
                    : null;
                  return (
                    <div
                      key={item.id}
                      className={`w-[calc(100vw-3.5rem)] max-w-[13.5rem] shrink-0 snap-start overflow-hidden rounded-xl border text-left transition-colors sm:w-[13.5rem] ${active
                        ? 'border-[var(--c-link)] bg-[var(--c-link)]/[0.09]'
                        : 'border-[var(--panel-border)] bg-[var(--panel-bg)] hover:border-[var(--c-text-main)]'}`}
                    >
                      <button
                        type="button"
                        onClick={() => selectTimeline(item)}
                        aria-pressed={active}
                        className="block w-full min-w-0 px-3 py-2.5 text-left"
                      >
                      <span className="flex min-w-0 items-center justify-between gap-2">
                        <time dateTime={item.date} className="tabular-nums text-xs font-bold text-main">
                          {fmtDate(item.date)}
                        </time>
                        <span className="truncate text-[13px] font-semibold text-muted">
                          {t(`archiveTimelineKind.${item.kind}`)}
                        </span>
                      </span>
                      {item.future && (
                        <span className="mt-1 inline-flex rounded border border-[var(--panel-border)] px-1.5 py-0.5 text-[13px] font-semibold text-main ">
                          {t('archiveFutureEffect')}
                        </span>
                      )}
                      {item.verifiedReconstruction && (
                        <span
                          title={t('archiveVerifiedReconstructionTooltip')}
                          className="mt-1 ml-1 inline-flex rounded border border-[var(--panel-border)] px-1.5 py-0.5 text-[13px] font-semibold text-main "
                        >
                          {t('archiveVerifiedReconstruction')}
                        </span>
                      )}
                      {interval ? (
                        <span className="mt-1.5 block space-y-0.5 text-[11px] leading-relaxed text-muted">
                          <span className="block">
                            {t('archiveEffectiveRange', {
                              from: interval.effective_from,
                              to: interval.effective_to ?? t('archiveOpenEnded'),
                            })}
                          </span>
                          {interval.published_at && (
                            <span className="block">{t('archivePublishedAt', { date: fmtDate(interval.published_at) })}</span>
                          )}
                          {interval.observed_at && (
                            <span className="block">{t('archiveObservedAt', { date: fmtDate(interval.observed_at) })}</span>
                          )}
                          {interval.verified_through_observed_at && (
                            <span className="block">{t('archiveVerifiedThrough', {
                              date: fmtDate(interval.verified_through_observed_at),
                            })}</span>
                          )}
                        </span>
                      ) : (
                        <span className="mt-1.5 block line-clamp-2 text-[11px] leading-relaxed text-muted">
                          {event?.procedure_title ?? event?.article_heading
                            ?? entry?.label ?? observation?.label
                            ?? t('archiveTimelineEvent')}
                        </span>
                      )}
                      </button>
                      {documentHref && (
                        <Link
                          href={documentHref}
                          className="flex min-w-0 items-center justify-between gap-2 border-t border-[var(--panel-border)] px-3 py-1.5 tabular-nums text-[11px] text-[var(--c-link)] hover:underline"
                        >
                          <span className="min-w-0 truncate">{event?.document_id}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <label className="block min-w-0 text-[13px] font-semibold text-muted [&>.sntiq-date]:mt-1">
              {t('archiveLegalDate')}
              <IsoDateField value={selectedDate}
                min={timeline[0]?.date}
                max={archive.head_date ?? timeline.at(-1)?.date} onChange={(iso) => selectFreeDate(iso)} />
              <span className="mt-1 block font-normal text-[11px] leading-relaxed">
                {t('archiveLegalDateHint')}
              </span>
            </label>
            <label className="block min-w-0 text-[13px] font-semibold text-muted [&>.sntiq-date]:mt-1">
              {t('archiveScope')}
              <select
                value={selectedNorm}
                onChange={(event) => setSelectedNorm(event.target.value)}
                className="sntiq-field mt-1"
              >
                <option value="">{t('archiveEntireAct')}</option>
                {normOptions.map((norm) => (
                  <option key={norm.value} value={norm.value}>{norm.label}</option>
                ))}
              </select>
            </label>
          </div>

          <details className="mt-3 rounded-lg border border-[var(--panel-border)] bg-[var(--c-link)]/[0.025]">
            <summary className="flex min-w-0 cursor-pointer list-none items-center gap-2 px-3 py-2 text-[11px] font-bold text-muted">
              <Clock3 className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 flex-1 break-words">{t('archiveKnowledgeAdvanced')}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
            </summary>
            <div className="border-t border-[var(--panel-border)] px-3 py-3">
              <label className="block min-w-0 text-[13px] font-semibold text-muted [&>.sntiq-date]:mt-1">
                {t('archiveKnowledgeDate')}
                <IsoDateField value={knowledgeAt} onChange={(iso) => setKnowledgeAt(iso)} />
              </label>
              <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 text-[11px] text-muted">
                <span className="min-w-0 break-words">{t('archiveKnowledgeHint')}</span>
                {archive.retrospective?.as_of && (
                  <Chip className="text-muted border-[var(--panel-border)] bg-transparent">
                    {t('archiveKnowledgeResolved', {
                      date: fmtDate(archive.retrospective.as_of),
                    })}
                  </Chip>
                )}
                {knowledgeAt && (
                  <button
                    type="button"
                    onClick={() => setKnowledgeAt('')}
                    className="rounded-md border border-[var(--panel-border)] px-2 py-1 font-bold text-main"
                  >
                    {t('archiveKnowledgeLatest')}
                  </button>
                )}
              </div>
            </div>
          </details>

          <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!previous}
              onClick={() => previous && selectTimeline(previous)}
              aria-label={t('archivePrevious')}
              className="inline-flex min-w-0 max-w-full flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--panel-border)] px-2.5 py-1.5 text-center text-xs font-bold text-main transition-colors hover:border-[var(--c-text-main)] disabled:pointer-events-none disabled:opacity-40 sm:flex-none"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> {t('archivePrevious')}
            </button>
            <button
              type="button"
              disabled={!next}
              onClick={() => next && selectTimeline(next)}
              aria-label={t('archiveNext')}
              className="inline-flex min-w-0 max-w-full flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--panel-border)] px-2.5 py-1.5 text-center text-xs font-bold text-main transition-colors hover:border-[var(--c-text-main)] disabled:pointer-events-none disabled:opacity-40 sm:flex-none"
            >
              {t('archiveNext')} <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={!archive.head_date || isHead}
              onClick={() => archive.head_date && selectFreeDate(archive.head_date)}
              className="min-w-0 max-w-full rounded-lg border border-[var(--c-link)]/30 bg-[var(--c-link)]/10 px-2.5 py-1.5 text-center text-xs font-bold text-[var(--c-link)] disabled:pointer-events-none disabled:opacity-50"
            >
              {t('archiveCurrent')}
            </button>
            {comparisonAvailable && (
              <button
                type="button"
                onClick={openComparison}
                className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-lg border border-[var(--panel-border)] px-2.5 py-1.5 text-xs font-bold text-main "
              >
                <span className="break-words">{t('archiveCompare')}</span>
              </button>
            )}
            <span className="flex min-w-0 flex-wrap items-center gap-1.5 sm:ml-auto" aria-live="polite">
              {isHead && (
                <Chip className="text-[var(--c-link)] border-[var(--c-link)]/30 bg-[var(--c-link)]/10">
                  {t('archiveCurrent')}
                </Chip>
              )}
              {markdown && (
                <Chip
                  title={selectedVerifiedReconstruction
                    ? t('archiveVerifiedReconstructionTooltip') : undefined}
                  className={selectedVerifiedReconstruction
                    ? 'text-main border-[var(--panel-border)] '
                    : markdown.exact && !markdown.partial
                  ? 'text-[var(--c-ok)] border-[var(--panel-border)] '
                  : 'text-[var(--c-warn)] border-[var(--panel-border)] '}
                >
                  {t(selectedVerifiedReconstruction
                    ? 'archiveVerifiedReconstruction'
                    : markdown.exact && !markdown.partial && isObservedState && !selectedInterval
                    ? 'archiveObservedExact'
                    : markdown.exact && !markdown.partial ? 'archiveExact' : 'archivePartial')}
                </Chip>
              )}
            </span>
          </div>

          {selectedEvent && (
            <section
              aria-labelledby={`kerf-archive-event-${act.id}`}
              className="mt-3 min-w-0 overflow-hidden rounded-xl border border-[var(--panel-border)] px-3 py-3 sm:px-4"
            >
              <div className="flex min-w-0 flex-wrap items-start gap-2">
                <span className="text-muted">
                  <GitCommitHorizontal className="h-4 w-4 text-main " />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <Chip className="text-main border-[var(--panel-border)] ">
                      {t(`archiveTimelineKind.${selectedTimelineItem?.kind ?? 'event'}`)}
                    </Chip>
                    {selectedTimelineItem?.future && (
                      <Chip className="text-main border-[var(--panel-border)] ">
                        {t('archiveFutureEffect')}
                      </Chip>
                    )}
                    {!selectedEvent.effective_at && (
                      <Chip className="text-[var(--c-warn)] border-[var(--panel-border)] ">
                        {t('archiveEffectiveUnresolved')}
                      </Chip>
                    )}
                    {selectedEvent.candidate_only && (
                      <Chip className="text-muted border-[var(--panel-border)] bg-transparent">
                        {t('archiveCandidateEvent')}
                      </Chip>
                    )}
                  </div>
                  <h4 id={`kerf-archive-event-${act.id}`} className="mt-1.5 min-w-0 break-words text-sm font-bold text-main">
                    {selectedAmendingActHref ? (
                      <Link
                        href={selectedAmendingActHref}
                        className="inline-flex min-w-0 max-w-full items-start gap-1 text-[var(--c-link)] hover:underline"
                      >
                        <span className="min-w-0 break-words">
                          {selectedEvent.procedure_title ?? selectedEvent.article_heading
                            ?? selectedEvent.document_id ?? t('archiveTimelineEvent')}
                        </span>
                        <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      </Link>
                    ) : (
                      selectedEvent.procedure_title ?? selectedEvent.article_heading
                        ?? selectedEvent.document_id ?? t('archiveTimelineEvent')
                    )}
                  </h4>
                  {(selectedEvent.article_heading || selectedEvent.amending_article) && (
                    <p className="mt-0.5 min-w-0 break-words text-[11px] text-muted">
                      {[selectedEvent.amending_article
                        ? `${t('archiveAmendingArticle')} ${selectedEvent.amending_article}` : null,
                      selectedEvent.article_heading].filter(Boolean).join(' — ')}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3 grid min-w-0 gap-2 text-[11px] text-muted sm:grid-cols-2 lg:grid-cols-4">
                <span className="min-w-0 break-words">
                  <strong className="text-main">{t('archivePublishedLabel')}:</strong>{' '}
                  {fmtDate(selectedEvent.published_at ?? selectedEvent.date)}
                </span>
                <span className="min-w-0 break-words">
                  <strong className="text-main">{t('archiveEffectiveAtLabel')}:</strong>{' '}
                  {selectedEvent.effective_at
                    ? fmtDate(selectedEvent.effective_at)
                    : t('archiveEffectiveUnresolved')}
                </span>
                {selectedEvent.document_id && (
                  <span className="min-w-0 break-all">
                    <strong className="text-main">{t('archiveDocument')}:</strong>{' '}
                    {selectedAmendingActHref ? (
                      <Link href={selectedAmendingActHref} className="text-[var(--c-link)] hover:underline">
                        {selectedEvent.document_id}
                      </Link>
                    ) : selectedEvent.document_id}
                  </span>
                )}
                {(selectedEvent.effective_date_status || selectedEvent.date_status) && (
                  <span className="min-w-0 break-words">
                    <strong className="text-main">{t('archiveDateStatus')}:</strong>{' '}
                    {(selectedEvent.effective_date_status ?? selectedEvent.date_status)
                      ?.replaceAll('_', ' ')}
                  </span>
                )}
              </div>

              {(selectedEvent.affected_norms?.length ?? 0) > 0 && (
                <div className="mt-3 min-w-0">
                  <p className="text-[13px] font-semibold text-muted">
                    {t('archiveAffectedNorms')}
                  </p>
                  <div className="mt-1.5 flex min-w-0 flex-wrap gap-1.5">
                    {selectedEvent.affected_norms!.map((norm) => (
                      <Chip
                        key={norm}
                        className={normalizedNormRef(norm) === normalizedNormRef(selectedNorm)
                          ? 'text-main border-[var(--panel-border)] '
                          : 'text-muted border-[var(--panel-border)] bg-transparent'}
                      >
                        {norm}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-3 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-[11px] leading-relaxed text-muted">
                {t('archiveEventNotCheckoutable')}
              </div>

              {(eventOfficialLinks.length > 0 || eventEvidenceLinks.length > 0) && (
                <div className="mt-3 min-w-0">
                  <p className="text-[13px] font-semibold text-muted">
                    {t('archiveOfficialEvidence')}
                  </p>
                  <div className="mt-1.5 flex min-w-0 flex-wrap gap-x-3 gap-y-1.5">
                    {[...eventOfficialLinks, ...eventEvidenceLinks].map((source) => (
                      <a
                        key={source.id}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={source.digest ?? undefined}
                        className="inline-flex min-w-0 max-w-full items-center gap-1 break-all font-mono text-[11px] text-[var(--c-link)] hover:underline"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        {source.label}
                        {source.digest && ` · ${shortDigest(source.digest)}`}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <details className="mt-3 min-w-0 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)]">
                <summary className="flex min-w-0 cursor-pointer list-none items-center gap-2 px-3 py-2 text-[11px] font-bold text-main">
                  <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 break-words">
                    {t('archiveAmendmentCommands', {
                      count: selectedEventCommands.length,
                      total: selectedEvent.commands?.length ?? selectedEvent.command_count ?? 0,
                    })}
                  </span>
                </summary>
                <div className="min-w-0 space-y-2 border-t border-[var(--panel-border)] p-3">
                  {selectedEventCommands.length === 0 ? (
                    <p className="text-xs text-muted">
                      {t(selectedNorm
                        ? 'archiveNoCommandsForNorm' : 'archiveNoParsedCommands')}
                    </p>
                  ) : selectedEventCommands.map((command, index) => (
                    <article
                      key={`${command.item ?? index}:${command.operation ?? 'command'}`}
                      className="min-w-0 overflow-hidden rounded-lg border border-[var(--panel-border)] bg-[var(--c-link)]/[0.025] p-3"
                    >
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <Chip className="text-main border-[var(--panel-border)] ">
                          {command.operation ?? t('archiveCommand')}
                        </Chip>
                        {amendmentCommandNorm(command) && (
                          <Chip className="text-muted border-[var(--panel-border)] bg-transparent">
                            {amendmentCommandNorm(command)}
                            {command.ref?.absatz ? ` Abs. ${command.ref.absatz}` : ''}
                          </Chip>
                        )}
                      </div>
                      {command.old_text_constraint && (
                        <div className="mt-2 min-w-0">
                          <p className="text-[13px] font-semibold text-[var(--c-bad)] ">
                            {t('archiveOldTextConstraint')}
                          </p>
                          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded p-2 text-[11px] leading-relaxed text-main">
                            {command.old_text_constraint}
                          </pre>
                        </div>
                      )}
                      {command.new_text && (
                        <div className="mt-2 min-w-0">
                          <p className="text-[13px] font-semibold text-[var(--c-ok)] ">
                            {t('archiveNewText')}
                          </p>
                          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded p-2 text-[11px] leading-relaxed text-main">
                            {command.new_text}
                          </pre>
                        </div>
                      )}
                      {command.raw && !command.new_text && !command.old_text_constraint && (
                        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-black/[0.025] p-2 text-[11px] leading-relaxed text-muted dark:bg-white/[0.025]">
                          {command.raw}
                        </pre>
                      )}
                    </article>
                  ))}
                </div>
              </details>

              <div className="mt-3 flex min-w-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={copyEventCitation}
                  disabled={!selectedEventCitation}
                  className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-lg border border-[var(--panel-border)] px-2.5 py-1.5 text-[11px] font-bold text-main disabled:opacity-40"
                >
                  {eventCitationCopied
                    ? <Check className="h-3.5 w-3.5 text-[var(--c-ok)]" />
                    : <Copy className="h-3.5 w-3.5" />}
                  <span className="break-words">{t(eventCitationCopied
                    ? 'archiveCitationCopied' : 'archiveCopyCitation')}</span>
                </button>
                <button
                  type="button"
                  onClick={downloadEventJson}
                  className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-lg border border-[var(--panel-border)] px-2.5 py-1.5 text-[11px] font-bold text-main "
                >
                  <Download className="h-3.5 w-3.5 shrink-0" />
                  <span className="break-words">{t('archiveDownloadEventJson')}</span>
                </button>
              </div>
            </section>
          )}

          {selectedInterval && (
            <div className="mt-3 rounded-xl border border-[var(--panel-border)] px-3 py-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Chip className="text-[var(--c-link)] border-[var(--panel-border)] ">
                  <History className="h-3 w-3" /> {t('archiveLegalVersion')}
                </Chip>
                {selectedTimelineItem?.verifiedReconstruction && (
                  <Chip
                    title={t('archiveVerifiedReconstructionTooltip')}
                    className="text-main border-[var(--panel-border)] "
                  >
                    <Check className="h-3 w-3" /> {t('archiveVerifiedReconstruction')}
                  </Chip>
                )}
                <span className="min-w-0 break-words text-xs font-bold text-main">
                  {t('archiveEffectiveRange', {
                    from: selectedInterval.effective_from,
                    to: selectedInterval.effective_to ?? t('archiveOpenEnded'),
                  })}
                </span>
              </div>
              <div className="mt-2 grid min-w-0 gap-2 text-[11px] text-muted sm:grid-cols-2 lg:grid-cols-3">
                <span className="min-w-0 break-words">
                  <strong className="text-main">{t('archiveEffectiveAtLabel')}:</strong>{' '}
                  {fmtDate(selectedInterval.effective_from)}
                  {selectedInterval.effective_to
                    ? ` – ${fmtDate(selectedInterval.effective_to)} (${t('archiveExclusiveEnd')})`
                    : ` – ${t('archiveOpenEnded')}`}
                </span>
                {selectedInterval.published_at && (
                  <span className="min-w-0 break-words">
                    <strong className="text-main">{t('archivePublishedLabel')}:</strong>{' '}
                    {fmtDate(selectedInterval.published_at)}
                  </span>
                )}
                {selectedInterval.observed_at && (
                  <span className="min-w-0 break-words">
                    <strong className="text-main">{t('archiveObservedLabel')}:</strong>{' '}
                    {fmtDate(selectedInterval.observed_at)}
                  </span>
                )}
                {selectedInterval.verified_through_observed_at && (
                  <span className="min-w-0 break-words">
                    <strong className="text-main">{t('archiveVerifiedThroughLabel')}:</strong>{' '}
                    {fmtDate(selectedInterval.verified_through_observed_at)}
                  </span>
                )}
                {selectedInterval.knowledge_from && (
                  <span className="min-w-0 break-words">
                    <strong className="text-main">{t('archiveKnownFromLabel')}:</strong>{' '}
                    {fmtDate(selectedInterval.knowledge_from)}
                    {selectedInterval.knowledge_to
                      ? ` – ${fmtDate(selectedInterval.knowledge_to)}` : ''}
                  </span>
                )}
                {selectedInterval.text_status && (
                  <span className="min-w-0 break-words">
                    <strong className="text-main">{t('archiveTextStatus')}:</strong>{' '}
                    {t(`archiveEvidence.${selectedInterval.text_status}`, {
                      defaultValue: selectedInterval.text_status.replaceAll('_', ' '),
                    })}
                  </span>
                )}
                {selectedInterval.date_status && (
                  <span className="min-w-0 break-words">
                    <strong className="text-main">{t('archiveDateStatus')}:</strong>{' '}
                    {t(`archiveEvidence.${selectedInterval.date_status}`, {
                      defaultValue: selectedInterval.date_status.replaceAll('_', ' '),
                    })}
                  </span>
                )}
              </div>
              {selectedInterval.state_sha256 && (
                <p className="mt-2 min-w-0 break-all font-mono text-[11px] text-muted" title={selectedInterval.state_sha256}>
                  {t('archiveStateDigest')}: {shortDigest(selectedInterval.state_sha256)}
                </p>
              )}
            </div>
          )}

          {!selectedInterval && legalEffectVerified && selectedEntry?.effective_at && (
            <div className="mt-3 rounded-lg border border-[var(--panel-border)] px-3 py-2.5">
              <div className="flex items-center gap-x-3 gap-y-1.5 flex-wrap">
                <Chip className="text-[var(--c-ok)] border-[var(--panel-border)] ">
                  <Check className="w-3 h-3" /> {t('archiveLegalEffectVerified')}
                </Chip>
                <span className="text-[11px] text-main">
                  {t('archiveLegalEffectNote', {
                    effective: selectedEntry.effective_at,
                    observed: selectedEntry.observed_at ?? selectedEntry.date,
                  })}
                </span>
                {selectedEntry.published_at && (
                  <Chip className="text-muted border-[var(--panel-border)] bg-transparent">
                    {t('archivePublishedAt', { date: fmtDate(selectedEntry.published_at) })}
                  </Chip>
                )}
              </div>
              <div className="mt-2 flex items-center gap-x-3 gap-y-1 flex-wrap text-[11px] tabular-nums">
                {selectedBgbl.url && (
                  <a
                    href={selectedBgbl.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[var(--c-link)] hover:underline"
                  >
                    {selectedBgbl.label ?? t('archiveBgblFinal')} <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {selectedProcedureUrl && (
                  <a
                    href={selectedProcedureUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[var(--c-link)] hover:underline"
                  >
                    {t('archiveDipProcedure')} <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {selectedEntry.legal_verification && (
                  <span className="text-muted break-all">{selectedEntry.legal_verification}</span>
                )}
              </div>
            </div>
          )}

          {!selectedInterval && isObservedState && selectedEntry && (
            <div className="mt-3 rounded-lg border border-[var(--panel-border)] px-3 py-2.5">
              <div className="flex items-center gap-x-3 gap-y-1.5 flex-wrap">
                <Chip className={isExactObservedState
                  ? 'text-[var(--c-ok)] border-[var(--panel-border)] '
                  : 'text-muted border-[var(--panel-border)] bg-transparent'}>
                  {isExactObservedState && <Check className="w-3 h-3" />}
                  {t(isExactObservedState ? 'archiveObservedExact' : 'archiveObservedShort')}
                </Chip>
                <span className="text-[11px] text-muted">
                  {t('archiveObservedNote', {
                    date: selectedEntry.observed_at ?? selectedEntry.date,
                  })}
                </span>
                {observedSourceUrl && (
                  <a
                    href={observedSourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] tabular-nums text-[var(--c-link)] hover:underline"
                  >
                    {t('archiveOfficialSource')} <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              {(selectedEntry.builddate || observedDigest) && (
                <div className="mt-1.5 flex items-center gap-x-3 gap-y-1 flex-wrap text-[11px] tabular-nums text-muted">
                  {selectedEntry.builddate && (
                    <span>{t('archiveSourceBuild')}: {fmtDate(selectedEntry.builddate)}</span>
                  )}
                  {observedDigest && (
                    <span title={selectedEntry.state_digest ?? undefined}>
                      {t('archiveStateDigest')}: {observedDigest}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {snapshotGaps.length > 0 && (
            <div className="mt-3 rounded-lg border border-[var(--panel-border)] px-3 py-2.5">
              <p className="text-[13px] font-semibold text-[var(--c-warn)] ">
                {t('archiveGaps')}
              </p>
              <ul className="mt-1 list-disc pl-4 text-xs text-muted space-y-0.5">
                {snapshotGaps.map((gap, index) => (
                  <li key={`${JSON.stringify(gap)}-${index}`}>
                    {gapText(gap, t('archiveGapUnknown'))}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {comparisonOpen && comparisonAvailable && (
            <section
              aria-labelledby={`kerf-archive-compare-${act.id}`}
              className="mt-4 min-w-0 rounded-xl border border-[var(--panel-border)] p-3 sm:p-4"
            >
              <div className="flex min-w-0 flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h4 id={`kerf-archive-compare-${act.id}`} className="font-bold text-main">
                    {t('archiveCompareTitle')}
                  </h4>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                    {t('archiveCompareHint')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setComparisonOpen(false)}
                  className="shrink-0 rounded-md border border-[var(--panel-border)] px-2 py-1 text-[11px] font-bold text-muted hover:text-main"
                >
                  {t('archiveCompareClose')}
                </button>
              </div>
              <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
                <label className="block min-w-0 text-[13px] font-semibold text-muted [&>.sntiq-date]:mt-1">
                  {t('archiveCompareFrom')}
                  <IsoDateField value={compareFrom}
                    min={timeline[0]?.date}
                    max={archive.head_date ?? timeline.at(-1)?.date} onChange={(iso) => setCompareFrom(iso)} />
                </label>
                <label className="block min-w-0 text-[13px] font-semibold text-muted [&>.sntiq-date]:mt-1">
                  {t('archiveCompareTo')}
                  <IsoDateField value={compareTo}
                    min={timeline[0]?.date}
                    max={archive.head_date ?? timeline.at(-1)?.date} onChange={(iso) => setCompareTo(iso)} />
                </label>
              </div>
              {compareFrom && compareTo && compareFrom === compareTo && (
                <p className="mt-3 text-xs text-muted">{t('archiveCompareSameDate')}</p>
              )}
              {comparisonLoading && (
                <div className="mt-3 flex items-center gap-2 text-xs text-muted" role="status">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('archiveCompareLoading')}
                </div>
              )}
              {comparisonError && (
                <p className="mt-3 flex items-center gap-2 text-xs text-[var(--c-warn)] " role="alert">
                  <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                  {t('archiveCompareUnavailable')}
                </p>
              )}
              {comparison && !comparisonLoading && (
                <div className="mt-3 min-w-0 space-y-3">
                  <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                    {([['from', comparison.from], ['to', comparison.to]] as const).map(([side, point]) => (
                      <div key={side} className="min-w-0 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-[11px] text-muted">
                        <p className="font-semibold text-main">
                          {t(side === 'from' ? 'archiveCompareFrom' : 'archiveCompareTo')}
                        </p>
                        <p className="mt-1 min-w-0 break-words">
                          {t('archiveCompareResolved', {
                            requested: point.requested_at
                              ?? (side === 'from' ? compareFrom : compareTo),
                            from: point.effective_from ?? point.resolved_at ?? '—',
                            to: point.effective_to ?? t('archiveOpenEnded'),
                          })}
                        </p>
                        {point.state_sha256 && (
                          <p className="mt-1 truncate font-mono" title={point.state_sha256}>
                            SHA-256 {shortDigest(point.state_sha256)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  {(comparison.gaps?.length ?? 0) > 0 && (
                    <div className="rounded-lg border border-[var(--panel-border)] px-3 py-2">
                      <p className="text-[11px] font-bold text-[var(--c-warn)] ">
                        {t('archiveGaps')}
                      </p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted">
                        {comparison.gaps!.map((gap, index) => (
                          <li key={`${JSON.stringify(gap)}-${index}`}>
                            {gapText(gap, t('archiveGapUnknown'))}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {comparison.changes.length === 0 ? (
                    <p className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3 text-xs text-muted">
                      {t('archiveCompareNoChanges')}
                    </p>
                  ) : comparison.changes.map((change, index) => (
                    <article
                      key={`${change.enbez}:${change.operation}:${index}`}
                      className="min-w-0 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3"
                    >
                      <div className="mb-2 flex min-w-0 flex-wrap items-center gap-2">
                        <Chip className="text-main border-[var(--panel-border)] ">
                          {change.enbez}
                        </Chip>
                        <span className="min-w-0 flex-1 break-words text-xs font-bold text-main">
                          {change.title}
                        </span>
                        <span className="text-[13px] font-semibold text-muted">
                          {t(`archiveCompareOperation.${change.operation}`, {
                            defaultValue: change.operation,
                          })}
                        </span>
                      </div>
                      <ChangeBody
                        oldText={change.old ?? null}
                        newText={change.new ?? null}
                        view="diff"
                      />
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          <div className="mt-4 rounded-xl border border-[var(--panel-border)] overflow-hidden">
            <div className="flex min-w-0 flex-wrap items-center gap-2 border-b border-[var(--panel-border)] bg-[var(--c-link)]/[0.035] px-3 py-2.5">
              <FileText className="w-3.5 h-3.5 text-[var(--c-link)]" />
              <span className="text-xs font-bold text-main">{t('archiveMarkdown')}</span>
              {markdown?.resolved_at && (
                <span className="min-w-0 break-words text-[11px] tabular-nums text-muted">
                  {markdown.resolved_at !== selectedDate
                    ? t('archiveRequestedResolved', {
                      requested: selectedDate,
                      resolved: markdown.resolved_at,
                    })
                    : t('archiveResolved', { date: markdown.resolved_at })}
                </span>
              )}
              <div className="flex w-full min-w-0 flex-wrap items-center gap-1.5 sm:ml-auto sm:w-auto">
                <button
                  type="button"
                  disabled={!markdown?.markdown}
                  onClick={copyMarkdown}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold text-muted hover:text-main disabled:opacity-40 disabled:pointer-events-none transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[var(--c-ok)]" /> : <Copy className="w-3.5 h-3.5" />}
                  {t(copied ? 'archiveCopied' : 'archiveCopy')}
                </button>
                {apiUrl && (
                  <a
                    href={apiUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-w-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold text-muted hover:text-main transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> {t('archiveOpenApi')}
                  </a>
                )}
                {downloadUrl && (
                  <a
                    href={downloadUrl}
                    download={`${fileName || act.id}.md`}
                    className="inline-flex min-w-0 items-center gap-1 rounded-md border border-[var(--c-link)]/30 bg-[var(--c-link)]/10 px-2 py-1 text-[11px] font-bold text-[var(--c-link)]"
                  >
                    <Download className="w-3.5 h-3.5" /> {t('archiveDownload')}
                  </a>
                )}
              </div>
            </div>
            {!canCheckoutSelectedDate && selectedDate && (
              <p className="flex min-w-0 items-start gap-2 p-4 text-xs leading-relaxed text-muted">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-main" />
                <span className="min-w-0 break-words">{t('archiveEventNotCheckoutable')}</span>
              </p>
            )}
            {markdownLoading && (
              <div className="flex items-center gap-2 p-4 text-xs text-muted" role="status">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('loading')}
              </div>
            )}
            {markdownError && (
              <p className="flex items-center gap-2 p-4 text-xs text-muted" role="alert">
                <TriangleAlert className="w-3.5 h-3.5 text-[var(--c-warn)]" />
                {t('archiveMarkdownUnavailable')}
              </p>
            )}
            {markdown && !markdownLoading && (
              markdown.markdown ? (
                <pre
                  tabIndex={0}
                  aria-label={t('archiveMarkdownPreview')}
                  className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words p-4 text-xs leading-relaxed text-main font-mono"
                >
                  {markdown.markdown}
                </pre>
              ) : (
                <p className="p-4 text-xs text-muted italic">{t('archiveNoMarkdown')}</p>
              )
            )}
          </div>
          {copyError && (
            <p className="mt-2 text-[11px] text-[var(--c-warn)] " role="alert">
              {t('archiveCopyFailed')}
            </p>
          )}
            </>
          )}
        </div>
      )}
    </details>
  );
};

const WikiTab: React.FC<{
  acts: KerfAct[] | null;
  error: boolean;
  feed: KerfFeedEvent[] | null;
  feedError: boolean;
  digest: KerfDigest | 'none' | null;
  stats: KerfStats | null;
  selectedId: string | null;
  detail: KerfActDetail | null;
  detailLoading: boolean;
  detailError: boolean;
  onSelect: (id: string, norm?: string | null) => void;
  onSynopse: () => void;
  onOpenSynopse: (id: string, norm?: string | null) => void;
  onDecisions: (jurabk: string) => void;
}> = ({
  acts, error, feed, feedError, digest, stats, selectedId, detail, detailLoading,
  detailError, onSelect, onSynopse, onOpenSynopse, onDecisions,
}) => {
  const { t } = useTranslation('kerf');
  const [q, setQ] = useState('');
  const [view, setView] = useState<'index' | 'realtime'>('index');
  const [searchResult, setSearchResult] = useState<KerfSearch | null>(null);
  const [searchPending, setSearchPending] = useState(false);
  const [searchMode, setSearchMode] = useState<'idle' | 'ready' | 'legacy' | 'error'>('idle');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<LawIndexGroupId>>(
    () => new Set(),
  );
  const [collapsedSubgroups, setCollapsedSubgroups] = useState<Set<LawIndexSubgroupId>>(
    () => new Set(),
  );

  const localFiltered = useMemo(() => {
    if (!acts) return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return acts;
    return acts.filter((a) =>
      `${a.title} ${a.jurabk} ${a.id}`.toLowerCase().includes(needle));
  }, [acts, q]);

  /* Keep title filtering synchronous, then enrich it after a short pause with
     ranked aliases and actual norm-body hits. An older/unavailable API never
     makes the index unusable: the local result remains visible. */
  useEffect(() => {
    const needle = q.trim();
    if (needle.length < 2) {
      setSearchResult(null);
      setSearchPending(false);
      setSearchMode('idle');
      return;
    }

    const ctl = new AbortController();
    setSearchResult(null);
    setSearchPending(true);
    setSearchMode('idle');
    const timer = window.setTimeout(() => {
      kerfSearch(needle, { limit: 40, normLimit: 40 }, ctl.signal)
        .then((result) => {
          if (ctl.signal.aborted) return;
          // Explicit null totals (a component that did not answer) stay null.
          const { enriched, ...normalized } = normalizeSearchResult(result, needle);
          setSearchResult(normalized);
          setSearchMode(enriched ? 'ready' : 'legacy');
        })
        .catch(() => {
          if (!ctl.signal.aborted) setSearchMode('error');
        })
        .finally(() => {
          if (!ctl.signal.aborted) setSearchPending(false);
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      ctl.abort();
    };
  }, [q]);

  const filtered = useMemo(() => {
    if (!q.trim() || !searchResult) return localFiltered;
    const byId = new Map<string, KerfAct>();
    for (const act of searchResult.act_matches) byId.set(act.id, act);
    for (const act of localFiltered) if (!byId.has(act.id)) byId.set(act.id, act);
    return Array.from(byId.values());
  }, [localFiltered, q, searchResult]);

  const groupedActs = useMemo(() => groupLawIndexActs(filtered), [filtered]);

  /* A search result must never be hidden behind a section the user happened
     to collapse earlier. Further toggles still work after the query settles. */
  useEffect(() => {
    if (!q.trim()) return;
    setCollapsedGroups((current) => current.size ? new Set() : current);
    setCollapsedSubgroups((current) => current.size ? new Set() : current);
  }, [q]);

  const toggleGroup = (id: LawIndexGroupId) => {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleSubgroup = (id: LawIndexSubgroupId) => {
    setCollapsedSubgroups((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const expandAllTopics = () => {
    setCollapsedGroups(new Set());
    setCollapsedSubgroups(new Set());
  };
  const collapseAllTopics = () => {
    setCollapsedGroups(new Set(groupedActs.map(({ id }) => id)));
    setCollapsedSubgroups(new Set(groupedActs.flatMap(({ subgroups }) =>
      subgroups.map(({ id }) => id))));
  };

  const normHits: KerfNormSearchHit[] = searchResult?.norm_matches ?? [];
  const procedureHits: KerfProcedureSearchHit[] = searchResult?.procedure_matches ?? [];
  const catalogHits: KerfCatalogSearchHit[] = searchResult?.catalog_matches ?? [];
  const changeHits: KerfChangeSearchHit[] = searchResult?.change_matches ?? [];
  const decisionHits: KerfDecision[] = searchResult?.decision_matches ?? [];
  const searchIncomplete = Boolean(searchResult) && (searchResult?.status === 'partial'
    || unavailableSearchComponents(searchResult).length > 0);
  const conceptNormHits = normHits.filter((hit) =>
    hit.matched_fields.includes('concept'));
  const literalNormHits = normHits.filter((hit) =>
    !hit.matched_fields.includes('concept'));

  if (error) return <LoadError />;
  if (!acts) return <Spinner />;

  return (
    <div>
      <header className={workbench.viewHead}>
        <div>
          <h2>{t('searchTitle')}</h2>
          <p>{t('searchHint')}</p>
        </div>
        <div className={workbench.seg} role="group" aria-label={t('searchTitle')}>
          {(['index', 'realtime'] as const).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v}>
              {t(`wikiView.${v}`)}
            </button>
          ))}
        </div>
      </header>

      {/* Discovery is the primary action.  Keep it above digests and watch
          cards, and temporarily clear those panels while a query is active so
          results never begin below several screens of unrelated content. */}
      {view === 'index' && (
        <>
          <div className={`sntiq-search ${workbench.field}`}>
            <Search aria-hidden="true" />
            <input className="sntiq-field"
              type="text"
              value={q}
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchTitle')}
              aria-busy={searchPending}
              onChange={(e) => setQ(e.target.value)}
            />
            {searchPending && (
              <>
                <Loader2
                  aria-hidden="true"
                  className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-[var(--c-link)] pointer-events-none"
                />
                <span className="sr-only" role="status">{t('loading')}</span>
              </>
            )}
          </div>
          {(searchMode === 'legacy' || searchMode === 'error') && q.trim().length >= 2 && (
            <p className="text-[11px] text-muted mb-3" role="status">
              {t(searchMode === 'legacy' ? 'searchTitleFallback' : 'searchUnavailable')}
            </p>
          )}
          {searchResult && q.trim().length >= 2 && <SearchStatusPanel result={searchResult} />}
        </>
      )}

      {view === 'index' && !q.trim() && stats && (
        <div className={workbench.coverage}>
          <dl className={workbench.facts}>
            <div><dd>{(stats.acts_fed + stats.acts_by).toLocaleString()}</dd><dt>{t('coverageDeepActs')}</dt></div>
            <div><dd>{stats.search?.norms?.toLocaleString() ?? '—'}</dd><dt>{t('coverageSearchableNorms')}</dt></div>
            <div><dd>{stats.gii_catalog_total?.toLocaleString() ?? '—'}</dd><dt>{t('coverageGiiMetadata')}</dt></div>
            <div><dd>{stats.eu_index_total?.toLocaleString() ?? '—'}</dd><dt>{t('coverageEuMetadata')}</dt></div>
            <div><dd>{stats.decisions?.toLocaleString() ?? '—'}</dd><dt>{t('coverageDecisions')}</dt></div>
          </dl>
          <p>{t('coverageHonesty')}</p>
        </div>
      )}

      {/* The LLM digest lives at tab level, not inside the Realtime
          sub-view — the default sub-view is the index, and the digest
          should be discoverable without switching. */}
      {(view !== 'index' || !q.trim()) && digest && digest !== 'none'
        && <DigestPanel digest={digest} />}

      {(view !== 'index' || !q.trim()) && <TrackedProceduresPanel />}

      {view === 'realtime' && (
        <FeedView feed={feed} error={feedError} />
      )}
      {view === 'index' && (<>

      {!q.trim() && detailLoading && !detail && <Spinner />}
      {!q.trim() && detailError && <LoadError />}
      {!q.trim() && detail && detail.id === selectedId && (
        <>
          <TemporalHeader act={detail} onSynopse={onSynopse} onDecisions={onDecisions} />
          <ActCitationsPanel key={`citations:${detail.id}`} act={detail} onOpenAct={onSelect} />
          <ActArchivePanel key={detail.id} act={detail} />
        </>
      )}

      <div className={workbench.listHead}>
        <div>
          <h3>{t('lawCount', { count: filtered.length })}</h3>
          <p>{t('lawTopicNavigationNote')}</p>
        </div>
        <div className={workbench.listTools} role="group" aria-label={t('lawTopicControls')}>
          <button type="button" onClick={expandAllTopics}>
            <ChevronDown aria-hidden="true" className="h-4 w-4" />
            {t('lawTopicExpandAll')}
          </button>
          <button type="button" onClick={collapseAllTopics}>
            <ChevronUp aria-hidden="true" className="h-4 w-4" />
            {t('lawTopicCollapseAll')}
          </button>
        </div>
      </div>

      {/* 'No law matches' is only claimed when every component answered. */}
      {filtered.length === 0 && procedureHits.length === 0
        && normHits.length === 0 && catalogHits.length === 0
        && changeHits.length === 0 && decisionHits.length === 0 && !searchPending && (
        <p className="text-sm text-muted p-4">
          {t(searchIncomplete ? 'searchNoResultsAvailableParts' : 'noResults')}
        </p>
      )}
      {/* A ruled index: topic, subtopic, then one row per law with the
          abbreviation as the anchor. No cards. */}
      <div className={workbench.topics}>
        {groupedActs.map((group) => {
          const groupOpen = !collapsedGroups.has(group.id);
          const groupPanelId = `kerf-law-topic-${group.id}`;
          return (
            <section key={group.id} className={workbench.topic}>
              <button
                type="button"
                aria-expanded={groupOpen}
                aria-controls={groupPanelId}
                onClick={() => toggleGroup(group.id)}
                className={workbench.topicHead}
              >
                <ChevronRight aria-hidden="true" className={`h-4 w-4 shrink-0 transition-transform ${groupOpen ? 'rotate-90' : ''}`} />
                <h3>{t(`lawTopic.group.${group.id}`)}</h3>
                <span>{group.count}</span>
              </button>
              {groupOpen && (
                <div id={groupPanelId}>
                  {group.subgroups.map((subgroup) => {
                    const subgroupOpen = !collapsedSubgroups.has(subgroup.id);
                    const subgroupPanelId = `kerf-law-topic-${group.id}-${subgroup.id}`;
                    return (
                      <section key={subgroup.id} className={workbench.subtopic}>
                        <button
                          type="button"
                          aria-expanded={subgroupOpen}
                          aria-controls={subgroupPanelId}
                          onClick={() => toggleSubgroup(subgroup.id)}
                          className={workbench.subtopicHead}
                        >
                          <ChevronRight aria-hidden="true" className={`h-3.5 w-3.5 shrink-0 transition-transform ${subgroupOpen ? 'rotate-90' : ''}`} />
                          <h4>{t(`lawTopic.subgroup.${subgroup.id}`)}</h4>
                          <span>{subgroup.acts.length}</span>
                        </button>
                        {subgroupOpen && (
                          <ul id={subgroupPanelId} className={workbench.laws}>
                            {subgroup.acts.map((a) => {
                              const active = a.id === selectedId;
                              const src = actSourceUrl(a);
                              return (
                                <li key={a.id} data-active={active}>
                                  <div className={workbench.lawLine}>
                                    <button type="button" onClick={() => onSelect(a.id)} className={workbench.law} aria-current={active ? 'true' : undefined}>
                                      <strong>{a.jurabk}</strong>
                                      <span className={workbench.lawTitle}>{a.title}</span>
                                      <span className={workbench.lawMeta}>
                                        <span>{a.norms} {t('norms')}</span>
                                        <span title={a.last_change ? undefined : t('lastChangeUnknownHint')}>
                                          {t('lastChange')} {fmtDate(a.last_change)}
                                        </span>
                                        {a.pending > 0 && (
                                          <span data-tone="warn" title={t('pendingHint')}>
                                            {t('pendingCount', { count: a.pending })}
                                          </span>
                                        )}
                                        {(a.decisions ?? 0) > 0 && (
                                          <span title={t('dec.forAct', { count: a.decisions ?? 0 })}>
                                            <Scale aria-hidden="true" className="inline h-3.5 w-3.5 align-[-2px]" /> {a.decisions}
                                            <span className="sr-only"> {t('dec.forAct', { count: a.decisions ?? 0 })}</span>
                                          </span>
                                        )}
                                      </span>
                                    </button>
                                    {/* Official text remains a sibling: nested
                                        interactive controls are invalid HTML. */}
                                    {src && (
                                      <a href={src} target="_blank" rel="noopener noreferrer" title={t('source')} aria-label={`${a.jurabk}: ${t('source')}`} className={workbench.lawSource}>
                                        <ExternalLink aria-hidden="true" className="w-4 h-4" />
                                      </a>
                                    )}
                                  </div>
                                  {active && (
                                    <button type="button" onClick={onSynopse} className={workbench.lawAction}> {t('viewSynopse')}
                                    </button>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
      {catalogHits.length > 0 && (
        <CatalogSearchSection
          hits={catalogHits}
          total={searchResult?.catalog_total}
          query={q}
        />
      )}
      {conceptNormHits.length > 0 && (
        <NormSearchSection
          id="kerf-norm-search-concept"
          title={t('searchConceptHits')}
          hits={conceptNormHits}
          total={searchResult?.norm_total}
          query={q}
          onSelect={onSelect}
          onOpenSynopse={onOpenSynopse}
        />
      )}
      {procedureHits.length > 0 && (
        <ProcedureSearchSection hits={procedureHits} total={searchResult?.procedure_total} query={q} />
      )}
      {literalNormHits.length > 0 && (
        <NormSearchSection
          id="kerf-norm-search-text"
          title={t('searchTextHits')}
          hits={literalNormHits}
          total={searchResult?.norm_total}
          query={q}
          onSelect={onSelect}
          onOpenSynopse={onOpenSynopse}
        />
      )}
      {changeHits.length > 0 && (
        <ChangeSearchSection
          hits={changeHits}
          total={searchResult?.change_total}
          query={q}
          onOpenSynopse={onOpenSynopse}
        />
      )}
      {decisionHits.length > 0 && (
        <DecisionSearchSection hits={decisionHits} total={searchResult?.decision_total} query={q} />
      )}
      </>)}
    </div>
  );
};

// ------------------------------------------------------------- Synopse
/** How an amendment's text is presented: inline word-diff (default), old
    and new side by side, or just the resulting text. */
type DiffView = 'diff' | 'split' | 'clean';

/** One amendment's old→new body in the chosen view. Shared by the DIP patch
    cards and the buzer per-§ changes. */
const ChangeBody: React.FC<{
  oldText: string | null;
  newText: string | null;
  view: DiffView;
}> = ({ oldText, newText, view }) => {
  const { t } = useTranslation('kerf');
  const rendered = useMemo(() => {
    try {
      if (view === 'split') return wordDiffSplit(oldText, newText);
      if (view === 'diff') return oldText || newText ? wordDiff(oldText, newText) : '';
      return null;
    } catch (error) {
      if (error instanceof DiffLimitError) return error;
      throw error;
    }
  }, [oldText, newText, view]);

  if (rendered instanceof DiffLimitError) return (
    <div className="space-y-3">
      <p role="status" className="text-sm text-muted">{t('diffTooLarge')}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {[[t('oldLabel'), oldText], [t('newLabel'), newText]].map(([label, text], index) => (
          <details key={index} className="min-w-0">
            <summary className="cursor-pointer text-sm font-semibold">{label}</summary>
            <p className="text-sm text-main whitespace-pre-wrap break-words">{text || t(index ? 'noNewText' : 'noOldText')}</p>
          </details>
        ))}
      </div>
    </div>
  );

  if (view === 'clean') {
    return newText ? (
      <p className="text-sm text-main whitespace-pre-wrap break-words">{newText}</p>
    ) : (
      <p className="text-xs text-muted italic">{t('noNewText')}</p>
    );
  }
  if (view === 'split') {
    const { oldHtml, newHtml } = rendered as { oldHtml: string; newHtml: string };
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="border-l-2 border-[var(--panel-border)] pl-3 min-w-0">
          <p className="text-[13px] tabular-nums font-semibold text-muted mb-1">
            {t('oldLabel')}
          </p>
          {oldText ? (
            <div className="kerf-diff text-sm text-main"
                 dangerouslySetInnerHTML={{ __html: oldHtml }} />
          ) : (
            <p className="text-xs text-muted italic">{t('noOldText')}</p>
          )}
        </div>
        <div className="border-l-2 border-[var(--panel-border)] pl-3 min-w-0">
          <p className="text-[13px] tabular-nums font-semibold text-muted mb-1">
            {t('newLabel')}
          </p>
          {newText ? (
            <div className="kerf-diff text-sm text-main"
                 dangerouslySetInnerHTML={{ __html: newHtml }} />
          ) : (
            <p className="text-xs text-muted italic">{t('noNewText')}</p>
          )}
        </div>
      </div>
    );
  }
  const html = rendered as string;
  return html ? (
    <div className="kerf-diff text-sm text-main" dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <p className="text-xs text-muted italic">{t('noDiff')}</p>
  );
};

const PatchCard: React.FC<{ p: KerfPatch; view: DiffView }> = ({ p, view }) => {
  const { t } = useTranslation('kerf');
  /* A draft instruction without a section is act-level or its target was
     not extracted: say so instead of showing an orphan 'Abs. 2'. */
  const location = patchLocation(p);
  const para = location.kind === 'section'
    ? location.label
    : [t('patchSectionUnknown'), location.absatz ? `Abs. ${location.absatz}` : null]
      .filter(Boolean).join(' · ');
  const docUrl = docSourceUrl(p.doc);
  // Too little captured text to render a meaningful comparison in ANY view.
  const fragmentary =
    ((p.old ?? '').trim().length + (p.new ?? '').trim().length) < 24;
  return (
    <div className={workbench.item}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
        <Chip className={statusChip(p.status)}>
          {t(`status.${p.status}`, { defaultValue: p.status })}
        </Chip>
        <Chip
          className={location.kind === 'section'
            ? 'text-main border-[var(--panel-border)] bg-transparent'
            : 'text-muted border-dashed border-[var(--panel-border)] bg-transparent'}
          title={location.kind === 'section' ? undefined : t('patchSectionUnknownHint')}
        >
          {para}
        </Chip>
        <span className="text-[13px] tabular-nums text-muted font-semibold">
          {t(`op.${p.op}`, { defaultValue: p.op })}
        </span>
        {p.valid_from && (
          <span className="text-[11px] text-muted tabular-nums ml-auto">
            {t(p.valid_from_verified ? 'validFrom' : 'draftValidFrom', {
              date: fmtDate(p.valid_from),
            })}
          </span>
        )}
      </div>
      {p.proc && (
        <p className="text-xs text-muted mb-2 break-words">
          <span className="text-[13px] tabular-nums font-semibold">
            {t('proc')}:
          </span>{' '}
          {p.proc}
        </p>
      )}
      {fragmentary ? (
        // DIP sometimes captures only a shred of the amendment text (a lone
        // "und" is a classic) — showing that as an old/new comparison is
        // nonsense, so point at the source document instead.
        <p className="text-xs text-muted italic">
          {t('fragmentNote')}
          {docUrl && (
            <>
              {' '}
              <a href={docUrl} target="_blank" rel="noopener noreferrer"
                 className="not-italic inline-flex items-center gap-1 text-[var(--c-link)] hover:underline">
                {t('source')} <ExternalLink className="w-3 h-3" />
              </a>
            </>
          )}
        </p>
      ) : (
        <ChangeBody oldText={p.old} newText={p.new} view={view} />
      )}
      {p.doc && (
        <p className="text-[11px] tabular-nums text-muted mt-2">
          {docUrl ? (
            <a href={docUrl} target="_blank" rel="noopener noreferrer"
               className="hover:text-[var(--c-link)] hover:underline">
              {p.doc} <ExternalLink aria-hidden="true" className="sntiq-inline-icon" />
            </a>
          ) : p.doc}
        </p>
      )}
    </div>
  );
};

/** 'Abs. N' / 'Abs. N–M' derived from a buzer excerpt's own paragraph
    markers. Only excerpts that START at an Absatz boundary ('(7) 1 Soweit…')
    qualify — mid-paragraph excerpts (a numbered item '2. deren…') return
    null. Later markers extend the range only while they continue the run
    (steps of 0 or +1 — '2a' counts as 2), so a stray quoted reference like
    '(98)' inside the text is ignored. Validated against the full corpus:
    16.5k diffs — 7 960 with a leading marker, 2 624 multi-Absatz, one
    stray-reference case. */
function absLabel(text: string): string | null {
  if (!/^\(\d{1,2}[a-z]?\)/.test(text)) return null;
  const marks = Array.from(
    text.matchAll(/(?:^|\s)\((\d{1,2}[a-z]?)\)(?=\s|$)/g), (m) => m[1]);
  if (marks.length === 0) return null;
  const num = (s: string) => parseInt(s, 10);
  const run = [marks[0]];
  for (const m of marks.slice(1)) {
    const d = num(m) - num(run[run.length - 1]);
    if (d === 0 || d === 1) run.push(m);
  }
  return run.length === 1
    ? `Abs. ${run[0]}`
    : `Abs. ${run[0]}–${run[run.length - 1]}`;
}

/** A dated consolidated version: expandable into per-§ local diffs. */
const VersionCard: React.FC<{ v: KerfVersion; view: DiffView }> = ({ v, view }) => {
  const { t } = useTranslation('kerf');
  const changes = v.changes ?? [];
  const text = (v.text || '').replace(/geändert durch.*$/, '').trim();
  const observed = Boolean(v.observed_at || isRetrievalObservation(v.date_basis));
  const legalEffectVerified = isVerifiedLegalEffect(v);
  const shownDate = legalEffectVerified ? (v.effective_at ?? v.date) : v.date;
  const observationDate = v.observed_at ?? (observed ? v.date : null);
  const sourceUrl = safeExternalHttpUrl(v.source_url ?? v.url);
  const digest = shortDigest(v.state_digest);
  const bgbl = bgblReference(v.bgbl);
  const procedureUrl = dipProcedureSourceUrl(v.procedure_id);
  const link = sourceUrl && (
    <a href={sourceUrl} target="_blank" rel="noopener noreferrer"
       className="inline-flex items-center gap-1 text-[11px] tabular-nums text-muted hover:text-[var(--c-link)] shrink-0">
      {t('source')} <ExternalLink className="w-3 h-3" />
    </a>
  );
  const provenance = (legalEffectVerified || observed) && (
    <>
      {legalEffectVerified && v.effective_at && (
        <div className="mt-2 rounded-lg border border-[var(--panel-border)] px-2.5 py-2">
          <div className="flex items-center gap-x-2.5 gap-y-1 flex-wrap text-[11px] tabular-nums text-muted">
            <Chip className="text-[var(--c-ok)] border-[var(--panel-border)] ">
              <Check className="w-3 h-3" /> {t('versionLegalEffectVerified')}
            </Chip>
            <span className="text-main">{t(isAfterDay(v.effective_at, berlinToday()) ? 'willTakeEffect' : 'effectiveFrom', { date: fmtDate(v.effective_at) })}</span>
            {v.published_at && (
              <span>{t('archivePublishedAt', { date: fmtDate(v.published_at) })}</span>
            )}
            {bgbl.url && (
              <a href={bgbl.url} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-1 text-[var(--c-link)] hover:underline">
                {bgbl.label ?? t('archiveBgblFinal')} <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {procedureUrl && (
              <a href={procedureUrl} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-1 text-[var(--c-link)] hover:underline">
                {t('archiveDipProcedure')} <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {v.legal_verification && (
              <span title={v.legal_verification}>{t('versionFinalTextMatched')}</span>
            )}
          </div>
        </div>
      )}
      {observed && observationDate && (
        <div className="mt-2 flex items-center gap-x-2.5 gap-y-1 flex-wrap text-[11px] tabular-nums text-muted">
          <Chip className="text-[var(--c-ok)] border-[var(--panel-border)] ">
            <Check className="w-3 h-3" /> {t('versionOfficialObserved')}
          </Chip>
          <span>{t('archiveObservedNote', { date: observationDate })}</span>
          {v.builddate && <span>{t('archiveSourceBuild')}: {fmtDate(v.builddate)}</span>}
          {digest && (
            <span title={v.state_digest ?? undefined}>{t('archiveStateDigest')}: {digest}</span>
          )}
        </div>
      )}
    </>
  );

  if (changes.length === 0) {
    return (
      <div className={workbench.item}>
        <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
          <span className="text-[11px] tabular-nums text-muted shrink-0">{fmtDate(shownDate)}</span>
          <span className="text-sm text-main flex-1 min-w-0 break-words">{text}</span>
          {link}
        </div>
        {provenance}
      </div>
    );
  }
  return (
    // Open by default — the per-§ diffs are the content, not an appendix;
    // the summary row still collapses a card out of the way.
    <details open className="group rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] overflow-hidden">
      <summary className="flex items-center gap-2 flex-wrap cursor-pointer list-none p-3.5">
        <ChevronRight className="w-4 h-4 text-muted shrink-0 transition-transform group-open:rotate-90" />
        <span className="text-[11px] tabular-nums text-muted shrink-0">{fmtDate(shownDate)}</span>
        <span className="text-sm text-main flex-1 min-w-0 break-words">{text}</span>
        <Chip className="text-[var(--c-link)] border-[var(--c-link)]/30 bg-[var(--c-link)]/10 shrink-0">
          {t('parasChanged', { count: changes.length })}
        </Chip>
        {link}
      </summary>
      <div className="border-t border-[var(--panel-border)] px-4 py-3 space-y-3">
        {provenance}
        {changes.map((c, i) => {
          const abs = absLabel(c.new || c.old || '');
          return (
          <div key={`${c.para ?? ''}-${i}`}>
            {c.para && (
              <Chip className="text-main border-[var(--panel-border)] bg-transparent mb-1">
                {/^\d/.test(c.para) ? `§ ${c.para}` : c.para}{abs ? ` ${abs}` : ''}
              </Chip>
            )}
            {!legalEffectVerified && !observed
              && c.effective_date && c.effective_date !== v.date && (
              <Chip className="ml-1 text-muted border-[var(--panel-border)] bg-transparent mb-1">
                {t('effectiveFrom', { date: fmtDate(c.effective_date) })}
              </Chip>
            )}
            {c.old === c.new ? (
              <p className="text-[11px] text-muted italic">
                {t('changeBeyondExcerpt')}{' '}
                {v.url && (
                  <a href={v.url} target="_blank" rel="noopener noreferrer"
                     className="text-[var(--c-link)] hover:underline">{t('source')} <ExternalLink aria-hidden="true" className="sntiq-inline-icon" /></a>
                )}
              </p>
            ) : (
              <ChangeBody oldText={c.old} newText={c.new} view={view} />
            )}
          </div>
          );
        })}
      </div>
    </details>
  );
};

const OfficialAmendmentCard: React.FC<{
  event: KerfRetrospectiveEvent; norm: string;
}> = ({ event, norm }) => {
  const { t } = useTranslation('kerf');
  const commands = (event.commands ?? []).filter((command) => commandTouchesNorm(command, norm));
  const source = safeExternalHttpUrl(event.official_html_url)
    ?? safeExternalHttpUrl(event.official_pdf_url);
  return (
    <article className={workbench.item}>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
        <Chip className="border-[var(--panel-border)] text-[var(--c-ok)] ">BGBl</Chip>
        {event.published_at && <span>{t('archivePublishedAt', { date: event.published_at })}</span>}
        <span>{event.effective_at
          ? t('validFrom', { date: event.effective_at }) : t('archiveEffectiveUnresolved')}</span>
      </div>
      <h3 className="break-words text-sm font-semibold text-main">{event.procedure_title ?? event.article_heading}</h3>
      <p className="mt-1 text-xs text-muted">{t('archiveAmendingArticle')} {event.amending_article}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {(event.affected_norms ?? []).map((ref) => <Chip key={ref} className="border-[var(--panel-border)] text-main">{ref}</Chip>)}
      </div>
      {commands.length > 0 && <details className="mt-3">
        <summary className="cursor-pointer text-xs font-semibold text-main">
          {t('archiveAmendmentCommands', { count: commands.length, total: event.command_count ?? event.commands?.length ?? 0 })}
        </summary>
        <div className="mt-2 divide-y divide-[var(--panel-border)]">
          {commands.map((command, index) => <div key={`${command.item}-${index}`} className="py-3">
            <p className="mb-1 text-xs font-semibold text-muted">
              {amendmentCommandNorm(command)} {t(`op.${command.operation}`, { defaultValue: command.operation ?? '' })}
            </p>
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-main">{command.raw}</p>
          </div>)}
        </div>
      </details>}
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--c-link)]">
        {source && <a href={source} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
          <ExternalLink className="h-3.5 w-3.5" />{t('archiveOfficialSource')}
        </a>}
        {event.document_id && <Link href={`/dt/kerf/aenderungen/${encodeURIComponent(event.document_id)}`} className="inline-flex items-center gap-1 hover:underline">
          <FileText className="h-3.5 w-3.5" />{event.document_id}
        </Link>}
      </div>
    </article>
  );
};

const SynopseTab: React.FC<{
  selectedId: string | null;
  initialNorm?: string | null;
  detail: KerfActDetail | null;
  detailLoading: boolean;
  detailError: boolean;
  onGotoWiki: () => void;
}> = ({ selectedId, initialNorm, detail, detailLoading, detailError, onGotoWiki }) => {
  const { t, i18n } = useTranslation('kerf');
  const [view, setView] = useState<DiffView>('diff');
  const [history, setHistory] = useState<KerfActArchive | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [norm, setNorm] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => { setNorm(initialNorm ?? ''); }, [selectedId, initialNorm]);
  useEffect(() => {
    setHistory(null);
    setHistoryError(false);
    if (!selectedId || !selectedId.startsWith('fed_')) {
      setHistoryLoading(false);
      return;
    }
    const controller = new AbortController();
    setHistoryLoading(true);
    kerfActArchive(selectedId, {}, controller.signal)
      .then((archive) => { if (!controller.signal.aborted) setHistory(archive); })
      .catch(() => { if (!controller.signal.aborted) setHistoryError(true); })
      .finally(() => { if (!controller.signal.aborted) setHistoryLoading(false); });
    return () => controller.abort();
  }, [selectedId, retry]);

  if (!selectedId) {
    return (
      // An empty view is an invitation, set like a view head: left, light
      // title, one line, the one action (DESIGN.md sections 4 and 5).
      <div>
        <div className="max-w-[46rem] py-6">
          <h3 className="m-0 text-[clamp(1.5rem,2.6vw,2.25rem)] font-light leading-[1.1] tracking-[-0.022em] text-main">{t('selectLawTitle')}</h3>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted">{t('selectLawHint')}</p>
          <button type="button" onClick={onGotoWiki} className="sntiq-btn sntiq-btn-primary mt-6">
            {workbenchLabels(i18n.language).wiki}
          </button>
        </div>
      </div>
    );
  }
  if (detailError) return <LoadError />;
  if (detailLoading || !detail || detail.id !== selectedId) return <Spinner />;

  const currentHistory = history?.act_id === selectedId ? history.retrospective : null;
  const items = buildSynopsisTimeline(detail, currentHistory?.events ?? [], norm);
  const selectedNorms = norm ? readerNormMatches(detail.norms, norm) : [];
  const selectedCurrentNorm = selectedNorms.length === 1 ? selectedNorms[0] : null;
  const normOptions = new Set([
    ...detail.norms.map(readerDesignator),
    ...(currentHistory?.events ?? []).flatMap((event) => event.affected_norms ?? []),
  ].filter((ref) => /^(?:§|Art\.?)\s*\d/iu.test(ref)));
  // A norm handed over from a search hit stays selectable even if its
  // designator is not in the current option list.
  if (norm && ![...normOptions].some((ref) => normKey(ref) === normKey(norm))) normOptions.add(norm);

  return (
    <div>
      <header className={workbench.viewHead}>
        <div className="min-w-0">
          <p className={workbench.tag}>{detail.jurabk}</p>
          <h2 style={{ marginTop: 6 }}>{detail.title}</h2>
          <p>{t('synopseIntro')}</p>
          {detail.juris === 'DE-BY' && (
            <p className="!text-[13px]">{t('byNoHistory')}</p>
          )}
        </div>
        {/* View switch: inline diff / old-and-new side by side / clean text */}
        <div className={workbench.seg}>
          {(['diff', 'split', 'clean'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
            >
              {t(`view.${v}`)}
            </button>
          ))}
        </div>
      </header>

      <label className="mb-4 block max-w-lg text-xs font-semibold text-muted">
        {t('archiveScope')}
        <select value={norm ? ([...normOptions].find((ref) => normKey(ref) === normKey(norm)) ?? norm) : ''} onChange={(event) => setNorm(event.target.value)} className="sntiq-field mt-1">
          <option value="">{t('archiveEntireAct')}</option>
          {[...normOptions].sort((a, b) => a.localeCompare(b, 'de', { numeric: true })).map((ref) => <option key={ref} value={ref}>{ref}</option>)}
        </select>
      </label>
      {selectedCurrentNorm && <details className="mb-4 border-y border-[var(--panel-border)] py-3" open>
        <summary className="cursor-pointer break-words text-sm font-semibold text-main">
          {selectedCurrentNorm.enbez} {selectedCurrentNorm.titel} · {t('synopseCurrentText')}
        </summary>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-main">{selectedCurrentNorm.text}</p>
      </details>}
      {historyLoading && <Spinner />}
      {historyError && <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-muted" role="alert">
        <span>{t('synopseHistoryError')}</span>
        <button type="button" onClick={() => setRetry((value) => value + 1)} className="text-[var(--c-link)] underline">{t('synopseRetry')}</button>
      </div>}
      {history?.act_id === selectedId && <ArchiveCoverageSummary archive={history} language={i18n.language} />}
      {items.length === 0 && !historyLoading ? (
        <p className="text-sm text-muted py-4">{t(norm ? 'synopseNoNormHistory' : 'noPatches')}</p>
      ) : (
        <div className="space-y-3">
          {items.map((it, i) =>
            it.kind === 'patch' ? (
              <PatchCard
                key={`p-${it.p.doc ?? ''}-${it.p.para ?? ''}-${it.p.absatz ?? ''}-${i}`}
                p={it.p}
                view={view}
              />
            ) : it.kind === 'event' ? (
              <OfficialAmendmentCard key={`e-${it.event.id ?? it.event.event_id ?? i}`} event={it.event} norm={norm} />
            ) : (
              <VersionCard key={`v-${it.v.date}-${i}`} v={it.v} view={view} />
            ),
          )}
        </div>
      )}
    </div>
  );
};

// ------------------------------------------------------- Rechtsprechung
/** Court-level colours (EuGH → SG). Literal classes so the Tailwind scanner
 *  keeps them. */
const LEVEL_META: Record<string, string> = {
  EuGH: 'text-main',
  BSG: 'text-main',
  LSG: 'text-main',
  SG: 'text-main',
};
const levelChip = (l: string) =>
  LEVEL_META[l] ?? 'text-muted';

/** Effect-kind colours: red = the norm falls, amber = at the EuGH,
 *  blue = interpreted, green = applied, slate = cited without a stronger claim. */
const EFFECT_META: Record<string, string> = {
  disapplied: 'text-[var(--c-bad)] border-[var(--panel-border)] ',
  incompatible: 'text-[var(--c-bad)] border-[var(--panel-border)] ',
  referred: 'text-[var(--c-warn)] border-[var(--panel-border)] ',
  interpreted: 'text-[var(--c-link)] border-[var(--panel-border)] ',
  applied: 'text-[var(--c-ok)] border-[var(--panel-border)] ',
  cited: 'text-muted border-[var(--panel-border)] ',
};
const effectChip = (k: string) =>
  EFFECT_META[k] ?? 'text-muted border-[var(--panel-border)] bg-transparent';

type DecLang = 'de' | 'en' | 'ru' | 'ua';

const DecisionCard: React.FC<{
  d: KerfDecision; lang: DecLang; onOpenAct: (id: string) => void; onOpenDecision: (id: string) => void;
}> = ({ d, lang, onOpenAct, onOpenDecision }) => {
  const { t } = useTranslation('kerf');
  const summary = d.summary[lang] || d.summary.de;
  return (
    <div
      id={`dec-${d.id}`}
      className="border-b border-[var(--panel-border)] py-4"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 mb-1.5 text-[13px] font-semibold text-muted tabular-nums">
        <span className={levelChip(d.level)}>{d.level}</span>
        {/* The court's short name is not repeated when it equals the level. */}
        {d.court_short !== d.level && <span>{d.court_short}</span>}
        <span>{d.az}</span>
        <span>{fmtDate(d.date)}</span>
        <span>{d.kind}</span>
      </div>
      <p className="text-base font-semibold leading-snug text-main break-words mb-1.5" style={{ letterSpacing: '-.01em' }}>{d.title}</p>
      {summary && !sameText(summary, d.title) && (
        <p className="text-[15px] leading-relaxed text-muted break-words mb-2.5 max-w-[78ch]">{summary}</p>
      )}

      {/* Grouped by relation: a mere citation is a mention, not an effect on
          the norm — it must not read like a finding about that norm. */}
      <div className="space-y-2">
        {groupEffectsByKind(d.effects).map((group) => (
          <div key={group.kind} className="space-y-1">
            <Chip className={effectChip(group.kind)}>
              {t(`dec.group.${group.kind}`, {
                defaultValue: t(`dec.effect.${group.kind}`, { defaultValue: humanizeKind(group.kind) }),
              })}
            </Chip>
            {group.effects.map((e, i) => {
              const label = effectNormLabel(e);
              return (
                <div key={`${e.jurabk}-${i}`} className="flex flex-wrap items-center gap-2 pl-2">
                  {e.act_id ? (
                    <button
                      onClick={() => onOpenAct(e.act_id!)}
                      className="shrink-0 inline-flex items-center min-h-6 text-[13px] font-semibold text-[var(--c-link)] hover:underline underline-offset-4"
                    >
                      {label}
                    </button>
                  ) : (
                    <Chip className="text-main border-[var(--panel-border)] bg-transparent shrink-0">
                      {label}
                    </Chip>
                  )}
                  {e.note && (
                    <span className="text-[13px] text-muted break-words min-w-0">
                      {e.note}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {d.related.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {d.related.map((r, i) => (
            <button
              key={`${r.ref}-${i}`}
              onClick={() =>
                document.getElementById(`dec-${r.ref}`)
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="block min-h-6 text-left text-[13px] text-muted hover:text-[var(--c-link)] transition-colors break-words"
            >
              ↳ {t(`dec.rel.${r.rel}`, { defaultValue: r.rel })}: {r.label}
            </button>
          ))}
        </div>
      )}

      {d.quote && (
        <blockquote className="mt-2.5 border-l-2 border-[var(--kerf-control-line)] pl-3 text-[15px] leading-relaxed text-muted break-words max-w-[78ch]">
          {d.quote}
        </blockquote>
      )}

      {d.text && (
        <details className="group mt-2.5">
          <summary className="flex items-center gap-1 cursor-pointer list-none text-[13px] tabular-nums text-muted hover:text-main font-semibold">
            <ChevronRight className="w-3.5 h-3.5 shrink-0 transition-transform group-open:rotate-90" />
            {t('dec.fulltext')}
          </summary>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-muted mt-2 max-w-[78ch]">{d.text}</div>
        </details>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] font-semibold text-muted">
        <button onClick={() => onOpenDecision(d.id)} className="inline-flex items-center gap-1.5 min-h-7 text-[var(--c-link)] hover:underline underline-offset-4"><BookOpen aria-hidden="true" className="w-3.5 h-3.5" />{readerCopy(lang).newTab}</button>
        {d.url ? (
          <a href={d.url} target="_blank" rel="noopener noreferrer"
             className="inline-flex items-center gap-1 text-[var(--c-link)] hover:underline">
            {d.source} <ExternalLink className="w-3 h-3" />
          </a>
        ) : (
          <span>{t('dec.source')}: {d.source}</span>
        )}
        <Link href={`/dt/kerf/entscheidungen/${d.id}`}
              className="inline-flex items-center gap-1 hover:text-[var(--c-link)] transition-colors">
          <Link2 className="w-3 h-3" /> {t('dec.permalink')}
        </Link>
      </div>
    </div>
  );
};

const DecisionsTab: React.FC<{
  decisions: KerfDecision[] | null;
  error: boolean;
  query: string;
  onQuery: (q: string) => void;
  onOpenAct: (id: string) => void;
  onOpenDecision: (id: string) => void;
}> = ({ decisions, error, query, onQuery, onOpenAct, onOpenDecision }) => {
  const { t, i18n } = useTranslation('kerf');
  const short = (i18n.language || 'de').slice(0, 2);
  const lang: DecLang =
    short === 'en' || short === 'ru' || short === 'ua' ? short : 'de';

  const filtered = useMemo(() => {
    if (!decisions) return [];
    const sorted = [...decisions].sort((a, b) => b.date.localeCompare(a.date));
    const needle = query.trim().toLowerCase();
    if (!needle) return sorted;
    return sorted.filter((d) =>
      [d.az, d.court, d.court_short, d.title, d.summary[lang] || d.summary.de, d.text ?? '',
       ...d.effects.map((e) => e.jurabk)]
        .join(' ').toLowerCase().includes(needle));
  }, [decisions, query, lang]);

  const needle = query.trim();

  return (
    <div>
      <header className={workbench.viewHead}><p>{t('dec.intro')}</p></header>

      <search className={`sntiq-search ${workbench.field} mb-2`}>
        <Search aria-hidden="true" />
        <input className="sntiq-field"
          type="search"
          aria-label={t('searchDecisionsTitle')}
          value={query}
          placeholder={t('dec.searchPlaceholder')}
          onChange={(e) => onQuery(e.target.value)}
        />
      </search>
      {needle && <FederalDecisionResults key={needle} query={needle} onOpen={onOpenDecision} />}
      {error ? <LoadError /> : !decisions ? <Spinner /> : <>
      <p className={`${workbench.tag} mt-4 pb-2.5`}>
        {needle ? t('dec.linkedCount', { count: filtered.length }) : t('dec.count', { count: filtered.length })}
      </p>

      {!needle && filtered.length === 0 && (
        <p className="text-sm text-muted p-4">{t('dec.noResults')}</p>
      )}
      <div className={workbench.ruled}>
        {filtered.map((d) => (
          <DecisionCard key={d.id} d={d} lang={lang} onOpenAct={onOpenAct} onOpenDecision={onOpenDecision} />
        ))}
      </div>
      </>}
    </div>
  );
};

// ------------------------------------------------------- source links
/** Official-document link for a 'bt-ds:…' reference — 'bt-ds:21/6637'
    (Bundestag Drucksache, wp/number) maps onto the dserver PDF; Bundesrat
    numbers and suffixed forms go to the DIP search. */
function docSourceUrl(docRef: string | null | undefined): string | null {
  const doc = docRef?.match(/^bt-ds:(.+)$/)?.[1];
  if (!doc) return null;
  const bt = doc.match(/^(\d{1,2})\/(\d{1,6})$/);
  if (bt) {
    const num = bt[2].padStart(5, '0');
    return `https://dserver.bundestag.de/btd/${bt[1]}/${num.slice(0, 3)}/${bt[1]}${num}.pdf`;
  }
  return `https://dip.bundestag.de/suche?term=${encodeURIComponent(doc)}`;
}

/** Cross-check URLs come from dataset metadata, so accept only explicit web
    schemes before putting them into an anchor. */
function safeExternalHttpUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

/** EUR-Lex link for an EU instrument. */
const celexUrl = (celex: string) =>
  `https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:${encodeURIComponent(celex)}`;

/** DIP full-text search — the only stable deep link for pipeline bills. */
const dipSearchUrl = (term: string) =>
  `https://dip.bundestag.de/suche?term=${encodeURIComponent(term.slice(0, 90))}`;

// -------------------------------------------------------------- Git-Log
/** Best official-source link for a commit: the explicit url when the API has
    one, then EUR-Lex via the CELEX number (EU-lane commits carry ONLY that),
    then the `doc` reference. Without the fallbacks the EU lane and the
    open-branch commits at the top of the log had no links at all. */
function commitSourceUrl(c: KerfCommit): string | null {
  return c.url ?? (c.celex ? celexUrl(c.celex) : docSourceUrl(c.doc));
}

const CommitRow: React.FC<{
  c: KerfCommit;
  laneName: string;
  /** jurabk -> act id, so a commit's law abbreviations deep-link into the
      Synopse; unknown abbreviations render as plain text. */
  actIndex: Map<string, string>;
  onOpenAct: (id: string) => void;
  onActor: (actor: string) => void;
}> = ({ c, laneName, actIndex, onOpenAct, onActor }) => {
  const { t } = useTranslation('kerf');
  const [showParas, setShowParas] = useState(false);
  const lm = laneMeta(c.lane);
  const Icon =
    c.type === 'merge' ? GitMerge :
    c.type === 'open' ? GitBranch :
    c.type === 'closed' ? Archive : GitCommitHorizontal;
  const status = c.refs?.[0];
  const known = status && STATUS_META[status];
  const stand = c.refs?.[1];
  const shownActs = c.acts.slice(0, 5);
  const src = commitSourceUrl(c);
  const legalEffectVerified = isVerifiedLegalEffect(c);
  const observed = Boolean(c.observed_at || c.checkout?.observed_at
    || isRetrievalObservation(c.date_basis)
    || status === 'official_state_observed');
  const observationDate = c.observed_at ?? c.checkout?.observed_at
    ?? (observed ? c.date : null);
  const digest = shortDigest(c.state_digest ?? c.checkout?.state_digest);
  const bgbl = bgblReference(c.bgbl);
  const procedureUrl = dipProcedureSourceUrl(c.procedure_id);
  const specialStatus = status === 'official_state_observed'
    || status === 'legal_effect_verified';
  /* A promulgated amendment whose effective day lies ahead is not in force:
     it gets future wording and its own badge, never 'wirksam'. */
  const effectiveDay = commitEffectiveDay(c);
  const upcoming = isUpcomingCommit(c, berlinToday());
  const parsedMsg = parseCommitMessage(c.msg);
  const msgHead = parsedMsg.kind === 'effective'
    ? (upcoming ? t('gitMsg.effectiveUpcoming', { date: effectiveDay }) : t('gitMsg.effective'))
    : parsedMsg.kind ? t(`gitMsg.${parsedMsg.kind}`) : null;
  const message = msgHead
    ? [msgHead, parsedMsg.subject].filter(Boolean).join(' · ')
    : c.msg;
  return (
    <div className={workbench.commit}>
      <div className="flex items-center gap-x-3 gap-y-1 flex-wrap mb-1.5">
        <span className={workbench.tag} data-lane={c.lane}>
          <Icon aria-hidden="true" className="w-4 h-4 shrink-0" />
          <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full ${lm.dot}`} />
          {laneName}
        </span>
        <span className="text-xs font-mono text-muted">{c.hash.slice(0, 7)}</span>
        <span className="text-[13px] tabular-nums text-muted">{fmtDate(c.date)}</span>
        {c.type === 'merge' && (
          <Chip className="text-[var(--c-link)] border-[var(--panel-border)] ">
            <GitMerge className="w-3 h-3" /> {t('mergeBadge')}
            {c.merge_ref && <span className="break-all">· {c.merge_ref}</span>}
          </Chip>
        )}
        {upcoming ? (
          <Chip
            className="text-main border-[var(--panel-border)] "
            title={t('gitUpcomingHint', { date: effectiveDay })}
          >
            <Clock3 className="w-3 h-3" /> {t(legalEffectVerified ? 'gitUpcomingVerified' : 'gitUpcoming')}
          </Chip>
        ) : legalEffectVerified ? (
          <Chip className="text-[var(--c-ok)] border-[var(--panel-border)] ">
            <Check className="w-3 h-3" /> {t('gitLegalEffectVerified')}
          </Chip>
        ) : observed ? (
          <Chip className="text-[var(--c-ok)] border-[var(--panel-border)] ">
            <Check className="w-3 h-3" /> {t('gitOfficialStateObserved')}
          </Chip>
        ) : null}
        {status && !specialStatus && (
          <Chip className={known
            ? statusChip(status)
            : 'text-muted border-[var(--panel-border)] bg-transparent'}>
            {t(`status.${status}`, { defaultValue: status })}
          </Chip>
        )}
      </div>
      <p className="text-[15px] leading-snug text-main font-semibold break-words" title={message !== c.msg ? c.msg : undefined}>{message}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[13px] text-muted tabular-nums">
        <button
          onClick={() => onActor(c.actor)}
          title={t('filterByActor')}
          className="hover:text-main transition-colors underline decoration-dotted decoration-1 underline-offset-2"
        >
          {c.actor}
        </button>
        {shownActs.map((a) => {
          const id = actIndex.get(a);
          return id ? (
            <button
              key={a}
              onClick={() => onOpenAct(id)}
              title={t('openAct')}
              className="text-[var(--c-link)] hover:underline"
            >
              {a}
            </button>
          ) : (
            <span key={a} className="text-main">{a}</span>
          );
        })}
        {c.acts.length > shownActs.length && (
          <span>+{c.acts.length - shownActs.length}</span>
        )}
        {c.targets_verified === false && c.acts.length > 0 && (
          <span className="italic" title={t('gitDraftTargetsHint')}>
            {t('gitDraftTargets')}
          </span>
        )}
        {c.paras.length > 0 && (
          <button
            onClick={() => setShowParas((s) => !s)}
            aria-expanded={showParas}
            className="inline-flex items-center gap-0.5 hover:text-main transition-colors"
          >
            §§ {c.paras.length}
            <ChevronRight className={`w-3 h-3 transition-transform ${showParas ? 'rotate-90' : ''}`} />
          </button>
        )}
        {stand && !STATUS_META[stand]
          && !(observed && stand === 'not_effective_date')
          && <span className="italic">{stand}</span>}
        {src && (
          <a href={src} target="_blank" rel="noopener noreferrer"
             className="inline-flex items-center gap-1 text-[var(--c-link)] hover:underline">
            {t('source')} <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
      {(legalEffectVerified || observed) && (
        <div className="mt-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] tabular-nums text-muted">
            {legalEffectVerified && c.effective_at && (
              <span className="text-main">
                {t(upcoming ? 'willTakeEffect' : 'effectiveFrom', { date: fmtDate(c.effective_at) })}
              </span>
            )}
            {legalEffectVerified && c.published_at && (
              <span>{t('archivePublishedAt', { date: fmtDate(c.published_at) })}</span>
            )}
            {observed && observationDate && (
              <span>{t('gitObservedAt', { date: fmtDate(observationDate) })}</span>
            )}
            {digest && (
              <span title={c.state_digest ?? c.checkout?.state_digest ?? undefined}>
                {t('archiveStateDigest')}: {digest}
              </span>
            )}
            {bgbl.url && (
              <a href={bgbl.url} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-1 text-[var(--c-link)] hover:underline">
                {bgbl.label ?? t('archiveBgblFinal')} <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {procedureUrl && (
              <a href={procedureUrl} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-1 text-[var(--c-link)] hover:underline">
                {t('archiveDipProcedure')} <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {legalEffectVerified && c.legal_verification && (
              <span title={c.legal_verification}>{t('versionFinalTextMatched')}</span>
            )}
          </div>
        </div>
      )}
      {showParas && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
          {c.paras.map((p) => (
            <Chip key={p} className="text-main border-[var(--panel-border)] bg-transparent">
              § {p}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
};

/** Commit-type filter: chip meta per KerfCommit['type']. */
const COMMIT_TYPES = [
  { id: 'commit', Icon: GitCommitHorizontal },
  { id: 'merge', Icon: GitMerge },
  { id: 'open', Icon: GitBranch },
  { id: 'closed', Icon: Archive },
] as const;

const GitLogTab: React.FC<{
  git: KerfGit | null;
  /** Lane names from the first ('all') fetch — stays rendered while a
      newly-selected lane is still loading. */
  lanes: string[];
  error: boolean;
  lane: number | null;
  onLane: (l: number | null) => void;
  onRetry: () => void;
  actIndex: Map<string, string>;
  onOpenAct: (id: string) => void;
  onLoadMore: () => void;
  loadingMore: boolean;
}> = ({ git, lanes, error, lane, onLane, onRetry, actIndex, onOpenAct, onLoadMore, loadingMore }) => {
  const { t, i18n } = useTranslation('kerf');
  const [q, setQ] = useState('');
  const [type, setType] = useState<'all' | KerfCommit['type']>('all');

  const commits = useMemo(() => {
    if (!git) return [];
    const needle = q.trim().toLowerCase();
    return git.commits.filter((c) =>
      (lane == null || c.lane === lane) &&
      (type === 'all' || c.type === type) &&
      (!needle ||
        `${c.msg} ${c.actor} ${c.hash} ${c.acts.join(' ')}`.toLowerCase().includes(needle)));
  }, [git, lane, type, q]);

  const hasMore = git ? git.commits.length < git.total : false;

  return (
    <div>
      {/* Plain-language intro — most visitors are not developers */}
      <header className={workbench.viewHead}><p>{t('gitPlain')}</p></header>

      <details className={`group ${workbench.fold} mb-4`} style={{ borderTop: '1px solid var(--kerf-line)' }}>
        <summary>
          <ChevronRight aria-hidden="true" className="w-4 h-4 shrink-0 transition-transform group-open:rotate-90" />
          <span>{t('gitExplainTitle')}</span>
        </summary>
        <div className="pb-4 pl-6 space-y-2.5">
          {([
            { Icon: GitCommitHorizontal, key: 'gitExplainCommit' },
            { Icon: GitMerge, key: 'gitExplainMerge' },
            { Icon: GitBranch, key: 'gitExplainOpen' },
            { Icon: Archive, key: 'gitExplainClosed' },
          ] as const).map(({ Icon, key }) => (
            <div key={key} className="flex items-start gap-2.5">
              <Icon aria-hidden="true" className="w-4 h-4 text-muted shrink-0 mt-1" />
              <p className="text-[15px] leading-relaxed text-main min-w-0 break-words">{t(key)}</p>
            </div>
          ))}
          <p className="text-sm text-main">{t('gitExplainLanes')}</p>
          <p className="text-sm text-muted pt-2.5 border-t border-[var(--panel-border)]">
            {t('gitExplainTips')}
          </p>
        </div>
      </details>

      <div className={`sntiq-search ${workbench.field} mb-3`}>
        <Search aria-hidden="true" />
        <input className="sntiq-field"
          type="text"
          value={q}
          placeholder={t('gitSearchPlaceholder')}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-1.5 mb-2">
        <button
          onClick={() => onLane(null)}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-colors ${
            lane == null
              ? 'bg-[var(--c-link)]/15 text-[var(--c-link)]'
              : 'text-muted hover:text-main border border-[var(--panel-border)]'
          }`}
        >
          {t('laneAll')}
        </button>
        {lanes.map((name, i) => {
          const lm = laneMeta(i);
          const on = lane === i;
          return (
            <button
              key={name}
              onClick={() => onLane(on ? null : i)}
              aria-pressed={on}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-colors border ${
                on ? 'text-[var(--c-link)] border-[var(--c-link)]/30 bg-[var(--c-link)]/10'
                   : 'text-muted hover:text-main border-[var(--panel-border)]'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${lm.dot}`} />
              {laneLabel(i18n.language, i, name)}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        <button
          onClick={() => setType('all')}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-colors ${
            type === 'all'
              ? 'bg-[var(--c-link)]/15 text-[var(--c-link)]'
              : 'text-muted hover:text-main border border-[var(--panel-border)]'
          }`}
        >
          {t('typeAll')}
        </button>
        {COMMIT_TYPES.map(({ id, Icon }) => {
          const on = type === id;
          return (
            <button
              key={id}
              onClick={() => setType(on ? 'all' : id)}
              aria-pressed={on}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-colors border ${
                on
                  ? 'text-[var(--c-link)] border-[var(--c-link)]/30 bg-[var(--c-link)]/10'
                  : 'text-muted hover:text-main border-[var(--panel-border)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t(`type.${id}`)}
            </button>
          );
        })}
      </div>

      {error ? (
        <LoadError onRetry={onRetry} />
      ) : !git ? (
        <Spinner />
      ) : (
        <>
          <p className={`${workbench.tag} mt-4 pb-2.5`}>
            {t('gitCount', { count: commits.length })}
          </p>

          {commits.length === 0 && (
            <p className="text-sm text-muted p-4">{t('gitNoResults')}</p>
          )}
          <div className={workbench.ruled}>
            {commits.map((c) => (
              <CommitRow
                key={c.hash}
                c={c}
                laneName={laneLabel(i18n.language, c.lane, lanes[c.lane] ?? '—')}
                actIndex={actIndex}
                onOpenAct={onOpenAct}
                onActor={(actor) => setQ((cur) => (cur === actor ? '' : actor))}
              />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center mt-5">
              <button
                onClick={onLoadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--panel-border)] text-[13px] font-semibold text-muted hover:text-main hover:border-[var(--c-text-main)] transition-colors disabled:opacity-50"
              >
                {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {t('loadMore')}
                <span className="tabular-nums opacity-60">
                  {git.commits.length}/{git.total}
                </span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// -------------------------------------------------------------- Realtime
const JURIS_CHIP: Record<string, string> = {
  DE: 'text-[var(--c-link)] border-[var(--panel-border)] ',
  'DE-BY': 'text-[var(--c-link)] border-[var(--panel-border)] ',
  EU: 'text-main border-[var(--panel-border)] ',
};

const FeedRow: React.FC<{ e: FeedRowModel }> = ({ e }) => {
  const { t } = useTranslation('kerf');
  /* BGBl rows from the GII Aktualitätendienst carry the RSS reporting day,
     not the promulgation day: label that date honestly and never mark it as
     a (future) legal date. */
  const basis = feedDateBasis(e);
  const future = basis !== 'reported' && isAfterDay(e.time, berlinToday());
  const { citation, actTitle } = basis === 'event'
    ? { citation: null, actTitle: e.title } : splitBgblTitle(e.title);
  const heading = actTitle ?? citation ?? e.title;
  const kindLabel = basis === 'reported' ? t('feed.reported')
    : basis === 'official_publication' ? t('feed.promulgated') : e.kind;
  return (
    <div className={`flex items-start gap-3 ${workbench.item}`} data-future={future}>
      <span
        className="text-[11px] tabular-nums text-muted w-[70px] shrink-0 pt-0.5"
        title={basis === 'reported' ? t('feed.reportedHint') : undefined}
      >
        {fmtDate(e.time)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <Chip className={JURIS_CHIP[e.juris] ?? 'text-muted border-[var(--panel-border)] bg-transparent'}>
            {e.juris}
          </Chip>
          <span className="text-[13px] tabular-nums text-muted font-semibold">
            {e.source}
          </span>
          <span
            className={`text-[11px] font-medium ${future ? 'text-[var(--c-warn)] ' : 'text-muted'}`}
            title={basis === 'reported' ? t('feed.reportedHint') : undefined}
          >
            {kindLabel}
          </span>
          {e.duplicates > 0 && (
            <Chip
              className="text-muted border-[var(--panel-border)] bg-transparent"
              title={t('feed.duplicateHint', { count: e.duplicates })}
            >
              ×{e.duplicates + 1}
            </Chip>
          )}
        </div>
        <p className="text-sm text-main break-words">
          {e.url ? (
            <a href={e.url} target="_blank" rel="noopener noreferrer"
               className="hover:text-[var(--c-link)] hover:underline">
              {heading}
            </a>
          ) : heading}
        </p>
        {actTitle && citation && (
          <p className="mt-0.5 text-[11px] tabular-nums text-muted break-words">{citation}</p>
        )}
      </div>
    </div>
  );
};

/** Optional LLM digest of the corpus — three periods, one text per UI
 *  language; language resolved like DecisionsTab. */
const DigestPanel: React.FC<{ digest: KerfDigest }> = ({ digest }) => {
  const { t, i18n } = useTranslation('kerf');
  const short = (i18n.language || 'de').slice(0, 2);
  const lang: DecLang =
    short === 'en' || short === 'ru' || short === 'ua' ? short : 'de';
  return (
    <section className={workbench.block}>
      <header className={workbench.blockHead}>
        <h3>{t('digest.title')}</h3>
        {/* A pinned, hand-written digest must not wear the AI label — the
            badge follows the payload's own `llm` flag, not the panel. */}
        <span className={workbench.tag} data-tone={digest.llm ? 'warn' : 'ok'}>
          {t(digest.llm ? 'digest.llmBadge' : 'digest.humanBadge')}
        </span>
      </header>
      {(['month', 'year', 'upcoming'] as const).map((k, i) => (
        <details key={k} open={i === 0} className={`group ${workbench.fold}`}>
          <summary>
            <ChevronRight aria-hidden="true" className="w-4 h-4 shrink-0 transition-transform group-open:rotate-90" />
            <span>{t(`digest.${k}`)}</span>
          </summary>
          <p>{digest.periods[k][lang]}</p>
        </details>
      ))}
      {/* The digest text is written server-side from raw feed rows; BGBl
          counts there are GII update-service reports, not promulgations. */}
      {(['month', 'year', 'upcoming'] as const).some((k) => /\bBGBl\b/u.test(digest.periods[k]?.[lang] ?? '')) && (
        <p className={workbench.fine}>{t('digest.bgblNote')}</p>
      )}
      <p className={workbench.fine}>
        {t(digest.llm ? 'digest.disclaimer' : 'digest.humanDisclaimer')}
        {' · '}{fmtDate(digest.generated_at)} · {digest.model}
      </p>
    </section>
  );
};

const FeedView: React.FC<{
  feed: KerfFeedEvent[] | null; error: boolean;
}> = ({ feed, error }) => {
  const { t } = useTranslation('kerf');
  const [juris, setJuris] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const jurisList = useMemo(
    () => Array.from(new Set((feed ?? []).map((e) => e.juris))).sort(),
    [feed]);
  const { shown, merged, bgbl } = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = (feed ?? []).filter((e) =>
      (juris == null || e.juris === juris) &&
      (!needle || `${e.title} ${e.source} ${e.kind}`.toLowerCase().includes(needle)));
    const deduped = dedupeFeedEvents(filtered);
    return { shown: deduped.rows, merged: deduped.merged, bgbl: feedBgblCounts(filtered) };
  }, [feed, juris, q]);
  if (error) return <LoadError />;
  if (!feed) return <Spinner />;
  return (
    <div>
      <div className={`sntiq-search ${workbench.field} mb-3`}>
        <Search aria-hidden="true" />
        <input className="sntiq-field"
          type="text"
          value={q}
          placeholder={t('feedSearchPlaceholder')}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <h3 className="text-sm font-semibold text-main">{t('realtime')}</h3>
        <span className="text-[11px] tabular-nums text-muted">{shown.length}</span>
        {bgbl.reports > 0 && (
          <span className="text-[11px] tabular-nums text-muted" title={t('feed.bgblSummaryHint')}>
            · {t('feed.bgblSummary', { reports: bgbl.reports, issues: bgbl.issues })}
          </span>
        )}
        {merged > 0 && (
          <span className="text-[11px] tabular-nums text-muted">
            · {t('feed.merged', { count: merged })}
          </span>
        )}
        <div className="flex flex-wrap items-center gap-1.5 ml-auto">
          <button
            onClick={() => setJuris(null)}
            className={`shrink-0 px-2.5 py-1 rounded-lg text-[13px] font-semibold transition-colors ${
              juris == null
                ? 'bg-[var(--c-link)]/15 text-[var(--c-link)]'
                : 'text-muted hover:text-main border border-[var(--panel-border)]'
            }`}
          >
            {t('feedAll')}
          </button>
          {jurisList.map((j) => {
            const on = juris === j;
            return (
              <button
                key={j}
                onClick={() => setJuris(on ? null : j)}
                aria-pressed={on}
                className={`shrink-0 px-2.5 py-1 rounded-lg text-[13px] font-semibold transition-colors border ${
                  on
                    ? JURIS_CHIP[j] ?? 'text-[var(--c-link)] border-[var(--c-link)]/30 bg-[var(--c-link)]/10'
                    : 'text-muted hover:text-main border-[var(--panel-border)]'
                }`}
              >
                {j}
              </button>
            );
          })}
        </div>
      </div>
      <div className="space-y-2">
        {shown.map((e, i) => <FeedRow key={`${e.time}-${e.source}-${e.url ?? ''}-${i}`} e={e} />)}
      </div>
    </div>
  );
};

// ------------------------------------------------------------- Hierarchie
const Section: React.FC<{
  label: React.ReactNode; count: React.ReactNode; open?: boolean;
  children: React.ReactNode;
}> = ({ label, count, open, children }) => (
  <details open={open} className={`group ${workbench.tree}`}>
    <summary>
      <ChevronRight aria-hidden="true" className="w-4 h-4 shrink-0 transition-transform group-open:rotate-90" />
      <span>{label}</span>
      <span>{count}</span>
    </summary>
    <div>{children}</div>
  </details>
);

const Leaf: React.FC<{
  date?: string | null; children: React.ReactNode; url?: string | null;
  onClick?: () => void;
}> = ({ date, children, url, onClick }) => {
  const body = <>
    {date && <span className="tabular-nums text-muted shrink-0 w-[5.5rem]">{fmtDate(date)}</span>}
    <span className="text-main min-w-0 break-words">
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer"
           className="hover:text-[var(--c-link)] hover:underline underline-offset-4">{children}</a>
      ) : children}
    </span>
  </>;
  // A row that opens something is a real button: reachable by keyboard.
  return onClick
    ? <button type="button" className={workbench.leaf} data-action="true" onClick={onClick}>{body}</button>
    : <div className={workbench.leaf}>{body}</div>;
};

const STATE_ORDER = [
  'Verkündet', 'Verabschiedet', 'Beschlussempfehlung liegt vor', 'Überwiesen',
  '1. Durchgang im Bundesrat abgeschlossen', 'Abgelehnt',
];
const pipelineSort = (a: [string, unknown], b: [string, unknown]) => {
  const ia = STATE_ORDER.indexOf(a[0]); const ib = STATE_ORDER.indexOf(b[0]);
  return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib);
};

/** Breadth layer inside the EU section: server-side search over all in-force
    directives and basic regulations (~8k). Lazy — nothing is fetched until
    the panel is opened; the query re-fetches debounced. */
const EuIndexPanel: React.FC = () => {
  const { t } = useTranslation('kerf');
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<'DIR' | 'REG' | null>(null);
  const [data, setData] = useState<KerfEuIndex | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) return;
    const ctl = new AbortController();
    setData(null);
    setError(false);
    setLoading(true);
    const id = window.setTimeout(() => {
      kerfEuIndex({ q: q.trim() || undefined, kind: kind ?? undefined }, ctl.signal)
        .then((d) => {
          if (!ctl.signal.aborted) setData(d);
        })
        .catch(() => {
          if (!ctl.signal.aborted) setError(true);
        })
        .finally(() => {
          if (!ctl.signal.aborted) setLoading(false);
        });
    }, 300);
    return () => { window.clearTimeout(id); ctl.abort(); };
  }, [open, q, kind]);

  return (
    <details
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className={`group ${workbench.tree}`}
    >
      <summary>
        <ChevronRight aria-hidden="true" className="w-4 h-4 shrink-0 transition-transform group-open:rotate-90" />
        <span>{t('euIndexTitle')}</span>
        <span>{data ? data.total : '~8000'}</span>
      </summary>
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`sntiq-search ${workbench.field} flex-1 min-w-[200px]`}>
            <Search aria-hidden="true" />
            <input className="sntiq-field"
              type="text"
              value={q}
              placeholder={t('euIndexSearch')}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          {(['DIR', 'REG'] as const).map((k) => {
            const on = kind === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setKind(on ? null : k)}
                aria-pressed={on}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-colors border ${
                  on
                    ? 'text-main border-[var(--panel-border)] '
                    : 'text-muted hover:text-main border-[var(--panel-border)]'
                }`}
              >
                {t(`kind.${k}`)}
              </button>
            );
          })}
        </div>

        {error && <LoadError />}
        {!error && loading && <Spinner />}
        {!error && data && (
          <>
            <p className="text-[11px] tabular-nums text-muted">
              {t('euIndexShown', {
                shown: data.instruments.length,
                matched: data.matched,
              })}
            </p>
            {data.instruments.length === 0
              ? <p className="text-sm text-muted py-3">{t('euIndexNoResults')}</p>
              : (
                <div className="space-y-0.5 max-h-96 overflow-y-auto pr-1">
                  {data.instruments.map((r) => (
                    <Leaf key={r.celex} date={r.date} url={celexUrl(r.celex)}>
                      <span className="font-mono text-muted mr-1.5">{r.celex}</span>
                      <span className="tabular-nums text-[11px] text-muted mr-1">
                        {r.type.startsWith('DIR') ? 'RL' : 'VO'}
                      </span>
                      {r.title}
                    </Leaf>
                  ))}
                </div>
              )}
          </>
        )}
      </div>
    </details>
  );
};

type HierAct = KerfHierarchy['bund']['acts'][number];

/** Schema-v1 fallback while the API and web client are deployed separately. */
const fallbackLegalLayers = (acts: HierAct[]) => {
  const constitutionIds = new Set(['fed_gg', 'by_bayverf', 'by_bv']);
  const ordinanceIds = new Set([
    'fed_aufenthv', 'fed_beschv_2013', 'fed_intv',
    'fed_ukraineaufenth_v', 'fed_ukraineaufenthfgv',
    'by_dvasyl', 'by_zustvauslr',
  ]);
  const layers = {
    constitution: [] as HierAct[],
    statutes: [] as HierAct[],
    ordinances: [] as HierAct[],
  };
  acts.forEach((act) => {
    const title = act.title.trim().toLocaleLowerCase();
    const constitutional = constitutionIds.has(act.id)
      || ['gg', 'bayverf', 'bv'].includes(act.jurabk.toLocaleLowerCase())
      || title.startsWith('grundgesetz für')
      || title.startsWith('verfassung des freistaates bayern');
    const ordinance = ordinanceIds.has(act.id)
      || title.startsWith('verordnung ')
      || title.endsWith('verordnung');
    if (constitutional) layers.constitution.push(act);
    else if (ordinance) layers.ordinances.push(act);
    else layers.statutes.push(act);
  });
  return layers;
};

const HierarchyTab: React.FC<{
  hier: KerfHierarchy | null; error: boolean; onOpenAct: (id: string) => void;
}> = ({ hier, error, onOpenAct }) => {
  const { t } = useTranslation('kerf');
  const [q, setQ] = useState('');
  if (error) return <LoadError />;
  if (!hier) return <Spinner />;

  // One filter across every level: constitutional texts, EU sources, corpora,
  // pipelines and Länder bills. Sections auto-open while a filter is active.
  const needle = q.trim().toLowerCase();
  const hit = (s: string) => !needle || s.toLowerCase().includes(needle);
  const euPrimary = (hier.eu.primary?.references ?? [])
    .filter((i) => hit(`${i.celex} ${i.kind} ${i.title}`));
  const secondary = hier.eu.secondary ?? {
    directives: hier.eu.instruments.filter((i) => i.kind === 'directive'),
    regulations: hier.eu.instruments.filter((i) => i.kind === 'regulation'),
    other: hier.eu.instruments.filter((i) => !['directive', 'regulation'].includes(i.kind)),
  };
  const euDirectives = secondary.directives
    .filter((i) => hit(`${i.celex} ${i.kind} ${i.title}`));
  const euRegulations = secondary.regulations
    .filter((i) => hit(`${i.celex} ${i.kind} ${i.title}`));
  const euOther = secondary.other
    .filter((i) => hit(`${i.celex} ${i.kind} ${i.title}`));
  const filterActs = (acts: HierAct[]) =>
    acts.filter((a) => hit(`${a.jurabk} ${a.title}`));
  const bundSource = hier.bund.layers ?? fallbackLegalLayers(hier.bund.acts);
  const baySource = hier.bayern.layers ?? fallbackLegalLayers(hier.bayern.acts);
  const bundLayers = {
    constitution: filterActs(bundSource.constitution),
    statutes: filterActs(bundSource.statutes),
    ordinances: filterActs(bundSource.ordinances),
  };
  const bayLayers = {
    constitution: filterActs(baySource.constitution),
    statutes: filterActs(baySource.statutes),
    ordinances: filterActs(baySource.ordinances),
  };
  const filterBills = <T extends { title: string }>(arr: T[]) =>
    arr.filter((v) => hit(v.title));
  const forceOpen = needle.length > 0;
  const bundPipeline = Object.entries(hier.bund.pipeline)
    .map(([status, rows]) => ({ status, bills: filterBills(rows) }))
    .filter(({ bills }) => !forceOpen || bills.length > 0)
    .sort((a, b) => pipelineSort([a.status, a.bills], [b.status, b.bills]));
  const bayernPipeline = Object.entries(hier.bayern.pipeline)
    .map(([status, rows]) => ({ status, bills: filterBills(rows) }))
    .filter(({ bills }) => !forceOpen || bills.length > 0);
  const laenderBills = Object.entries(hier.laender)
    .map(([code, rows]) => ({ code, bills: filterBills(rows) }))
    .filter(({ bills }) => !forceOpen || bills.length > 0)
    .sort((a, b) => b.bills.length - a.bills.length);
  const bundBillCount = bundPipeline.reduce((sum, group) => sum + group.bills.length, 0);
  const bayernBillCount = bayernPipeline.reduce((sum, group) => sum + group.bills.length, 0);
  const laenderBillCount = laenderBills.reduce((sum, land) => sum + land.bills.length, 0);
  const laenderCoverage = hier.meta?.coverage?.laender_monitor ?? null;
  // Coverage is judged on the unfiltered rows; the shown count follows the filter.
  const laenderCount = coverageCount(
    Object.values(hier.laender).reduce((sum, rows) => sum + rows.length, 0), laenderCoverage);
  const euSecondaryCount = euDirectives.length + euRegulations.length + euOther.length;
  const bundActCount = bundLayers.statutes.length + bundLayers.ordinances.length;
  const bayActCount = bayLayers.constitution.length
    + bayLayers.statutes.length + bayLayers.ordinances.length;
  const actLeaf = (act: HierAct) => (
    <Leaf key={act.id} onClick={() => onOpenAct(act.id)}>
      <strong className="font-semibold">{act.jurabk}</strong> — {act.title}
    </Leaf>
  );
  const euLeaf = (instrument: (typeof euDirectives)[number]) => (
    <Leaf key={instrument.celex} url={celexUrl(instrument.celex)}>
      <span className="font-mono text-muted mr-1.5">{instrument.celex}</span>
      <span className="tabular-nums text-[11px] text-muted mr-1">
        {instrument.kind === 'directive' ? 'RL' : instrument.kind === 'regulation' ? 'VO' : instrument.kind}
      </span>
      {instrument.geas && <span className="text-[11px] text-[var(--c-ok)] font-bold mr-1">GEAS</span>}
      {instrument.title}
      {instrument.kind === 'directive' && (instrument.deu_mnes
        ? <span className="text-[var(--c-ok)] "> <ArrowRight aria-hidden="true" className="sntiq-inline-icon" /> {instrument.deu_mnes} {t('deuImpl')}</span>
        : <span className="text-muted"> · {t('noImpl')}</span>)}
      {instrument.kind === 'regulation' && instrument.in_force !== false
        && <span className="text-muted"> · {t('directlyApplicable')}</span>}
      {instrument.in_force === false && <span className="text-[var(--c-bad)]"> · {t('repealed')}</span>}
    </Leaf>
  );

  return (
    <div className="max-w-4xl">
      <header className={workbench.viewHead}>
        <div>
          <h2>{t('hierTitle')}</h2>
          <p>{t('hierIntro')}</p>
        </div>
      </header>
      <p className={workbench.fine} style={{ marginTop: 0, marginBottom: 20 }}>{t('hierCompetenceNote')}</p>

      <div className={`sntiq-search ${workbench.field} mb-4`}>
        <Search aria-hidden="true" />
        <input className="sntiq-field"
          type="text"
          value={q}
          placeholder={t('hierFilterPlaceholder')}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* GG is the constitutional layer of the German legal order. */}
      <Section label={t('constitutionalLaw')}
               count={bundLayers.constitution.length} open>
        {bundLayers.constitution.map(actLeaf)}
      </Section>

      {/* EU applicability is competence-specific, not a blanket supervisor. */}
      <Section label={t('eu')}
               count={`${euSecondaryCount} ${t('indexedActs')}`} open>
        <p className="px-1 pb-1 text-[11px] leading-relaxed text-muted">
          {t('euLayerNote')}
        </p>
        <Section label={t('primaryLaw')} count={euPrimary.length} open>
          <p className="px-1 pb-1 text-[11px] text-muted">{t('externalReferences')}</p>
          {euPrimary.map((instrument) => (
            <Leaf key={instrument.celex} url={celexUrl(instrument.celex)}>
              <span className="font-mono text-muted mr-1.5">{instrument.celex}</span>
              {instrument.title}
            </Leaf>
          ))}
        </Section>
        <Section label={t('secondaryLaw')} count={euSecondaryCount} open={forceOpen}>
          <Section label={t('directives')} count={euDirectives.length} open={forceOpen}>
            {euDirectives.map(euLeaf)}
          </Section>
          <Section label={t('regulations')} count={euRegulations.length} open={forceOpen}>
            {euRegulations.map(euLeaf)}
          </Section>
          {euOther.length > 0 && (
            <Section label={t('otherEuActs')} count={euOther.length} open={forceOpen}>
              {euOther.map(euLeaf)}
            </Section>
          )}
          {/* breadth layer: every in-force directive and basic regulation */}
          <EuIndexPanel />
        </Section>
      </Section>

      {/* Bund statutes and Rechtsverordnungen (GG is shown above). */}
      <Section label={t('bund')}
               count={`${bundActCount} ${t('indexedActs')}`} open>
        <Section label={t('statutes')} count={bundLayers.statutes.length} open={forceOpen}>
          {bundLayers.statutes.map(actLeaf)}
        </Section>
        <Section label={t('ordinances')} count={bundLayers.ordinances.length} open={forceOpen}>
          {bundLayers.ordinances.map(actLeaf)}
        </Section>
        <Section label={t('pipeline')} count={t('billRows', { count: bundBillCount })} open={forceOpen}>
          {bundPipeline.map(({ status, bills }) => (
              <Section key={status} label={status} count={bills.length} open={forceOpen}>
                {bills.slice(0, 60).map((v, i) => (
                  <Leaf key={i} date={v.date} url={dipSearchUrl(v.title)}>{v.title}</Leaf>
                ))}
              </Section>
          ))}
        </Section>
      </Section>

      {/* Bayern */}
      <Section label={t('bayern')}
               count={`${bayActCount} ${t('indexedActs')}`} open={forceOpen || undefined}>
        <Section label={t('constitutionalLaw')} count={bayLayers.constitution.length} open={forceOpen}>
          {bayLayers.constitution.map(actLeaf)}
        </Section>
        <Section label={t('statutes')} count={bayLayers.statutes.length} open={forceOpen}>
          {bayLayers.statutes.map(actLeaf)}
        </Section>
        <Section label={t('ordinances')} count={bayLayers.ordinances.length} open={forceOpen}>
          {bayLayers.ordinances.map(actLeaf)}
        </Section>
        <Section label="Landtag WP19" count={t('billRows', { count: bayernBillCount })} open={forceOpen}>
          {bayernPipeline.map(({ status, bills }) => (
              <Section key={status} label={status} count={bills.length} open={forceOpen}>
                {bills.slice(0, 60).map((v, i) => (
                  <Leaf key={i} date={v.date}>{v.drs ? `[${v.drs}] ` : ''}{v.title}</Leaf>
                ))}
              </Section>
          ))}
        </Section>
      </Section>

      {/* Länder — a layer whose coverage is marked unavailable shows 'not
          covered', never '0 bills'. */}
      <Section label={t('laender')}
               count={laenderCount.kind === 'notCovered'
                 ? <span title={t('notCoveredHint')}>{t('notCovered')}</span>
                 : t(laenderCount.partial ? 'billRowsPartial' : 'billRows', { count: laenderBillCount })}
               open={forceOpen || undefined}>
        {hier.meta?.coverage?.laender_monitor === 'origin_verification_required' && (
          <p className="px-1 pb-2 text-[11px] leading-relaxed text-muted">
            {t('laenderCoverageOriginOnly')}
          </p>
        )}
        {laenderBills.map(({ code, bills }) => (
              <Section
                key={code}
                label={code.replace('DE-', '')}
                count={laenderCoverage && bills.length === 0
                  ? <span title={t('notCoveredHint')}>—</span>
                  : bills.length}
                open={forceOpen}
              >
                {bills.slice(0, 40).map((v, i) => (
                  <Leaf key={i} date={v.date} url={v.url}>{v.title}</Leaf>
                ))}
              </Section>
        ))}
      </Section>
    </div>
  );
};

// ------------------------------------------------------------- shared bits
const Spinner: React.FC = () => {
  const { t } = useTranslation('kerf');
  return (
    <div className={workbench.state} role="status">
      <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin" /> {t('loading')}
    </div>
  );
};
const LoadError: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => {
  const { t, i18n } = useTranslation('kerf');
  return (
    <div className={workbench.state} role="alert">
      <TriangleAlert aria-hidden="true" className="w-4 h-4 text-[var(--c-warn)]" /> {t('loadError')}
      {onRetry && <button type="button" onClick={onRetry} className="sntiq-btn !min-h-9 !py-1.5 !px-3 !text-[13px]">
        {readerCopy(i18n.language).retry}
      </button>}
    </div>
  );
};

// --------------------------------------------------- tutorial & credits
/** The core Laws-as-Git legend. Each analogy is explained in plain language
    and stays subordinate to the legal effect evidenced by the source. */
const TUT_ROWS = [
  { term: 'tut.term.law', key: 'tut.repo' },
  { term: 'tut.term.change', key: 'tut.commit' },
  { term: 'tut.term.current', key: 'tut.head' },
  { term: 'tut.term.bill', key: 'tut.branch' },
  { term: 'tut.term.eu', key: 'tut.merge' },
  { term: 'tut.term.case', key: 'tut.decisions' },
] as const;

const TutorialPanel: React.FC = () => {
  const { t } = useTranslation('kerf');
  return (
    <details className={`group ${workbench.fold} mt-6`} style={{ borderTop: '1px solid var(--kerf-line)' }}>
      <summary>
        <ChevronRight aria-hidden="true" className="w-4 h-4 shrink-0 transition-transform group-open:rotate-90" />
        <span>{t('tut.title')}</span>
      </summary>
      <div className="pb-4 pl-6 space-y-2.5">
        {TUT_ROWS.map(({ term, key }) => (
          <div key={key} className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] items-baseline gap-3">
            <strong className="text-[15px] font-semibold text-main break-words">{t(term)}</strong>
            <p className="text-[15px] leading-relaxed text-main min-w-0 break-words">{t(key)}</p>
          </div>
        ))}
        <p className={workbench.fine}>{t('tut.tabs')}</p>
      </div>
    </details>
  );
};

/** The public services Kerf is built on — proper nouns, no i18n. */
const CREDIT_LINKS: { name: string; url: string; title?: string }[] = [
  { name: 'Deutscher Bundestag/Bundesrat – DIP', url: 'https://dip.bundestag.de', title: 'Dokumentations- und Informationssystem für Parlamentsmaterialien; Daten kostenfrei verfügbar' },
  { name: 'Bundesrat', url: 'https://www.bundesrat.de' },
  { name: 'gesetze-im-internet.de', url: 'https://www.gesetze-im-internet.de' },
  { name: 'Rechtsprechung im Internet', url: 'https://www.rechtsprechung-im-internet.de' },
  { name: 'NeuRIS — rechtsinformationen.bund.de', url: 'https://www.rechtsinformationen.bund.de' },
  { name: 'recht.bund.de — Bundesgesetzblatt', url: 'https://www.recht.bund.de' },
  { name: 'BAYERN.RECHT', url: 'https://www.gesetze-bayern.de' },
  { name: 'Verkündungsplattform Bayern', url: 'https://www.verkuendung-bayern.de' },
  { name: 'Bayerischer Landtag', url: 'https://www.bayern.landtag.de' },
  { name: 'EUR-Lex', url: 'https://eur-lex.europa.eu' },
];

const CreditsStrip: React.FC = () => {
  const { t } = useTranslation('kerf');
  return (
    <div className="mt-4 px-1 text-xs text-muted">
      <p className="text-[13px] tabular-nums font-semibold mb-1">
        {t('credits.title')}
      </p>
      <p className="mb-2">{t('credits.intro')}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {CREDIT_LINKS.map((l) => (
          <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer"
             title={l.title}
             className="inline-flex items-center gap-1 hover:text-[var(--c-link)] transition-colors">
            {l.name} <ExternalLink className="w-3 h-3" />
          </a>
        ))}
      </div>
    </div>
  );
};

// -------------------------------------------------------------- container
const KerfModule: React.FC = () => {
  const { t, i18n } = useTranslation('kerf');
  const [tab, setTab] = useState<Tab>('reader');
  const locationLabel = workbenchLabels(i18n.language)[tab];
  useModuleActions('kerf', {
    headerTitle: <div className={workbench.headerTitle} aria-hidden="true">
      <strong>Kerf</strong><span className={workbench.location}>{locationLabel}</span>
    </div>,
    footerNote: <span>{t('footer')}</span>,
  }, [t, locationLabel]);
  useEffect(() => {
    const openSharedReader = () => {
      if (location.pathname === '/dt/kerf' && decodeWorkspace(location.hash)) setTab('reader');
    };
    window.addEventListener('hashchange', openSharedReader);
    window.addEventListener('popstate', openSharedReader);
    return () => {
      window.removeEventListener('hashchange', openSharedReader);
      window.removeEventListener('popstate', openSharedReader);
    };
  }, []);
  const [graphOpened, setGraphOpened] = useState(false);
  useEffect(() => { if (tab === 'graph') setGraphOpened(true); }, [tab]);
  const [readerDocument, setReaderDocument] = useState<{ actId: string; norm: string | null; documentType?: 'law' | 'decision'; sequence: number } | null>(null);

  const [acts, setActs] = useState<KerfAct[] | null>(null);
  const [actsError, setActsError] = useState<KerfRequestError | null>(null);
  const [actsAttempt, setActsAttempt] = useState(0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedNorm, setSelectedNorm] = useState<string | null>(null);
  const [detail, setDetail] = useState<KerfActDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(false);

  // git log — cached PER LANE: sparse lanes (EU has ~47 commits total) all
  // but vanish from the newest-150 slice of the merged stream, so a lane
  // filter re-fetches server-side (`/git?lane=N`) instead of sieving it.
  const [gitByLane, setGitByLane] = useState<Record<string, KerfGit>>({});
  const [gitError, setGitError] = useState(false);
  const [gitLoadingMore, setGitLoadingMore] = useState(false);
  const [lane, setLane] = useState<number | null>(null);
  const laneKey = lane == null ? 'all' : String(lane);
  const git = gitByLane[laneKey] ?? null;

  const [feed, setFeed] = useState<KerfFeedEvent[] | null>(null);
  const [feedError, setFeedError] = useState(false);

  // 'none' = no digest available (404 or any error) — panel simply absent
  const [digest, setDigest] = useState<KerfDigest | 'none' | null>(null);
  const [stats, setStats] = useState<KerfStats | null>(null);

  const [hier, setHier] = useState<KerfHierarchy | null>(null);
  const [hierError, setHierError] = useState(false);

  const [decisions, setDecisions] = useState<KerfDecision[] | null>(null);
  const [decisionsError, setDecisionsError] = useState(false);
  const [decisionsQuery, setDecisionsQuery] = useState('');

  const openAct = (id: string, norm?: string | null) => { setSelectedId(id); setSelectedNorm(norm ?? null); setReaderDocument(null); setTab('synopse'); };
  const openReader = (id: string, norm?: string | null) => {
    setSelectedId(id);
    setReaderDocument(previous => ({ actId: id, norm: norm ?? null, sequence: (previous?.sequence ?? 0) + 1 }));
    setTab('reader');
  };
  const openDecisionReader = (id: string) => {
    setReaderDocument(previous => ({ actId: id, norm: null, documentType: 'decision', sequence: (previous?.sequence ?? 0) + 1 }));
    setTab('reader');
  };
  const openDecisionsFor = (jurabk: string) => {
    setDecisionsQuery(jurabk); setTab('decisions');
  };

  // jurabk -> act id, so git-log commits can deep-link into the Synopse
  const actIndex = useMemo(
    () => new Map((acts ?? []).map((a) => [a.jurabk, a.id] as const)),
    [acts]);

  const loadMoreGit = () => {
    if (!git || gitLoadingMore) return;
    setGitLoadingMore(true);
    kerfGitLog(git.commits.length + 150, lane ?? undefined)
      .then((g) => setGitByLane((prev) => ({ ...prev, [laneKey]: g })))
      .catch(() => { /* keep the commits we already have */ })
      .finally(() => setGitLoadingMore(false));
  };

  // law index — loaded once
  useEffect(() => {
    const ctl = new AbortController();
    setActsError(null);
    kerfActs(ctl.signal)
      .then(setActs)
      .catch((error) => { if (!ctl.signal.aborted) setActsError(toKerfRequestError(error)); });
    return () => ctl.abort();
  }, [actsAttempt]);

  useEffect(() => {
    const ctl = new AbortController();
    kerfStats(ctl.signal).then(setStats).catch(() => { /* optional coverage strip */ });
    return () => ctl.abort();
  }, []);

  // selected law detail
  useEffect(() => {
    if (!selectedId) { setDetail(null); setDetailError(false); return; }
    const ctl = new AbortController();
    setDetailLoading(true);
    setDetailError(false);
    kerfAct(selectedId, ctl.signal)
      .then((d) => setDetail(d))
      .catch(() => { if (!ctl.signal.aborted) setDetailError(true); })
      .finally(() => { if (!ctl.signal.aborted) setDetailLoading(false); });
    return () => ctl.abort();
  }, [selectedId]);

  // git log — loaded when the tab is first opened, and once per lane on
  // first selection of that lane
  useEffect(() => {
    if (tab !== 'gitlog' || git || gitError) return;
    const ctl = new AbortController();
    kerfGitLog(150, lane ?? undefined, ctl.signal)
      .then((g) => setGitByLane((prev) => ({ ...prev, [laneKey]: g })))
      .catch(() => { if (!ctl.signal.aborted) setGitError(true); });
    return () => ctl.abort();
  }, [tab, git, gitError, lane, laneKey]);

  // realtime feed — loaded once the Wiki tab is opened (Realtime sub-view)
  useEffect(() => {
    if (tab !== 'wiki' || feed || feedError) return;
    const ctl = new AbortController();
    kerfFeed(150, ctl.signal)
      .then((f) => setFeed(f.events))
      .catch(() => { if (!ctl.signal.aborted) setFeedError(true); });
    return () => ctl.abort();
  }, [tab, feed, feedError]);

  // LLM digest — optional; loaded once with the Wiki tab (Realtime sub-view)
  useEffect(() => {
    if (tab !== 'wiki' || digest) return;
    const ctl = new AbortController();
    kerfDigest(ctl.signal)
      .then(setDigest)
      .catch(() => { if (!ctl.signal.aborted) setDigest('none'); });
    return () => ctl.abort();
  }, [tab, digest]);

  // hierarchy — loaded when its tab is first opened
  useEffect(() => {
    if (tab !== 'hierarchy' || hier || hierError) return;
    const ctl = new AbortController();
    kerfHierarchy(ctl.signal)
      .then(setHier)
      .catch(() => { if (!ctl.signal.aborted) setHierError(true); });
    return () => ctl.abort();
  }, [tab, hier, hierError]);

  // case law — loaded when its tab is first opened
  useEffect(() => {
    if (tab !== 'decisions') return;
    const ctl = new AbortController();
    setDecisionsError(false);
    const timer = window.setTimeout(() => {
      kerfDecisions({ limit: 200, q: decisionsQuery.trim() || undefined }, ctl.signal)
        .then((r) => { if (!ctl.signal.aborted) setDecisions(r.decisions); })
        .catch(() => { if (!ctl.signal.aborted) setDecisionsError(true); });
    }, decisionsQuery ? 220 : 0);
    return () => { ctl.abort(); window.clearTimeout(timer); };
  }, [tab, decisionsQuery]);

  const TABS: { id: Tab; Icon: React.ElementType }[] = [
    { id: 'reader', Icon: BookOpen },
    { id: 'wiki', Icon: Library },
    { id: 'synopse', Icon: FileDiff },
    { id: 'decisions', Icon: Scale },
    { id: 'gitlog', Icon: History },
    { id: 'hierarchy', Icon: ListTree },
    { id: 'graph', Icon: Waypoints },
  ];

  return (
    <div data-module="kerf" className={workbench.app}>
      <style dangerouslySetInnerHTML={{ __html: DIFF_CSS }} />

      {/* The module's band as a workspace strip (DESIGN.md section 7): night
          with the gold relief under the header, the name and where the
          reader is. A working tool opens straight on its work, so the band
          stays this narrow strip instead of opening large on entry. */}
      <header className={workbench.top}>
        <NightBand preset="kerf" size="workspace" wide>
          <div className={workbench.topbar}>
            <h1>Kerf</h1>
            {/* The single location label; the rail item and panels do not repeat it as a header. */}
            <span className={workbench.location} data-kerf-location>{locationLabel}</span>
            <Link href="/dt/chamfer" title="Chamfer" className={workbench.toChamfer}><span>Chamfer</span><ArrowUpRight size={13} aria-hidden="true" /></Link>
          </div>
        </NightBand>
      </header>
        <nav className={workbench.rail} aria-label="Kerf">
          {TABS.map(({ id, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-pressed={tab === id}
              aria-label={workbenchLabels(i18n.language)[id]}
              title={id === 'reader' ? workbenchLabels(i18n.language)[id] : `${workbenchLabels(i18n.language)[id]} · ${t(`tab.${id}`)}`}
              className={workbench.navItem}
            >
              <Icon size={19} /><span>{workbenchLabels(i18n.language)[id]}</span>
            </button>
          ))}
          {/* On a wide screen the strip shares the header's row, whose end
              belongs to the site controls: the way to Chamfer moves here. */}
          <Link href="/dt/chamfer" className={`${workbench.navItem} ${workbench.railChamfer}`}><ArrowUpRight size={19} aria-hidden="true" /><span>Chamfer</span></Link>
        </nav>
      <div className={workbench.body}>
        <div className={workbench.readerPanel} hidden={tab !== 'reader'}><KerfReader acts={acts} error={actsError} onRetry={() => setActsAttempt(value => value + 1)} onHistory={openAct} onDecisions={openDecisionsFor} initialDocument={readerDocument} onInitialDocumentConsumed={() => setReaderDocument(null)} visible={tab === 'reader'} onBrowseAll={() => setTab('wiki')} /></div>
        {(graphOpened || tab === 'graph') && <div className={workbench.graphPanel} hidden={tab !== 'graph'}><KerfArenaGraph acts={acts} onOpenAct={openReader} visible={tab === 'graph'} /></div>}
        {tab !== 'reader' && tab !== 'graph' && <div className={workbench.panel} key={tab}>
        {tab === 'wiki' && (
          <WikiTab
            acts={acts}
            error={Boolean(actsError)}
            feed={feed}
            feedError={feedError}
            digest={digest}
            stats={stats}
            selectedId={selectedId}
            detail={detail}
            detailLoading={detailLoading}
            detailError={detailError}
            onSelect={openReader}
            onSynopse={() => setTab('synopse')}
            onOpenSynopse={openAct}
            onDecisions={openDecisionsFor}
          />
        )}
        {tab === 'synopse' && (
          <SynopseTab
            selectedId={selectedId}
            initialNorm={selectedNorm}
            detail={detail}
            detailLoading={detailLoading}
            detailError={detailError}
            onGotoWiki={() => setTab('wiki')}
          />
        )}
        {tab === 'decisions' && (
          <DecisionsTab
            decisions={decisions}
            error={decisionsError}
            query={decisionsQuery}
            onQuery={setDecisionsQuery}
            onOpenAct={openReader}
            onOpenDecision={openDecisionReader}
          />
        )}
        {tab === 'gitlog' && (
          <GitLogTab
            git={git}
            lanes={gitByLane['all']?.lanes ?? git?.lanes ?? []}
            error={gitError}
            lane={lane}
            onLane={(value) => { setGitError(false); setLane(value); }}
            onRetry={() => setGitError(false)}
            actIndex={actIndex}
            onOpenAct={openAct}
            onLoadMore={loadMoreGit}
            loadingMore={gitLoadingMore}
          />
        )}
        {tab === 'hierarchy' && (
          <HierarchyTab hier={hier} error={hierError} onOpenAct={openAct} />
        )}
        </div>}
      </div>
    </div>
  );
};

export default KerfModule;
