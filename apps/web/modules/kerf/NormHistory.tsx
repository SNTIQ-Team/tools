'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeftRight, BookOpenText, ExternalLink, GitCommitHorizontal, GitCompareArrows } from 'lucide-react';
import {
  kerfNormAt, kerfNormBlame, kerfNormChanges, kerfNormDiff, kerfNormLog, kerfNormMaterials, kerfResolveNorm, validityKind, versionSelector,
  type KerfChanges, type KerfEnvelope, type KerfMaterialFragment, type KerfNormAt, type KerfNormBlame, type KerfNormDiff, type KerfNormLog, type KerfNormMaterials, type KerfNormVersion,
} from './normHistoryClient';
import { amendmentLine, diffSummary, legalDate, normHistoryCopy, statusIsFailure, validityLine } from './normHistoryFormat';
import { actChangeSummaryFrom, attestationSummary, legacyNormChanges, normChangeSummary, normalizeChangeRecord, versionRole, type SourceRole } from './changeHistory';
import { changeHistoryCopy, completenessLabel, fill, roleLine } from './changeHistoryFormat';
import { ActChangeHistory, ActVersionList, ChangeBrief, ChangeSummaryBlock, NormChangeList, changeRecords } from './ChangeHistoryViews';
import NormVersionText from './NormVersionText';
import { berlinToday } from './kerfLabels';
import { useReaderAct } from './readerResources';
import { readerLawLabel } from './readerLabels';
import styles from './normHistory.module.css';
import LoadStatus from './LoadStatus';
import { toKerfRequestError, type KerfRequestError } from './kerfRequest';

export type NormHistoryMode = 'log' | 'text' | 'diff' | 'changes' | 'blame';
type Mode = NormHistoryMode;
type Load<T> = { data: T | null; error: KerfRequestError | null; loading: boolean };
type Pair = { from: string; to: string };

const safeUrl = (value?: string | null) => {
  try { const url = new URL(value ?? ''); return url.protocol === 'https:' ? url.href : undefined; } catch { return undefined; }
};

