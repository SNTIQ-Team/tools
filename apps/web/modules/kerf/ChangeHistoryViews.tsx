'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, ExternalLink, FileText, GitCompareArrows, Plus } from 'lucide-react';
import {
  changeCitation, changeDiffPair, normalizeActChangeGroup, normalizeChangeRecord, normalizeChangeSummary, sortChanges,
  summaryHasContent, type KerfActChangeGroup, type KerfChangeRecord, type KerfChangeSummary, type SourceRole, isSourceRole,
} from './changeHistory';
import { changeDateRows, changeHistoryCopy, changeStateLine, changeTypeLabel, fill, historyDate } from './changeHistoryFormat';
import { kerfActChanges, kerfActVersions, type KerfActVersions, type KerfChanges } from './normHistoryClient';
import { berlinToday } from './kerfLabels';
import LoadStatus from './LoadStatus';
import { toKerfRequestError, type KerfRequestError } from './kerfRequest';
import styles from './normHistory.module.css';

const safeUrl = (value?: string | null) => {
  try { const url = new URL(value ?? ''); return url.protocol === 'https:' ? url.href : undefined; } catch { return undefined; }
};

/** Amending act as a citation, linked to its official publication when safe. */
function AmendingAct({ change }: { change: Pick<KerfChangeRecord, 'amending_act'> }) {
  const citation = changeCitation(change.amending_act);
  const url = safeUrl(change.amending_act?.url);
  if (!citation) return null;
  return <span className={styles.citation}>{url ? <a href={url} target="_blank" rel="noopener noreferrer">{citation} <ExternalLink size={11} /></a> : citation}</span>;
}

/** Compact one-change line used in summaries and tiles. */
export function ChangeBrief({ change, language, today = berlinToday(), hideNorm = false }: { change: KerfChangeRecord; language: string; today?: string; hideNorm?: boolean }) {
  const c = changeHistoryCopy(language);
  const state = changeStateLine(change, language, today);
  const inForce = change.dates.in_force;
  return <span className={styles.brief} data-state={state.state}>
    <AmendingAct change={change} />
    {change.norm_label && !hideNorm && <span className={styles.chamferNorm}>{change.norm_label}</span>}
    <span>{changeTypeLabel(change.change_type, language)}</span>
    <strong data-date-known={Boolean(inForce?.date)}>{state.state === 'pending' ? state.label : inForce?.date ? `${c.dates.in_force} ${historyDate(inForce.date, language)}` : state.label}</strong>
  </span>;
}

/**
 * change_summary (kerf-change-summary/1) at the top of a norm or act.
 * `compact` is the reader-header variant: next pending, last change, notes.
 */
