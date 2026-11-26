'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, BookOpen, Bookmark, ExternalLink, RotateCcw, Search, X } from 'lucide-react';
import { kerfFeed, kerfGitLog, kerfSearch, type KerfAct, type KerfCommit, type KerfFeedEvent, type KerfSearch } from './client';
import { readerCopy } from './readerI18n';
import { readerLawLabel } from './readerLabels';
import { legalDate as historyDate } from './normHistoryFormat';
import { berlinToday } from './kerfLabels';
import { kerfShowcaseCopy } from './showcaseContent';
import { overviewCopy, overviewTiles, recentOfficial, upcomingChanges, type TileChange } from './readerOverview';
import LoadStatus from './LoadStatus';
import { toKerfRequestError, type KerfRequestError } from './kerfRequest';
import styles from './readerOverview.module.css';

export type OverviewDocument = { actId: string; norm: string | null; documentType?: 'law' | 'decision'; at?: string };

function useRemote<T>(load: (signal: AbortSignal) => Promise<T>, key: string) {
  const [state, setState] = useState<{ data: T | null; error: KerfRequestError | null; loading: boolean }>({ data: null, error: null, loading: true });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ data: null, error: null, loading: true });
    load(controller.signal)
      .then(data => { if (!controller.signal.aborted) setState({ data, error: null, loading: false }); })
      .catch(error => { if (!controller.signal.aborted) setState({ data: null, error: toKerfRequestError(error), loading: false }); });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);
  return { ...state, retry: () => setAttempt(value => value + 1) };
}

function ChangeLine({ change, kind, language }: { change: TileChange; kind: 'last' | 'next'; language: string }) {
  const o = overviewCopy(language);
  const date = change.date ? historyDate(change.date, language) : null;
  const when = !date ? o.dateUnknown : change.state === 'pending' || kind === 'next' ? o.entersOn.replace('{date}', date) : o.inForce.replace('{date}', date);
  return <span className={styles.changeLine} data-kind={kind} data-state={change.state} data-date-known={Boolean(date)}>
    <span className={styles.changeLabel}>{kind === 'last' ? o.lastChange : o.nextChange}</span>
    <strong>{when}</strong>
    {change.citation && <small>{change.citation}</small>}
    {change.source === 'git' && <small>{/commencement/u.test(change.basis ?? '') ? o.perClause : o.fromGit}</small>}
  </span>;
}

