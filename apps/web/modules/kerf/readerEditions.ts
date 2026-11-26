import type { KerfActArchive, KerfRetrospectiveEvent } from './client';
import { formatDay } from '@/core/formatDay';
import { buildArchiveTimeline } from './retrospectiveTimeline';
import { normalizeLang } from '@/core/i18n/config';

export function readerHistoryEvents(archive: KerfActArchive | null): KerfRetrospectiveEvent[] {
  const seen = new Set<string>();
  return [...(archive?.retrospective?.events ?? [])].filter(event => {
    const key = event.id ?? event.event_id ?? JSON.stringify([event.document_id, event.amending_article, event.date]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => (b.published_at ?? b.date).localeCompare(a.published_at ?? a.date));
}

export function filterReaderHistoryEvents(events: KerfRetrospectiveEvent[], query: string, language: string): KerfRetrospectiveEvent[] {
  const normalize = (text: string) => text.normalize('NFKC').replace(/\s+/gu, ' ').trim()
    .toLocaleLowerCase().replace(/(§§?|art\.?)\s*(?=\d)/gu, '$1 ');
  const needle = normalize(query);
  if (!needle) return events;
  return events.filter(event => {
    const dates = [event.published_at ?? event.date, event.effective_at].filter((date): date is string => Boolean(date));
    const fields = [...dates.flatMap(date => [date, readerEditionDate(date, language), spokenDate(date, language)]),
      event.procedure_title, event.article_heading, event.fundstelle, event.document_id, event.amending_article,
      ...(event.affected_norms ?? []), ...(event.commands ?? []).flatMap(command => [
        command.raw, command.old_text_constraint, command.new_text,
      ])];
    return normalize(fields.filter(Boolean).join(' ')).includes(needle);
  });
}

export function readerEditions(archive: KerfActArchive | null) {
  const seen = new Set<string>();
  return buildArchiveTimeline(archive).filter(item => {
    if (!item.checkoutable || item.kind === 'head') return false;
    const digest = item.observation?.state_sha256 ?? item.observation?.state_digest ?? item.entry?.state_digest;
    const key = item.kind === 'observed' && digest ? `observed:${digest}` : `${item.kind}:${item.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).reverse();
}

const COPY = {
  en: { latest: 'Latest source text', latestShort: 'Latest', latestDetail: 'Most recently available text', legal: 'Legal editions', observed: 'Source archive', since: 'Effective from', future: 'Takes effect', captured: 'Saved on', unknown: 'Archived text', partialSearch: 'Search incomplete: part of the index was unavailable, so missing hits are not proof of absence.' },
  de: { latest: 'Neuester Quellentext', latestShort: 'Neuester', latestDetail: 'Zuletzt verfügbarer Text', legal: 'Gesetzesfassungen', observed: 'Quellenarchiv', since: 'Gültig ab', future: 'Tritt in Kraft am', captured: 'Gespeichert am', unknown: 'Archivtext', partialSearch: 'Suche unvollständig: Ein Teil des Index war nicht verfügbar; fehlende Treffer belegen nichts.' },
  ru: { latest: 'Последний текст источника', latestShort: 'Последний', latestDetail: 'Последний доступный текст', legal: 'Редакции закона', observed: 'Архив источника', since: 'Действует с', future: 'Вступит в силу', captured: 'Сохранён', unknown: 'Архивный текст', partialSearch: 'Поиск неполный: часть индекса была недоступна, отсутствие результатов ничего не доказывает.' },
  ua: { latest: 'Останній текст джерела', latestShort: 'Останній', latestDetail: 'Останній доступний текст', legal: 'Редакції закону', observed: 'Архів джерела', since: 'Чинна з', future: 'Набуде чинності', captured: 'Збережено', unknown: 'Архівний текст', partialSearch: 'Пошук неповний: частина індексу була недоступна, відсутність результатів нічого не доводить.' },
};

export const readerEditionCopy = (language: string) => COPY[normalizeLang(language) ?? 'en'];

/** A day as the reader sees it: the site's DD.MM.YYYY in every language
    (core/formatDay.ts). */
export function readerEditionDate(date: string, language: string) {
  void language;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return formatDay(date);
}

/** The same day spelled out ("28. Dezember 2001", "10 июля 2026"): never
    shown, but searchable, since people type dates that way too. */
function spokenDate(date: string, language: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  const lang = normalizeLang(language) ?? 'en';
  return new Intl.DateTimeFormat(lang === 'ua' ? 'uk' : lang, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${date}T12:00:00Z`));
}

export interface ReaderEditionChoice {
  value: string; label: string; detail: string;
  group: 'latest' | 'legal' | 'observed'; future: boolean; available: boolean;
}

export function readerEditionChoices(archive: KerfActArchive | null, language: string, today = new Date().toISOString().slice(0, 10)): ReaderEditionChoice[] {
  const copy = readerEditionCopy(language);
  const editions = readerEditions(archive);
  // The checkout API takes a day, not an evidence id, and resolves a legal
  // interval first. Do not present a second option that loads the same body.
  const legalDates = new Set(editions.filter(item => item.kind !== 'observed').map(item => item.date));
  const offered = new Set<string>();
  return [{ value: 'HEAD', label: copy.latest, detail: copy.latestDetail, group: 'latest', future: false, available: true },
    ...(['legal', 'observed'] as const).flatMap(group => editions
      .filter(item => {
        if ((item.kind === 'observed' ? 'observed' : 'legal') !== group || offered.has(item.date)
          || group === 'observed' && legalDates.has(item.date)) return false;
        offered.add(item.date);
        return true;
      })
      .map(item => {
        const future = group === 'legal' && item.date > today;
        const label = readerEditionDate(item.date, language);
        return { value: item.date, label, group, future, available: item.date <= (archive?.head_date || today),
          detail: `${group === 'observed' ? copy.captured : future ? copy.future : copy.since} ${label}` };
      })),
  ];
}


export function readerSourceUrl(value?: string | null): string | undefined {
  if (!value || value.length > 4096) return undefined;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}
