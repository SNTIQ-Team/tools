'use client';

/**
 * Taper — browse the authority graph behind Chamfer:
 *
 *   place search → [Behörden] competent offices per kind, with
 *                  supervisory bodies and caveats
 *                → [Gerichte] court instance chains per legal matter
 *   any authority → graph drawer: full card + related edges
 *                   (parent / supervision / appeal), click to walk the
 *                   graph with a breadcrumb trail.
 *
 * First iteration: hierarchic + chain views. A force-directed canvas
 * mode can plug into the same drawer state later.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle, ArrowLeft, ArrowRight, ChevronRight,
  ExternalLink, Info, Loader2, OctagonAlert, Search, X,
} from 'lucide-react';
import { useModuleActions } from '@/core/shell/ModuleActions';
import ModuleBand from '@/core/shell/ModuleBand';
import {
  agCourtChain, agDetail, agMatters, agResolve, agSearchPlaces,
  VIEW_KINDS, type AgAuthority, type AgDetail, type AgMatter,
  type AgChainEntry, type AgCaveat, type AgPlace, type AgResolution,
} from './client';
import GermanyGraph from './GermanyGraph';
import TreeOutline from './TreeOutline';
import css from './taper.module.css';
import './i18n/register';

/** German official names — the fallback when a kind has no translation. */
const KIND_LABELS: Record<string, string> = {
  auslaenderbehoerde: 'Ausländerbehörde',
  sozialamt: 'Sozialamt',
  asylblg_behoerde: 'AsylbLG',
  jobcenter: 'Jobcenter',
  jugendamt: 'Jugendamt',
  wohngeldstelle: 'Wohngeldstelle',
  standesamt: 'Standesamt',
};

const EU_RELATIONS = new Set([
  'institutional_part', 'political_accountability', 'judicial_review',
  'co_legislation', 'reporting_accountability', 'financial_audit',
  'maladministration_review', 'sectoral_oversight',
]);

/** Places offered on the start screen (a town, a postcode, two big cities). */
const EXAMPLES = ['Erding', '85435', 'München', 'Berlin'];

/* ── shared presentation ────────────────────────────────────────────────
   View switches are plain text tabs with an ink rule under the current one
   (the same idiom as Chamfer's stepper and Lathe's view tabs); a two-way
   choice inside a view is a pair of small buttons. Both are ≥ 40px tall. */
/* High-contrast mode frames every button and flattens the colours: rows get
   a little side padding there, and "selected" is said with an underline. */
const HC_PAD = '[.high-contrast_&]:px-2';
const HC_ON = '[.high-contrast_&]:underline [.high-contrast_&]:decoration-2 [.high-contrast_&]:underline-offset-4';
/* Windows forced colours drop backgrounds and paint transparent borders, so
   "selected" is redrawn there with a system-colour outline. */
const FC_ON = 'forced-colors:outline forced-colors:outline-2 forced-colors:-outline-offset-2 forced-colors:outline-[Highlight]';
const TAB = `relative -mb-px forced-colors:mb-0 inline-flex min-h-11 items-center border-b-2 text-[0.9375rem] leading-tight transition-colors ${HC_PAD}`;
const TAB_ON = `border-[var(--c-text-main)] font-semibold text-main forced-colors:border-[Highlight] ${FC_ON} ${HC_ON}`;
const TAB_OFF = 'border-transparent font-medium text-muted hover:text-[var(--c-link)] forced-colors:border-[Canvas]';
const SEG = 'inline-flex min-h-10 items-center rounded-lg border px-3 text-sm font-semibold transition-colors';
const SEG_ON = `border-[var(--c-text-main)] text-main ${FC_ON} ${HC_ON}`;
const SEG_OFF = 'border-[var(--panel-border)] text-muted hover:text-main';
const ROW = `group flex w-full items-start gap-3 py-3 text-left ${HC_PAD}`;
const STATUS = 'flex items-center gap-2 py-3 text-sm text-main';
/* The module header metric shared with Chamfer and Lathe: a
   breadcrumb line that starts 7rem below the top of the page (the wrapper's
   pt-28), then the title. On the start screen the title is the module name;
   inside a view the name steps back into the breadcrumb line and the place
   (or the graph) takes the same title slot at the same size. */
// Large and light (DESIGN.md section 4): the open place or graph.
const TITLE = 'text-[clamp(2rem,3.6vw,3rem)] font-light leading-[1.05] tracking-[-0.024em] text-main';
/* The shared input with a boundary that is visible on the page background
   and one focus ring instead of ring + glow. */

/** A note that belongs to a result: the icon carries the severity, the text
 *  stays in the normal ink (status colours are too weak for small type). */
const Notice: React.FC<{
  severity: string; lang?: string; children: React.ReactNode;
}> = ({ severity, lang, children }) => {
  const Icon = severity === 'block' ? OctagonAlert
    : severity === 'warn' ? AlertTriangle : Info;
  return (
    <p className="flex items-start gap-2 py-2 text-sm leading-relaxed text-main">
      <Icon aria-hidden="true"
            className={`mt-0.5 h-4 w-4 shrink-0 ${
              severity === 'block' ? 'text-[var(--c-bad)]'
                : severity === 'warn' ? 'text-[var(--c-warn)]' : 'text-muted'}`} />
      <span lang={lang} className="min-w-0 break-words">{children}</span>
    </p>
  );
};

