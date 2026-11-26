'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import type { KerfActArchive } from './client';
import { filterReaderHistoryEvents, readerHistoryEvents, readerEditionDate, readerSourceUrl } from './readerEditions';
import { readerWorkbenchCopy } from './readerWorkbenchCopy';
import { readerCopy } from './readerI18n';
import ArchiveCoverageSummary from './ArchiveCoverageSummary';
import styles from './readerWorkbench.module.css';

export default function ReaderHistory({ archive, language, selectedId, selectionRequest }: { archive: KerfActArchive; language: string; selectedId?: string; selectionRequest?: number }) {
  const t = readerWorkbenchCopy(language);
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(30);
  const root = useRef<HTMLDivElement>(null);
  const pendingSelection = useRef<string | null>(null);
  const events = useMemo(() => readerHistoryEvents(archive), [archive]);
  const filtered = useMemo(() => filterReaderHistoryEvents(events, query, language), [events, query, language]);
  useEffect(() => {
    pendingSelection.current = selectedId ?? null;
    if (!selectedId) return;
    setQuery('');
    setLimit(Math.max(30, events.findIndex(event => (event.id ?? event.event_id) === selectedId) + 1));
  }, [selectedId, selectionRequest, events]);
  useEffect(() => {
    // Selection first clears the filter/expands pagination. Wait for that DOM
    // before scrolling; a target can be absent from the previous filtered list.
    if (!pendingSelection.current || query) return;
    const selected = [...root.current?.querySelectorAll<HTMLElement>('[data-history-id]') ?? []]
      .find(element => element.dataset.historyId === pendingSelection.current);
    if (selected) { selected.scrollIntoView({ block: 'center' }); pendingSelection.current = null; }
  }, [selectedId, selectionRequest, events, limit, query]);
  return <div ref={root} className={styles.history} data-reader-history>
    <div className={styles.historyHeading}><h2>{t.actHistory}</h2><span>{query.trim() ? `${filtered.length} / ${events.length}` : events.length}</span></div>
    <div className={`sntiq-search ${styles.search}`}><Search size={15} aria-hidden="true" /><input className="sntiq-field sntiq-field-sm" value={query} aria-label={t.searchHistory} placeholder={t.searchHistory} onChange={event => { setQuery(event.target.value); setLimit(30); }} /></div>
    <ArchiveCoverageSummary archive={archive} language={language} />
    {filtered.slice(0, limit).map((event, index) => {
      const id = event.id ?? event.event_id ?? String(index);
      const url = readerSourceUrl(event.official_html_url) ?? readerSourceUrl(event.official_pdf_url) ?? event.evidence?.map(item => readerSourceUrl(item.url)).find(Boolean);
      const day = event.published_at ?? event.effective_at ?? event.date;
      return <article className={styles.event} key={id} data-history-id={id} data-history-date={day} data-selected={selectedId === id}>
        <time dateTime={day}>{readerEditionDate(day, language)}</time>
        {event.published_at ? <small>{t.published}{event.effective_at && ` · ${t.effective} ${readerEditionDate(event.effective_at, language)}`}</small> : event.effective_at && <small>{t.effective}</small>}
        <h3>{event.procedure_title ?? event.article_heading ?? event.document_id}</h3>
        {event.amending_article && <p>{event.amending_article}</p>}
        {event.fundstelle && <p>{event.fundstelle}</p>}
        {Boolean(event.affected_norms?.length) && <p>{event.affected_norms!.join(', ')}</p>}
        {!event.historical_text_reconstructed && <small>{t.noBody}</small>}
        {url && <a href={url} target="_blank" rel="noopener noreferrer">{t.source}<ExternalLink size={13} aria-hidden="true" /></a>}
      </article>;
    })}
    {!filtered.length && <p role="status">{events.length ? readerCopy(language).noResults : t.noEvents}</p>}
    {filtered.length > limit && <button className={styles.command} onClick={() => setLimit(value => value + 30)}>{t.more} ({filtered.length - limit})</button>}
  </div>;
}
