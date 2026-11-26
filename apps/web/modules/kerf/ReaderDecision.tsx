'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, RotateCcw } from 'lucide-react';
import { kerfDecision, type KerfAct, type KerfDecision } from './client';
import ReaderText, { readerDocumentHref, type ReaderReference } from './ReaderText';
import { readerCopy, type ReaderCopy } from './readerI18n';
import { decisionCopy, decisionSections, decisionLawReferences, getReaderDecisionTitle, safeDecisionSource } from './readerDecision';
import styles from './readerDecision.module.css';
import RiiReaderDecision from './RiiReaderDecision';

export { getReaderDecisionTitle } from './readerDecision';

export type LoadedDecision = Pick<KerfDecision, 'id' | 'az' | 'court' | 'text'>;

export interface ReaderDecisionProps {
  decisionId: string;
  acts: KerfAct[];
  onReference: (reference: ReaderReference) => void;
  onOpenLaw?: (actId: string, norm: string | null) => void;
  onOpenDecision?: (decisionId: string) => void;
  onLoaded?: (decision: LoadedDecision) => void;
  t?: ReaderCopy;
}

export default function ReaderDecision(props: ReaderDecisionProps) {
  const match = /^rii:(jb-[A-Z0-9]{1,64})$/.exec(props.decisionId);
  if (match) return <RiiReaderDecision key={match[1]} documentId={match[1]} onLoaded={props.onLoaded} />;
  return <IndexedDecision {...props} />;
}

function IndexedDecision({ decisionId, acts, onReference, onOpenLaw, onOpenDecision, onLoaded, t }: ReaderDecisionProps) {
  const { i18n } = useTranslation();
  const common = t ?? readerCopy(i18n.language);
  const copy = decisionCopy(i18n.language);
  const [decision, setDecision] = useState<KerfDecision | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const loaded = useRef(onLoaded);
  const sectionPrefix = useId();
  loaded.current = onLoaded;

  useEffect(() => {
    const controller = new AbortController();
    setFailedId(null);
    setDecision(null);
    void kerfDecision(decisionId, controller.signal).then(value => {
      if (controller.signal.aborted) return;
      setDecision(value);
      loaded.current?.(value);
    }).catch(() => { if (!controller.signal.aborted) setFailedId(decisionId); });
    return () => controller.abort();
  }, [decisionId, attempt]);

  const current = decision?.id === decisionId ? decision : null;
  const sections = useMemo(() => current ? decisionSections(current, i18n.language) : [], [current, i18n.language]);
  const references = useMemo(() => current ? decisionLawReferences(current, acts) : [], [current, acts]);

  if (!current) return <div className={styles.state} role="status">
    {failedId === decisionId ? <>
      <p>{common.failed}</p>
      <button type="button" onClick={() => setAttempt(value => value + 1)}><RotateCcw size={15} />{common.retry}</button>
    </> : <p>{common.loading}</p>}
  </div>;

  const source = safeDecisionSource(current.url);
  const metadata = [
    [copy.court, current.court], [copy.reference, current.az], [copy.date, current.date],
    [copy.kind, current.kind], [copy.jurisdiction, current.juris], [copy.proc, current.proc],
    [copy.source, current.source],
  ].filter(([, value]) => value);
  const sectionLink = (id: string) => `${sectionPrefix}-${id}`;
  const renderText = (text: string) => <ReaderText text={text} actId={`decision:${current.id}`} acts={acts} norms={[]} citations={[]} onReference={onReference} />;
  const navigate = (event: React.MouseEvent<HTMLAnchorElement>, callback: () => void) => {
    if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) {
      event.preventDefault(); callback();
    }
  };
  const toc = [
    ...sections.map(section => ({ id: section.id, label: copy[section.id] })),
    ...(references.length ? [{ id: 'norms', label: copy.norms }] : []),
    ...(current.related?.length ? [{ id: 'related', label: copy.related }] : []),
  ];

  return <article className={styles.decision}>
    <header className={styles.header}>
      <p className={styles.citation}>{getReaderDecisionTitle(current)}</p>
      <h2>{current.title || getReaderDecisionTitle(current)}</h2>
      <dl className={styles.metadata}>{metadata.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      {source && <a className={styles.source} href={source} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} />{common.source}</a>}
    </header>

    {toc.length > 1 && <nav className={styles.contents} aria-label={common.contents}>{toc.map(section => <a key={section.id} href={`#${sectionLink(section.id)}`} onClick={event => {
      event.preventDefault();
      const element = document.getElementById(sectionLink(section.id));
      const viewport = element?.closest<HTMLElement>('[data-reader-scroll]');
      if (element && viewport) viewport.scrollTo({
        top: viewport.scrollTop + element.getBoundingClientRect().top - viewport.getBoundingClientRect().top - 18,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    }}>{section.label}</a>)}</nav>}

    {sections.map(section => <section key={section.id} id={sectionLink(section.id)} className={styles.section}>
      <h3>{copy[section.id]}</h3>
      {section.id === 'quote'
        ? <blockquote className={styles.text} lang={section.language}>{renderText(section.text)}</blockquote>
        : <div className={styles.text} lang={section.language}>{renderText(section.text)}</div>}
    </section>)}

    {!sections.some(section => section.id === 'text') && <p className={styles.missing}>{copy.missingText}</p>}

    {references.length > 0 && <section id={sectionLink('norms')} className={styles.section}>
      <h3>{copy.norms}</h3>
      <ul className={styles.references}>{references.map(reference => <li key={reference.url ?? `${reference.actId}:${reference.norm ?? ''}`}>
        {reference.kind === 'external' ? <a href={reference.url} target="_blank" rel="noopener noreferrer">{reference.label}</a>
          : <a href={readerDocumentHref(reference.actId!, reference.norm ?? null)} onClick={event => navigate(event, () => {
          if (onOpenLaw) onOpenLaw(reference.actId!, reference.norm ?? null);
          else onReference(reference);
        })}>{reference.label}</a>}
      </li>)}</ul>
    </section>}

    {current.related?.length > 0 && <section id={sectionLink('related')} className={styles.section}>
      <h3>{copy.related}</h3>
      <ul className={styles.related}>{current.related.map((related, index) => <li key={`${related.ref}:${index}`}>
        <a href={`/dt/kerf/entscheidungen/${encodeURIComponent(related.ref)}`} onClick={event => {
          if (onOpenDecision) navigate(event, () => onOpenDecision(related.ref));
        }}>{related.label || related.ref}</a>
      </li>)}</ul>
    </section>}
  </article>;
}
