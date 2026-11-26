/**
 * Indexable, document-centric view of one final BGBl amending act. Unlike a
 * consolidated version page, this route renders the official amendment
 * commands grouped by article and affected corpus act.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink, GitCommitHorizontal } from 'lucide-react';
import { kerfUrl, SITE_URL } from '@/core/config';
import {
  kerfAmendingAct,
  type KerfAmendingAct,
  type KerfRetrospectiveCommand,
  type KerfRetrospectiveEvidence,
  type KerfRetrospectiveEvent,
} from '@/modules/kerf/client';
import DocumentActions from './DocumentActions';
import { isKerfRequestError } from '@/modules/kerf/kerfRequest';
import doc from '@/modules/kerf/documentPage.module.css';

export const revalidate = 3600;

/** German-first page: ISO days are shown as DD.MM.YYYY. */
const fmtDate = (value?: string | null) => {
  const day = value?.slice(0, 10);
  const match = day ? /^(\d{4})-(\d{2})-(\d{2})$/u.exec(day) : null;
  return match ? `${match[3]}.${match[2]}.${match[1]}` : day || '—';
};

const safeHttpUrl = (value?: string | null) => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.toString() : null;
  } catch {
    return null;
  }
};

const shortHash = (value?: string | null) => {
  const normalized = value?.replace(/^sha256:/iu, '').trim();
  return normalized ? normalized.slice(0, 16) : null;
};

const unique = <T,>(values: T[]) => Array.from(new Set(values));

const operationLabel = (operation?: string | null) => ({
  add: 'eingefügt',
  insert: 'eingefügt',
  replace: 'neu gefasst',
  delete: 'aufgehoben',
  remove: 'aufgehoben',
  amend: 'geändert',
  modify: 'geändert',
  other: 'sonstige Änderung',
}[operation ?? ''] ?? operation?.replaceAll('_', ' ') ?? 'Änderungsbefehl');

const commandReference = (command: KerfRetrospectiveCommand) => [
  command.ref?.para ? `§ ${command.ref.para}` : null,
  command.ref?.absatz ? `Abs. ${command.ref.absatz}` : null,
  command.ref?.satz ? `Satz ${command.ref.satz}` : null,
  command.ref?.nummer ? `Nr. ${command.ref.nummer}` : null,
].filter(Boolean).join(' ');

const dipUrl = (procedureId: string) => /^\d+$/u.test(procedureId)
  ? `https://dip.bundestag.de/vorgang/_/${encodeURIComponent(procedureId)}`
  : null;

const evidenceIdentity = (evidence: KerfRetrospectiveEvidence, index: number) =>
  `${evidence.source ?? 'source'}:${evidence.url ?? evidence.document ?? index}`;

async function getDocument(documentId: string): Promise<KerfAmendingAct | null> {
  try {
    return await kerfAmendingAct(documentId);
  } catch (error) {
    if (isKerfRequestError(error) && error.kind === 'not_found') return null;
    throw error;
  }
}

