import { normalizeLang } from '@/core/i18n/config';
import type { KerfActArchiveGap, KerfActMarkdown } from './client';

/** All front matter fields of a Kerf Markdown export, typed where the
 * serializer wrote JSON scalars.  Nothing is dropped: an adapter that forwards
 * only the body would erase exactness, reconstruction and date qualifications. */
export function frontMatterFields(markdown: string): [string, string][] {
  const match = /^﻿?---[\t ]*\r?\n([\s\S]*?)\r?\n---[\t ]*(?:\r?\n|$)/u.exec(markdown.slice(0, 65_536));
  if (!match) return [];
  const rows: [string, string][] = [];
  for (const line of match[1].split(/\r?\n/u)) {
    const field = /^([A-Za-z_][A-Za-z0-9_]*):[\t ]*(.*)$/u.exec(line);
    if (!field) continue;
    let value = field[2].trim();
    try { const parsed: unknown = JSON.parse(value); value = parsed === null ? '—' : typeof parsed === 'object' ? JSON.stringify(parsed) : String(parsed); } catch { /* keep raw */ }
    rows.push([field[1], value.slice(0, 600)]);
  }
  return rows;
}

export function gapLabels(gaps: KerfActArchiveGap[] | undefined): string[] {
  return (gaps ?? []).map(gap => typeof gap === 'string' ? gap : gap.label ?? gap.reason ?? '').filter(Boolean);
}

export type EditionQuality = 'exact' | 'verified_reconstruction' | 'not_exact' | 'unknown';
export function editionQuality(edition: Pick<KerfActMarkdown, 'source_exact' | 'verified_reconstruction' | 'exact'>): EditionQuality {
  if (edition.verified_reconstruction) return 'verified_reconstruction';
  if (edition.source_exact === false) return 'not_exact';
  if (edition.source_exact === true || edition.exact) return 'exact';
  return 'unknown';
}

const COPY = {
  en: { exact: 'Exact official source text', verified_reconstruction: 'Verified reconstruction — derived, not an exact official capture', not_exact: 'Not an exact official capture', unknown: 'Source exactness not stated', observed: 'Date is a retrieval observation, not a legal effective date', legal: 'Legal effective date verified against the final BGBl and its commencement clause', incomplete: 'This text is not established as the edition for this date:', more: 'more', provenance: 'Provenance (front matter)' },
  de: { exact: 'Amtlich exakter Quelltext', verified_reconstruction: 'Verifizierte Rekonstruktion — abgeleitet, kein amtlich exakter Abruf', not_exact: 'Kein amtlich exakter Abruf', unknown: 'Quellgenauigkeit nicht angegeben', observed: 'Datum ist ein Abrufdatum, kein Inkrafttretensdatum', legal: 'Inkrafttreten geprüft am endgültigen BGBl und seiner Inkrafttretensregel', incomplete: 'Dieser Text ist nicht als Fassung für dieses Datum belegt:', more: 'weitere', provenance: 'Herkunftsangaben (Front Matter)' },
  ru: { exact: 'Точный официальный текст', verified_reconstruction: 'Проверенная реконструкция — производный текст, не точная официальная копия', not_exact: 'Не точная официальная копия', unknown: 'Точность источника не указана', observed: 'Дата — дата получения, не дата вступления в силу', legal: 'Дата вступления в силу проверена по BGBl и норме о вступлении в силу', incomplete: 'Этот текст не подтверждён как редакция на эту дату:', more: 'ещё', provenance: 'Происхождение (front matter)' },
  ua: { exact: 'Точний офіційний текст', verified_reconstruction: 'Перевірена реконструкція — похідний текст, не точна офіційна копія', not_exact: 'Не точна офіційна копія', unknown: 'Точність джерела не зазначено', observed: 'Дата — дата отримання, не дата набрання чинності', legal: 'Дату набрання чинності перевірено за BGBl і нормою про набрання чинності', incomplete: 'Цей текст не підтверджено як редакцію на цю дату:', more: 'ще', provenance: 'Походження (front matter)' },
};
export const provenanceCopy = (language: string) => COPY[(normalizeLang(language) ?? 'en') as keyof typeof COPY] ?? COPY.en;