function useEnvelope<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>, attempt: number): Load<T> {
  const [state, setState] = useState<Load<T>>({ data: null, error: null, loading: Boolean(key) });
  useEffect(() => {
    if (!key) { setState({ data: null, error: null, loading: false }); return; }
    const controller = new AbortController();
    setState({ data: null, error: null, loading: true });
    load(controller.signal)
      .then(data => { if (!controller.signal.aborted) setState({ data, error: null, loading: false }); })
      .catch(error => { if (!controller.signal.aborted) setState({ data: null, error: toKerfRequestError(error), loading: false }); });
    return () => controller.abort();
    // `load` is recreated per render; the key captures its inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);
  return state;
}

function Notice({ envelope, language, localWarning }: { envelope: KerfEnvelope; language: string; localWarning?: string }) {
  const c = normHistoryCopy(language);
  const failed = envelope.searched.filter(row => row.status !== 'ok');
  // A localized summary replaces the API's (English) warning text when the
  // caller has one; failures always show the API's own explanation.
  const warnings = localWarning && envelope.status === 'ok' ? [localWarning] : envelope.warnings;
  if (envelope.status === 'ok' && !warnings.length) return null;
  return <div className={styles.notice} data-status={envelope.status} role={statusIsFailure(envelope.status) ? 'alert' : 'status'}>
    <AlertTriangle size={14} />
    <div>
      <strong>{envelope.status === 'ok' ? c.note : c.statuses[envelope.status] ?? envelope.status}</strong>
      {envelope.error?.message && <p>{envelope.error.message}</p>}
      {warnings.filter(text => text !== envelope.error?.message).map(text => <p key={text}>{text}</p>)}
      {failed.map(row => <p key={row.source}>{row.source}: {c.statuses[row.status as keyof typeof c.statuses] ?? row.status}</p>)}
    </div>
  </div>;
}

/** Newest-first list → the version in force today (not a future one). */
export const isFutureVersion = (version: KerfNormVersion, today = berlinToday()) => version.future === true
  || version.temporal.attribution?.status === 'future_version_reconstructed'
  || Boolean(version.temporal.valid_from && validityKind(version.temporal) !== 'unresolved' && version.temporal.valid_from > today);

export function currentVersion(newestFirst: readonly KerfNormVersion[], today = berlinToday()): KerfNormVersion | null {
  // A future (not yet in force) version is never the current one.
  return newestFirst.find(version => !isFutureVersion(version, today)) ?? null;
}

/** Date selector for `/at` when the API cannot select by version id. */
export function versionDate(version: KerfNormVersion, today = berlinToday()): string {
  const temporal = version.temporal;
  if (temporal.valid_from && validityKind(temporal) !== 'unresolved') return temporal.valid_from.slice(0, 10);
  return (temporal.known_at ?? temporal.observed_from ?? version.source.observed_at ?? today).slice(0, 10);
}

const knownAt = (version: KerfNormVersion) => version.temporal.known_at
  ?? version.attestations?.map(attestationSummary).find(row => row.from)?.from ?? version.temporal.observed_from ?? version.source.observed_at ?? null;
const completenessOf = (version: KerfNormVersion) => version.completeness?.status ?? (version.quality.complete === false ? 'partial' : null);

/** Role, completeness and verification of a version — reconstruction and
 * archived copies are always labelled, and a capture date is never a legal date. */
function VersionProvenance({ version, language }: { version: KerfNormVersion; language: string }) {
  const ch = changeHistoryCopy(language);
  const role = versionRole(version);
  const complete = completenessOf(version);
  const cross = version.verification?.cross_source;
  return <div className={styles.provenanceLine} data-role={role}>
    <span className={styles.roleBadge} data-role={role}>{roleLine(role, language, role === 'archived_capture' ? knownAt(version) : null)}</span>
    {complete && complete !== 'complete' && <span className={styles.completeBadge} data-status={complete}>{completenessLabel(complete, language)}{version.completeness?.reason ? ` — ${version.completeness.reason}` : ''}</span>}
    {cross && <small>{ch.crossSource[cross] ?? cross}</small>}
    {version.temporal.attribution?.status && <small data-attribution={version.temporal.attribution.status}>{ch.attribution[version.temporal.attribution.status] ?? version.temporal.attribution.status}</small>}
  </div>;
}

function VersionCard({ version, previous, isCurrent, language, onShowText, onComparePrevious, onCompareCurrent }: {
  version: KerfNormVersion; previous?: KerfNormVersion; isCurrent: boolean; language: string;
  onShowText: () => void; onComparePrevious: () => void; onCompareCurrent?: () => void;
}) {
  const c = normHistoryCopy(language);
  const ch = changeHistoryCopy(language);
  const role = versionRole(version);
  const validity = validityLine(version.temporal, language);
  const amendment = amendmentLine(version.amendment, language);
  const amendmentUrl = safeUrl(version.amendment?.url);
  const normUrl = safeUrl(version.source.norm_url);
  const change = version.change ? normalizeChangeRecord(version.change) : null;
  const attestations = (version.attestations ?? []).map(attestationSummary);
  return <article className={styles.version} data-version={version.version_id} data-future={validity.future} data-role={role} data-current={isCurrent}>
    <header>
      <GitCommitHorizontal size={15} />
      <strong>{validity.label}</strong>
      {validity.future && <span className={styles.badge}>{c.future}</span>}
      {isCurrent && <span className={styles.currentBadge}>{ch.current}</span>}
    </header>
    <VersionProvenance version={version} language={language} />
    {isFutureVersion(version) && version.temporal.valid_from && <p className={styles.futureNote} data-future-version>{fill(ch.futureVersion, { date: legalDate(version.temporal.valid_from, language) })}</p>}
    {/* An archived capture's date is when the copy was taken, not a legal date. */}
    {role === 'archived_capture' ? null : validity.basis && <small>{validity.basis}</small>}
    {version.temporal.valid_until_exclusive && <small>{c.until} {legalDate(version.temporal.valid_until_exclusive, language)}</small>}
    {role !== 'archived_capture' && version.temporal.valid_from && version.temporal.observed_from && <small>{c.observed} {legalDate(version.temporal.observed_from, language)} ({c.observedNote})</small>}
    {change ? <p>{ch.officialAct}: <ChangeBrief change={change} language={language} /></p>
      : amendment && <p>{c.amendedBy}: {amendmentUrl ? <a href={amendmentUrl} target="_blank" rel="noopener noreferrer">{amendment.text} <ExternalLink size={11} /></a> : amendment.text}{amendment.note && <small> — {amendment.note}</small>}</p>}
    {attestations.length > 0 && <details className={styles.attestations}>
      <summary>{ch.attestations} ({attestations.length})</summary>
      <ul>{attestations.map((row, index) => <li key={`${row.source}:${index}`}>
        <strong>{row.source}</strong>{row.role ? ` · ${ch.rolesShort[row.role as SourceRole]}` : ''}
        {row.from && ` · ${legalDate(row.from, language)}${row.until && row.until !== row.from ? `–${legalDate(row.until, language)}` : ''}`}
        {row.count ? ` · ${row.count}×` : ''}
        {safeUrl(row.archiveUrl) && <> · <a href={safeUrl(row.archiveUrl)} target="_blank" rel="noopener noreferrer">{ch.rolesShort.archived_capture} <ExternalLink size={10} /></a></>}
        {safeUrl(row.url) && !row.archiveUrl && <> · <a href={safeUrl(row.url)} target="_blank" rel="noopener noreferrer">URL <ExternalLink size={10} /></a></>}
      </li>)}</ul>
    </details>}
    <footer>
      <code title={version.version_id}>#{version.content_hash.value.slice(0, 12)}</code>
      {normUrl && <a href={normUrl} target="_blank" rel="noopener noreferrer">{c.officialNorm} <ExternalLink size={11} /></a>}
      {safeUrl(version.source.archive_url) && <a href={safeUrl(version.source.archive_url)} target="_blank" rel="noopener noreferrer">{ch.rolesShort.archived_capture} <ExternalLink size={11} /></a>}
      <button type="button" onClick={onShowText} data-version-action="text"><BookOpenText size={13} />{ch.showText}</button>
      {previous && <button type="button" onClick={onComparePrevious} data-version-action="previous"><GitCompareArrows size={13} />{ch.compareBefore}</button>}
      {onCompareCurrent && <button type="button" onClick={onCompareCurrent} data-version-action="current"><GitCompareArrows size={13} />{ch.compareCurrent}</button>}
    </footer>
  </article>;
}

export const versionOptionLabel = (version: KerfNormVersion, current: KerfNormVersion | null, language: string) => {
  const ch = changeHistoryCopy(language);
  const role = versionRole(version);
  const date = validityKind(version.temporal) === 'unresolved'
    ? legalDate(knownAt(version), language)
    : validityLine(version.temporal, language).label;
  return `${date} · ${ch.rolesShort[role]} · #${version.content_hash.value.slice(0, 8)}${version.version_id === current?.version_id ? ` · ${ch.current}` : ''}`;
};

function VersionPicker({ label, value, versions, current, language, onChange }: { label: string; value: string; versions: KerfNormVersion[]; current: KerfNormVersion | null; language: string; onChange: (value: string) => void }) {
  return <label>{label}<select className="sntiq-field sntiq-field-sm mt-1" value={value} onChange={event => onChange(event.target.value)}>
    {versions.map(version => <option key={version.version_id} value={versionSelector(version)}>{versionOptionLabel(version, current, language)}</option>)}
    {!versions.some(version => versionSelector(version) === value) && <option value={value}>{value}</option>}
  </select></label>;
}

function TextView({ canonicalId, versions, current, selected, onSelect, language, attempt, onRetry, bavarian }: {
  canonicalId: string; versions: KerfNormVersion[]; current: KerfNormVersion | null; selected: string | null; onSelect: (id: string) => void;
  language: string; attempt: number; onRetry: () => void; bavarian: boolean;
}) {
  const c = normHistoryCopy(language);
  const ch = changeHistoryCopy(language);
  const version = versions.find(item => item.version_id === selected) ?? current ?? versions[0];
  const at = useEnvelope<KerfNormAt & { selectedBy: 'version' | 'date' }>(version ? `${canonicalId}|${version.version_id}` : null,
    signal => kerfNormAt(canonicalId, { version: version!.version_id, date: versionDate(version!) }, signal), attempt);
  if (!version) return <p>{c.noVersions}</p>;
  const got = at.data?.evidence?.[0];
  const mismatch = got && got.version_id !== version.version_id && got.content_hash.value !== version.content_hash.value;
  const shown = got ?? version;
  const role = versionRole(shown);
  const complete = completenessOf(shown);
  const validity = validityLine(shown.temporal, language);
  return <div className={styles.textView} data-version-view={version.version_id}>
    <div className={styles.pickers}>
      <VersionPicker label={ch.chooseVersion} value={versionSelector(version)} versions={versions} current={current} language={language} onChange={onSelect} />
    </div>
    <VersionProvenance version={shown} language={language} />
    <p className={styles.muted}>{validity.label}{role !== 'archived_capture' && validity.basis ? ` — ${validity.basis}` : ''}</p>
    {role === 'reconstruction' && <p className={styles.notice} data-status="temporally_unresolved" role="note"><AlertTriangle size={14} /><span>{ch.reconstructionWarning}</span></p>}
    {complete === 'partial' && <p className={styles.notice} data-status="temporally_unresolved" role="note"><AlertTriangle size={14} /><span>{ch.partialWarning}{shown.completeness?.reason ? `: ${shown.completeness.reason}` : ''}</span></p>}
    {complete === 'unavailable' && <p className={styles.notice} data-status="unavailable" role="note"><AlertTriangle size={14} /><span>{ch.unavailableWarning}</span></p>}
    <LoadStatus compact loading={at.loading} error={at.error} language={language} title={ch.textUnavailable} onRetry={onRetry} resetKey={version.version_id} />
    {at.data && <Notice envelope={at.data} language={language} />}
    {mismatch && <p className={styles.notice} data-status="temporally_unresolved" role="note" data-version-mismatch><AlertTriangle size={14} />
      <span>{fill(ch.mismatch, { got: got!.content_hash.value.slice(0, 8), want: version.content_hash.value.slice(0, 8) })}</span></p>}
    {at.data && !got?.text && <p className={styles.muted}>{ch.textUnavailable}</p>}
    {got?.text && <div className={styles.versionText}><h3>{got.pinpoint.label}{got.pinpoint.title ? ` · ${got.pinpoint.title}` : ''}</h3>
      <NormVersionText text={got.text} structure={got.structure} bavarian={bavarian} fallbackNote={ch.structureFallback} /></div>}
  </div>;
}

function DiffView({ canonicalId, versions, current, pair, setPair, language, attempt, onRetry }: {
  canonicalId: string; versions: KerfNormVersion[]; current: KerfNormVersion | null; pair: Pair; setPair: (pair: Pair) => void;
  language: string; attempt: number; onRetry: () => void;
}) {
  const c = normHistoryCopy(language);
  const ch = changeHistoryCopy(language);
  const same = pair.from === pair.to;
  const diff = useEnvelope<KerfNormDiff>(same ? null : `${canonicalId}|${pair.from}|${pair.to}`, signal => kerfNormDiff(canonicalId, pair.from, pair.to, signal), attempt);
  const summary = useMemo(() => diffSummary(diff.data?.changes ?? []), [diff.data]);
  const side = (selector: string) => versions.find(version => versionSelector(version) === selector || version.version_id === selector);
  const from = side(pair.from), to = side(pair.to);
  return <div className={styles.diff}>
    <div className={styles.pickers}>
      <VersionPicker label={c.from} value={pair.from} versions={versions} current={current} language={language} onChange={value => setPair({ ...pair, from: value })} />
      <button type="button" className={styles.swap} title={ch.swap} aria-label={ch.swap} onClick={() => setPair({ from: pair.to, to: pair.from })}><ArrowLeftRight size={14} /></button>
      <VersionPicker label={c.to} value={pair.to} versions={versions} current={current} language={language} onChange={value => setPair({ ...pair, to: value })} />
    </div>
    {current && pair.to !== versionSelector(current) && <button type="button" className={styles.more} onClick={() => setPair({ ...pair, to: versionSelector(current) })}>{ch.compareCurrent}</button>}
    <div className={styles.sides}>
      {from && <div><small>{c.from}</small><VersionProvenance version={from} language={language} /></div>}
      {to && <div><small>{c.to}</small><VersionProvenance version={to} language={language} /></div>}
    </div>
    {[from, to].some(version => version && versionRole(version) === 'reconstruction') && <p className={styles.notice} data-status="temporally_unresolved" role="note"><AlertTriangle size={14} /><span>{ch.reconstructionWarning}</span></p>}
    {[from, to].some(version => version && completenessOf(version) === 'partial') && <p className={styles.notice} data-status="temporally_unresolved" role="note"><AlertTriangle size={14} /><span>{ch.partialWarning}</span></p>}
    {same && <p className={styles.muted}>{ch.sameVersion}</p>}
    <LoadStatus compact loading={diff.loading} error={diff.error} language={language} title={c.statuses.unavailable} onRetry={onRetry} resetKey={`${pair.from}|${pair.to}`} />
    {diff.data && <>
      <Notice envelope={diff.data} language={language} />
      {diff.data.identical && <p>{c.identical}</p>}
      {diff.data.title_change && <div className={styles.change}><h4>—</h4><p><del>{diff.data.title_change.old}</del> <ins>{diff.data.title_change.new}</ins></p></div>}
      {summary.changes.map((op, index) => <div key={index} className={styles.change} data-op={op.op}>
        <h4>{op.op === 'insert' ? `+ ${op.new?.label}` : op.op === 'delete' ? `− ${op.old?.label}` : op.old?.label === op.new?.label ? op.new?.label : `${op.old?.label} → ${op.new?.label}`}</h4>
        {op.op === 'replace' && <p>{op.words?.length ? op.words.map((word, wordIndex) => word.op === 'equal' ? <span key={wordIndex}>{word.text} </span> : word.op === 'insert' ? <ins key={wordIndex}>{word.text} </ins> : <del key={wordIndex}>{word.text} </del>)
          : <><del>{op.old_text}</del> <ins>{op.new_text}</ins></>}</p>}
        {op.op === 'insert' && <p><ins>{op.new_text}</ins></p>}
        {op.op === 'delete' && <p><del>{op.old_text}</del></p>}
        {op.op === 'moved' && <p><small>{c.moved}</small> {op.text}</p>}
      </div>)}
      {summary.unchanged > 0 && <p className={styles.muted}>{summary.unchanged} {c.unchanged}</p>}
    </>}
  </div>;
}

function BlameView({ canonicalId, language, attempt, onRetry }: { canonicalId: string; language: string; attempt: number; onRetry: () => void }) {
  const c = normHistoryCopy(language);
  const blame = useEnvelope<KerfNormBlame>(canonicalId, signal => kerfNormBlame(canonicalId, signal), attempt);
  if (blame.loading || blame.error || !blame.data) return <LoadStatus compact loading={blame.loading} error={blame.error} language={language} title={c.statuses.unavailable} onRetry={onRetry} resetKey={canonicalId} />;
  const summary = blame.data.summary;
  const local = summary && summary.predates_text_history > 0
    ? c.predatesSummary.replace('{n}', String(summary.predates_text_history)).replace('{total}', String(summary.sentences))
    : undefined;
  return <div className={styles.blame}>
    <Notice envelope={blame.data} language={language} localWarning={local} />
    {(blame.data.lines ?? []).map(line => {
      const by = line.introduced_by;
      const amendment = amendmentLine(by?.amendment, language);
      return <div key={line.locator} className={styles.blameRow} data-status={line.status}>
        <div className={styles.blameMeta}>
          <strong>{line.label}</strong>
          {by ? <>
            <span>{c.introducedBy}: {by.valid_from ? legalDate(by.valid_from, language) : `${c.unresolved} (${c.observed} ${legalDate(by.observed_from, language)})`}</span>
            {amendment && <span>{amendment.text}</span>}
          </> : <span>{c.predates}{line.present_since?.observed_from ? ` (${c.historyStart} ${legalDate(line.present_since.observed_from, language)})` : ''}</span>}
          {line.candidates.length > 0 && <span className={styles.muted}>{c.candidates}: {line.candidates.map(item => item.reference ?? item.document_id).join(', ')}</span>}
        </div>
        <p>{line.text}</p>
      </div>;
    })}
  </div>;
}

function MaterialList({ title, rows, language }: { title: string; rows: KerfMaterialFragment[]; language: string }) {
  const c = normHistoryCopy(language);
  const [open, setOpen] = useState(false);
  if (!rows.length) return null;
  const shown = open ? rows : rows.slice(0, 5);
  return <div className={styles.materialGroup}>
    <h4>{title} ({rows.length})</h4>
    {shown.map(row => {
      const url = safeUrl(row.source.url);
      return <article key={row.id} className={styles.event}>
        <strong>{c.roles[row.role] ?? row.role} · BT-Drs. {row.pinpoint.drucksache}, {c.page} {row.pinpoint.printed_page ?? row.pinpoint.pdf_page}</strong>
        <small>{row.heading}{row.government_position ? ` — ${c.positions[row.government_position] ?? row.government_position}` : ''}</small>
        <p>{row.text.length > 420 ? `${row.text.slice(0, 420)}…` : row.text}</p>
        {url && <a href={url} target="_blank" rel="noopener noreferrer">PDF <ExternalLink size={11} /></a>}
      </article>;
    })}
    {rows.length > 5 && <button type="button" className={styles.more} onClick={() => setOpen(value => !value)}>{open ? '−' : `+${rows.length - 5}`}</button>}
  </div>;
}

function MaterialsSection({ canonicalId, language, attempt }: { canonicalId: string; language: string; attempt: number }) {
  const c = normHistoryCopy(language);
  const materials = useEnvelope<KerfNormMaterials>(canonicalId, signal => kerfNormMaterials(canonicalId, signal), attempt);
  if (materials.loading || materials.error || !materials.data) return null;
  const data = materials.data;
  // Not deployed / not in corpus: say so once, quietly; never render "0 materials".
  if (statusIsFailure(data.status)) return <section className={styles.events}><h3>{c.materials}</h3><Notice envelope={data} language={language} /></section>;
  if (!data.explains?.length && !data.mentions?.length) return null;
  return <section className={styles.events}>
    <h3>{c.materials}</h3>
    <p className={styles.muted}>{c.materialsNote}</p>
    <MaterialList title={c.explains} rows={data.explains ?? []} language={language} />
    <MaterialList title={c.mentions} rows={data.mentions ?? []} language={language} />
  </section>;
}

function ChangesView({ canonicalId, log, versionsOldestFirst, language, attempt, onRetry, onShowDiff }: {
  canonicalId: string; log: KerfNormLog; versionsOldestFirst: KerfNormVersion[]; language: string; attempt: number; onRetry: () => void; onShowDiff: (pair: Pair) => void;
}) {
  const ch = changeHistoryCopy(language);
  const changes = useEnvelope<KerfChanges>(canonicalId, signal => kerfNormChanges(canonicalId, { limit: 500 }, signal), attempt);
  // The deployed API has no /changes route yet: derive from the log's events.
  if (changes.error?.kind === 'not_found') return <NormChangeList changes={legacyNormChanges(log, berlinToday())} language={language} legacy onShowDiff={onShowDiff} versionsOldestFirst={versionsOldestFirst} />;
  if (changes.loading || changes.error || !changes.data) return <LoadStatus compact loading={changes.loading} error={changes.error} language={language} title={ch.changes} onRetry={onRetry} resetKey={canonicalId} />;
  return <>
    <Notice envelope={changes.data} language={language} />
    <NormChangeList changes={changeRecords(changes.data)} language={language} onShowDiff={onShowDiff} versionsOldestFirst={versionsOldestFirst} />
  </>;
}

function NormVersions({ actId, norm, language, initialMode }: { actId: string; norm: string; language: string; initialMode?: Mode }) {
  const c = normHistoryCopy(language);
  const ch = changeHistoryCopy(language);
  const [mode, setMode] = useState<Mode>(initialMode ?? 'log');
  const [attempt, setAttempt] = useState(0);
  const [pair, setPair] = useState<Pair | null>(null);
  const [textVersion, setTextVersion] = useState<string | null>(null);
  const retry = () => setAttempt(value => value + 1);
  const resolved = useEnvelope(`${actId}|${norm}`, signal => kerfResolveNorm(actId, norm, signal), attempt);
  const canonicalId = resolved.data?.status === 'ok' ? resolved.data.evidence[0]?.canonical_id ?? null : null;
  const log = useEnvelope<KerfNormLog>(canonicalId, signal => kerfNormLog(canonicalId ?? '', signal), attempt);
  const newestFirst = useMemo(() => log.data?.evidence ?? [], [log.data]);
  const oldestFirst = useMemo(() => [...newestFirst].reverse(), [newestFirst]);
  const today = berlinToday();
  const current = useMemo(() => currentVersion(newestFirst, today), [newestFirst, today]);
  const summary = useMemo(() => log.data ? normChangeSummary(log.data, today) : null, [log.data, today]);
  const defaultPair = useMemo<Pair | null>(() => {
    const anchor = current ?? newestFirst[0];
    if (!anchor) return null;
    const index = newestFirst.indexOf(anchor);
    const previous = newestFirst[index + 1] ?? newestFirst.find(version => version !== anchor);
    return { from: versionSelector(previous ?? anchor), to: versionSelector(anchor) };
  }, [current, newestFirst]);
  const activePair = pair ?? defaultPair;
  const compare = (from: KerfNormVersion, to: KerfNormVersion) => { setPair({ from: versionSelector(from), to: versionSelector(to) }); setMode('diff'); };
  const modes: { id: Mode; label: string; disabled?: boolean }[] = [
    { id: 'log', label: ch.versions },
    { id: 'text', label: ch.text, disabled: !newestFirst.length },
    { id: 'diff', label: ch.compare, disabled: !newestFirst.length },
    { id: 'changes', label: ch.changes, disabled: !log.data },
    { id: 'blame', label: c.blame, disabled: !newestFirst.length },
  ];
  return <div className={styles.root} data-norm-history={canonicalId ?? ''} data-mode={mode}>
    <div className={styles.heading}>
      <h2>{c.title} · {log.data?.norm?.label ?? norm}{log.data?.norm?.act?.jurabk ? ` ${readerLawLabel({ id: log.data.norm.act.id ?? actId, jurabk: log.data.norm.act.jurabk })}` : ''}</h2>
      {canonicalId && <code>{canonicalId}</code>}
    </div>
    <LoadStatus compact loading={resolved.loading || log.loading} error={resolved.error ?? log.error} language={language} title={c.statuses.unavailable} onRetry={retry} resetKey={`${actId}|${norm}`} />
    {resolved.data && resolved.data.status !== 'ok' && <Notice envelope={resolved.data} language={language} />}
    {summary && <ChangeSummaryBlock summary={summary} language={language} onOpenChanges={mode === 'changes' ? undefined : () => setMode('changes')} />}
    <div className={styles.modes} role="group" aria-label={c.title}>
      {modes.map(item => <button key={item.id} type="button" aria-pressed={mode === item.id} disabled={item.disabled} onClick={() => setMode(item.id)} data-norm-mode={item.id}>{item.label}</button>)}
    </div>
    {log.data && mode === 'log' && <>
      <Notice envelope={log.data} language={language} />
      {log.data.history && <p className={styles.muted}>{c.historyStart} {legalDate(log.data.history.text_history_start, language)} · {log.data.history.verified_legal_starts}/{log.data.history.consolidated_versions} {c.verifiedStarts}.</p>}
      {!newestFirst.length && <p>{c.noVersions}</p>}
      {newestFirst.map((version, index) => {
        const previous = newestFirst[index + 1];
        const isCurrent = version.version_id === current?.version_id;
        return <VersionCard key={version.version_id} version={version} previous={previous} isCurrent={isCurrent} language={language}
          onShowText={() => { setTextVersion(version.version_id); setMode('text'); }}
          onComparePrevious={() => { if (previous) compare(previous, version); }}
          onCompareCurrent={!isCurrent && current ? () => compare(version, current) : undefined} />;
      })}
      {canonicalId && <MaterialsSection canonicalId={canonicalId} language={language} attempt={attempt} />}
    </>}
    {canonicalId && mode === 'text' && <TextView canonicalId={canonicalId} versions={newestFirst} current={current} selected={textVersion} onSelect={value => setTextVersion(newestFirst.find(version => versionSelector(version) === value)?.version_id ?? value)}
      language={language} attempt={attempt} onRetry={retry} bavarian={actId.startsWith('by_')} />}
    {canonicalId && mode === 'diff' && activePair && <DiffView canonicalId={canonicalId} versions={newestFirst} current={current} pair={activePair} setPair={setPair} language={language} attempt={attempt} onRetry={retry} />}
    {canonicalId && log.data && mode === 'changes' && <ChangesView canonicalId={canonicalId} log={log.data} versionsOldestFirst={oldestFirst} language={language} attempt={attempt} onRetry={retry}
      onShowDiff={next => { setPair(next); setMode('diff'); }} />}
    {canonicalId && mode === 'blame' && <BlameView canonicalId={canonicalId} language={language} attempt={attempt} onRetry={retry} />}
  </div>;
}

/** Act level (no single provision open): change summary and the act's change history. */
function ActVersions({ actId, language, onOpenNorm }: { actId: string; language: string; onOpenNorm?: (norm: string) => void }) {
  const ch = changeHistoryCopy(language);
  const act = useReaderAct(actId);
  const [mode, setMode] = useState<'changes' | 'versions'>('changes');
  const fallback = useMemo(() => act.data ? actChangeSummaryFrom(act.data, berlinToday()) : null, [act.data]);
  return <div className={styles.root} data-norm-history="" data-act-versions={actId}>
    <div className={styles.heading}><h2>{ch.actHistory}{act.data ? ` · ${readerLawLabel(act.data)}` : ''}</h2></div>
    <div className={styles.modes} role="group" aria-label={ch.actHistory}>
      <button type="button" aria-pressed={mode === 'changes'} onClick={() => setMode('changes')} data-act-mode="changes">{ch.changes}</button>
      <button type="button" aria-pressed={mode === 'versions'} onClick={() => setMode('versions')} data-act-mode="versions">{ch.actVersions}</button>
    </div>
    {mode === 'changes' ? <ActChangeHistory actId={actId} language={language} onOpenNorm={onOpenNorm} fallbackSummary={fallback} /> : <ActVersionList actId={actId} language={language} />}
  </div>;
}

export default function NormHistory({ actId, norm, language, onOpenNorm, initialMode }: {
  actId: string; norm: string | null; language: string; onOpenNorm?: (norm: string) => void; initialMode?: Mode;
}) {
  return norm ? <NormVersions actId={actId} norm={norm} language={language} initialMode={initialMode} /> : <ActVersions actId={actId} language={language} onOpenNorm={onOpenNorm} />;
}