export async function generateMetadata({ params }: {
  params: Promise<{ documentId: string }>;
}): Promise<Metadata> {
  const { documentId } = await params;
  const document = await getDocument(documentId);
  if (!document) return { title: 'Änderungsgesetz nicht gefunden', robots: { index: false, follow: false } };
  const name = document.title ?? document.titles[0] ?? document.document_id;
  const title = `${name} · ${document.document_id}`;
  const description = [
    `${document.event_count} amtliche Änderungsereignisse`,
    `${document.command_count} strukturierte Änderungsbefehle`,
    `${document.affected_acts.length} betroffene Gesetze`,
  ].join(' · ');
  const canonical = `${SITE_URL}/dt/kerf/aenderungen/${encodeURIComponent(document.document_id)}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'article', title, description,
      url: canonical,
    },
  };
}

/** Publication, entry into force and retroactivity of one event, in words. */
function EventStatus({ event }: { event: KerfRetrospectiveEvent }) {
  return (
    <p className={doc.status}>
      <span>verkündet {fmtDate(event.published_at ?? event.date)}</span>
      {event.effective_at ? (
        <span data-state={event.future ? 'future' : 'in_force'}>
          {event.future ? 'vorgesehen ab' : 'wirksam ab'} {fmtDate(event.effective_at)}
        </span>
      ) : (
        <span data-state="unresolved">Inkrafttreten ungeklärt</span>
      )}
      {event.retroactive && <span data-state="retroactive">rückwirkend</span>}
    </p>
  );
}

function CommandCard({ command, index }: {
  command: KerfRetrospectiveCommand;
  index: number;
}) {
  const reference = commandReference(command);
  return (
    <article className={doc.command}>
      <p className={doc.commandHead}>
        <strong>{operationLabel(command.operation)}</strong>
        {reference && <strong>{reference}</strong>}
        <span>Befehl {command.item ?? index + 1}</span>
      </p>

      {(command.old_text_constraint || command.new_text) && (
        <div className={doc.wording}>
          <section data-side="old">
            <h5>Vorausgesetzter alter Wortlaut</h5>
            <pre className={doc.pre}>
              {command.old_text_constraint || '— nicht vollständig rekonstruiert —'}
            </pre>
          </section>
          <section data-side="new">
            <h5>Neuer Wortlaut</h5>
            <pre className={doc.pre}>
              {command.new_text || '— kein vollständiger Ersatztext —'}
            </pre>
          </section>
        </div>
      )}

      {command.raw && (
        <details className={doc.raw}>
          <summary>
            <GitCommitHorizontal size={15} aria-hidden="true" />
            Amtlicher Änderungsbefehl
          </summary>
          <pre className={doc.pre}>{command.raw}</pre>
        </details>
      )}
    </article>
  );
}

export default async function AmendingActPage({ params }: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = await params;
  const document = await getDocument(documentId);
  if (!document) notFound();

  const title = document.title ?? document.titles[0] ?? document.document_id;
  const canonical = `${SITE_URL}/dt/kerf/aenderungen/${encodeURIComponent(document.document_id)}`;
  const apiUrl = kerfUrl(`/amending-acts/${encodeURIComponent(document.document_id)}`);
  const officialHtml = safeHttpUrl(document.official_html_url);
  const officialPdf = safeHttpUrl(document.official_pdf_url);
  const events = document.articles.flatMap((article) => article.events);
  const effectiveDates = unique(events.flatMap((event) =>
    event.effective_at ? [event.effective_at] : [])).sort();
  const unresolvedCount = events.filter((event) => !event.effective_at).length;
  const futureCount = events.filter((event) => event.future).length;
  const publicationDates = document.published_dates.length
    ? document.published_dates : document.published_at ? [document.published_at] : [];
  const citation = [
    title,
    document.document_id,
    publicationDates.length ? `verkündet ${publicationDates.join(', ')}` : null,
    officialHtml ?? officialPdf,
    canonical,
  ].filter(Boolean).join(' · ');
  const officialOnly = document.source_policy?.official_only === true;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Legislation',
    name: title,
    legislationIdentifier: document.document_id,
    datePublished: document.published_at ?? publicationDates[0],
    url: canonical,
    inLanguage: 'de',
    publisher: { '@type': 'Organization', name: 'SNTIQ Kerf' },
    isBasedOn: officialHtml ?? officialPdf ?? undefined,
  };

  return (
    <div className={doc.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />

      <nav aria-label="Breadcrumb" className={`${doc.crumbs} print:hidden`}>
        <Link href="/">SNTIQ</Link>
        <span aria-hidden="true">/</span>
        <Link href="/#projects">Deutschland Together</Link>
        <span aria-hidden="true">/</span>
        <Link href="/dt/kerf">Kerf</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page" className={doc.id}>{document.document_id}</span>
      </nav>

      <article className={doc.article}>
        <header>
          <p className={doc.kicker}>
            <span>BGBl-Änderungsgesetz</span>
            {officialOnly && <span data-tone="ok">Amtliche Quellen</span>}
            <span className={doc.id}>{document.document_id}</span>
          </p>
          <h1>{title}</h1>
          <p className={doc.lead}>
            Dokumentzentrierte Ansicht der amtlichen Änderungsbefehle. Veröffentlichung,
            Inkrafttreten und beobachteter konsolidierter Text bleiben getrennte Tatsachen.
          </p>

          <dl className={doc.facts}>
            <div>
              <dt>Verkündet</dt>
              <dd>{publicationDates.map(fmtDate).join(', ') || '—'}</dd>
            </div>
            <div>
              <dt>Inkrafttreten</dt>
              <dd>
                {effectiveDates.map(fmtDate).join(', ') || 'nicht vollständig aufgelöst'}
                {(futureCount > 0 || unresolvedCount > 0) && (
                  <small>
                    {[
                      futureCount > 0 ? `${futureCount} künftig` : null,
                      unresolvedCount > 0 ? `${unresolvedCount} ungeklärt` : null,
                    ].filter(Boolean).join(' · ')}
                  </small>
                )}
              </dd>
            </div>
            <div>
              <dt>Betroffene Gesetze</dt>
              <dd>{document.affected_acts.length}</dd>
            </div>
            <div>
              <dt>Änderungsbefehle</dt>
              <dd>{document.command_count}</dd>
            </div>
          </dl>

          <div className={doc.actions}>
            <DocumentActions
              apiUrl={apiUrl}
              citation={citation}
              fileName={`${document.document_id}-kerf.json`.replace(/[^\p{L}\p{N}._-]+/gu, '-')}
            />
            <div className={doc.links}>
              {officialHtml && (
                <a href={officialHtml} target="_blank" rel="noopener noreferrer" className={doc.link}>
                  Amtliches HTML <ExternalLink size={14} aria-hidden="true" />
                </a>
              )}
              {officialPdf && (
                <a href={officialPdf} target="_blank" rel="noopener noreferrer" className={doc.link}>
                  Amtliches PDF <ExternalLink size={14} aria-hidden="true" />
                </a>
              )}
            </div>
          </div>
        </header>

        {document.affected_acts.length > 0 && (
          <section className={doc.section}>
            <h2>Betroffene Gesetze und Normen</h2>
            <ul className={doc.rows}>
              {document.affected_acts.map((act) => (
                <li key={act.act_id} className={doc.row}>
                  <strong>{act.jurabk ?? act.act_id}</strong>
                  <div>
                    {act.title && <p>{act.title}</p>}
                    {act.affected_norms.length > 0 && <p>{act.affected_norms.join(' · ')}</p>}
                  </div>
                  <span>{act.event_count} Ereignisse · {act.command_count} Befehle</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className={doc.section}>
          <h2>Änderungen nach Artikel</h2>
          {document.articles.map((article, articleIndex) => (
            <section
              key={`${article.article ?? articleIndex}:${article.heading ?? ''}`}
              className={doc.articleBlock}
            >
              <header>
                <p className={doc.kicker}>
                  <span>Artikel {article.article ?? '—'}</span>
                  <span>{article.command_count} Befehle</span>
                  {article.affected_norms.length > 0 && <span>{article.affected_norms.join(' · ')}</span>}
                </p>
                {article.heading && <h3>{article.heading}</h3>}
              </header>

              {article.events.map((event, eventIndex) => (
                <section
                  key={event.id ?? event.event_id ?? `${event.act_id}:${eventIndex}`}
                  className={doc.event}
                >
                  <div className={doc.eventHead}>
                    <h4>
                      <b>{event.jurabk ?? event.act_id ?? 'Gesetz'}</b>
                      {event.act_title}
                    </h4>
                    <EventStatus event={event} />
                  </div>
                  {(event.affected_norms?.length ?? 0) > 0 && (
                    <p className={`${doc.label} ${doc.muted}`} style={{ marginTop: '.25rem' }}>
                      {event.affected_norms!.join(' · ')}
                    </p>
                  )}

                  {(event.commands ?? []).length > 0
                    ? event.commands!.map((command, commandIndex) => (
                        <CommandCard
                          key={`${command.item ?? commandIndex}:${command.operation ?? ''}`}
                          command={command}
                          index={commandIndex}
                        />
                      ))
                    : (
                      <p className={doc.empty}>
                        Für dieses Ereignis liegt noch kein strukturierter Änderungsbefehl vor.
                      </p>
                    )}
                </section>
              ))}
            </section>
          ))}
        </section>

        <section className={doc.section}>
          <h2>Amtliche Nachweise</h2>
          <div className={doc.pairs}>
            {document.evidence.map((evidence, index) => {
              const url = safeHttpUrl(evidence.url);
              return (
                <div key={evidenceIdentity(evidence, index)} className={doc.pair}>
                  <strong>{evidence.document ?? evidence.source ?? 'Amtliche Quelle'}</strong>
                  {url && (
                    <a href={url} target="_blank" rel="noopener noreferrer" className={`${doc.link} ${doc.id}`}>
                      {url} <ExternalLink size={13} aria-hidden="true" />
                    </a>
                  )}
                  {(evidence.sha256 || evidence.state_sha256) && (
                    <p className={doc.id} title={evidence.sha256 ?? evidence.state_sha256 ?? undefined}>
                      SHA-256 {shortHash(evidence.sha256 ?? evidence.state_sha256)}
                    </p>
                  )}
                </div>
              );
            })}
            {document.procedure_ids.map((procedureId) => {
              const url = dipUrl(procedureId);
              return url ? (
                <div key={procedureId} className={doc.pair}>
                  <strong>DIP-Vorgang {procedureId}</strong>
                  <a href={url} target="_blank" rel="noopener noreferrer" className={doc.link}>
                    Vorgang öffnen <ExternalLink size={13} aria-hidden="true" />
                  </a>
                </div>
              ) : null;
            })}
          </div>

          {(document.pdf_sha256s.length > 0 || document.pdf_sha256) && (
            <div className={doc.pair}>
              <p className={doc.label}>PDF-Integrität</p>
              {unique([
                ...document.pdf_sha256s,
                ...(document.pdf_sha256 ? [document.pdf_sha256] : []),
              ]).map((hash) => (
                <p key={hash} className={doc.id}>SHA-256 {hash}</p>
              ))}
            </div>
          )}
        </section>

        <footer className={doc.foot}>
          <div className={doc.meta}>
            <a href={apiUrl} target="_blank" rel="noopener noreferrer" className={doc.link}>
              JSON API <ExternalLink size={13} aria-hidden="true" />
            </a>
            <span>Wissensstand {fmtDate(document.as_of)}</span>
            <span>Build {fmtDate(document.built_at)}</span>
          </div>
          <p className={doc.note}>
            Die Änderungsbefehle stammen aus dem amtlichen Dokument. Ein Ereignis ist
            noch kein vollständig rekonstruierter historischer Gesetzesstand; dafür
            müssen alter und neuer konsolidierter Text als eigener Kerf-Zustand
            nachgewiesen sein.
          </p>
        </footer>
      </article>
    </div>
  );
}
