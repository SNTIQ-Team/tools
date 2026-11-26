'use client';

import { formatDay } from '@/core/formatDay';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AArrowDown, AArrowUp, ArrowLeft, ArrowRight, BookOpen, BookText, Bookmark, ChevronLeft, ChevronRight, ChevronsDownUp, ChevronsUpDown, Columns2, Copy, CopyX, Download, ExternalLink, GitCompareArrows, History, Library, Link2, Loader2, Maximize2, Minimize2, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Pin, Plus, RotateCcw, Search, SquareSplitHorizontal, SquareSplitVertical, X } from 'lucide-react';
import { storageGet, storageSet } from '@/core/safeStorage';
import { kerfActMarkdownUrl, kerfCitations, kerfEuIndex, kerfSearch, type KerfAct, type KerfActDetail, type KerfActNorm, type KerfCitations, type KerfEuIndex, type KerfSearch, type KerfStatutoryCitation } from './client';
import { readerCopy, type ReaderCopy } from './readerI18n';
import { createWorkspace, decodeWorkspace, encodeWorkspace, workspaceReducer, readerDocKey, validReaderDate, type ReaderAction, type ReaderPane, type ReaderTab, type ReaderWorkspace, type ReaderView } from './readerWorkspace';
import { useReaderAct, useReaderReferences, useReaderArchive, useReaderEdition } from './readerResources';
import LoadStatus from './LoadStatus';
import { KerfRequestError } from './kerfRequest';
import { archiveNorms, archiveTitle, sourceParagraphs } from './readerArchiveStructure';
import StructuredReaderText from './StructuredReaderText';
import ReaderSourceAnnotations from './ReaderSourceAnnotations';
import ReaderText, { readerDocumentHref, type ReaderReference } from './ReaderText';
import ReaderDecision, { type LoadedDecision } from './ReaderDecision';
import ReaderArchivedText from './ReaderArchivedText';
import { readerEditionCopy, readerEditionDate, readerSourceUrl } from './readerEditions';
import ReaderEditionPicker from './ReaderEditionPicker';
import ReaderTiles from './ReaderTiles';
import SplitPanes from '@/core/SplitPanes';
import { useMediaQuery } from '@/core/useMediaQuery';
import ReaderHistory from './ReaderHistory';
import NormHistory from './NormHistory';
import ReaderEditionProvenance from './ReaderEditionProvenance';
import ReaderComparison from './ReaderComparison';
import ReaderOverview from './ReaderOverview';
import { changeHistoryCopy } from './changeHistoryFormat';
import { ChangeSummaryBlock } from './ChangeHistoryViews';
import { useReaderChangeSummary } from './readerChangeSummary';
import type { NormHistoryMode } from './NormHistory';
import ReaderTocOutline, { TocOutlineList } from './ReaderTocOutline';
import { isTocNorm, isTocPseudoNorm, provisionsText, readerProvisions, stripTocPlaceholders } from './readerToc';
import { downloadMarkdownExport } from './readerExport';
import ReaderContextMenu from './ReaderContextMenu';
import { readerWorkbenchCopy } from './readerWorkbenchCopy';
import { readerShortcut } from './readerShortcuts';
import desk from './readerWorkbench.module.css';
import { normKey } from './synopsisTimeline';
import { readerLawLabel } from './readerLabels';
import { needsArticleChoice, readerDesignator, readerNormMatches, readerOutline } from './readerOutline';
import { officialActSource } from './officialSources';
import { useStructuredNorms, useStructuredNormsState, useArchivedStructuredNorms, getStructuredNorm } from './readerStructuredResources';
import styles from './reader.module.css';

const STORAGE = 'sntiq_kerf_workspace_v1';
type MenuTarget = { x: number; y: number; actId: string; norm: string | null; paneId?: string; tabId?: string; documentType?: 'law' | 'decision'; at?: string };
type SavedDocument = { actId: string; norm: string | null; documentType?: 'law' | 'decision'; at?: string };
type ScrollPosition = { top: number; normIndex?: number; offset?: number };
const savedKey = (document: SavedDocument) => readerDocKey(document.actId, document.norm, document.documentType, document.at);



