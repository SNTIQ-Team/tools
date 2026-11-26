'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeftRight, ArrowUp } from 'lucide-react';
import { kerfActMarkdown, type KerfActArchive } from './client';
import { readerEditionChoices, readerEditionCopy, readerEditionDate } from './readerEditions';
import { readerWorkbenchCopy } from './readerWorkbenchCopy';
import { changeHistoryCopy } from './changeHistoryFormat';
import LoadStatus from './LoadStatus';
import { toKerfRequestError, type KerfRequestError } from './kerfRequest';
import { validReaderDate, type ReaderComparisonState } from './readerWorkspace';
import { comparisonChanges, comparisonReady, type ReaderChange } from './readerComparison';
import styles from './readerWorkbench.module.css';

export default function ReaderComparison({ actId, norm, at, archive, language, value, onChange }: {
  actId: string; norm: string | null; at?: string; archive: KerfActArchive; language: string;
  value?: ReaderComparisonState; onChange: (value: ReaderComparisonState) => void;
}) {
  const t = readerWorkbenchCopy(language);
  const baseChoices = useMemo(() => readerEditionChoices(archive, language).filter(item => item.available), [archive, language]);
  const choices = useMemo(() => {
    const choices = [...baseChoices];
    // A share link can request a day within an interval or a repeated capture
    // omitted from the compact menu. Never silently substitute another body.
    for (const date of [value?.from, value?.to, at]) {
      if (!validReaderDate(date) || choices.some(item => item.value === date)) continue;
      choices.push({ value: date, label: readerEditionDate(date, language), detail: readerEditionCopy(language).unknown,
        group: 'observed', future: false, available: date <= (archive.head_date || new Date().toISOString().slice(0, 10)) });
    }
    return choices;
  }, [baseChoices, value?.from, value?.to, at, archive.head_date, language]);
  const copy = readerEditionCopy(language);
  const options = (['latest', 'legal', 'observed'] as const).map(group => {
    const items = choices.filter(item => item.group === group);
    if (!items.length) return null;
    return <optgroup key={group} label={copy[group]}>{items.map(item =>
      <option key={item.value} value={item.value} disabled={!item.available} title={item.detail}>{item.value === 'HEAD' ? copy.latestShort : readerEditionDate(item.value, language)}</option>)}</optgroup>;
  });
  const dates = baseChoices.filter(item => item.value !== 'HEAD').map(item => item.value).sort();
  const to = choices.some(item => item.value === (value?.to ?? at)) ? (value?.to ?? at)! : 'HEAD';
  const anchor = to === 'HEAD' ? archive.head_date : to;
  const previous = dates.filter(date => !anchor || date < anchor).at(-1);
  const from = value?.from ?? previous ?? (to === 'HEAD' ? dates.at(-1) ?? 'HEAD' : 'HEAD');
  const split = value?.split ?? false;
  const available = Boolean(choices.find(item => item.value === from)?.available && choices.find(item => item.value === to)?.available);
  const change = (patch: Partial<ReaderComparisonState>) => onChange({ from, to, split, ...patch });
  const [response, setResponse] = useState<{ key: string; changes?: ReaderChange[]; error?: KerfRequestError; incomplete?: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [active, setActive] = useState(0);
  const [limit, setLimit] = useState(24);
  const viewport = useRef<HTMLDivElement>(null);
  const key = JSON.stringify([actId, norm, from, to, attempt]);
  const current = response?.key === key ? response : null;
  const result = current?.changes;
  const same = from === to;
  useEffect(() => {
    const controller = new AbortController();
    setActive(0); setLimit(24);
    if (!available || same) return;
    const load = async () => {
      const [before, after] = await Promise.all([from, to].map(at => kerfActMarkdown(actId, { at, norm: norm ?? undefined }, controller.signal)));
      if (controller.signal.aborted) return;
      setResponse(comparisonReady(before) && comparisonReady(after)
        ? { key, changes: comparisonChanges(before.markdown, after.markdown) } : { key, incomplete: true });
    };
    void load().catch(error => { if (!controller.signal.aborted) setResponse({ key, error: toKerfRequestError(error) }); });
    return () => controller.abort();
  }, [actId, norm, from, to, key, available, same]);
  useEffect(() => { viewport.current?.querySelectorAll('[data-reader-change]')[active]?.scrollIntoView({ block: 'start' }); }, [active]);
  const move = (step: number) => { if (result?.length) { const next = (active + step + result.length) % result.length; setLimit(value => Math.max(value, next + 1)); setActive(next); } };
  return <div className={styles.comparison} data-reader-comparison>
    <div className={styles.compareTools}>
      <label>{t.from}<select className="sntiq-field sntiq-field-sm mt-1" aria-label={t.from} title={choices.find(item => item.value === from)?.detail} value={from} onChange={event => change({ from: event.target.value })}>{options}</select></label>
      <button title={t.swap} aria-label={t.swap} onClick={() => change({ from: to, to: from })}><ArrowLeftRight size={16} /></button>
      <label>{t.to}<select className="sntiq-field sntiq-field-sm mt-1" aria-label={t.to} title={choices.find(item => item.value === to)?.detail} value={to} onChange={event => change({ to: event.target.value })}>{options}</select></label>
    </div>
    <div className={styles.compareModes}>
      <button aria-label={t.inline} title={t.inline} aria-pressed={!split} onClick={() => change({ split: false })}>{t.inline}</button>
      <button aria-label={t.sideBySide} title={t.sideBySide} aria-pressed={split} onClick={() => change({ split: true })}>{t.sideBySide}</button>
      <span>{result ? `${result.length ? active + 1 : 0} / ${result.length}` : ''}</span>
      <button aria-label={t.previousChange} title={t.previousChange} disabled={!result?.length} onClick={() => move(-1)}><ArrowUp size={16} /></button>
      <button aria-label={t.nextChange} title={t.nextChange} disabled={!result?.length} onClick={() => move(1)}><ArrowDown size={16} /></button>
    </div>
    <div className={styles.compareScroll} ref={viewport}>
      {!available || current?.incomplete ? <p role="status">{t.unavailable}</p>
        : same ? <p role="status">{choices.length > 1 ? changeHistoryCopy(language).sameVersion : t.unavailable}</p>
        : !result ? <LoadStatus compact loading={!current} error={current?.error} language={language} resetKey={key} onRetry={() => setAttempt(value => value + 1)} />
        : result.length === 0 ? <p role="status">{t.noChanges}</p>
        : result.slice(0, limit).map((change, index) => <section key={change.id} className={styles.change} data-reader-change data-selected={active === index}>
          <h3>{change.label}</h3>
          {split ? <div className={styles.splitDiff}>
            <div><small>{t.from}</small>{change.parts.filter(part => !part.added).map((part, i) => part.removed ? <del key={i}>{part.value}</del> : <span key={i}>{part.value}</span>)}</div>
            <div><small>{t.to}</small>{change.parts.filter(part => !part.removed).map((part, i) => part.added ? <ins key={i}>{part.value}</ins> : <span key={i}>{part.value}</span>)}</div>
          </div> : <div className={styles.inlineDiff}>{change.parts.map((part, i) => part.added ? <ins key={i}>{part.value}</ins> : part.removed ? <del key={i}>{part.value}</del> : <span key={i}>{part.value}</span>)}</div>}
        </section>)}
      {result && result.length > limit && <button className={styles.command} onClick={() => setLimit(value => value + 24)}>{t.more}</button>}
    </div>
  </div>;
}