export default function ReaderOverview({ acts, language, recent, bookmarks, title, onOpen, canReopen, onReopen, onBrowseAll, searchInput }: {
  acts: KerfAct[]; language: string; recent: OverviewDocument[]; bookmarks: OverviewDocument[];
  title: (document: OverviewDocument) => string; onOpen: (document: OverviewDocument) => void;
  canReopen: boolean; onReopen: () => void; onBrowseAll?: () => void; searchInput?: React.Ref<HTMLInputElement>;
}) {
  const t = readerCopy(language);
  const o = overviewCopy(language);
  const today = berlinToday();
  const feed = useRemote<KerfFeedEvent[]>(signal => kerfFeed(150, signal).then(value => value.events), 'feed');
  const git = useRemote<KerfCommit[]>(signal => kerfGitLog(200, undefined, signal).then(value => value.commits), 'git');
  const tiles = useMemo(() => overviewTiles(acts, git.data ?? [], today), [acts, git.data, today]);
  const upcoming = useMemo(() => upcomingChanges(git.data ?? [], acts, today, 40), [git.data, acts, today]);
  const [keyOnly, setKeyOnly] = useState(false);
  const shownUpcoming = (keyOnly ? upcoming.filter(row => row.priority) : upcoming).slice(0, 8);
  const recentRows = useMemo(() => recentOfficial(feed.data ?? [], 8), [feed.data]);

  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<KerfSearch | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<KerfRequestError | null>(null);
  const [searchAttempt, setSearchAttempt] = useState(0);
  useEffect(() => {
    const needle = query.trim(); const controller = new AbortController();
    setSearch(null); setSearchError(null); setSearching(false);
    if (needle.length < 2) return;
    setSearching(true);
    const timer = window.setTimeout(() => {
      kerfSearch(needle, { limit: 12, normLimit: 12 }, controller.signal)
        .then(value => { if (!controller.signal.aborted) setSearch(value); })
        .catch(error => { if (!controller.signal.aborted) setSearchError(toKerfRequestError(error)); })
        .finally(() => { if (!controller.signal.aborted) setSearching(false); });
    }, 220);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query, searchAttempt]);
  const needle = query.trim().toLocaleLowerCase();
  const actHits = useMemo(() => {
    if (!needle) return [];
    const local = acts.filter(act => `${readerLawLabel(act)} ${act.jurabk} ${act.title} ${act.id}`.toLocaleLowerCase().includes(needle));
    return Array.from(new Map([...(search?.act_matches ?? []), ...local].map(act => [act.id, act])).values()).slice(0, 8);
  }, [acts, needle, search]);
  const normHits = (search?.norm_matches ?? []).slice(0, 8);
  const openFirst = () => { if (normHits[0]) onOpen({ actId: normHits[0].act_id, norm: normHits[0].enbez }); else if (actHits[0]) onOpen({ actId: actHits[0].id, norm: null }); };

  return <div className={styles.overview} data-reader-overview>
    <div className={styles.inner}>
      <p className={styles.lead}>{kerfShowcaseCopy(language).description}</p>
      <div className={`sntiq-search ${styles.search}`} role="search">
        <Search size={18} aria-hidden="true" />
        <input ref={searchInput} className="sntiq-field" value={query} placeholder={t.search} aria-label={t.search} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') openFirst(); if (event.key === 'Escape') setQuery(''); }} />
        {query && <button type="button" title={t.clear} aria-label={t.clear} onClick={() => setQuery('')}><X size={15} /></button>}
      </div>
      {needle.length > 0 && <section className={styles.results} aria-label={t.searchResults} data-overview-results>
        {searching && <LoadStatus compact loading error={null} language={language} label={t.queryPending} resetKey={query} />}
        {searchError && <LoadStatus compact loading={false} error={searchError} language={language} title={t.failed} onRetry={() => setSearchAttempt(value => value + 1)} />}
        {actHits.length > 0 && <><h3>{o.searchLaws}</h3><div className={styles.resultList}>{actHits.map(act => <button key={act.id} type="button" onClick={() => onOpen({ actId: act.id, norm: null })}><strong>{readerLawLabel(act)}</strong><span>{act.title}</span></button>)}</div></>}
        {normHits.length > 0 && <><h3>{o.searchProvisions}</h3><div className={styles.resultList}>{normHits.map((hit, index) => <button key={`${hit.act_id}:${hit.enbez}:${index}`} type="button" onClick={() => onOpen({ actId: hit.act_id, norm: hit.enbez })}><strong>{hit.jurabk} {hit.enbez}</strong><span>{hit.norm_title}</span>{hit.snippet && <em>{hit.snippet}</em>}</button>)}</div></>}
        {!searching && !searchError && needle.length >= 2 && !actHits.length && !normHits.length && <p className={styles.muted}>{t.noResults}</p>}
      </section>}

      {(recent.length > 0 || bookmarks.length > 0 || canReopen) && <section className={styles.section} aria-labelledby="overview-continue">
        <header><h2 id="overview-continue">{o.continueReading}</h2>{canReopen && <button type="button" className={styles.link} onClick={onReopen}><RotateCcw size={13} />{o.reopen}</button>}</header>
        <div className={styles.chips}>
          {recent.slice(0, 8).map(item => <button key={`r:${item.actId}:${item.norm}:${item.at}:${item.documentType}`} type="button" onClick={() => onOpen(item)} data-overview-recent><BookOpen size={13} /><span>{title(item)}</span>{item.at && <small>{historyDate(item.at, language)}</small>}</button>)}
          {bookmarks.slice(0, 6).map(item => <button key={`b:${item.actId}:${item.norm}:${item.at}:${item.documentType}`} type="button" onClick={() => onOpen(item)} data-overview-bookmark><Bookmark size={13} /><span>{title(item)}</span></button>)}
        </div>
      </section>}

      <section className={styles.section} aria-labelledby="overview-key">
        <header><h2 id="overview-key">{o.keyActs}</h2>{onBrowseAll && <button type="button" className={styles.link} onClick={onBrowseAll}>{o.allLaws}<ArrowUpRight size={13} /></button>}</header>
        {/* A ruled index: the abbreviation is the anchor, then the name, then
            the state in force and the next one, each with its source. */}
        <div className={styles.actsHead} aria-hidden="true"><span>{o.searchLaws}</span><span /><span>{o.lastChange}</span><span>{o.nextChange}</span></div>
        <ul className={styles.acts}>
          {tiles.map(({ act, last, next }) => <li key={act.id}><button type="button" className={styles.act} data-overview-act={act.id} onClick={() => onOpen({ actId: act.id, norm: null })}>
            <span className={styles.actAbbr}><strong>{readerLawLabel(act)}</strong><small>{act.juris}</small></span>
            <span className={styles.actTitle}>{act.title}</span>
            {last ? <ChangeLine change={last} kind="last" language={language} /> : <span className={styles.none} aria-hidden="true">—</span>}
            {next ? <ChangeLine change={next} kind="next" language={language} /> : <span className={styles.none} aria-hidden="true">—</span>}
          </button></li>)}
        </ul>
      </section>

      <div className={styles.columns}>
        <section className={styles.section} aria-labelledby="overview-upcoming">
          <header><h2 id="overview-upcoming">{o.upcoming}</h2>
            <label className={styles.toggle}><input type="checkbox" className="sntiq-check" checked={keyOnly} onChange={event => setKeyOnly(event.target.checked)} />{o.keyOnly}</label></header>
          <LoadStatus compact loading={git.loading} error={git.error} language={language} title={o.upcoming} onRetry={git.retry} resetKey="git" />
          {git.data && !shownUpcoming.length && <p className={styles.muted}>{o.nothingUpcoming}</p>}
          <ol className={styles.feed}>{shownUpcoming.map(row => <li key={row.key} data-priority={row.priority}>
            <time dateTime={row.date}>{historyDate(row.date, language)}</time>
            <div>
              <p className={styles.feedActs}>{row.acts.length ? row.acts.slice(0, 4).map(act => <button key={act.id} type="button" onClick={() => onOpen({ actId: act.id, norm: null })}>{readerLawLabel(act)}</button>) : row.jurabks.slice(0, 4).join(', ')}{row.jurabks.length > 4 ? ` +${row.jurabks.length - 4}` : ''}</p>
              <small>{o.entersOn.replace('{date}', historyDate(row.date, language))}{/commencement/u.test(row.basis ?? '') ? ` · ${o.perClause}` : ''}{row.subject ? ` · ${row.subject}` : ''}</small>
              {row.url && <a href={row.url} target="_blank" rel="noopener noreferrer" aria-label={`${row.subject} ${t.source}`}><ExternalLink size={12} /></a>}
            </div>
          </li>)}</ol>
        </section>
        <section className={styles.section} aria-labelledby="overview-recent">
          <header><h2 id="overview-recent">{o.recentOfficial}</h2></header>
          <LoadStatus compact loading={feed.loading} error={feed.error} language={language} title={o.recentOfficial} onRetry={feed.retry} resetKey="feed" />
          {feed.data && !recentRows.length && <p className={styles.muted}>{o.nothingRecent}</p>}
          <ol className={styles.feed}>{recentRows.map(row => <li key={row.key}>
            <time dateTime={row.date} title={row.basis === 'reported' ? o.reportedHint : undefined}>{historyDate(row.date, language)}</time>
            <div>
              <p>{row.url ? <a href={row.url} target="_blank" rel="noopener noreferrer">{row.title}</a> : row.title}</p>
              <small>{row.juris} · {row.source} · {row.basis === 'reported' ? o.reported : row.basis === 'official_publication' || /verkündet/iu.test(row.kind) ? o.promulgated : o.published}{row.citation ? ` · ${row.citation}` : ''}</small>
            </div>
          </li>)}</ol>
        </section>
      </div>
    </div>
  </div>;
}