function readDocuments(key: string): SavedDocument[] {
  try {
    const value: unknown = JSON.parse(storageGet(key) ?? '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is SavedDocument => item && typeof item === 'object' && typeof item.actId === 'string' && item.actId.length < 256 && (item.norm === null || typeof item.norm === 'string' && item.norm.length < 128) && (item.documentType === undefined || item.documentType === 'law' || item.documentType === 'decision') && (item.at === undefined || item.documentType !== 'decision' && validReaderDate(item.at))).slice(0, 50);
  } catch { return []; }
}

function IconButton({ title, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { title: string }) {
  return <button type="button" {...props} className={`${styles.icon} ${props.className ?? ''}`} title={title} aria-label={title}>{children}</button>;
}

/** A tool named in words (DESIGN.md section 6, "Иконки"): for actions a
    glyph cannot say on its own (full text, references, reopen a tab). */
function ToolText({ label, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button type="button" {...props} className={`${styles.toolText} ${props.className ?? ''}`}>{label}</button>;
}

function ReferenceList({ actId, norm, t, onOpen }: { actId: string; norm: string | null; t: ReaderCopy; onOpen: (actId: string, norm: string | null) => void }) {
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [result, setResult] = useState<KerfCitations | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(false);
    kerfCitations({ act: actId, norm: norm ?? undefined, direction, limit: 100, offset: page * 100 }, controller.signal)
      .then(data => { if (!controller.signal.aborted) setResult(previous => ({ ...data, citations: page && previous ? [...previous.citations, ...data.citations] : data.citations })); })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [actId, norm, direction, page, attempt]);
  return <section className={styles.references} aria-label={t.references}>
    <h3>{t.references}</h3>
    <div className={styles.sideTabs}>{(['in', 'out'] as const).map(value => <button key={value} aria-pressed={direction === value} onClick={() => { if (value !== direction) { setDirection(value); setPage(0); setResult(null); } }}>{value === 'in' ? t.incoming : t.outgoing}</button>)}</div>
    {error ? <button className={styles.textButton} onClick={() => setAttempt(value => value + 1)}><RotateCcw size={14} />{t.referenceError}</button> : !result ? <Loader2 size={17} className="animate-spin" /> : <>
      {!result.citations.length && <p>{t.noReferences}</p>}
      {result.citations.map(row => {
        const id = direction === 'in' ? row.source_act : row.target_act;
        const designation = direction === 'in' ? row.source_norm : row.target_norm;
        const label = `${direction === 'in' ? row.source_jurabk : row.target_jurabk ?? ''} ${designation ?? row.citation_text}`;
        return <div key={row.id} className={styles.referenceRow}>{id && (direction === 'in' || row.status === 'resolved')
          ? <button onClick={() => onOpen(id, designation ?? null)}><BookOpen size={13} />{label}</button> : <strong>{row.citation_text}</strong>}<p>{row.source_excerpt}</p></div>;
      })}
      {result.matched > result.citations.length && <button className={styles.textButton} disabled={loading} onClick={() => setPage(value => value + 1)}><Plus size={14} />{t.more} ({result.citations.length}/{result.matched})</button>}
    </>}
  </section>;
}

function DocumentView({ tab, acts, t, fontSize, query, showReferences, onReference, onOpen, onHistory, onChanges, scrollPositions }: {
  tab: ReaderTab; acts: KerfAct[]; t: ReaderCopy; fontSize: number; query: string; showReferences: boolean;
  onReference: (reference: ReaderReference) => void; onOpen: (actId: string, norm: string | null, mode?: 'new' | 'replace') => void;
  onHistory: (actId: string, norm?: string | null) => void; onChanges: () => void; scrollPositions: React.MutableRefObject<Map<string, ScrollPosition>>;
}) {
  const law = useReaderAct(tab.actId);
  const act = law.data;
  const { i18n } = useTranslation();
  const edition = useReaderEdition(tab.actId, tab.at, tab.norm);
  const fullEdition = useReaderEdition(tab.actId, tab.at, null);
  const editionStructures = useArchivedStructuredNorms(fullEdition.data);
  const historicalTitle = useMemo(() => edition.data ? archiveTitle(edition.data.markdown, tab.norm) : fullEdition.data ? archiveTitle(fullEdition.data.markdown) : undefined, [edition.data, fullEdition.data, tab.norm]);
  const archivedNorms = useMemo(() => fullEdition.data ? archiveNorms(fullEdition.data.markdown) : undefined, [fullEdition.data]);
  // Secondary resources wait for the text itself: the API serialises work,
  // so the requested document must not queue behind its own side data.
  const citations = useReaderReferences(tab.at || !act ? null : tab.actId);
  const structure = useStructuredNormsState(act);
  const blocks = structure.norms;
  const changeSummary = useReaderChangeSummary(tab.at ? null : act, tab.norm);
  const viewport = useRef<HTMLDivElement>(null);
  const scrollKey = `${tab.id}:${savedKey(tab)}:${query}`;
  const normRows = useMemo(() => {
    const groups = new Map<string, KerfStatutoryCitation[]>();
    for (const citation of citations.rows) {
      const key = normKey(citation.source_norm);
      groups.set(key, [...(groups.get(key) ?? []), citation]);
    }
    return groups;
  }, [citations.rows]);
  const norms = useMemo(() => {
    const all = act?.norms ?? [];
    if (tab.norm) return readerNormMatches(all, tab.norm);
    const needle = query.trim().toLocaleLowerCase();
    return needle ? all.filter(norm => `${norm.enbez} ${norm.titel} ${norm.text} ${getStructuredNorm(blocks, act!, norm)?.source_annotations_text ?? ''}`.toLocaleLowerCase().includes(needle)) : all;
  }, [act, tab.norm, query, blocks]);
  // Keep long books responsive while retaining the complete source for search,
  // navigation and export. Loading more never removes already visited norms.
  const [window, setWindow] = useState({ key: '', count: 80 });
  const savedIndex = scrollPositions.current.get(scrollKey)?.normIndex ?? 0;
  const visibleCount = window.key === scrollKey ? window.count : Math.max(80, savedIndex + 80);
  const more = useRef<HTMLButtonElement>(null);
  const loadMore = useCallback(() => setWindow({ key: scrollKey, count: visibleCount + 80 }), [scrollKey, visibleCount]);
  useEffect(() => {
    if (!more.current || !viewport.current || !('IntersectionObserver' in globalThis)) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) loadMore();
    }, { root: viewport.current, rootMargin: '800px' });
    observer.observe(more.current);
    return () => observer.disconnect();
  }, [loadMore, norms.length, act, tab.at]);
  useLayoutEffect(() => {
    const node = viewport.current;
    if (!node || !act) return;
    const position = scrollPositions.current.get(scrollKey);
    const anchor = position?.normIndex !== undefined ? node.querySelectorAll<HTMLElement>('[data-reader-norm]')[position.normIndex] : null;
    node.scrollTop = anchor && position?.offset !== undefined
      ? node.scrollTop + anchor.getBoundingClientRect().top - node.getBoundingClientRect().top - position.offset
      : position?.top ?? 0;
  }, [scrollKey, act, blocks, editionStructures, edition.data, fontSize, scrollPositions]);
  const rememberScroll = (node: HTMLDivElement) => {
    const top = node.getBoundingClientRect().top;
    const sections = [...node.querySelectorAll<HTMLElement>('[data-reader-norm]')];
    const normIndex = sections.findIndex(section => section.getBoundingClientRect().bottom > top);
    scrollPositions.current.set(scrollKey, { top: node.scrollTop, ...(normIndex >= 0 ? { normIndex, offset: sections[normIndex].getBoundingClientRect().top - top } : {}) });
  };
  if (law.error || !act) return <LoadStatus loading={law.loading} error={law.error} language={i18n.language} title={t.failed} label={t.loadingProvisions} onRetry={law.retry} onCancel={law.cancel} resetKey={tab.actId} />;
  const source = officialActSource(act);
  const editionSource = readerSourceUrl(edition.data?.source_url);
  const archivedSource = readerSourceUrl(edition.data?.archive_url);
  const observedEdition = /observ|retrieval|capture/.test(edition.data?.date_basis ?? '');
  const editionDate = observedEdition ? edition.data?.observed_at ?? edition.data?.resolved_at : edition.data?.effective_from ?? edition.data?.effective_at ?? edition.data?.resolved_at;
  const choices = tab.norm ? readerNormMatches(tab.at ? archivedNorms ?? [] : act.norms ?? [], tab.norm) : [];
  const ambiguous = needsArticleChoice(choices);
  return <div ref={viewport} className={styles.viewport} data-reader-scroll={tab.id} onScroll={event => rememberScroll(event.currentTarget)}>
    <div className={styles.document} data-reader-act={act.id} style={{ '--reader-font': `${fontSize}px` } as React.CSSProperties}>
      <header className={styles.documentHeader}>
        <h2>{tab.norm ? `${tab.norm} ${readerLawLabel(act)}` : readerLawLabel(act)}</h2>
        {(!tab.at || historicalTitle || edition.data) && <p>{tab.at ? historicalTitle ?? act.title : act.title}</p>}
        {!tab.at && <ChangeSummaryBlock summary={changeSummary} language={i18n.language} compact onOpenChanges={onChanges} />}
        {!tab.at && <details className={styles.status}><summary>{t.currentness}{act.build ? ` · ${act.build.replace(/^(\d{4})(\d{2})(\d{2})$/, '$3.$2.$1')}` : ''}</summary><p>{act.stand}</p>{source && <a href={source} target="_blank" rel="noopener noreferrer">{t.source}{act.juris === 'EU' ? ` · CELEX ${new URL(source).searchParams.get('uri')?.slice(6)}` : ''} <ExternalLink size={12} style={{ display: 'inline' }} /></a>}</details>}
      </header>
      {tab.at && <div className={styles.editionStatus} data-reader-edition={tab.at}>
        <History size={14} /><span>{observedEdition ? t.observed : edition.data?.effective_from || edition.data?.legal_effect_verified ? (editionDate ?? tab.at) > new Date().toISOString().slice(0, 10) ? readerEditionCopy(i18n.language).future : t.effectiveEdition : t.edition}: {readerEditionDate((editionDate ?? tab.at).slice(0, 10), i18n.language)}</span>
        {edition.data?.partial && <strong>{t.partialEdition}</strong>}
        {edition.data && <ReaderEditionProvenance edition={edition.data} language={i18n.language} />}
        {archivedSource && <a href={archivedSource} target="_blank" rel="noopener noreferrer">{t.archivedSource} <ExternalLink size={12} style={{ display: 'inline' }} /></a>}
        {editionSource && editionSource !== archivedSource && <a href={editionSource} target="_blank" rel="noopener noreferrer">{t.source}{edition.data?.source ? ` · ${edition.data.source}` : ''} <ExternalLink size={12} style={{ display: 'inline' }} /></a>}
      </div>}
      {ambiguous ? <div className={styles.empty} data-reader-choose-provision>
        <p>{t.chooseProvision}</p>
        {choices.map(norm => <button key={readerDesignator(norm)} className={styles.lawRow} onClick={() => onOpen(act.id, readerDesignator(norm), 'replace')}>
          <strong>{readerDesignator(norm)}</strong><small>{norm.titel}</small>
        </button>)}
      </div> : tab.at ? edition.error || !edition.data ? <LoadStatus loading={edition.loading} error={edition.error} language={i18n.language} title={t.editionUnavailable} onRetry={edition.retry} onCancel={edition.cancel} resetKey={`${tab.actId}:${tab.at}:${tab.norm}`} />
        : <div className={`${styles.legalText} ${styles.archivedText}`} data-reader-archive-text><ReaderArchivedText markdown={edition.data.markdown} acts={acts} act={act} at={tab.at} norms={archivedNorms} structures={blocks} editionStructures={editionStructures} query={query} onReference={onReference} tocNote={t.tocNote} onOpenNorm={enbez => onOpen(act.id, enbez)} /></div>
        : <>
      {structure.error && <div className={styles.structureNotice} role="status" data-structure-error={structure.error.kind}><span>{t.structureUnavailable}</span><button type="button" className={styles.textButton} onClick={structure.retry}><RotateCcw size={13} />{t.retry}</button></div>}
      {!norms.length && <div className={styles.empty}><p>{tab.norm ? t.missingNorm : t.noResults}</p><button className={styles.textButton} onClick={() => onOpen(act.id, null, 'replace')}><BookText size={15} />{t.fullText}</button></div>}
      {norms.slice(0, visibleCount).map((norm, index) => {
        const designation = readerDesignator(norm);
        const rows = normRows.get(normKey(designation)) ?? [];
        const structure = getStructuredNorm(blocks, act, norm);
        const renderText = (text: string) => <ReaderText text={text} acts={acts} actId={act.id} norms={act.norms ?? []} citations={rows} query={query} onReference={onReference} />;
        // The source's table of contents is not a provision: a collapsed outline, never "no text".
        if (isTocPseudoNorm(norm)) return <section key={`${norm.enbez}:${index}`} className={styles.norm} data-reader-norm={norm.enbez}>
          <ReaderTocOutline label={norm.enbez} norms={act.norms ?? []} fallback={readerLawLabel(act)} note={t.tocNote} open={Boolean(tab.norm)} onOpen={enbez => onOpen(act.id, enbez)} />
        </section>;
        const body = <div lang="de" className={styles.legalText}>{structure ? <StructuredReaderText nodes={structure.blocks} acts={acts} actId={act.id} norms={act.norms ?? []} citations={rows} query={query} onReference={onReference} /> : norm.text ? sourceParagraphs(norm.text, { bavarianSentences: act.id.startsWith('by_') }).map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{renderText(paragraph)}</p>) : <span className="text-muted">{norm.titel || t.emptyText}</span>}</div>;
        if (isTocNorm(norm)) return <section key={`${norm.enbez}:${index}`} className={styles.norm} data-reader-norm={norm.enbez}>
          <details data-reader-toc="source" open={Boolean(tab.norm) || undefined}><summary>{norm.enbez}</summary>{body}</details>
        </section>;
        return <section key={`${norm.enbez}:${index}`} className={styles.norm} data-reader-norm={designation} data-reader-menu-act={act.id} data-reader-menu-norm={designation}>
          {norm.glied && (index === 0 || norm.glied !== norms[index - 1].glied) && <span lang="de" className={styles.groupLabel}>{norm.glied}</span>}
          <div className={styles.normHeading}><h3 lang="de"><a href={readerDocumentHref(act.id, designation)} onClick={event => { if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onOpen(act.id, designation); } }}>{norm.enbez}{norm.titel ? ` · ${norm.titel}` : ''}</a></h3><ToolText label={t.history} onClick={() => onHistory(act.id, designation)} /></div>
          {body}
          {structure?.source_annotations?.length ? <ReaderSourceAnnotations annotations={structure.source_annotations} label={t.sourceAnnotations} acts={acts} actId={act.id} norms={act.norms ?? []} query={query} onReference={onReference} /> : null}
        </section>;
      })}
      {norms.length > visibleCount && <button ref={more} className={styles.textButton} data-reader-load-more onClick={loadMore}>{t.more} ({visibleCount}/{norms.length})</button>}
      {showReferences && <ReferenceList key={readerDocKey(act.id, tab.norm)} actId={act.id} norm={tab.norm} t={t} onOpen={onOpen} />}
      </>}
    </div>
  </div>;
}

