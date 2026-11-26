/**
 * Indexable permalink for one court decision (Rechtsprechung) — a static,
 * German-first document page rendered on the server so search engines can
 * crawl what the Kerf SPA (/dt/kerf) only shows client-side. All
 * four summary languages are rendered for multilingual indexing.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, ExternalLink } from 'lucide-react';
import { kerfUrl, SITE_URL } from '@/core/config';
import type { KerfDecision } from '@/modules/kerf/client';
import { isKerfRequestError, kerfGetJson } from '@/modules/kerf/kerfRequest';
import {
  effectNormLabel, groupEffectsByKind, humanizeKind, sameText,
} from '@/modules/kerf/kerfLabels';
import doc from '@/modules/kerf/documentPage.module.css';

export const revalidate = 3600;

/** Effect kinds: German group headings (mirrors the de locale of the Kerf
 *  module — this page is a German-first document) and the status tone of the
 *  heading: bad = the norm falls, warn = at the EuGH, link = interpreted,
 *  ok = applied. `cited` is a mention only and is labelled as such. */
const EFFECT_META: Record<string, { tone: string; label: string }> = {
  disapplied: { tone: 'bad', label: 'Unangewendet gelassen' },
  incompatible: { tone: 'bad', label: 'Für unionsrechtswidrig erklärt' },
  referred: { tone: 'warn', label: 'Dem EuGH vorgelegt' },
  interpreted: { tone: 'link', label: 'Ausgelegt' },
  applied: { tone: 'ok', label: 'Angewendet' },
  cited: { tone: 'muted', label: 'Zitiert – nur Erwähnung, keine festgestellte Wirkung' },
};
const effectTone = (k: string) => EFFECT_META[k]?.tone ?? 'muted';
/** Never print a raw machine kind: unknown kinds are made readable. */
const effectLabel = (k: string) => EFFECT_META[k]?.label ?? humanizeKind(k);

const REL_LABEL: Record<string, string> = {
  follows: 'folgt', answers: 'beantwortet', cites: 'zitiert',
};

/** The four summary sections — `lang` is the BCP-47 tag for the markup. */
const SUMMARY_LANGS = [
  { key: 'de', lang: 'de', label: 'Deutsch' },
  { key: 'en', lang: 'en', label: 'English' },
  { key: 'ru', lang: 'ru', label: 'Русский' },
  { key: 'ua', lang: 'uk', label: 'Українська' },
] as const;

/** German-first page: ISO days are shown as DD.MM.YYYY. */
const fmtDate = (d: string | null | undefined) => {
  const day = d?.slice(0, 10);
  const match = day ? /^(\d{4})-(\d{2})-(\d{2})$/u.exec(day) : null;
  return match ? `${match[3]}.${match[2]}.${match[1]}` : day || '—';
};

async function getDecision(id: string): Promise<KerfDecision | null> {
  try {
    return await kerfGetJson<KerfDecision>(kerfUrl(`/decisions/${encodeURIComponent(id)}`));
  } catch (error) {
    if (isKerfRequestError(error) && error.kind === 'not_found') return null;
    throw error;
  }
}