export function ChangeSummaryBlock({ summary, language, compact = false, onOpenChanges }: {
  summary: KerfChangeSummary | null | undefined; language: string; compact?: boolean; onOpenChanges?: () => void;
}) {
  const c = changeHistoryCopy(language);
  const today = summary?.as_of ?? berlinToday();
  if (!summaryHasContent(summary)) return null;
  const counts = summary.counts;
  const unknownTotal = summary.unknown_dates_total ?? summary.unknown_dates.length;
  const history = summary.completeness;
  const complete = history?.event_history && /^complete/u.test(history.event_history);
  const roles = Object.entries(counts?.versions_by_role ?? {}).filter(([, count]) => count > 0);
  // A summary built only from GII notes knows nothing about change events:
  // it must not claim "none recorded" for the last or next change.
  const knowsEvents = summary.derived !== 'legacy' || counts != null;
  return <section className={styles.summary} data-change-summary={summary.scope} data-derived={summary.derived ?? 'served'} data-compact={compact}>
    <header>
      <strong>{c.summary}</strong>
      {onOpenChanges && <button type="button" onClick={onOpenChanges}>{c.openChanges}</button>}
    </header>
    {knowsEvents && <div className={styles.summaryRows}>
      <div data-summary="next" data-pending={Boolean(summary.next_pending_change)}>
        <span className={styles.summaryLabel}>{c.nextPending}</span>
        {summary.next_pending_change ? <ChangeBrief change={summary.next_pending_change} language={language} today={today} hideNorm={summary.scope === 'norm'} /> : <em>{c.none}</em>}
        {!compact && summary.pending_changes.length > 1 && <small>{summary.pending_changes.length} {c.pendingChanges}</small>}
      </div>
      <div data-summary="last">
        <span className={styles.summaryLabel}>{c.lastChange}</span>
        {summary.last_change ? <ChangeBrief change={summary.last_change} language={language} today={today} hideNorm={summary.scope === 'norm'} /> : <em>{c.none}</em>}
      </div>
      {!compact && summary.last_incorporated_undated && <div data-summary="undated">
        <span className={styles.summaryLabel}>{c.lastUndated}</span>
        <ChangeBrief change={summary.last_incorporated_undated} language={language} today={today} hideNorm={summary.scope === 'norm'} />
      </div>}
    </div>}
    <SummaryMore compact={compact} label={c.summaryDetails}>
    {counts && (counts.versions || counts.events) ? <p className={styles.summaryCounts} data-summary="counts">
      {summary.scope === 'act' && counts.act_states != null && <span>{counts.act_states} {c.actStates}</span>}
      {counts.versions != null && <span>{counts.versions} {summary.scope === 'act' ? c.normVersions : c.versionsCount}</span>}
      {!compact && roles.length > 0 && <span>({roles.map(([role, count]) => `${count} ${isSourceRole(role) ? c.rolesShort[role as SourceRole] : role}`).join(', ')})</span>}
      {counts.events != null && <span>{counts.events} {c.eventsCount}</span>}
      {counts.events_with_in_force != null && <span>{counts.events_with_in_force} {c.withInForce}</span>}
      {!compact && counts.events_pending ? <span>{counts.events_pending} {c.eventsPending}</span> : null}
      {!compact && counts.events_date_unknown ? <span>{counts.events_date_unknown} {c.eventsUndated}</span> : null}
      {!compact && counts.amending_acts ? <span>{counts.amending_acts} {c.amendingActs}</span> : null}
    </p> : null}
    {summary.act_stand_note && <p className={styles.summaryNote} data-summary="stand">
      <span className={styles.summaryLabel}>{c.standNote}</span> „{summary.act_stand_note.text}“
      {summary.scope === 'norm' && summary.act_stand_note.norm_specific !== true && <small> — {c.standScope}</small>}
    </p>}
    {summary.documentation_notes.map(note => <p key={note.text} className={styles.summaryNote} data-note-kind={note.kind}>
      <span className={styles.summaryLabel}>{c.noteKinds[note.kind] ?? c.noteKinds.other}</span> „{note.text}“
      {note.source && <small> — {note.source}{note.observed_at ? `, ${historyDate(note.observed_at, language)}` : ''}</small>}
    </p>)}
    {!compact && unknownTotal > 0 && <details className={styles.unknown} data-summary="unknown">
      <summary>{c.unknownDates} ({unknownTotal})</summary>
      <ul>{summary.unknown_dates.slice(0, 30).map((row, index) => <li key={`${row.change_id}:${row.field}:${index}`}>
        <strong>{c.dates[row.field as keyof typeof c.dates] ?? row.field}: {c.unknown}</strong> — {row.amending_act ?? row.change_id}{row.reason ? <small> ({row.reason})</small> : null}
      </li>)}</ul>
      {unknownTotal > summary.unknown_dates.length && <small>{fill(c.shownOf, { shown: Math.min(30, summary.unknown_dates.length), total: unknownTotal })}</small>}
    </details>}
    {!compact && history && (history.event_history || history.text_history_start) && <p className={styles.muted} data-summary="completeness">
      {history.event_history ? complete && history.event_history_start ? fill(c.eventHistoryComplete, { date: historyDate(history.event_history_start, language) })
        : history.event_history_start ? fill(c.eventHistoryPartial, { date: historyDate(history.event_history_start, language) }) : c.eventHistoryUnknown : null}
      {history.text_history_start && <> · {fill(c.textHistoryStart, { date: historyDate(history.text_history_start, language) })}</>}
    </p>}
    {summary.derived === 'legacy' && !compact && <p className={styles.muted}>{c.derived}</p>}
    </SummaryMore>
  </section>;
}

/** Secondary summary lines: always shown in the compact header variant and on
 * wide screens; collapsed by default at phone width so the versions stay in view. */