function Preview({ reference, acts, t, onClose, onOpen, onReference }: { reference: ReaderReference; acts: KerfAct[]; t: ReaderCopy; onClose: () => void; onOpen: (beside: boolean) => void; onReference: (reference: ReaderReference) => void }) {
  const law = useReaderAct(reference.actId ?? null);
  const { data } = law;
  const { i18n } = useTranslation();
  const edition = useReaderEdition(reference.actId ?? null, reference.at, reference.norm ?? null);
  const fullEdition = useReaderEdition(reference.actId ?? null, reference.at, null);
  const editionStructures = useArchivedStructuredNorms(fullEdition.data);
  const archivedNorms = useMemo(() => fullEdition.data ? archiveNorms(fullEdition.data.markdown) : undefined, [fullEdition.data]);
  const blocks = useStructuredNorms(data);
  const matches = reference.norm ? readerNormMatches(data?.norms ?? [], reference.norm) : [];
  const norm = matches.length === 1 ? matches[0] : undefined;
  const structure = data && norm ? getStructuredNorm(blocks, data, norm) : undefined;
  return <section className={styles.preview} aria-label={`${t.preview}: ${reference.label}`}>
    <div className={styles.previewHeader}><BookOpen size={15} /><span>{reference.label}{reference.at ? ` · ${reference.at}` : ''}</span><IconButton title={t.close} onClick={onClose}><X size={16} /></IconButton></div>
    <div className={`${styles.previewBody} ${styles.legalText}`}>{law.error || !data ? <LoadStatus compact loading={law.loading} error={law.error} language={i18n.language} title={t.failed} onRetry={law.retry} onCancel={law.cancel} resetKey={reference.actId} />
      : reference.at ? edition.error || !edition.data ? <LoadStatus compact loading={edition.loading} error={edition.error} language={i18n.language} title={t.editionUnavailable} onRetry={edition.retry} onCancel={edition.cancel} resetKey={`${reference.actId}:${reference.at}`} /> : <ReaderArchivedText markdown={edition.data.markdown} acts={acts} act={data} at={reference.at} norms={archivedNorms} structures={blocks} editionStructures={editionStructures} query="" onReference={onReference} tocNote={t.tocNote} />
      : norm && isTocPseudoNorm(norm) ? <><h4>{norm.enbez}</h4><TocOutlineList norms={data.norms ?? []} fallback={readerLawLabel(data)} note={t.tocNote} /></>
      : <><h4>{norm?.titel ?? data.title}</h4>{norm ? structure ? <StructuredReaderText nodes={structure.blocks} acts={acts} actId={data.id} norms={[]} citations={[]} onReference={onReference} /> : sourceParagraphs(norm.text ?? '').map((text, index) => <p key={index}>{text}</p>) : t.missingNorm}</>}</div>
    <div className={styles.previewActions}><button className={styles.textButton} onClick={() => onOpen(false)}><Plus size={15} />{t.newTab}</button><button className={styles.textButton} onClick={() => onOpen(true)}><Columns2 size={15} />{t.openBeside}</button></div>
  </section>;
}