const RelatedEdges: React.FC<{
  edges: AgDetail['related'];
  direction: 'outgoing' | 'incoming';
  onOpen: (id: number) => void;
}> = ({ edges, direction, onOpen }) => {
  const { t } = useTranslation('taper');
  if (edges.length === 0) return null;
  return (
    <section>
      <h5 className="sntiq-kicker pb-2">
        {t(`edges.${direction}`)}
      </h5>
      <div className="sntiq-rule">
        {edges.map((e, i) => {
          const sourceUrl = e.source_url && /^https?:\/\//.test(e.source_url)
            ? e.source_url : null;
          return (
            <div key={`${direction}-${e.id}-${i}`} className="sntiq-row">
              <button type="button" onClick={() => onOpen(e.id)}
                      className={ROW}>
                <span className="min-w-0 flex-1">
                  <span className="sntiq-kicker block" data-tone="accent">
                    {t(`rel.${e.relation}`, { defaultValue: e.relation })}
                    {e.matter ? ` · ${e.matter}` : ''}
                  </span>
                  <span className="mt-0.5 block break-words text-[0.9375rem] font-medium leading-snug text-main group-hover:text-[var(--c-link)]">
                    {e.name}
                  </span>
                  {e.note && (
                    <span className="mt-1.5 block text-[13px] leading-relaxed text-muted">
                      <span className="block font-semibold">
                        {t('relationNoteGerman')}
                      </span>
                      <span lang="de">{e.note}</span>
                    </span>
                  )}
                </span>
                <ChevronRight aria-hidden="true"
                              className="mt-1 h-4 w-4 shrink-0 text-muted" />
              </button>
              {(e.source || sourceUrl) && (
                <div className="-mt-2 pb-1 text-[13px] text-muted">
                  {sourceUrl ? (
                    <a href={sourceUrl} target="_blank" rel="noopener noreferrer"
                       className="sntiq-link inline-flex min-h-10 items-center gap-1">
                      {e.source ?? t('relationSource')}
                      <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <span className="inline-flex min-h-8 items-center">{e.source}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

/** One office as a row of a ruled list (opens its card). */
const AuthorityCardView: React.FC<{
  a: AgAuthority;
  onOpen: (id: number) => void;
  /** small label above the name, e.g. the court type */
  badge?: string;
}> = ({ a, onOpen, badge }) => {
  const { t } = useTranslation('taper');
  return (
    <button
      type="button"
      onClick={() => onOpen(a.id)}
      className={ROW}
    >
      <span className="min-w-0 flex-1">
        {badge && <span className="sntiq-kicker mb-0.5 block">{badge}</span>}
        <span className="block break-words text-base font-semibold leading-snug text-main group-hover:text-[var(--c-link)]">
          {a.name}
        </span>
        <span className="mt-1 block text-sm leading-snug text-muted">
          {[a.street, `${a.plz ?? ''} ${a.city ?? ''}`.trim()]
            .filter(Boolean).join(' · ')}
        </span>
        {(a.fax || a.email) && (
          <span className="mt-0.5 block break-words text-sm leading-snug text-muted">
            {[a.fax && `${t('contact.fax')} ${a.fax}`, a.email]
              .filter(Boolean).join(' · ')}
          </span>
        )}
      </span>
      <ChevronRight aria-hidden="true"
                    className="mt-1 h-4 w-4 shrink-0 text-muted" />
    </button>
  );
};

const AuthorityContacts: React.FC<{ a: AgAuthority }> = ({ a }) => {
  const { t } = useTranslation('taper');
  const address = a.postal_address ?? [
    a.street,
    [a.plz, a.city].filter(Boolean).join(' '),
  ].filter(Boolean).join('\n');
  const verifiedEu = a.kind.startsWith('eu_') &&
    Boolean(a.contact_sources?.length);
  if (!address && !a.phone && !a.fax && !a.email && !a.web) return null;
  const term = 'pt-2.5 text-[13px] font-semibold text-muted sm:pb-2.5';
  const value = 'min-w-0 break-words pb-2.5 text-[0.9375rem] leading-snug text-main sm:pt-2.5';
  const row = 'sntiq-row grid grid-cols-1 gap-x-4 sm:grid-cols-[7.5rem_minmax(0,1fr)]';
  return (
    <section className="mt-6">
      <h4 className="pb-2 text-[0.9375rem] font-semibold text-main">
        {t('contact.title')}
      </h4>
      <dl className="sntiq-rule">
        {address && (
          <div className={row}>
            <dt className={term}>{t('contact.address')}</dt>
            <dd className={value}>
              <address className="whitespace-pre-line not-italic">{address}</address>
            </dd>
          </div>
        )}
        {a.phone && (
          <div className={row}>
            <dt className={term}>{t('contact.phone')}</dt>
            <dd className={value}>
              <a className="sntiq-link" href={`tel:${a.phone.replace(/[^+\d]/g, '')}`}>
                {a.phone}
              </a>
            </dd>
          </div>
        )}
        {(a.email || verifiedEu) && (
          <div className={row}>
            <dt className={term}>{t('contact.email')}</dt>
            <dd className={value}>
              {a.email
                ? <a className="sntiq-link break-all" href={`mailto:${a.email}`}>{a.email}</a>
                : <span className="text-muted">{t('contact.notPublished')}</span>}
            </dd>
          </div>
        )}
        {(a.fax || verifiedEu) && (
          <div className={row}>
            <dt className={term}>{t('contact.fax')}</dt>
            <dd className={value}>
              {a.fax ?? (
                <span className="text-muted">
                  {a.fax_unavailable_reason === 'not_used'
                    ? t('contact.faxNotUsed') : t('contact.notPublished')}
                </span>
              )}
            </dd>
          </div>
        )}
      </dl>
      {a.web && (
        <a href={a.web} target="_blank" rel="noopener noreferrer"
           className="sntiq-link mt-1 inline-flex min-h-10 items-center gap-1.5 text-[0.9375rem] font-semibold">
          {t('contact.website')}
          <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
        </a>
      )}
      {a.contact_sources && a.contact_sources.length > 0 && (
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          <span>{t('contact.verified', { date: a.contact_verified_at })}</span>
          <span aria-hidden="true"> · </span>
          {a.contact_sources.map((source, i) => (
            <React.Fragment key={source.url}>
              {i > 0 && <span aria-hidden="true"> · </span>}
              <a href={source.url} target="_blank" rel="noopener noreferrer"
                 className="sntiq-link inline-flex items-center gap-1">
                {source.label}
                <ExternalLink aria-hidden="true" className="h-3 w-3" />
              </a>
            </React.Fragment>
          ))}
        </p>
      )}
    </section>
  );
};

/** drawer that walks the graph: card + edges, with the way back */
const GraphDrawer: React.FC<{
  stack: AgDetail[];
  loading: boolean;
  onOpen: (id: number) => void;
  onBack: () => void;
  onClose: () => void;
  onShowInGraph: (n: AgDetail) => void;
}> = ({ stack, loading, onOpen, onBack, onClose, onShowInGraph }) => {
  const { t } = useTranslation('taper');
  const node = stack[stack.length - 1];
  const previous = stack[stack.length - 2];
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  // A dialog: Escape closes it, focus moves in and returns on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    panel.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus?.({ preventScroll: true });
    };
  }, []);
  // every node starts at its top
  useEffect(() => { panel.current?.scrollTo({ top: 0 }); }, [node?.id]);
  const iconButton = 'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted hover:text-main';
  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-end bg-black/50 sm:items-stretch"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* phone: a sheet from the bottom; wider: a drawer on the right, so the
          graph it belongs to stays visible beside it */}
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={node?.name ?? t('graph')}
        tabIndex={-1}
        className="sntiq-float flex max-h-[88dvh] w-full flex-col overflow-y-auto bg-[var(--panel-bg)] overscroll-contain rounded-b-none px-5 pb-6 outline-none sm:max-h-none sm:w-[30rem] sm:max-w-[92vw] sm:rounded-none sm:border-y-0 sm:border-r-0 sm:px-6"
      >
        <div className="sticky top-0 z-10 -mx-5 flex items-center gap-1 border-b border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 sm:-mx-6 sm:px-4">
          {stack.length > 1 ? (
            <button type="button" onClick={onBack} aria-label={t('back')}
                    className={iconButton}>
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            </button>
          ) : <span className="w-2 shrink-0" />}
          <span className="sntiq-kicker min-w-0 flex-1 truncate">
            {previous ? previous.name : t('graph')}
          </span>
          <button type="button" onClick={onClose} aria-label={t('close')}
                  className={iconButton}>
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        {loading || !node ? (
          <div role="status" className={`${STATUS} min-h-40`}>
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            {t('loading')}
          </div>
        ) : (
          <>
            <p className="sntiq-kicker pt-5" data-tone="accent">
              {t(`kind.${node.kind}`, {
                defaultValue: KIND_LABELS[node.kind] ?? node.kind,
              })}
            </p>
            <h3 className="mt-1 break-words text-xl font-bold leading-tight tracking-tight text-main sm:text-2xl">
              {node.name}
            </h3>
            <AuthorityContacts a={node} />

            <h4 className="mt-7 pb-2 text-[0.9375rem] font-semibold text-main">
              {t('edges')}
            </h4>
            {(node.kind.startsWith('eu_') ||
              [...node.related, ...(node.related_incoming ?? [])]
                .some((e) => EU_RELATIONS.has(e.relation))) && (
              <p className="pb-4 text-[13px] leading-relaxed text-muted">
                {t('euRelationsCaveat')}
              </p>
            )}
            {node.related.length === 0 &&
             (node.related_incoming ?? []).length === 0 && (
              <p className="text-sm text-muted">{t('noEdges')}</p>
            )}
            <div className="space-y-6">
              <RelatedEdges edges={node.related} direction="outgoing"
                            onOpen={onOpen} />
              <RelatedEdges edges={node.related_incoming ?? []}
                            direction="incoming" onOpen={onOpen} />
            </div>
            <button
              type="button"
              className="sntiq-btn sntiq-btn-primary mt-7 w-full"
              onClick={() => onShowInGraph(node)}
            >
              {t('showInGraph')}
            </button>
            <p className="mt-4 text-[13px] leading-relaxed text-muted">
              {t('provenance', {
                source: node.provenance.source,
                date: node.provenance.fetched_at?.slice(0, 10) ?? '',
              })}
            </p>
          </>
        )}
      </div>
    </div>
  );
};

const TaperModule: React.FC = () => {
  const { t } = useTranslation('taper');
  useModuleActions('taper',
    { footerNote: <span>{t('footer')}</span> }, [t]);

  const [query, setQuery] = useState('');
  const [result, setResult] = useState<{query: string; places: AgPlace[]} | null>(null);
  const matches = result?.query === query.trim() ? result.places : [];
  // what the place search is doing, so silence is never the answer
  const [searchState, setSearchState] =
    useState<'idle' | 'pending' | 'done' | 'error'>('idle');
  const matchList = useRef<HTMLUListElement>(null);
  const searchField = useRef<HTMLInputElement>(null);
  const placeHeading = useRef<HTMLHeadingElement>(null);
  const [place, setPlace] = useState<AgPlace | null>(null);
  const [germany, setGermany] = useState(false);
  const [germanyMode, setGermanyMode] = useState<'graph' | 'tree'>('graph');
  const [tab, setTab] = useState<'authorities' | 'courts' | 'graph'>('authorities');
  const [chainPlz, setChainPlz] = useState('');
  const [chainOrtKey, setChainOrtKey] = useState<string | null>(null);

  const [resolutions, setResolutions] =
    useState<Record<string, AgResolution | null>>({});
  const [loadingAuth, setLoadingAuth] = useState(false);

  const [matters, setMatters] = useState<AgMatter[]>([]);
  const [matter, setMatter] = useState('verwaltung');
  const [chain, setChain] = useState<AgChainEntry[] | null>(null);
  const [chainCaveats, setChainCaveats] = useState<AgCaveat[]>([]);
  const [missingCourtPlace, setMissingCourtPlace] = useState(false);
  // a failed request is not "no chain recorded": keep the two apart
  const [chainError, setChainError] = useState(false);
  const [chainOrtOptions, setChainOrtOptions] =
    useState<{ ort: string; ortk: string }[] | null>(null);
  const [loadingChain, setLoadingChain] = useState(false);

  const [extraFocus, setExtraFocus] = useState<number[]>([]);
  // amber thread: place authorities -> competent Verwaltungsgericht
  const [courtIds, setCourtIds] = useState<number[]>([]);
  // place graph: tight neighbourhood by default, full map on demand
  const [localView, setLocalView] = useState(true);
  const [stack, setStack] = useState<AgDetail[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const drawerRequest = useRef<AbortController | null>(null);
  useEffect(() => () => drawerRequest.current?.abort(), []);

  // ---------------------------------------------------- place search
  useEffect(() => {
    if (query.trim().length < 2) {
      setResult(null); setSearchState('idle'); return;
    }
    const ctl = new AbortController();
    setSearchState('pending');
    const id = setTimeout(() => {
      agSearchPlaces(query.trim(), ctl.signal)
        .then((r) => {
          if (ctl.signal.aborted) return;
          setResult({ query: query.trim(), places: r.matches });
          setSearchState('done');
        })
        .catch(() => { if (!ctl.signal.aborted) setSearchState('error'); });
    }, 250);
    return () => { clearTimeout(id); ctl.abort(); };
  }, [query]);

  // Only a confirmed postcode may seed the court resolver.
  useEffect(() => {
    setChainPlz(place?.plz ?? '');
    setChainOrtKey(null);
  }, [place]);

  // The graph follows the same explicit postcode/locality as the courts tab.
  useEffect(() => {
    setCourtIds([]);
    if (!place || !/^\d{5}$/.test(chainPlz)) return;
    const ctl = new AbortController();
    agCourtChain(chainPlz, 'verwaltung', chainOrtKey ? undefined : place.name, ctl.signal, chainOrtKey ?? undefined)
      .then((r) => {
        if (ctl.signal.aborted) return;
        const first = r.chain?.find(c => c.role === 'court' && c.position === 1);
        if (first) setCourtIds([first.id]);
      })
      .catch(() => {});
    return () => ctl.abort();
  }, [place, chainPlz, chainOrtKey]);

  // ------------------------------------------------- authorities tab
  useEffect(() => {
    if (!place) return;
    setLoadingAuth(true);
    setResolutions({});
    const ctl = new AbortController();
    Promise.allSettled(
      VIEW_KINDS.map(async (k) => {
        try {
          const r = await agResolve(place.ags, k, ctl.signal);
          if (!ctl.signal.aborted) setResolutions((m) => ({ ...m, [k]: r }));
        } catch {
          if (!ctl.signal.aborted) setResolutions((m) => ({ ...m, [k]: null }));
        }
      }),
    ).finally(() => { if (!ctl.signal.aborted) setLoadingAuth(false); });
    agMatters(ctl.signal)
      .then((m) => { if (!ctl.signal.aborted) setMatters(m.filter((x) => x.core)); })
      .catch(() => {});
    return () => ctl.abort();
  }, [place]);

  // ------------------------------------------------------ courts tab
  useEffect(() => {
    setChain(null);
    setChainCaveats([]);
    setMissingCourtPlace(false);
    setChainError(false);
    setChainOrtOptions(null);
    setLoadingChain(false);
    if (!place || tab !== 'courts') return;
    const plz = chainPlz;
    if (!/^\d{5}$/.test(plz)) return;
    const ctl = new AbortController();
    setLoadingChain(true);
    setChain(null);
    setChainError(false);
    setChainOrtOptions(null);
    agCourtChain(plz, matter, chainOrtKey ? undefined : place.name, ctl.signal, chainOrtKey ?? undefined)
      .then((r) => {
        if (ctl.signal.aborted) return;
        setChainCaveats(r.caveats ?? []);
        setMissingCourtPlace(Boolean(r.missingPlace));
        if (r.needs_ort && r.options) setChainOrtOptions(r.options);
        else setChain(r.chain ?? []);
      })
      .catch(() => { if (!ctl.signal.aborted) setChainError(true); })
      .finally(() => { if (!ctl.signal.aborted) setLoadingChain(false); });
    return () => ctl.abort();
  }, [place, tab, matter, chainPlz, chainOrtKey]);

  const pickOrt = (ortk: string) => {
    // Keep explicit register identity across matter changes. The effect
    // owns cancellation when the postcode/place is edited or we unmount.
    setChainOrtKey(ortk);
  };

  // ------------------------------------------------------ graph walk
  const cancelDrawerLoad = useCallback(() => {
    drawerRequest.current?.abort();
    drawerRequest.current = null;
    setDrawerLoading(false);
  }, []);
  const closeDrawer = useCallback(() => {
    cancelDrawerLoad();
    setDrawerOpen(false);
    setStack([]);
  }, [cancelDrawerLoad]);
  const openNode = useCallback((id: number) => {
    drawerRequest.current?.abort();
    const controller = new AbortController();
    drawerRequest.current = controller;
    setDrawerOpen(true);
    setDrawerLoading(true);
    agDetail(id, controller.signal)
      .then((d) => { if (!controller.signal.aborted) setStack((s) => [...s, d]); })
      // no error UI in the drawer: fall back to the previous node, or
      // close the drawer if this was the first load (nothing to show)
      .catch(() => { if (!controller.signal.aborted && stack.length === 0) setDrawerOpen(false); })
      .finally(() => { if (!controller.signal.aborted) setDrawerLoading(false); });
  }, [stack.length]);

  // A picked place clears the field for the next one and leaves the graph;
  // the focus goes to its name, since the hit that held it is gone.
  const choosePlace = (m: AgPlace) => {
    setPlace(m);
    setQuery('');
    setGermany(false);
  };
  useEffect(() => { if (place) placeHeading.current?.focus({ preventScroll: true }); }, [place]);

  // Enter / the button never guesses: a single hit is taken (the same choice
  // as clicking its row), several hits move the focus to the list.
  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (matches.length === 1 && !/^\d{3,4}$/.test(query.trim())) choosePlace(matches[0]);
    else matchList.current?.querySelector('button')?.focus();
  };

  // The API ranks prefix hits alphabetically ("Berlingen" before "Berlin"):
  // show an exact name first. Display order only — the hits are untouched.
  const wanted = query.trim().toLocaleLowerCase('de');
  const shownMatches = [...matches].sort((a, b) =>
    Number(b.name.toLocaleLowerCase('de') === wanted) -
    Number(a.name.toLocaleLowerCase('de') === wanted));

  const kindName = (k: string) =>
    t(`kind.${k}`, { defaultValue: KIND_LABELS[k] ?? k });
  const courts = (chain ?? []).filter(c => c.role === 'court').sort((a, b) => a.position - b.position);
  const prosecution = (chain ?? []).filter(c => c.role === 'prosecution');
  const start = !place && !germany;
  const plzValid = /^\d{5}$/.test(chainPlz);

  // The hits of the band's search. On entry they stand under the band; while
  // a place or the graph is open they stand above it until one is picked or
  // the field is cleared (Escape), so the open view is never thrown away.
  const hits = (
    <div className={start ? 'min-h-11' : undefined} aria-live="polite">
      {matches.length > 0 ? (
        <div className={start ? 'pb-8' : 'pb-6'}>
          <p className="sntiq-kicker pb-2">{t('matchesTitle')}</p>
          <ul ref={matchList} className="sntiq-rule">
            {shownMatches.map((m) => (
              <li key={`${m.ags}-${m.plz ?? ''}`} className="sntiq-row">
                <button type="button" data-taper-match=""
                        className={`${ROW} !items-center`}
                        onClick={() => choosePlace(m)}>
                  <span className="min-w-0 flex-1">
                    <span lang="de" translate="no"
                          className="block break-words text-lg font-medium leading-snug text-main group-hover:text-[var(--c-link)]">
                      {m.plz && <span className={css.data}>{m.plz} </span>}
                      {m.name}
                    </span>
                    <span lang="de" translate="no" className="mt-0.5 block text-sm text-muted">
                      {[m.kreis !== m.name && m.kreis, m.land]
                        .filter(Boolean).join(', ')}
                    </span>
                  </span>
                  <ChevronRight aria-hidden="true"
                                className="h-4 w-4 shrink-0 text-muted" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : searchState === 'pending' ? (
        <p className={STATUS}>
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          {t('searching')}
        </p>
      ) : searchState === 'done' ? (
        <p className={STATUS}>{t('noPlaces', { q: query.trim() })}</p>
      ) : searchState === 'error' ? (
        <Notice severity="warn">{t('searchError')}</Notice>
      ) : null}
    </div>
  );

  return (
    // The start screen is one short block: it takes its own height, so the
    // footer follows it instead of a screen-high void.
    <div data-module="taper" className={`w-full ${start ? 'pb-16' : 'min-h-screen pb-20'}`}>
      {/* The module's band (ModuleBand, DESIGN.md section 7) with the place
          search on it: the tool's one main action. At work the band folds
          to a strip and the search stays in it. */}
      <ModuleBand
        module="taper"
        name="Taper"
        line={t('lead')}
        compact={!start}
        crumbsLabel={t('a11y:breadcrumb')}
        crumbs={[{ href: '/', label: 'SNTIQ' }, { href: '/#projects', label: 'Deutschland Together' }]}
      >
        <form onSubmit={submitSearch} role="search">
          <label htmlFor="taper-place" className={start ? 'sntiq-kicker mb-1.5 block' : 'sr-only'}>
            {t('searchLabel')}
          </label>
          <div className="flex items-stretch gap-2">
            <div className="sntiq-search flex-1">
              <Search aria-hidden="true" />
              <input
                ref={searchField}
                id="taper-place"
                type="text"
                // On a phone in large-text mode not even a short example
                // fits beside the button: there the label and the examples
                // below carry the hint.
                className={`sntiq-field ${start ? 'h-12 sm:text-[1.0625rem]' : 'h-11 min-h-11'} max-sm:[.large-text_&]:placeholder:text-transparent`}
                value={query}
                autoFocus={start}
                autoComplete="off"
                enterKeyHint="search"
                placeholder={t('searchPlaceholder')}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape' && query) { e.preventDefault(); setQuery(''); } }}
              />
            </div>
            <button type="submit"
                    className={`sntiq-btn sntiq-btn-primary ${css.go} shrink-0 ${start ? 'h-12 px-5 sm:px-6' : 'h-11 px-4'}`}>
              {t('searchBtn')}
            </button>
          </div>
        </form>
        {start && (
          <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-sm text-muted">
            {/* own line on a phone: four places never fit beside it */}
            <span className="basis-full pt-1 sm:basis-auto sm:pt-0">{t('examples')}:</span>
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                className="sntiq-link inline-flex min-h-10 items-center pr-2.5 text-[0.9375rem] font-medium sm:pl-1 sm:pr-1"
                onClick={() => setQuery(example)}
              >
                {example}
              </button>
            ))}
          </p>
        )}
      </ModuleBand>

      <div className="px-4 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-screen-xl">
        {!start && query.trim().length >= 2 && <div className="max-w-3xl">{hits}</div>}

        {/* whole-Germany graph — no place needed */}
        {germany && !place && (
          <div>
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
              <h2 className={`min-w-0 ${TITLE}`}>
                {t('germanyTitle')}
              </h2>
              <button
                type="button"
                className="sntiq-btn"
                onClick={() => { setGermany(false); searchField.current?.focus(); }}
              >
                <ArrowLeft aria-hidden="true" className="h-4 w-4" /> {t('back')}
              </button>
            </div>
            <div role="group" aria-label={t('viewSwitch')}
                 className="mt-4 mb-5 flex gap-6 border-b border-[var(--panel-border)]">
              {(['graph', 'tree'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={germanyMode === m}
                  onClick={() => setGermanyMode(m)}
                  className={`${TAB} ${germanyMode === m ? TAB_ON : TAB_OFF}`}
                >
                  {t(`mode.${m}`)}
                </button>
              ))}
            </div>
            {germanyMode === 'graph'
              ? <GermanyGraph onInspect={openNode} focusIds={extraFocus} />
              : <TreeOutline onInspect={openNode} />}
          </div>
        )}

        {/* start: the hits (or the search state), then the door to the
            whole graph */}
        {start && (
          <div className="max-w-3xl">
            {/* The line under the band is also where a search status is
                written, so the door does not jump while a search is
                running; a list of hits pushes it down. */}
            {hits}
            <button
              type="button"
              className={`group flex w-full items-baseline justify-between gap-4 border-t border-b border-t-[var(--c-text-main)] border-b-[var(--panel-border)] pt-3.5 pb-4 text-left text-main ${HC_PAD}`}
              onClick={() => setGermany(true)}
            >
              <span className="min-w-0">
                <span className="block text-[1.1875rem] font-medium leading-tight tracking-[-0.016em] group-hover:text-[var(--c-link)]">
                  {t('germanyBtn')}
                </span>
                <span className="mt-1 block text-[0.9375rem] leading-snug text-muted">
                  {t('germanyDoor')}
                </span>
              </span>
              <ArrowRight aria-hidden="true"
                          className="h-5 w-5 shrink-0 translate-y-0.5 group-hover:text-[var(--c-link)]" />
            </button>
          </div>
        )}

        {place && (
          <div>
            <div className="min-w-0">
              <h2 ref={placeHeading} tabIndex={-1} lang="de" translate="no"
                  className={`break-words ${css.heading} ${TITLE}`}>
                {/* In the large light title the code stays in the title's face
                    (the mono's single weight would shout); muted, so the name leads. */}
                {place.plz && <span className="tabular-nums text-muted">{place.plz} </span>}
                {place.name}
              </h2>
              <p lang="de" translate="no" className="mt-2 text-[0.9375rem] text-muted">
                {[place.kreis !== place.name && place.kreis, place.land]
                  .filter(Boolean).join(', ')}
              </p>
            </div>
            <div role="group" aria-label={t('viewSwitch')}
                 className="mt-4 mb-6 flex gap-6 border-b border-[var(--panel-border)]">
              {(['authorities', 'courts', 'graph'] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={tab === id}
                  onClick={() => setTab(id)}
                  className={`${TAB} ${tab === id ? TAB_ON : TAB_OFF}`}
                >
                  {t(`tab.${id}`)}
                </button>
              ))}
            </div>

            {tab === 'authorities' && (() => {
              const sections = VIEW_KINDS.map((k) => {
                const r = resolutions[k];
                if (!r) return null;
                // several listed offices are shown as such: the first
                // candidate is not the answer (the API selects none)
                const offices = r.resolved ? [r.resolved] : r.candidates;
                const main = offices[0];
                if (!main) return null;
                // same office often serves several kinds — show once
                // (only a unique resolution is folded into another kind)
                const kinds = r.resolved
                  ? VIEW_KINDS.filter(kind => resolutions[kind]?.resolved?.id === main.id)
                  : [k];
                if (kinds[0] !== k) return null;
                return (
                  <section key={k}
                           className="sntiq-row grid grid-cols-1 gap-x-8 py-4 md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
                    <h3 className="text-[0.9375rem] font-semibold leading-snug text-main md:pt-3">
                      {kinds.map(kind => <span key={kind} className="block">{kindName(kind)}</span>)}
                    </h3>
                    <div className="min-w-0">
                      {offices.length > 1 && (
                        <Notice severity="warn">
                          {t('multipleCandidates', {
                            n: offices.length,
                            kind: KIND_LABELS[k] ?? k,
                          })}
                        </Notice>
                      )}
                      <div className="divide-y divide-[var(--panel-border)]">
                        {offices.map((a) => (
                          <AuthorityCardView key={a.id} a={a} onOpen={openNode} />
                        ))}
                      </div>
                      {kinds.map(kind => {
                        const details = resolutions[kind]!;
                        if (!details.supervisory.length && !details.caveats?.length) return null;
                        return (
                          <div key={kind}>
                            {kinds.length > 1 && <p className="mt-3 font-semibold">{kindName(kind)}</p>}
                            {details.supervisory.length > 0 && (
                              <div className="pt-1">
                                <p className="sntiq-kicker">{t('supervisedBy')}</p>
                                {details.supervisory.map((sup) => (
                                  <button
                                    key={sup.id}
                                    type="button"
                                    onClick={() => openNode(sup.id)}
                                    className={`sntiq-link flex min-h-10 items-center text-left text-[0.9375rem] ${HC_PAD}`}
                                  >
                                    <span className="min-w-0 break-words">{sup.name}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                            {(details.caveats ?? []).map((c, ci) => (
                              <Notice key={ci} severity={c.severity} lang="de">
                                {c.text_de}
                              </Notice>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              });
              const settled = !loadingAuth;
              const empty = settled && !sections.some(Boolean);
              return (
                <div className="-mt-3 min-h-40">
                  {loadingAuth && Object.keys(resolutions).length === 0 && (
                    <div role="status" className={STATUS}>
                      <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                      {t('loading')}
                    </div>
                  )}
                  {sections}
                  {empty && (
                    VIEW_KINDS.every((k) => resolutions[k] === null)
                      ? <Notice severity="warn">{t('authError')}</Notice>
                      : <p className={STATUS}>{t('noAuthorities')}</p>
                  )}
                </div>
              );
            })()}

            {tab === 'courts' && (
              <div className="max-w-3xl">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[11rem_minmax(0,1fr)]">
                  <div>
                    <label htmlFor="taper-plz" className="sntiq-kicker mb-1.5 block">
                      {t('postcode')}
                    </label>
                    <input
                      id="taper-plz"
                      type="text"
                      inputMode="numeric"
                      maxLength={5}
                      aria-describedby={plzValid ? undefined : 'taper-plz-hint'}
                      className="sntiq-field tabular-nums"
                      value={chainPlz}
                      onChange={(e) => {
                        setChainPlz(e.target.value.replace(/\D/g, ''));
                        setChainOrtKey(null);
                      }}
                    />
                  </div>
                  {/* under its field on a phone, under both fields on a desk */}
                  {!plzValid && (
                    <p id="taper-plz-hint"
                       className="-mt-2 text-sm leading-relaxed text-muted sm:order-last sm:col-span-2">
                      {t('enterPostcode')}
                    </p>
                  )}
                  <div className="min-w-0">
                    <label htmlFor="taper-matter" className="sntiq-kicker mb-1.5 block">
                      {t('matter')}
                    </label>
                    <div className="relative">
                      <select
                        id="taper-matter"
                        lang="de"
                        className="sntiq-field"
                        value={matter}
                        onChange={(e) => setMatter(e.target.value)}
                      >
                        {matters.map((m) => (
                          <option key={m.code} value={m.code}>{m.label_de}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="mt-6 min-h-40" aria-live="polite">
                  {loadingChain && (
                    <div role="status" className={STATUS}>
                      <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                      {t('loading')}
                    </div>
                  )}
                  {chainOrtOptions && (
                    <div>
                      <p className="pb-2 text-[0.9375rem] font-semibold text-main">{t('pickOrt')}</p>
                      <div className="sntiq-rule">
                        {chainOrtOptions.map((o) => (
                          <button key={o.ortk} type="button"
                                  className={`sntiq-row group flex min-h-11 w-full items-center gap-3 py-2 text-left ${HC_PAD}`}
                                  onClick={() => pickOrt(o.ortk)}>
                            <span className="min-w-0 flex-1 break-words text-base text-main group-hover:text-[var(--c-link)]">
                              {o.ort}
                              {chainOrtOptions.filter((x) => x.ort === o.ort).length > 1 && (
                                <span className="ml-2 tabular-nums text-xs text-muted">{o.ortk}</span>
                              )}
                            </span>
                            <ChevronRight aria-hidden="true"
                                          className="h-4 w-4 shrink-0 text-muted" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {chainError && !loadingChain && (
                    <Notice severity="warn">{t('chainError')}</Notice>
                  )}
                  {chain && !courts.length && !loadingChain && (
                    <p className={STATUS}>{t(missingCourtPlace ? 'noCourtPlace' : 'noChain')}</p>
                  )}
                  {courts.length > 0 && (
                    <>
                      <p className="sntiq-kicker pb-2">{t('chainTitle')}</p>
                      <ol className="sntiq-rule">
                        {courts.map((c, i) => (
                          <li key={`${c.id}-${i}`}
                              className="sntiq-row grid grid-cols-[1.75rem_minmax(0,1fr)]">
                            <span className="pt-3.5 text-sm font-semibold tabular-nums text-muted">
                              {c.position}
                            </span>
                            <AuthorityCardView
                              a={c} onOpen={openNode}
                              badge={kindName(c.kind)}
                            />
                          </li>
                        ))}
                      </ol>
                    </>
                  )}
                  {prosecution.length > 0 && (
                    <section>
                      <h3 className="sntiq-kicker mt-5 pb-2">{t('prosecutionTitle')}</h3>
                      {prosecution.map(c =>
                        <AuthorityCardView key={c.id} a={c} onOpen={openNode} badge={kindName(c.kind)} />)}
                    </section>
                  )}
                  {chainCaveats.map((c, i) => (
                    <Notice key={i} severity={c.severity} lang="de">{c.text_de}</Notice>
                  ))}
                </div>
              </div>
            )}
            {tab === 'graph' && (() => {
              const focusIds: number[] = [];
              for (const k of VIEW_KINDS) {
                const r = resolutions[k];
                if (!r) continue;
                for (const a of r.resolved ? [r.resolved] : r.candidates) {
                  if (!focusIds.includes(a.id)) focusIds.push(a.id);
                }
                for (const sup of r.supervisory) {
                  if (!focusIds.includes(sup.id)) focusIds.push(sup.id);
                }
              }
              const allFocus = [...focusIds, ...extraFocus, ...courtIds];
              const threads: [number, number][] = courtIds.length
                ? focusIds.slice(0, 3).map((f) =>
                    [f, courtIds[0]] as [number, number])
                : [];
              return (
                <div>
                  <div role="group" aria-label={t('viewSwitch')}
                       className="mb-3 flex flex-wrap gap-2">
                    {([['local', true], ['full', false]] as const)
                      .map(([k, v]) => (
                      <button
                        key={k}
                        type="button"
                        aria-pressed={localView === v}
                        onClick={() => setLocalView(v)}
                        className={`${SEG} ${localView === v ? SEG_ON : SEG_OFF}`}
                      >
                        {t(`view.${k}`)}
                      </button>
                    ))}
                  </div>
                  <GermanyGraph onInspect={openNode}
                                focusIds={allFocus}
                                focusLinks={threads}
                                localView={localView} />
                </div>
              );
            })()}
          </div>
        )}
      </div>
      </div>

      {drawerOpen && (
        <GraphDrawer
          stack={stack}
          loading={drawerLoading}
          onOpen={openNode}
          onBack={() => { cancelDrawerLoad(); setStack((s) => s.slice(0, -1)); }}
          onClose={closeDrawer}
          onShowInGraph={(n) => {
            setExtraFocus((xs) => xs.includes(n.id) ? xs : [...xs, n.id]);
            closeDrawer();
            if (place) setTab('graph');
            else setGermany(true);
          }}
        />
      )}
    </div>
  );
};

export default TaperModule;