function SummaryMore({ compact, label, children }: { compact: boolean; label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  useEffect(() => { if (!compact && typeof matchMedia === 'function' && matchMedia('(max-width: 640px)').matches) setOpen(false); }, [compact]);
  if (compact) return <>{children}</>;
  return <details className={styles.summaryMore} open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{label}</summary>
    {children}
  </details>;
}

function DateGrid({ change, language }: { change: Pick<KerfChangeRecord, 'dates'> & Partial<KerfChangeRecord>; language: string }) {
  return <dl className={styles.dateGrid}>{changeDateRows(change as KerfChangeRecord, language).map(row => <div key={row.field}>
    <dt>{row.label}</dt>
    <dd data-known={row.known} data-field={row.field} title={row.basis ?? undefined}>{row.value}{row.status && <small> · {row.status}</small>}</dd>
  </div>)}</dl>;
}

/** Verification of the text effect, localised; the raw value only as a last resort. */
const effectLabel = (value: string | null | undefined, language: string) => {
  if (!value) return null;
  const c = changeHistoryCopy(language);
  return c.effects[value] ?? c.attribution[value] ?? value;
};

/** One change record, buzer-style: amending act, dates (unknown explicit), type, state, diff. */
export function ChangeRecordCard({ change, language, today = berlinToday(), onShowDiff, versionsOldestFirst = [], onOpenNorm, hideNorm = false }: {
  change: KerfChangeRecord; language: string; today?: string; onShowDiff?: (pair: { from: string; to: string }) => void;
  versionsOldestFirst?: readonly { version_id: string }[]; onOpenNorm?: (label: string) => void; hideNorm?: boolean;
}) {
  const c = changeHistoryCopy(language);
  const state = changeStateLine(change, language, today);
  const pair = changeDiffPair(change, versionsOldestFirst);
  const effect = effectLabel(change.text_effect?.verification, language);
  const stateText = state.state === 'in_force' ? effect : [state.label, effect].filter(Boolean).join(' · ');
  return <article className={styles.changeCard} data-change={change.change_id} data-state={state.state}>
    <header>
      {state.state === 'pending' && <span className={styles.pendingBadge}><CalendarClock size={12} />{c.states.pending}</span>}
      <AmendingAct change={change} />
      {change.norm_label && !hideNorm && (onOpenNorm ? <button type="button" className={styles.normLink} onClick={() => onOpenNorm(change.norm_label!)}>{change.norm_label}</button> : <span className={styles.chamferNorm}>{change.norm_label}</span>)}
      <span className={styles.typeBadge} data-type={change.change_type}>{changeTypeLabel(change.change_type, language)}</span>
    </header>
    {change.amending_act?.title && <p className={styles.actTitle}>{change.amending_act.title}</p>}
    <DateGrid change={change} language={language} />
    {stateText && <p className={styles.stateLine} data-state={state.state}>{stateText}</p>}
    {change.gii_documentation && <p className={styles.actTitle} data-gii-documentation={change.gii_documentation.kind}>{c.giiDocumentation}: {c.noteKinds[change.gii_documentation.kind] ?? c.noteKinds.other}{change.gii_documentation.text ? ` — „${change.gii_documentation.text}“` : ''}</p>}
    {(pair && onShowDiff) || change.commands?.length ? <footer>
      {pair && onShowDiff && <button type="button" onClick={() => onShowDiff(pair)}><GitCompareArrows size={13} />{c.showDiff}</button>}
      {change.commands?.some(command => command.raw) && <details><summary><FileText size={12} /> {c.commands}</summary>
        {change.commands.filter(command => command.raw).map((command, index) => <pre key={index}>{command.raw}</pre>)}
      </details>}
    </footer> : null}
  </article>;
}

/** The change list of one provision. */
export function NormChangeList({ changes, language, legacy, onShowDiff, versionsOldestFirst }: {
  changes: KerfChangeRecord[]; language: string; legacy?: boolean; onShowDiff?: (pair: { from: string; to: string }) => void;
  versionsOldestFirst?: readonly { version_id: string }[];
}) {
  const c = changeHistoryCopy(language);
  const today = berlinToday();
  const sorted = useMemo(() => sortChanges(changes), [changes]);
  const pending = sorted.filter(change => changeStateLine(change, language, today).state === 'pending');
  const rest = sorted.filter(change => !pending.includes(change));
  return <div className={styles.changeList} data-change-list>
    {legacy && <p className={styles.notice} data-status="temporally_unresolved"><AlertTriangle size={14} /><span>{c.legacyChanges}</span></p>}
    {!sorted.length && <p className={styles.muted}>{c.noChanges}</p>}
    {pending.length > 0 && <section className={styles.pendingGroup} aria-label={c.pendingChanges}>
      <h3><CalendarClock size={14} />{c.pendingChanges} ({pending.length})</h3>
      {pending.map(change => <ChangeRecordCard key={change.change_id} change={change} language={language} today={today} onShowDiff={onShowDiff} versionsOldestFirst={versionsOldestFirst} hideNorm />)}
    </section>}
    {rest.map(change => <ChangeRecordCard key={change.change_id} change={change} language={language} today={today} onShowDiff={onShowDiff} versionsOldestFirst={versionsOldestFirst} hideNorm />)}
  </div>;
}

const PAGE = 50;

/** Change history of a whole act: amending acts (with article) and the provisions they changed. */
export function ActChangeHistory({ actId, language, onOpenNorm, fallbackSummary }: {
  actId: string; language: string; onOpenNorm?: (label: string) => void; fallbackSummary?: KerfChangeSummary | null;
}) {
  const c = changeHistoryCopy(language);
  const today = berlinToday();
  const [pages, setPages] = useState<KerfChanges[]>([]);
  const [state, setState] = useState<{ loading: boolean; error: KerfRequestError | null; missing: boolean }>({ loading: true, error: null, missing: false });
  const [attempt, setAttempt] = useState(0);
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState(previous => ({ ...previous, loading: true, error: null }));
    kerfActChanges(actId, { limit: PAGE, offset }, controller.signal)
      .then(page => { if (!controller.signal.aborted) { setPages(previous => offset ? [...previous, page] : [page]); setState({ loading: false, error: null, missing: false }); } })
      .catch(error => {
        if (controller.signal.aborted) return;
        const typed = toKerfRequestError(error);
        // A route the deployed API does not have yet is an absence, not a failure.
        setState({ loading: false, error: typed.kind === 'not_found' ? null : typed, missing: typed.kind === 'not_found' });
      });
    return () => controller.abort();
  }, [actId, offset, attempt]);
  const first = pages[0];
  const summary = normalizeChangeSummary(first?.change_summary) ?? fallbackSummary ?? null;
  const groups = useMemo(() => pages.flatMap((page, pageIndex) => (page.evidence ?? []).map((row, index) => normalizeActChangeGroup(row, pageIndex * PAGE + index)))
    .filter((group): group is KerfActChangeGroup => Boolean(group)), [pages]);
  const total = first?.total ?? null;
  return <div className={styles.actHistory} data-act-history={actId}>
    <ChangeSummaryBlock summary={summary} language={language} />
    {state.missing && <p className={styles.notice} data-status="unavailable" role="status"><AlertTriangle size={14} /><span>{c.actChangesUnavailable}</span></p>}
    {first && first.status !== 'ok' && first.status !== 'partial' && <p className={styles.notice} data-status={first.status}><AlertTriangle size={14} /><span>{first.error?.message ?? first.status}</span></p>}
    {first && !groups.length && first.status === 'ok' && <p className={styles.muted}>{c.noActChanges}</p>}
    {groups.map(group => {
      const head = { ...group.norms[0], amending_act: group.amending_act, dates: group.dates, state: group.state ?? group.norms[0].state, pending: group.pending ?? group.norms[0].pending, norm_label: null, commands: [], text_effect: null };
      const line = changeStateLine(head, language, today);
      return <article key={group.key} className={styles.changeCard} data-state={line.state} data-act-change>
        <header>
          {line.state === 'pending' && <span className={styles.pendingBadge}><CalendarClock size={12} />{c.states.pending}</span>}
          <AmendingAct change={head} />
        </header>
        {group.amending_act?.title && <p className={styles.actTitle}>{group.amending_act.title}</p>}
        <DateGrid change={head} language={language} />
        {line.state !== 'in_force' && <p className={styles.stateLine} data-state={line.state}>{line.label}</p>}
        <div className={styles.affected}><span>{c.affected} ({group.norms.length})</span>
          {group.norms.map(norm => <button key={norm.change_id} type="button" disabled={!onOpenNorm || !norm.norm_label} onClick={() => norm.norm_label && onOpenNorm?.(norm.norm_label)} title={changeTypeLabel(norm.change_type, language)}>
            {norm.norm_label ?? '—'} <small>{changeTypeLabel(norm.change_type, language)}</small>
          </button>)}
        </div>
      </article>;
    })}
    <LoadStatus compact loading={state.loading} error={state.error} language={language} title={c.actHistory} onRetry={() => setAttempt(value => value + 1)} resetKey={`${actId}:${offset}`} />
    {!state.loading && total != null && groups.length < total && <button type="button" className={styles.more} onClick={() => setOffset(pages.reduce((sum, page) => sum + (page.evidence?.length ?? 0), 0))}>
      <Plus size={13} />{c.loadMore} ({fill(c.shownOf, { shown: groups.length, total })})</button>}
  </div>;
}