export async function generateMetadata({ params }: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const d = await getDecision(id);
  if (!d) return { title: 'Entscheidung nicht gefunden', robots: { index: false, follow: false } };
  const title = `${d.az}, ${d.court_short}: ${d.title}`;
  const description = d.summary.de.length > 155
    ? `${d.summary.de.slice(0, 152).trimEnd()}…`
    : d.summary.de;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/dt/kerf/entscheidungen/${d.id}` },
    openGraph: { type: 'article', title, description, url: `${SITE_URL}/dt/kerf/entscheidungen/${d.id}` },
  };
}

export default async function DecisionPage({ params }: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const d = await getDecision(id);
  if (!d) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: d.title,
    datePublished: d.date,
    inLanguage: 'de',
    author: { '@type': 'Organization', name: 'SNTIQ' },
    publisher: { '@type': 'Organization', name: 'SNTIQ' },
    mainEntityOfPage: `${SITE_URL}/dt/kerf/entscheidungen/${d.id}`,
  };

  return (
    <div className={doc.page} data-width="narrow">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />

      <nav aria-label="Breadcrumb" className={doc.crumbs}>
        <Link href="/">SNTIQ</Link>
        <span aria-hidden="true">/</span>
        <Link href="/#projects">Deutschland Together</Link>
        <span aria-hidden="true">/</span>
        <Link href="/dt/kerf">Kerf</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{d.az}</span>
      </nav>

      <article className={doc.article}>
        <header>
          <p className={doc.kicker}>
            <span>{d.level}</span>
            {d.court_short !== d.level && <span>{d.court_short}</span>}
            <span>{d.az}</span>
            <span>{fmtDate(d.date)}</span>
            <span>{d.kind}</span>
          </p>
          <h1>{d.title}</h1>
          {/* Empty metadata rows are omitted, never rendered as 'Verfahren:'. */}
          {(d.court || d.proc?.trim()) && (
            <p className={doc.lead}>
              {[d.court, d.proc?.trim() ? `Verfahren: ${d.proc.trim()}` : null]
                .filter(Boolean).join(' · ')}
            </p>
          )}
        </header>

        {/* A summary that merely repeats the headline is not shown twice. */}
        {SUMMARY_LANGS.map(({ key, lang, label }) =>
          d.summary[key] && !sameText(d.summary[key], d.title) ? (
            <section key={key} lang={lang} className={doc.summary}>
              <h2 className={doc.label}>{label}</h2>
              <p>{d.summary[key]}</p>
            </section>
          ) : null,
        )}

        {d.effects.length > 0 && (
          <section className={doc.section}>
            {/* 'Betroffene Normen' overstated plain citations: the norms are
                grouped by relation, and a citation is labelled a mention. */}
            <h2>
              {d.effects.every((e) => e.kind === 'cited')
                ? 'Zitierte Normen (Erwähnungen)' : 'Normbezüge'}
            </h2>
            <div className={doc.effects}>
              {groupEffectsByKind(d.effects).map((group) => (
                <div key={group.kind} className={doc.effectGroup}>
                  <h3 data-tone={effectTone(group.kind)}>{effectLabel(group.kind)}</h3>
                  <ul>
                    {group.effects.map((e, i) => (
                      <li key={`${e.jurabk}-${i}`}>
                        <b>{effectNormLabel(e)}</b>
                        {e.note && <span>{e.note}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {d.related.length > 0 && (
          <section className={doc.section}>
            <h2>Verknüpfte Entscheidungen</h2>
            <ul className={doc.related}>
              {d.related.map((r, i) => (
                <li key={`${r.ref}-${i}`}>
                  <span>{REL_LABEL[r.rel] ?? r.rel}</span>
                  <Link href={`/dt/kerf/entscheidungen/${r.ref}`}>{r.label}</Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {d.quote && <blockquote className={doc.quote}>{d.quote}</blockquote>}

        {d.text && (
          <details className={doc.fulltext}>
            <summary>
              <ChevronRight size={16} aria-hidden="true" />
              Volltext (anonymisiert)
            </summary>
            <div>{d.text}</div>
          </details>
        )}

        <footer className={doc.foot}>
          <div className={doc.meta}>
            {d.url ? (
              <a href={d.url} target="_blank" rel="noopener noreferrer" className={doc.link}>
                {d.source} <ExternalLink size={13} aria-hidden="true" />
              </a>
            ) : (
              <span>Quelle: {d.source}</span>
            )}
          </div>
          <p className={doc.note}>
            Diese Seite ist Teil von{' '}
            <Link href="/dt/kerf" className={doc.link} style={{ display: 'inline', minHeight: 0, fontSize: 'inherit' }}>
              Kerf
            </Link>
            {' '}— Geschichte deutscher und europäischer Gesetzgebung,
            verknüpft mit der Rechtsprechung zu den betroffenen Normen.
          </p>
        </footer>
      </article>
    </div>
  );
}
