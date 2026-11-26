'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeftRight, ArrowUp, Loader2, RotateCcw } from 'lucide-react';
import { kerfActMarkdown, type KerfActArchive } from './client';
import { readerEditionChoices, readerEditionCopy, readerEditionDate } from './readerEditions';
import { readerWorkbenchCopy } from './readerWorkbenchCopy';
import { readerCopy } from './readerI18n';
import { validReaderDate, type ReaderComparisonState } from './readerWorkspace';
import { comparisonChanges, comparisonReady, type ReaderChange } from './readerComparison';
import styles from './readerWorkbench.module.css';

export default function ReaderComparison({ actId, norm, at, archive, language, value, onChange }: {
  actId: string; norm: string | null; at?: string; archive: KerfActArchive; language: string;
  value?: ReaderComparisonState; onChange: (value: ReaderComparisonState) => void;
}) {
  const t = readerWorkbenchCopy(language);
  const reader = readerCopy(language);
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
  const options = choices.map(item => <option key={item.value} value={item.value} disabled={!item.available} title={item.detail}>{item.value === 'HEAD' ? readerEditionCopy(language).latestShort : readerEditionDate(item.value, language)}</option>);
  const dates = baseChoices.filter(item => item.value !== 'HEAD').map(item => item.value).sort();
  const from = choices.some(item => item.value === value?.from) ? value!.from : dates[0] ?? 'HEAD';
  const to = choices.some(item => item.value === (value?.to ?? at)) ? (value?.to ?? at)! : 'HEAD';
  const split = value?.split ?? false;
  const available = Boolean(choices.find(item => item.value === from)?.available && choices.find(item => item.value === to)?.available);
  const change = (patch: Partial<ReaderComparisonState>) => onChange({ from, to, split, ...patch });
  const [result, setResult] = useState<ReaderChange[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [active, setActive] = useState(0);
  const [limit, setLimit] = useState(24);
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    setResult(null); setError(false); setActive(0); setLimit(24);
    if (!available) { setError(true); return () => controller.abort(); }
    const load = async () => {
      const before = await kerfActMarkdown(actId, { at: from, norm: norm ?? undefined }, controller.signal);
      const after = from === to ? before : await kerfActMarkdown(actId, { at: to, norm: norm ?? undefined }, controller.signal);
      if (!comparisonReady(before) || !comparisonReady(after)) throw new Error('Incomplete edition');
      if (!controller.signal.aborted) setResult(comparisonChanges(before.markdown, after.markdown));
    };
    void load().catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [actId, norm, from, to, attempt, available]);
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
      {error ? <div role="alert"><p>{t.unavailable}</p><button className={styles.command} aria-label={reader.retry} onClick={() => setAttempt(value => value + 1)}><RotateCcw size={16} /></button></div>
        : !result ? <Loader2 className="animate-spin" role="status" aria-label={reader.loading} size={20} />
        : result.length === 0 ? <p>{t.noChanges}</p>
        : result.slice(0, limit).map((change, index) => <section key={change.id} className={styles.change} data-reader-change data-selected={active === index}>
          <h3>{change.label}</h3>
          {split ? <div className={styles.splitDiff}>
            <div aria-label={t.from}>{change.parts.filter(part => !part.added).map((part, i) => part.removed ? <del key={i}>{part.value}</del> : <span key={i}>{part.value}</span>)}</div>
            <div aria-label={t.to}>{change.parts.filter(part => !part.removed).map((part, i) => part.added ? <ins key={i}>{part.value}</ins> : <span key={i}>{part.value}</span>)}</div>
          </div> : <div className={styles.inlineDiff}>{change.parts.map((part, i) => part.added ? <ins key={i}>{part.value}</ins> : part.removed ? <del key={i}>{part.value}</del> : <span key={i}>{part.value}</span>)}</div>}
        </section>)}
      {result && result.length > limit && <button className={styles.command} onClick={() => setLimit(value => value + 24)}>{t.more}</button>}
    </div>
  </div>;
}