/** Normalise the evidence of a /norms/{id}/changes page. */
export const changeRecords = (page: KerfChanges | null | undefined): KerfChangeRecord[] =>
  (page?.evidence ?? []).map(normalizeChangeRecord).filter((row): row is KerfChangeRecord => Boolean(row));

/** Consolidated versions of a whole act (GII daily, Wayback copies, NeuRIS, …). Capture
 * days are knowledge dates; a legal start is shown only when the API states one. */
export function ActVersionList({ actId, language }: { actId: string; language: string }) {
  const c = changeHistoryCopy(language);
  const [pages, setPages] = useState<KerfActVersions[]>([]);
  const [state, setState] = useState<{ loading: boolean; error: KerfRequestError | null; missing: boolean }>({ loading: true, error: null, missing: false });
  const [attempt, setAttempt] = useState(0);
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState(previous => ({ ...previous, loading: true, error: null }));
    kerfActVersions(actId, { limit: 40, offset }, controller.signal)
      .then(page => { if (!controller.signal.aborted) { setPages(previous => offset ? [...previous, page] : [page]); setState({ loading: false, error: null, missing: false }); } })
      .catch(error => {
        if (controller.signal.aborted) return;
        const typed = toKerfRequestError(error);
        setState({ loading: false, error: typed.kind === 'not_found' ? null : typed, missing: typed.kind === 'not_found' });
      });
    return () => controller.abort();
  }, [actId, offset, attempt]);
  const rows = pages.flatMap(page => page.evidence ?? []);
  const total = pages[0]?.total ?? null;
  if (state.missing) return <p className={styles.notice} data-status="unavailable" role="status"><AlertTriangle size={14} /><span>{c.actChangesUnavailable}</span></p>;
  return <div className={styles.changeList} data-act-versions-list>
    {rows.map((row, index) => {
      const role = isSourceRole(row.source_role) ? row.source_role : null;
      const from = row.known_from ? historyDate(row.known_from, language) : null;
      const until = row.known_until && row.known_until !== row.known_from ? historyDate(row.known_until, language) : null;
      const link = safeUrl(row.archive_url) ?? safeUrl(row.url);
      return <article key={`${row.seq ?? index}:${row.sha256 ?? ''}`} className={styles.changeCard} data-act-version={row.source ?? ''} data-role={role ?? ''}>
        <header>
          {role && <span className={styles.roleBadge} data-role={role}>{c.rolesShort[role]}</span>}
          <span>{c.sources[row.source ?? ''] ?? row.source}</span>
          {from && <span className={styles.muted}>{until ? fill(c.knownRange, { from, until }) : fill(c.knownOn, { from })}</span>}
          {row.complete === false && <span className={styles.completeBadge} data-status="partial">{c.completeness.partial}</span>}
          {link && <a className={styles.citation} href={link} target="_blank" rel="noopener noreferrer"><ExternalLink size={11} /></a>}
        </header>
        {row.valid_from && <p className={styles.stateLine}>{c.dates.in_force} {historyDate(row.valid_from, language)}</p>}
        {row.act_stand_note?.text && <p className={styles.summaryNote}><span className={styles.summaryLabel}>{c.standNote}</span> „{row.act_stand_note.text}“</p>}
        {(row.documentation_notes ?? []).filter(note => note.text).map(note => <p key={note.text} className={styles.summaryNote}><span className={styles.summaryLabel}>{c.noteKinds[note.kind ?? 'other'] ?? c.noteKinds.other}</span> „{note.text}“</p>)}
      </article>;
    })}
    <LoadStatus compact loading={state.loading} error={state.error} language={language} title={c.actVersions} onRetry={() => setAttempt(value => value + 1)} resetKey={`${actId}:${offset}`} />
    {!state.loading && total != null && rows.length < total && <button type="button" className={styles.more} onClick={() => setOffset(rows.length)}><Plus size={13} />{c.loadMore} ({fill(c.shownOf, { shown: rows.length, total })})</button>}
  </div>;
}