export default function KerfReader({ acts, error, onRetry, onHistory, onDecisions, initialDocument, onInitialDocumentConsumed, visible = true, onBrowseAll }: {
  acts: KerfAct[] | null; error: boolean | KerfRequestError | null; onHistory: (actId: string, norm?: string | null) => void; onDecisions: (jurabk: string) => void;
  initialDocument?: { actId: string; norm: string | null; documentType?: 'law' | 'decision'; sequence: number } | null;
  onInitialDocumentConsumed?: () => void;
  visible?: boolean;
  onRetry: () => void;
  /** Opens the full law index (the Library rail tab). */
  onBrowseAll?: () => void;
}) {
  const { i18n } = useTranslation();
  const t = readerCopy(i18n.language);
  const w = readerWorkbenchCopy(i18n.language);
  const [workspace, setWorkspace] = useState<ReaderWorkspace>(createWorkspace);
  const state = useRef(workspace);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [sidebar, setSidebar] = useState(true);
  const [sideTab, setSideTab] = useState<'library' | 'contents' | 'bookmarks'>('library');
  const [query, setQuery] = useState('');
  const [bookQueries, setBookQueries] = useState<Record<string, string>>({});
  const [jurisdiction, setJurisdiction] = useState('');
  const [search, setSearch] = useState<KerfSearch | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [eu, setEu] = useState<KerfEuIndex | null>(null);
  const [bookmarks, setBookmarks] = useState<SavedDocument[]>([]);
  const [recent, setRecent] = useState<SavedDocument[]>([]);
  const [decisionTitles, setDecisionTitles] = useState<Record<string, string>>({});
  const [fontSize, setFontSize] = useState(16);
  const [previews, setPreviews] = useState<ReaderReference[]>([]);
  const [references, setReferences] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState(false);
  const [tocRevision, setTocRevision] = useState(0);
  const [dragged, setDragged] = useState<{ paneId: string; tabId: string } | null>(null);
  const [maximized, setMaximized] = useState(false);
  const compact = useMediaQuery('(max-width: 900px)');
  const overlaySidebar = useMediaQuery('(max-width: 640px)');
  const hasDocuments = workspace.panes.some(pane => pane.tabs.length);
  const readingFocus = maximized && visible && hasDocuments;
  const sidebarShown = sidebar && !maximized;
  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);
  const closeMenu = useCallback(() => setMenuTarget(null), []);
  const root = useRef<HTMLDivElement>(null);
  const previousRects = useRef<Map<string, DOMRect> | null>(null);
  const rememberLayout = useCallback(() => {
    previousRects.current = new Map([...root.current?.querySelectorAll<HTMLElement>('[data-reader-pane]') ?? []]
      .map(element => [element.dataset.readerPane!, element.getBoundingClientRect()]));
  }, []);
  const toggleMaximized = useCallback(() => { rememberLayout(); setMaximized(value => !value); }, [rememberLayout]);
  const toggleSidebar = useCallback(() => {
    if (maximized) { setMaximized(false); setSidebar(true); }
    else setSidebar(value => !value);
  }, [maximized]);
  useEffect(() => {
    if (!visible || !hasDocuments) setMaximized(false);
  }, [visible, hasDocuments]);
  const scrollPositions = useRef(new Map<string, ScrollPosition>());
  const input = useRef<HTMLInputElement>(null);
  const bookInput = useRef<HTMLInputElement>(null);
  const overviewInput = useRef<HTMLInputElement>(null);
  const wasInReadingFocus = useRef(false);
  useLayoutEffect(() => {
    const changed = wasInReadingFocus.current !== readingFocus;
    wasInReadingFocus.current = readingFocus;
    if (changed && visible && root.current && !root.current.contains(document.activeElement)) {
      const control = root.current.querySelector<HTMLButtonElement>('[data-reader-maximize]') ?? overviewInput.current;
      control?.focus({ preventScroll: true });
    }
  }, [readingFocus, visible]);
  const activePane = workspace.panes.find(pane => pane.id === workspace.activePaneId) ?? workspace.panes[0];
  const activeTab = activePane.tabs.find(tab => tab.id === activePane.activeTabId);
  const hasContents = Boolean(activeTab && activeTab.documentType !== 'decision');
  const activeSearchKey = activeTab ? `${activeTab.id}:${savedKey(activeTab)}` : '';
  const bookQuery = bookQueries[activeSearchKey] ?? '';
  const setBookQuery = (value: string) => setBookQueries(previous => ({ ...previous, [activeSearchKey]: value }));
  const activeLaw = useReaderAct(activeTab?.documentType !== 'decision' ? activeTab?.actId ?? null : null);
  const activeEdition = useReaderEdition(activeTab?.actId ?? null, activeTab?.at, null);
  const activeStructures = useStructuredNorms(activeTab?.at ? null : activeLaw.data);
  const activeNorms = useMemo(() => activeTab?.at ? activeEdition.data ? archiveNorms(activeEdition.data.markdown) : [] : activeLaw.data?.norms ?? [], [activeTab?.at, activeEdition.data, activeLaw.data]);
  const actById = useMemo(() => new Map((acts ?? []).map(act => [act.id, act])), [acts]);

  const apply = useCallback((action: ReaderAction, push = true) => {
    const previous = state.current;
    const next = workspaceReducer(previous, action);
    if (next === previous) {
      if ((action.type === 'split' || action.type === 'open') && (previous.panes.length >= 4 && action.type === 'split' || previous.panes.reduce((sum, pane) => sum + pane.tabs.length, 0) >= 24)) setNotice(t.workspaceLimit);
      return;
    }
    if (['split', 'close-pane', 'set-layout'].includes(action.type)) rememberLayout();
    state.current = next; setWorkspace(next);
    const hash = encodeWorkspace(next);
    const url = `${location.pathname}${location.search}${hash}`;
    if (push) history.pushState(history.state, '', url); else history.replaceState(history.state, '', url);
    storageSet(STORAGE, hash);
  }, [t.workspaceLimit, rememberLayout]);

  useLayoutEffect(() => {
    const before = previousRects.current; previousRects.current = null;
    if (!before || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const frame = requestAnimationFrame(() => {
      root.current?.querySelectorAll<HTMLElement>('[data-reader-pane]').forEach(element => {
        const old = before.get(element.dataset.readerPane!);
        const next = element.getBoundingClientRect();
        if (!old || !next.width || !next.height || !old.width || !old.height) return;
        element.animate([{ transformOrigin: 'top left', transform: `translate(${old.x - next.x}px,${old.y - next.y}px) scale(${old.width / next.width},${old.height / next.height})` },
          { transformOrigin: 'top left', transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' });
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [workspace, maximized]);

  useEffect(() => {
    const hash = window.location.hash;
    const restored = decodeWorkspace(hash) ?? (!hash ? decodeWorkspace(storageGet(STORAGE) ?? '') : null);
    if (restored) {
      state.current = restored; setWorkspace(restored);
      const pane = restored.panes.find(item => item.id === restored.activePaneId);
      const tab = pane?.tabs.find(item => item.id === pane.activeTabId);
      if (tab && tab.documentType !== 'decision') setSideTab('contents');
    }
    else if (hash.startsWith('#reader=')) setNotice(t.invalidWorkspace);
    history.replaceState(history.state, '', `${location.pathname}${location.search}${encodeWorkspace(state.current)}`);
    setBookmarks(readDocuments('sntiq_kerf_bookmarks_v1'));
    setRecent(readDocuments('sntiq_kerf_recent_v1'));
    const size = Number(storageGet('sntiq_kerf_reader_font'));
    if (Number.isFinite(size) && size >= 14 && size <= 22) setFontSize(size);
    setSidebar(window.innerWidth > 640 || !restored?.panes.some(pane => pane.tabs.length));
    setReady(true);
    const restore = () => {
      if (location.pathname !== '/dt/kerf') return;
      const value = decodeWorkspace(location.hash) ?? (!location.hash ? createWorkspace() : null);
      if (value) { state.current = value; setWorkspace(value); storageSet(STORAGE, encodeWorkspace(value)); }
    };
    window.addEventListener('popstate', restore); window.addEventListener('hashchange', restore);
    return () => { window.removeEventListener('popstate', restore); window.removeEventListener('hashchange', restore); };
    // The workspace is restored once; changing language must not discard open documents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = useCallback((actId: string, norm: string | null = null, mode: 'new' | 'replace' = 'new', paneId?: string, documentType: 'law' | 'decision' = 'law', at?: string) => {
    apply({ type: 'open', actId, norm, mode, paneId, documentType, at });
    const pane = state.current.panes.find(item => item.id === state.current.activePaneId);
    const opened = pane?.tabs.find(item => item.id === pane.activeTabId);
    if (!opened || opened.actId !== actId || normKey(opened.norm) !== normKey(norm)) return;
    setSideTab(documentType === 'decision' ? 'library' : 'contents');
    if (window.innerWidth <= 640) setSidebar(false);
    setRecent(previous => {
      const entry: SavedDocument = { actId, norm, ...(documentType === 'decision' ? { documentType } : {}), ...(opened.at ? { at: opened.at } : {}) };
      const next = [entry, ...previous.filter(item => savedKey(item) !== savedKey(entry))].slice(0, 16);
      storageSet('sntiq_kerf_recent_v1', JSON.stringify(next)); return next;
    });
  }, [apply]);

  useEffect(() => {
    if (ready && initialDocument) {
      open(initialDocument.actId, initialDocument.norm, 'new', undefined, initialDocument.documentType);
      onInitialDocumentConsumed?.();
    }
  }, [initialDocument?.sequence, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (sideTab === 'contents' && !hasContents) setSideTab('library');
  }, [hasContents, sideTab]);

  useEffect(() => {
    const needle = query.trim(); const controller = new AbortController();
    setSearch(null); setSearchError(false); setSearching(false);
    if (needle.length < 2) return;
    setSearching(true);
    const timer = window.setTimeout(() => {
      kerfSearch(needle, { limit: 25, normLimit: 35, lawJurisdiction: jurisdiction || undefined }, controller.signal)
        .then(value => { if (!controller.signal.aborted) setSearch(value); })
        .catch(() => { if (!controller.signal.aborted) setSearchError(true); })
        .finally(() => { if (!controller.signal.aborted) setSearching(false); });
    }, 220);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query, jurisdiction]);

  useEffect(() => {
    const controller = new AbortController();
    setEu(null);
    if (query.trim().length < 2 && jurisdiction !== 'EU') return;
    const timer = window.setTimeout(() => {
      kerfEuIndex({ q: query.trim() || undefined, limit: 20 }, controller.signal)
        .then(value => { if (!controller.signal.aborted) setEu(value); })
        .catch(() => { /* Other independent search results remain usable. */ });
    }, 220);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query, jurisdiction]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (!visible) return;
      const target = event.target as HTMLElement;
      if (event.key === 'Escape' && !event.defaultPrevented) {
        if (previews.length) setPreviews([]);
        else if (maximized) setMaximized(false);
        return;
      }
      const command = readerShortcut(event, Boolean(target.closest('input,textarea,select,[contenteditable]:not([contenteditable=false]),[role=menu],[role=listbox]')));
      if (!command) return;
      event.preventDefault();
      const current = state.current;
      const pane = current.panes.find(item => item.id === current.activePaneId)!;
      const tab = pane.tabs.find(item => item.id === pane.activeTabId);
      if (command === 'search' && !current.panes.some(item => item.tabs.length)) overviewInput.current?.focus();
      else if (command === 'search') { setMaximized(false); setSidebar(true); setSideTab('library'); window.setTimeout(() => input.current?.focus(), 0); }
      else if (command === 'search-book' && tab?.documentType !== 'decision') { setMaximized(false); setSidebar(true); setSideTab('contents'); window.setTimeout(() => bookInput.current?.focus(), 0); }
      else if (command === 'sidebar') toggleSidebar();
      else if (command === 'split-right' || command === 'split-down') { setMaximized(false); apply({ type: 'split', layout: command === 'split-right' ? 'columns' : 'rows' }); }
      else if (command === 'reopen') apply({ type: 'reopen' });
      else if (command === 'close' && tab) apply({ type: 'close-tab', paneId: pane.id, tabId: tab.id });
      else if (command === 'maximize' && current.panes.some(item => item.tabs.length)) toggleMaximized();
      else if ((command === 'read' || command === 'history' || command === 'diff' || command === 'versions') && tab) apply({ type: 'set-view', paneId: pane.id, tabId: tab.id, view: command });
      else if (command === 'next-tab' || command === 'previous-tab') {
        const index = pane.tabs.findIndex(item => item.id === pane.activeTabId);
        const next = pane.tabs[(index + (command === 'next-tab' ? 1 : -1) + pane.tabs.length) % pane.tabs.length];
        if (next) apply({ type: 'activate', paneId: pane.id, tabId: next.id });
      } else if (command === 'next-pane' || command === 'previous-pane') {
        const index = current.panes.indexOf(pane);
        const next = current.panes[(index + (command === 'next-pane' ? 1 : -1) + current.panes.length) % current.panes.length];
        apply({ type: 'activate', paneId: next.id });
      }
    };
    window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown);
  }, [apply, visible, maximized, previews.length, toggleMaximized, toggleSidebar]);

  const copy = async (value: string) => { try { await navigator.clipboard.writeText(value); setNotice(t.copied); } catch { setNotice(t.copyFailed); } };
  const toggleBookmark = (tab: SavedDocument) => setBookmarks(previous => {
    const key = savedKey(tab);
    const next = previous.some(item => savedKey(item) === key) ? previous.filter(item => savedKey(item) !== key) : [...previous, { actId: tab.actId, norm: tab.norm, ...(tab.documentType === 'decision' ? { documentType: tab.documentType } : {}), ...(tab.at ? { at: tab.at } : {}) }].slice(-50);
    storageSet('sntiq_kerf_bookmarks_v1', JSON.stringify(next)); return next;
  });
  const showPreview = (reference: ReaderReference) => setPreviews(previous => [...previous.filter(item => readerDocKey(item.actId ?? '', item.norm, 'law', item.at) !== readerDocKey(reference.actId ?? '', reference.norm, 'law', reference.at)), reference].slice(-2));
  const lawRows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const local = (acts ?? []).filter(act => !needle || `${act.jurabk} ${act.title} ${act.id}`.toLocaleLowerCase().includes(needle));
    const found = [...(search?.act_matches ?? []), ...local];
    const result = Array.from(new Map(found.map(act => [act.id, act])).values()).filter(act => !jurisdiction || act.juris === jurisdiction);
    return needle ? result : result.sort((a, b) => readerLawLabel(a).localeCompare(readerLawLabel(b), 'de', { numeric: true }));
  }, [acts, query, search, jurisdiction]);
  const normHits = (search?.norm_matches ?? []).filter(hit => !jurisdiction || hit.juris === jurisdiction);
  const catalogHits = jurisdiction && jurisdiction !== 'DE' ? [] : (search?.catalog_matches ?? []).filter(hit => /^https:\/\/www\.gesetze-im-internet\.de\//i.test(hit.url));
  const euHits = jurisdiction && jurisdiction !== 'EU' ? [] : eu?.instruments ?? [];
  const groups = useMemo(() => {
    const needle = bookQuery.trim().toLocaleLowerCase();
    // The sidebar is the table of contents; the source's own TOC pseudo-norm is not listed.
    return readerOutline(readerProvisions(activeNorms), activeLaw.data?.jurabk || '', norm => !needle
      || `${norm.enbez} ${norm.titel} ${norm.text} ${getStructuredNorm(activeStructures, activeLaw.data!, norm)?.source_annotations_text ?? ''}`.toLocaleLowerCase().includes(needle));
  }, [activeNorms, activeLaw.data, activeStructures, bookQuery]);
  const title = (tab: SavedDocument) => tab.documentType === 'decision' ? (Object.hasOwn(decisionTitles, tab.actId) ? decisionTitles[tab.actId] : tab.actId) : `${actById.has(tab.actId) ? readerLawLabel(actById.get(tab.actId)!) : tab.actId.replace(/^fed_/, '')}${tab.norm ? ` ${tab.norm}` : ''}`;
  const startSearch = () => {
    if (!state.current.panes.some(item => item.tabs.length)) { overviewInput.current?.focus(); return; }
    setMaximized(false); setSidebar(true); setSideTab('library'); window.setTimeout(() => input.current?.focus(), 0);
  };
  const showContextMenu = (event: React.MouseEvent) => {
    const element = (event.target as HTMLElement).closest<HTMLElement>('[data-reader-menu-act]');
    if (!element) return;
    event.preventDefault();
    const paneId = element.closest<HTMLElement>('[data-reader-pane]')?.dataset.readerPane;
    const tabId = element.dataset.readerMenuTab;
    const sourcePane = workspace.panes.find(pane => pane.id === paneId);
    const tab = sourcePane?.tabs.find(item => item.id === (tabId ?? sourcePane.activeTabId));
    const rect = element.getBoundingClientRect();
    setMenuTarget({ x: event.clientX || rect.left + 12, y: event.clientY || rect.top + 12,
      actId: element.dataset.readerMenuAct!, norm: element.dataset.readerMenuNorm || (tabId ? tab?.norm : null) || null,
      paneId, tabId, documentType: tab?.documentType,
      at: tab?.documentType === 'decision' ? undefined : element.dataset.readerMenuAt ?? tab?.at ?? 'HEAD' });
  };
  const menuOpen = (view: ReaderView = 'read', beside = false, axis: 'columns' | 'rows' = 'columns') => {
    if (!menuTarget) return;
    let paneId = menuTarget.paneId ?? state.current.activePaneId;
    if (menuTarget.tabId) apply({ type: 'activate', paneId, tabId: menuTarget.tabId });
    if (beside) {
      const before = state.current.panes.length;
      apply({ type: 'split', paneId, layout: axis });
      if (state.current.panes.length === before) return;
      paneId = state.current.activePaneId; setMaximized(false);
    }
    if (!menuTarget.tabId || beside) open(menuTarget.actId, menuTarget.norm, beside ? 'replace' : 'new', paneId, menuTarget.documentType, menuTarget.at);
    const pane = state.current.panes.find(item => item.id === paneId)!;
    if (pane.activeTabId) apply({ type: 'set-view', paneId, tabId: pane.activeTabId, view });
  };
  const contextTab = menuTarget?.tabId ? workspace.panes.find(pane => pane.id === menuTarget.paneId)?.tabs.find(tab => tab.id === menuTarget.tabId) : null;

  if (error || !acts) return <LoadStatus loading={!acts && !error} error={error ? error === true ? new KerfRequestError('network') : error : null} language={i18n.language} title={t.failed} onRetry={onRetry} />;
  // No open document: an overview (search, key acts, what changed, what is
  // coming, continue reading) instead of an empty reader with a second library.
  if (!hasDocuments) return <div ref={root} className={styles.reader} data-reader-workspace data-reader-empty>
    {notice && <div className={styles.notice} role="status"><span>{notice}</span><IconButton title={t.close} onClick={() => setNotice(null)}><X size={14} /></IconButton></div>}
    {ready && <ReaderOverview acts={acts} language={i18n.language} recent={recent} bookmarks={bookmarks} title={title} searchInput={overviewInput}
      onOpen={item => open(item.actId, item.norm, 'new', undefined, item.documentType, item.at)}
      canReopen={Boolean(workspace.closedTabs?.length)} onReopen={() => apply({ type: 'reopen' })} onBrowseAll={onBrowseAll} />}
  </div>;
  return <div ref={root} className={styles.reader} data-reader-workspace data-reader-maximized={readingFocus || undefined} onContextMenu={showContextMenu}>
    <div className={styles.toolbar}>
      <IconButton title={sidebarShown ? t.hideLibrary : t.showLibrary} aria-pressed={sidebarShown} onClick={toggleSidebar}>{sidebarShown ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}</IconButton>
      {/* No "Read" title here: the top bar already names the location. */}
      <span className={styles.toolbarSpacer} />
      <IconButton title={t.earlier} onClick={() => history.back()}><ArrowLeft size={16} /></IconButton>
      <IconButton title={t.later} onClick={() => history.forward()}><ArrowRight size={16} /></IconButton>
      <ToolText label={t.reopen} title={t.reopen} disabled={!workspace.closedTabs?.length} onClick={() => apply({ type: 'reopen' })} />
      <div className={styles.segmented}><IconButton title={`${w.splitRight} (Alt+Shift+Right)`} disabled={workspace.panes.length >= 4} onClick={() => { setMaximized(false); apply({ type: 'split', layout: 'columns' }); }}><SquareSplitHorizontal size={16} /></IconButton><IconButton title={`${w.splitDown} (Alt+Shift+Down)`} disabled={workspace.panes.length >= 4} onClick={() => { setMaximized(false); apply({ type: 'split', layout: 'rows' }); }}><SquareSplitVertical size={16} /></IconButton></div>
      <IconButton data-reader-maximize title={`${maximized ? w.restore : w.maximize} (Alt+Shift+Enter)`} aria-pressed={maximized} onClick={toggleMaximized}>{maximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</IconButton>
      <IconButton title={t.share} onClick={() => void copy(`${location.origin}${location.pathname}${encodeWorkspace(state.current)}`)}><Link2 size={17} /></IconButton>
    </div>
    {(compact || maximized) && workspace.panes.length > 1 && <div className={desk.viewModes}>{workspace.panes.map((pane, index) => <button key={pane.id} aria-pressed={pane.id === workspace.activePaneId} onClick={() => apply({ type: 'activate', paneId: pane.id })}>{index + 1} · {pane.tabs.find(tab => tab.id === pane.activeTabId) ? title(pane.tabs.find(tab => tab.id === pane.activeTabId)!) : t.pane}</button>)}</div>}
    {notice && <div className={styles.notice} role="status"><span>{notice}</span><IconButton title={t.close} onClick={() => setNotice(null)}><X size={14} /></IconButton></div>}
    <SplitPanes id="kerf-reader-side" label={w.resize}
      mode={sidebarShown ? (overlaySidebar ? 'stack' : 'split') : 'second'}
      defaultSize="254px" minSize="180px" maxSize="45%" secondMinSize="40%"
      className={styles.split} firstClassName={styles.splitSide} secondClassName={styles.splitMain}
      first={<aside className={styles.sidebar} aria-label={t.library}>
        <div className={styles.sideTabs}>
          <button aria-pressed={sideTab === 'library'} onClick={() => setSideTab('library')}>{t.library}</button>
          <button aria-pressed={sideTab === 'contents'} disabled={!hasContents} onClick={() => setSideTab('contents')}>{t.contents}</button>
          <button aria-pressed={sideTab === 'bookmarks'} onClick={() => setSideTab('bookmarks')}>{t.bookmarks}</button>
        </div>
        {sideTab === 'library' && <>
          <div className={`sntiq-search ${styles.search}`}><Search size={15} aria-hidden="true" /><input className="sntiq-field sntiq-field-sm" ref={input} aria-label={t.search} placeholder={t.search} value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { if (normHits[0]) open(normHits[0].act_id, normHits[0].enbez); else if (lawRows[0]) open(lawRows[0].id); } }} />{query && <IconButton title={t.clear} onClick={() => setQuery('')}><X size={13} /></IconButton>}</div>
          <div className={styles.filters}><select className="sntiq-field sntiq-field-sm" value={jurisdiction} aria-label={t.filter} onChange={event => setJurisdiction(event.target.value)}><option value="">{t.all}</option><option value="DE">{t.federal}</option><option value="DE-BY">{t.bavaria}</option><option value="EU">EU</option></select></div>
          <div className={styles.scrollList}>
            {searching && <div className={styles.listHeader} role="status"><Loader2 size={13} className="animate-spin" />{t.queryPending}</div>}
            {searchError && <div className={styles.listHeader} role="alert">{t.failed}</div>}
            {normHits.map((hit, index) => <button key={`${hit.act_id}:${hit.enbez}:${index}`} className={styles.lawRow} data-reader-menu-act={hit.act_id} data-reader-menu-norm={hit.enbez} onClick={() => open(hit.act_id, hit.enbez)}><strong>{hit.jurabk} {hit.enbez}</strong><small>{hit.norm_title}</small><em>{hit.snippet}</em></button>)}
            {lawRows.map(act => <button key={act.id} className={styles.lawRow} data-reader-menu-act={act.id} onClick={() => open(act.id)}><strong>{readerLawLabel(act)}<span className="text-muted text-[10px]">{act.juris}</span></strong><small>{act.title}</small></button>)}
            {catalogHits.map(hit => <a key={hit.id} className={styles.lawRow} href={hit.url} target="_blank" rel="noopener noreferrer"><strong>{hit.abbrev}<ExternalLink size={12} /></strong><small>{hit.title}</small><em>{t.catalog} · GII</em></a>)}
            {euHits.map(hit => <div key={hit.celex} className={styles.lawRow}><a href={`https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:${encodeURIComponent(hit.celex)}`} target="_blank" rel="noopener noreferrer"><strong>{hit.celex}</strong><ExternalLink size={12} /></a><small>{hit.title}</small><div className={styles.listHeader}><span>EUR-Lex · {formatDay(hit.date)}</span><a href={`https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:${encodeURIComponent(hit.celex)}`} target="_blank" rel="noopener noreferrer">DE</a><a href={`https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:${encodeURIComponent(hit.celex)}`} target="_blank" rel="noopener noreferrer">EN</a></div></div>)}
            {query && !searching && !searchError && (search as { status?: string } | null)?.status === 'partial' && <div className={styles.listHeader} role="status">{readerEditionCopy(i18n.language).partialSearch}</div>}
            {query && !searching && !searchError && (search as { status?: string } | null)?.status !== 'partial' && !normHits.length && !lawRows.length && !catalogHits.length && !euHits.length && <div className={styles.empty}>{t.noResults}</div>}
          </div>
        </>}
        {sideTab === 'contents' && <>
          <div className={`sntiq-search ${styles.search}`}><Search size={15} aria-hidden="true" /><input className="sntiq-field sntiq-field-sm" ref={bookInput} aria-label={t.searchBook} placeholder={t.searchBook} value={bookQuery} onChange={event => setBookQuery(event.target.value)} />{bookQuery && <IconButton title={t.clear} onClick={() => setBookQuery('')}><X size={13} /></IconButton>}</div>
          <div className={styles.listHeader}><span>{activeLaw.data && readerLawLabel(activeLaw.data)}</span><IconButton title={collapsed ? t.expand : t.collapse} onClick={() => { setCollapsed(value => !value); setTocRevision(value => value + 1); }}>{collapsed ? <ChevronsUpDown size={15} /> : <ChevronsDownUp size={15} />}</IconButton></div>
          {activeTab && <button className={`${styles.normRow} ${!activeTab.norm ? styles.active : ''}`} onClick={() => open(activeTab.actId, null, 'replace', undefined, 'law', activeTab.at)}>{t.fullText}</button>}
          <div className={styles.scrollList}>
            {activeTab?.at && (activeEdition.error || !activeEdition.data) ? <LoadStatus compact loading={activeEdition.loading} error={activeEdition.error} language={i18n.language} title={t.editionUnavailable} onRetry={activeEdition.retry} />
              : activeLaw.error || !activeLaw.data ? <LoadStatus compact loading={activeLaw.loading} error={activeLaw.error} language={i18n.language} title={t.failed} label={t.loadingProvisions} onRetry={activeLaw.retry} /> : groups.map(({ label: group, norms, start }) => <details key={`${activeTab?.actId}:${start}:${tocRevision}:${Boolean(bookQuery)}`} className={styles.tocGroup} open={bookQuery ? true : !collapsed}>
              <summary>{group}</summary>{norms.map((norm, index) => <button key={`${norm.enbez}:${index}`} className={`${styles.normRow} ${normKey(activeTab?.norm) === normKey(readerDesignator(norm)) ? styles.active : ''}`} data-reader-menu-act={activeTab?.actId} data-reader-menu-norm={readerDesignator(norm)} data-reader-menu-at={activeTab?.at} onClick={event => activeTab && open(activeTab.actId, readerDesignator(norm), event.ctrlKey || event.metaKey ? 'new' : 'replace', undefined, 'law', activeTab.at)}><strong>{norm.enbez}</strong>{norm.titel}</button>)}
            </details>)}
          </div>
        </>}
        {sideTab === 'bookmarks' && <div className={styles.scrollList}>
          <div className={styles.listHeader}><Bookmark size={13} /><span>{t.bookmarks}</span></div>
          {bookmarks.map(item => <div className={styles.followRow} key={savedKey(item)}><button className={styles.lawRow} onClick={() => open(item.actId, item.norm, 'new', undefined, item.documentType, item.at)}><strong>{title(item)}</strong>{item.at && <small>{item.at}</small>}</button><IconButton title={t.close} onClick={() => toggleBookmark(item)}><X size={13} /></IconButton></div>)}
          {!bookmarks.length && <p className={styles.listHeader}>{t.noResults}</p>}
          <div className={styles.listHeader}><History size={13} /><span>{t.recent}</span></div>
          {recent.map(item => <button key={savedKey(item)} className={styles.lawRow} onClick={() => open(item.actId, item.norm, 'new', undefined, item.documentType, item.at)}><strong>{title(item)}</strong>{item.at && <small>{item.at}</small>}</button>)}
        </div>}
      </aside>}
      second={<ReaderTiles workspace={workspace} single={compact || maximized} label={w.resize} onResize={(path, ratio) => apply({ type: 'resize-tile', path, ratio }, false)} render={id => {
          const paneIndex = workspace.panes.findIndex(pane => pane.id === id);
          const pane = workspace.panes[paneIndex];
          const tab = pane.tabs.find(item => item.id === pane.activeTabId);
          const act = tab ? actById.get(tab.actId) : null;
          return <ReaderPaneView key={pane.id} pane={pane} paneIndex={paneIndex} workspace={workspace} tab={tab} acts={acts} t={t} active={workspace.activePaneId === pane.id} apply={apply}
            onOpen={(actId, norm, mode) => open(actId, norm, mode, pane.id, 'law', actId === tab?.actId ? tab.at : undefined)} onSearch={startSearch} title={title} fontSize={fontSize}
            setFontSize={value => { setFontSize(value); storageSet('sntiq_kerf_reader_font', String(value)); }} onHistory={onHistory}
            onDecisions={() => act && onDecisions(act.jurabk)} onCopy={copy} bookmarks={bookmarks} toggleBookmark={toggleBookmark}
            onOpenDecision={id => open(id, null, 'new', pane.id, 'decision')} onDecisionTitle={(id, label) => setDecisionTitles(previous => previous[id] === label ? previous : { ...previous, [id]: label })}
            query={tab ? bookQueries[`${tab.id}:${savedKey(tab)}`] ?? '' : ''} showReferences={Object.hasOwn(references, pane.id) && Boolean(references[pane.id])}
            toggleReferences={() => setReferences(value => ({ ...value, [pane.id]: !(Object.hasOwn(value, pane.id) && value[pane.id]) }))} onReference={showPreview} scrollPositions={scrollPositions} dragged={dragged} setDragged={setDragged} onMenu={setMenuTarget} />;
        }} />}
    />
    {previews.length > 0 && <div className={styles.previews}>{previews.map(reference => <Preview key={readerDocKey(reference.actId ?? '', reference.norm, 'law', reference.at)} reference={reference} acts={acts} onReference={showPreview} t={t}
      onClose={() => setPreviews(items => items.filter(item => item !== reference))}
      onOpen={beside => {
        if (!reference.actId) return;
        if (beside) {
          const count = state.current.panes.length;
          if (count >= 4) { setNotice(t.workspaceLimit); return; }
          setMaximized(false);
          apply({ type: 'split' });
          if (state.current.panes.length === count) { setNotice(t.workspaceLimit); return; }
        }
        open(reference.actId, reference.norm ?? null, beside ? 'replace' : 'new', undefined, 'law', reference.at);
        setPreviews(items => items.filter(item => item !== reference));
      }} />)}</div>}
    {menuTarget && <ReaderContextMenu x={menuTarget.x} y={menuTarget.y} label={w.menu} onClose={closeMenu} items={[
      { label: w.newTab, icon: <Plus size={15} />, action: () => menuOpen() },
      { label: w.beside, icon: <SquareSplitHorizontal size={15} />, action: () => menuOpen('read', true), disabled: workspace.panes.length >= 4 },
      { label: w.splitDown, icon: <SquareSplitVertical size={15} />, action: () => menuOpen('read', true, 'rows'), disabled: workspace.panes.length >= 4 },
      { label: w.history, icon: <History size={15} />, action: () => menuOpen('history'), disabled: menuTarget.documentType === 'decision' },
      { label: w.diff, icon: <GitCompareArrows size={15} />, action: () => menuOpen('diff'), disabled: menuTarget.documentType === 'decision' },
      { label: w.copyLink, icon: <Link2 size={15} />, action: () => {
        const shared = workspaceReducer(createWorkspace(), { type: 'open', actId: menuTarget.actId, norm: menuTarget.norm, mode: 'new', documentType: menuTarget.documentType, at: menuTarget.at });
        void copy(`${location.origin}${location.pathname}${encodeWorkspace(shared)}`);
      } },
      ...(contextTab && menuTarget.paneId ? [
        { label: contextTab.pinned ? w.unpin : w.pin, icon: <Pin size={15} />, action: () => apply({ type: 'pin-tab', paneId: menuTarget.paneId!, tabId: contextTab.id }) },
        // Reordering lives with the tab it moves, not in the reading footer,
        // where two bare chevrons read as "previous / next provision".
        ...(() => {
          const tabs = workspace.panes.find(item => item.id === menuTarget.paneId)?.tabs ?? [];
          const index = tabs.findIndex(item => item.id === contextTab.id);
          return [
            { label: t.moveLeft, icon: <ArrowLeft size={15} />, action: () => apply({ type: 'reorder-tab', paneId: menuTarget.paneId!, tabId: contextTab.id, index: index - 1 }), disabled: index <= 0 },
            { label: t.moveRight, icon: <ArrowRight size={15} />, action: () => apply({ type: 'reorder-tab', paneId: menuTarget.paneId!, tabId: contextTab.id, index: index + 1 }), disabled: index < 0 || index >= tabs.length - 1 },
          ];
        })(),
        { label: w.closeOthers, icon: <CopyX size={15} />, action: () => apply({ type: 'close-others', paneId: menuTarget.paneId!, tabId: contextTab.id }) },
        { label: w.close, icon: <X size={15} />, action: () => apply({ type: 'close-tab', paneId: menuTarget.paneId!, tabId: contextTab.id }) },
      ] : []),
    ]} />}
  </div>;
}

function ReaderPaneView({ pane, paneIndex, workspace, tab, acts, t, active, apply, onOpen, onSearch, title, fontSize, setFontSize, onHistory, onDecisions, onOpenDecision, onDecisionTitle, onCopy, bookmarks, toggleBookmark, query, showReferences, toggleReferences, onReference, scrollPositions, dragged, setDragged, onMenu }: {
  pane: ReaderPane; paneIndex: number; workspace: ReaderWorkspace; tab?: ReaderTab; acts: KerfAct[]; t: ReaderCopy; active: boolean;
  apply: (action: ReaderAction, push?: boolean) => void; onOpen: (actId: string, norm: string | null, mode?: 'new' | 'replace') => void;
  onSearch: () => void; title: (tab: SavedDocument) => string; fontSize: number; setFontSize: (size: number) => void;
  onHistory: (actId: string, norm?: string | null) => void; onDecisions: () => void; onCopy: (text: string) => Promise<void>;
  onOpenDecision: (id: string) => void; onDecisionTitle: (id: string, title: string) => void;
  bookmarks: SavedDocument[]; toggleBookmark: (tab: SavedDocument) => void; query: string; showReferences: boolean;
  toggleReferences: () => void; onReference: (reference: ReaderReference) => void; scrollPositions: React.MutableRefObject<Map<string, ScrollPosition>>;
  dragged: { paneId: string; tabId: string } | null; setDragged: (value: { paneId: string; tabId: string } | null) => void;
  onMenu: (target: MenuTarget) => void;
}) {
  const isDecision = tab?.documentType === 'decision';
  const law = useReaderAct(!isDecision ? tab?.actId ?? null : null);
  const { data } = law;
  // The edition archive (picker, history, compare) waits for the text itself.
  const archive = useReaderArchive(!isDecision && data ? tab?.actId ?? null : null);
  const edition = useReaderEdition(!isDecision ? tab?.actId ?? null : null, tab?.at, tab?.norm ?? null);
  const { i18n } = useTranslation();
  const w = readerWorkbenchCopy(i18n.language);
  const view = tab?.view ?? 'read';
  const historyCopy = changeHistoryCopy(i18n.language);
  const versionsLabel = tab?.norm ? w.normVersions : historyCopy.actVersions;
  // A saved date pair (and a dated checkout) belongs to the document archive.
  // With a provision open, the normal comparison uses its own wording history.
  const provisionDiff = view === 'diff' && tab?.norm && (tab.comparison?.kind === 'norm' || !tab.at && !tab.comparison);
  const [selectedEvent, setSelectedEvent] = useState<{ tabId: string; id?: string; request: number } | null>(null);
  const [versionsMode, setVersionsMode] = useState<{ tabId: string; mode: NormHistoryMode } | null>(null);
  const setView = (view: ReaderView) => { if (tab) apply({ type: 'set-view', paneId: pane.id, tabId: tab.id, view }); };
  const showHistory = (id?: string) => { if (tab) setSelectedEvent(previous => ({ tabId: tab.id, id, request: (previous?.request ?? 0) + 1 })); setView('history'); };
  const [decision, setDecision] = useState<LoadedDecision | null>(null);
  const decisionViewport = useRef<HTMLDivElement>(null);
  const decisionScrollKey = tab ? `${tab.id}:${savedKey(tab)}` : '';
  useLayoutEffect(() => { if (decisionViewport.current && decision?.id === tab?.actId) decisionViewport.current.scrollTop = scrollPositions.current.get(decisionScrollKey)?.top ?? 0; }, [decisionScrollKey, decision, tab?.actId, scrollPositions]);
  const fullEdition = useReaderEdition(!isDecision ? tab?.actId ?? null : null, tab?.at, null);
  // Navigation, counts and exports cover provisions, not the TOC pseudo-norm.
  const norms = useMemo(() => readerProvisions(tab?.at ? fullEdition.data ? archiveNorms(fullEdition.data.markdown) : [] : data?.norms ?? []), [tab?.at, fullEdition.data, data]);
  const selectedNorms = tab?.norm ? readerNormMatches(norms, tab.norm) : norms;
  const normIndex = tab?.norm && selectedNorms.length === 1 ? norms.indexOf(selectedNorms[0]) : -1;
  const ambiguous = Boolean(tab?.norm && needsArticleChoice(selectedNorms));
  const currentIndex = pane.tabs.findIndex(item => item.id === tab?.id);
  const drop = (event: React.DragEvent, index?: number) => {
    if (!dragged) return;
    event.preventDefault(); event.stopPropagation();
    apply(dragged.paneId === pane.id && index !== undefined ? { type: 'reorder-tab', paneId: pane.id, tabId: dragged.tabId, index } : { type: 'move-tab', fromPaneId: dragged.paneId, toPaneId: pane.id, tabId: dragged.tabId, index });
    setDragged(null);
  };
  return <section className={styles.pane} data-reader-pane={pane.id} data-active={active} aria-label={`${t.pane} ${paneIndex + 1}`} onFocusCapture={() => { if (!active) apply({ type: 'activate', paneId: pane.id }, false); }} onPointerDownCapture={() => { if (!active) apply({ type: 'activate', paneId: pane.id }, false); }}>
    <div className={styles.tabBar} onDragOver={event => { if (dragged) event.preventDefault(); }} onDrop={event => drop(event)}>
      <div className={styles.tabs} role="tablist" aria-label={`${t.pane} ${paneIndex + 1}`}>
        {pane.tabs.map((item, index) => <div key={item.id} role="tab" tabIndex={item.id === pane.activeTabId ? 0 : -1} aria-selected={item.id === pane.activeTabId} aria-controls={`reader-content-${pane.id}`} className={styles.tab} draggable data-dragging={dragged?.tabId === item.id} title={title(item)} data-reader-menu-act={item.actId} data-reader-menu-tab={item.id}
          onAuxClick={event => { if (event.button === 1 && !item.pinned) { event.preventDefault(); apply({ type: 'close-tab', paneId: pane.id, tabId: item.id }); } }}
          onClick={() => apply({ type: 'activate', paneId: pane.id, tabId: item.id })}
          onKeyDown={event => {
            if (event.target !== event.currentTarget) return;
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); apply({ type: 'activate', paneId: pane.id, tabId: item.id }); }
            if (event.key === 'Delete') { event.preventDefault(); apply({ type: 'close-tab', paneId: pane.id, tabId: item.id }); }
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              event.preventDefault(); const next = pane.tabs[(index + (event.key === 'ArrowLeft' ? -1 : 1) + pane.tabs.length) % pane.tabs.length];
              apply({ type: 'activate', paneId: pane.id, tabId: next.id });
              (event.currentTarget.parentElement?.children[(index + (event.key === 'ArrowLeft' ? -1 : 1) + pane.tabs.length) % pane.tabs.length] as HTMLElement)?.focus();
            }
          }}
          onDragStart={event => { setDragged({ paneId: pane.id, tabId: item.id }); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', item.id); }} onDragEnd={() => setDragged(null)} onDragOver={event => { if (dragged) event.preventDefault(); }} onDrop={event => drop(event, index)}>
          {item.pinned && <Pin size={12} />}<span>{title(item)}</span><IconButton title={`${t.closeTab}: ${title(item)}`} tabIndex={item.id === pane.activeTabId ? 0 : -1} onClick={event => { event.stopPropagation(); apply({ type: 'close-tab', paneId: pane.id, tabId: item.id }); }}><X size={12} /></IconButton>
        </div>)}
      </div>
      <IconButton title={t.newTab} onClick={onSearch}><Plus size={16} /></IconButton>
      {tab && <IconButton title={w.menu} onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); onMenu({ x: rect.left, y: rect.bottom, actId: tab.actId, norm: tab.norm, paneId: pane.id, tabId: tab.id, documentType: tab.documentType, at: tab.at }); }}><MoreHorizontal size={16} /></IconButton>}
      {workspace.panes.length > 1 && <IconButton title={t.closePane} onClick={() => apply({ type: 'close-pane', paneId: pane.id })}><X size={15} /></IconButton>}
    </div>
    {tab && <div className={styles.paneTools}>
      {!isDecision && <>
      <IconButton title={t.previous} disabled={normIndex <= 0} onClick={() => onOpen(tab.actId, readerDesignator(norms[normIndex - 1]), 'replace')}><ChevronLeft size={17} /></IconButton>
      <IconButton title={t.next} disabled={ambiguous || !norms.length || normIndex >= norms.length - 1} onClick={() => onOpen(tab.actId, readerDesignator(norms[normIndex + 1]), 'replace')}><ChevronRight size={17} /></IconButton>
      <ToolText label={t.fullText} aria-pressed={!tab.norm} onClick={() => onOpen(tab.actId, null, 'replace')} />
      <ToolText label={t.references} disabled={Boolean(tab.at)} aria-pressed={showReferences && !tab.at} onClick={toggleReferences} />
      </>}
      <IconButton title={t.bookmark} aria-pressed={bookmarks.some(item => savedKey(item) === savedKey(tab))} onClick={() => toggleBookmark(tab)}><Bookmark size={15} /></IconButton>
      <span className={styles.spacer} />
      <IconButton title={t.fontSmaller} disabled={fontSize <= 14} onClick={() => setFontSize(fontSize - 1)}><AArrowDown size={17} /></IconButton>
      <IconButton title={t.fontLarger} disabled={fontSize >= 22} onClick={() => setFontSize(fontSize + 1)}><AArrowUp size={17} /></IconButton>
      <IconButton title={t.copy} disabled={ambiguous || (isDecision ? decision?.id !== tab.actId || !decision.text : tab.at ? !edition.data : !data)} onClick={() => void onCopy(isDecision ? decision?.text ?? '' : tab.at ? stripTocPlaceholders(edition.data?.markdown ?? '') : provisionsText(selectedNorms))}><Copy size={15} /></IconButton>
      {!isDecision && !ambiguous && <a className={styles.icon} title={t.download} aria-label={t.download} href={kerfActMarkdownUrl(tab.actId, { at: tab.at ?? 'HEAD', norm: tab.norm ?? undefined, download: true })}
        onClick={event => { if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); void downloadMarkdownExport(event.currentTarget.href, `${(data ? readerLawLabel(data) : tab.actId).replace(/[^\p{L}\p{N}._ -]+/gu, '_')}${tab.norm ? ` ${tab.norm.replace(/[^\p{L}\p{N}._ -]+/gu, '_')}` : ''}${tab.at ? ` ${tab.at}` : ''}.md`); }}><Download size={15} /></a>}
    </div>}
    {tab && !isDecision && <div className={styles.editionBar}>
      <ReaderEditionPicker key={tab.id} archive={archive.data} value={tab.at ?? 'HEAD'} language={i18n.language} label={t.edition} onChange={at => { apply({ type: 'set-version', paneId: pane.id, tabId: tab.id, at }); setView('read'); }} onHistory={showHistory} />
      {archive.error && <IconButton title={t.retry} onClick={archive.retry}><RotateCcw size={13} /></IconButton>}
      <div className={`${desk.viewModes} ${desk.editionModes}`} role="group" aria-label={w.read}>
        <button aria-label={w.read} aria-pressed={view === 'read'} title={`${w.read} (Alt+Shift+R)`} onClick={() => setView('read')}><span>{w.read}</span></button>
        <button aria-label={w.actHistory} aria-pressed={view === 'history'} title={`${w.actHistory} (Alt+Shift+H)`} onClick={() => showHistory()}><span className={desk.modeFull}>{w.actHistory}</span><span className={desk.modeShort}>{w.history}</span></button>
        <button aria-label={w.diff} aria-pressed={view === 'diff'} title={`${w.diff} (Alt+Shift+D)`} onClick={() => setView('diff')}><span>{w.diff}</span></button>
        <button aria-label={versionsLabel} aria-pressed={view === 'versions'} title={`${versionsLabel} (Alt+Shift+V)`} onClick={() => { setVersionsMode(null); setView('versions'); }}><span className={desk.modeFull}>{versionsLabel}</span><span className={desk.modeShort}>{historyCopy.versions}</span></button>
      </div>
    </div>}
    <div id={`reader-content-${pane.id}`} role="tabpanel" style={{ display: 'flex', flex: 1, minHeight: 0, flexDirection: 'column' }}>
      {tab ? isDecision ? <div key={decisionScrollKey} ref={decisionViewport} className={styles.viewport} data-reader-scroll={tab.id} onScroll={event => { if (decision?.id === tab.actId) scrollPositions.current.set(decisionScrollKey, { top: event.currentTarget.scrollTop }); }}><div className={styles.document} style={{ '--reader-font': `${fontSize}px` } as React.CSSProperties}><ReaderDecision decisionId={tab.actId} acts={acts} t={t} onReference={onReference} onOpenLaw={onOpen} onOpenDecision={onOpenDecision} onLoaded={value => { setDecision(value); onDecisionTitle(value.id, value.az || value.id); }} /></div></div>
        : provisionDiff ? <NormHistory key={`compare:${tab.id}:${tab.actId}:${tab.norm}`} actId={tab.actId} norm={tab.norm} language={i18n.language}
          comparison={{ value: tab.comparison, onChange: comparison => apply({ type: 'set-comparison', paneId: pane.id, tabId: tab.id, comparison }),
            onArchive: () => onOpen(tab.actId, null, 'replace') }} />
        : view === 'versions' ? <NormHistory key={`${tab.id}:${tab.actId}:${tab.norm}:${versionsMode?.tabId === tab.id ? versionsMode.mode : ''}`} actId={tab.actId} norm={tab.norm} language={i18n.language}
          initialMode={versionsMode?.tabId === tab.id ? versionsMode.mode : undefined}
          onCompare={comparison => { apply({ type: 'set-comparison', paneId: pane.id, tabId: tab.id, comparison }); setView('diff'); }} onOpenNorm={norm => onOpen(tab.actId, norm, 'replace')} />
        : view !== 'read' ? law.error || archive.error || !archive.data ? <LoadStatus loading={law.loading || archive.loading} error={law.error ?? archive.error} language={i18n.language} title={t.failed} onRetry={law.error ? law.retry : archive.retry} onCancel={law.error ? undefined : law.loading ? law.cancel : archive.cancel} resetKey={`${tab.actId}:${view}`} />
          : view === 'history' ? <ReaderHistory key={tab.id} archive={archive.data} language={i18n.language} selectedId={selectedEvent?.tabId === tab.id ? selectedEvent.id : undefined} selectionRequest={selectedEvent?.tabId === tab.id ? selectedEvent.request : undefined} />
          : <ReaderComparison key={`${tab.id}:${tab.actId}:${tab.norm}`} actId={tab.actId} norm={tab.norm} at={tab.at} archive={archive.data} language={i18n.language} value={tab.comparison} onChange={comparison => apply({ type: 'set-comparison', paneId: pane.id, tabId: tab.id, comparison })} />
        : <DocumentView key={tab.id} tab={tab} acts={acts} t={t} fontSize={fontSize} query={query} showReferences={showReferences} onReference={onReference} onOpen={onOpen} onHistory={(id, norm) => { onOpen(id, norm ?? null, 'replace'); if (norm) { setVersionsMode(null); setView('versions'); } else showHistory(); }}
          onChanges={() => { setVersionsMode({ tabId: tab.id, mode: 'changes' }); setView('versions'); }} scrollPositions={scrollPositions} />
        : <div className={styles.empty}><Library size={28} /><p>{t.noDocuments}</p><div className={styles.welcomeLaws}>{acts.filter(act => ['fed_asylvfg_1992', 'fed_aufenthg_2004', 'fed_sgb_12', 'fed_sgb_2', 'fed_bgb', 'fed_gg'].includes(act.id)).map(act => <button key={act.id} className={styles.lawRow} onClick={() => onOpen(act.id, null)}><strong>{readerLawLabel(act)}</strong><small>{act.title}</small></button>)}</div><button className={styles.textButton} onClick={onSearch}><Search size={15} />{t.search}</button></div>}
    </div>
    {tab && <div className={styles.paneFooter}>
      <span data-pane-status>{isDecision ? (decision?.id === tab.actId ? decision.court : t.decisions)
        : law.error || (tab.at && fullEdition.error) ? t.notLoaded
        : law.loading || !data || (tab.at && (fullEdition.loading || !fullEdition.data)) ? `${t.loadingProvisions}…`
        : `${norms.length} ${t.provisions}`}</span>
      {workspace.panes.length > 1 && <select className="sntiq-field sntiq-field-sm w-auto max-w-[150px]" aria-label={t.move} value="" onChange={event => { if (event.target.value) apply({ type: 'move-tab', fromPaneId: pane.id, toPaneId: event.target.value, tabId: tab.id }); }}><option value="">{t.move}</option>{workspace.panes.filter(item => item.id !== pane.id).map(item => <option key={item.id} value={item.id}>{t.pane} {workspace.panes.indexOf(item) + 1}</option>)}</select>}
      {!isDecision && <ToolText label={t.decisions} onClick={onDecisions} />}
    </div>}
  </section>;
}
