'use client';

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './i18n/register';
import { ExternalLink } from 'lucide-react';
import { kerfFederalDecisionSearch, type FederalDecisionHit } from './client';
import { isKerfRequestError } from './kerfRequest';
import { safeDecisionSource } from './readerDecision';
import { readerCopy } from './readerI18n';
import workbench from './workbench.module.css';

interface SearchPage {
  rows: FederalDecisionHit[];
  next: string | null;
}

export default function FederalDecisionResults({ query, onOpen }: {
  query: string;
  onOpen: (id: string) => void;
}) {
  const { t, i18n } = useTranslation('kerf');
  const [page, setPage] = useState<SearchPage | null>(null);
  const [request, setRequest] = useState<{ cursor: string | null }>({ cursor: null });
  const [pending, setPending] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setPending(true);
    setFailed(false);
    const timer = window.setTimeout(() => {
      kerfFederalDecisionSearch(query, request.cursor, controller.signal)
        .then(result => {
          if (controller.signal.aborted) return;
          setPage(old => ({ rows: request.cursor ? [...(old?.rows ?? []), ...result.items] : result.items, next: result.next }));
          setPending(false);
        })
        .catch(error => {
          if (controller.signal.aborted) return;
          if (request.cursor && isKerfRequestError(error) && error.status === 409) {
            setPage(null);
            setRequest({ cursor: null });
            return;
          }
          setFailed(true);
          setPending(false);
        });
    }, request.cursor ? 0 : 220);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query, request]);

  return <section className="mt-4" aria-labelledby="kerf-federal-results">
    <h3 id="kerf-federal-results" className={workbench.tag}><span lang="de" translate="no">Rechtsprechung im Internet</span> · {t('dec.federalFullText')}</h3>
    <ul className={workbench.ruled}>
      {page?.rows.map(hit => {
        const source = safeDecisionSource(hit.source_url);
        return <li key={hit.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-[var(--panel-border)] py-2">
          <button type="button" onClick={() => onOpen(`rii:${hit.document}`)} className="min-w-0 break-words text-left text-sm font-semibold text-main hover:underline">
            {hit.court} · {hit.docket || hit.ecli || hit.document}
          </button>
          {hit.decision_date && <time dateTime={hit.decision_date} className="text-xs tabular-nums text-muted">{hit.decision_date.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3.$2.$1')}</time>}
          {source && <a href={source} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs text-[var(--c-link)] hover:underline">
            {t('dec.source')} <ExternalLink aria-hidden="true" className="sntiq-inline-icon" />
          </a>}
        </li>;
      })}
    </ul>
    <div role="status" className="mt-1 text-sm text-muted">
      {pending ? t('loading') : failed ? t('loadError') : !page?.rows.length ? t('dec.noResults') : null}
    </div>
    {failed && <button className="sntiq-btn mt-2" type="button" onClick={() => setRequest({ ...request })}>{readerCopy(i18n.language).retry}</button>}
    {!failed && page?.next && <button className="sntiq-btn mt-2" type="button" disabled={pending} onClick={() => setRequest({ cursor: page.next })}>{t('loadMore')}</button>}
  </section>;
}
