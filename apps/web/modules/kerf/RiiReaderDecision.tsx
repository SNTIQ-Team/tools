'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './i18n/register';
import { ExternalLink } from 'lucide-react';
import { kerfRiiMetadata, kerfRiiPassages, type RiiDecisionMetadata, type RiiPassage } from './client';
import { decisionCopy, safeDecisionSource } from './readerDecision';
import { readerCopy } from './readerI18n';
import type { LoadedDecision } from './ReaderDecision';
import styles from './readerDecision.module.css';

const sectionNames: Record<string, string> = {
  titel: 'Titel', leitsatz: 'Leitsatz', orientierungssatz: 'Orientierungssatz',
  tenor: 'Tenor', tatbestand: 'Tatbestand', entscheidungsgruende: 'Entscheidungsgründe',
  gruende: 'Gründe', abweichende_meinung: 'Abweichende Meinung', sonstiger_langtext: 'Sonstiger Langtext',
};
// RII stores a stable lower-case key for the issuing court.
const courtNames: Record<string, string> = {
  bag: 'BAG', bfh: 'BFH', bgh: 'BGH', bpatg: 'BPatG', bsg: 'BSG',
  bverfg: 'BVerfG', bverwg: 'BVerwG', gmsogb: 'GmS-OGB',
};
const courtLabel = (code: string) => courtNames[code] ?? code;

interface DocumentPage {
  metadata: RiiDecisionMetadata;
  revision: string;
  passages: RiiPassage[];
  total: number;
}

export default function RiiReaderDecision({ documentId, onLoaded }: {
  documentId: string;
  onLoaded?: (decision: LoadedDecision) => void;
}) {
  const { t, i18n } = useTranslation('kerf');
  const copy = readerCopy(i18n.language);
  const [page, setPage] = useState<DocumentPage | null>(null);
  const [request, setRequest] = useState<{ offset: number; revision?: string }>({ offset: 0 });
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(true);
  const report = useRef(onLoaded);
  report.current = onLoaded;

  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    setPending(true);
    const read = async () => {
      const [result, header] = await Promise.all([
        kerfRiiPassages(documentId, request.offset, controller.signal),
        request.offset ? Promise.resolve(null) : kerfRiiMetadata(documentId, controller.signal),
      ]);
      if (controller.signal.aborted) return;
      if (result.document !== documentId || result.offset !== request.offset
          || (header && header.metadata.document !== documentId)
          || result.revision !== (header?.revision ?? request.revision)
          || (!result.passages.length && result.offset < result.total)) throw new Error('RII edition mismatch');
      setPage(old => header
        ? { metadata: header.metadata, revision: result.revision, passages: result.passages, total: result.total }
        : old && { ...old, passages: [...old.passages, ...result.passages], total: result.total });
      setPending(false);
    };
    void read().catch(() => { if (!controller.signal.aborted) { setFailed(true); setPending(false); } });
    return () => controller.abort();
  }, [documentId, request]);

  useEffect(() => {
    if (!page) return;
    const text = page.passages.length === page.total
      ? page.passages.map(p => p.printed_number ? `Rn. ${p.printed_number}  ${p.text}` : p.text).join('\n\n') : null;
    report.current?.({ id: `rii:${documentId}`, court: courtLabel(page.metadata.court), az: page.metadata.docket || page.metadata.ecli || page.metadata.document, text });
  }, [page, documentId]);

  const source = safeDecisionSource(page?.metadata.source_page);
  return <article className={styles.decision}>
    {page && <>
      <header className={styles.header} lang="de">
        <p className={styles.citation}>{[page.metadata.form, page.metadata.date?.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3.$2.$1')].filter(Boolean).join(' · ')}</p>
        <h2>{courtLabel(page.metadata.court)} · {page.metadata.docket || page.metadata.document}</h2>
        {page.metadata.ecli && <p className={styles.citation}>{page.metadata.ecli}</p>}
        {source && <a href={source} className={styles.source} target="_blank" rel="noopener noreferrer">
          Rechtsprechung im Internet <ExternalLink aria-hidden="true" className="sntiq-inline-icon" />
        </a>}
      </header>
      {page.total === 0 && <p className={styles.missing}>{decisionCopy(i18n.language).missingText}</p>}
      {page.passages.map((passage, i) => <React.Fragment key={passage.anchor}>
        {passage.section !== page.passages[i - 1]?.section && <h3 lang="de" className="mt-5 mb-2 text-sm font-semibold">{sectionNames[passage.section] ?? passage.section}</h3>}
        <p lang="de" className={`${styles.text} mb-3`}>{passage.printed_number && <span className="mr-2 text-xs tabular-nums text-muted">Rn. {passage.printed_number}</span>}{passage.text}</p>
      </React.Fragment>)}
    </>}
    {(pending || failed) && <p role="status" className="my-3 text-sm text-muted">{failed ? copy.failed : copy.loading}</p>}
    {failed && <button type="button" className="sntiq-btn" onClick={() => {
      if (request.offset) setPage(null);
      setRequest({ offset: 0 });
    }}>{copy.retry}</button>}
    {!failed && page && page.passages.length < page.total && <button type="button" className="sntiq-btn" disabled={pending}
      onClick={() => setRequest({ offset: page.passages.length, revision: page.revision })}>{t('loadMore')}</button>}
  </article>;
}
