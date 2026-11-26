import { normalizeLang } from '@/core/i18n/config';
import type { KerfAct, KerfDecision } from './client';
import type { ReaderReference } from './readerLinks';
import { normKey } from './synopsisTimeline';

export type DecisionSectionId = 'summary' | 'outcome' | 'quote' | 'text';
export interface DecisionSection { id: DecisionSectionId; text: string; language?: string }

export function getReaderDecisionTitle(decision: KerfDecision): string {
  return [decision.court_short || decision.court, decision.az].filter(Boolean).join(' ') || decision.title || decision.id;
}

export function decisionSections(decision: KerfDecision, language: string): DecisionSection[] {
  const preferred = normalizeLang(language) ?? 'de';
  const summaryLanguage = decision.summary?.[preferred]?.trim() ? preferred : 'de';
  const summary = decision.summary?.[summaryLanguage];
  const sections: DecisionSection[] = [];
  if (summary?.trim()) sections.push({ id: 'summary', text: summary, language: summaryLanguage === 'ua' ? 'uk' : summaryLanguage });
  for (const id of ['outcome', 'quote', 'text'] as const) {
    const text = decision[id];
    if (text?.trim()) sections.push({ id, text });
  }
  return sections;
}

export function decisionLawReferences(decision: KerfDecision, acts: KerfAct[]): ReaderReference[] {
  const references = new Map<string, ReaderReference>();
  for (const effect of decision.effects ?? []) {
    if (/^\d{5}[RLDC]\d{4}$/u.test(effect.eu_celex ?? '')) {
      const url = `https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:${effect.eu_celex}`;
      references.set(url, {
        kind: 'external', url,
        label: `${effect.jurabk}${effect.paras?.length ? ` (${effect.paras.join(', ')})` : ''}`,
      });
    }
    const act = acts.find(row => row.id === effect.act_id);
    if (!act) continue;
    for (const para of effect.paras?.length ? effect.paras : [null]) {
      const norm = para?.trim() || undefined;
      if (norm && (norm.length > 128 || /[\u0000-\u001f\u007f]/u.test(norm))) continue;
      const key = JSON.stringify([act.id, normKey(norm)]);
      if (!references.has(key)) references.set(key, {
        kind: 'local', actId: act.id, ...(norm ? { norm } : {}),
        label: [act.jurabk, norm].filter(Boolean).join(' '),
      });
    }
  }
  return [...references.values()];
}

export function safeDecisionSource(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

const en = {
  summary: 'Summary', outcome: 'Outcome', quote: 'Excerpt', text: 'Indexed text',
  missingText: 'The decision text is not indexed. The official source may provide it.',
  court: 'Court', date: 'Date', reference: 'Case number', kind: 'Type', jurisdiction: 'Jurisdiction',
  proc: 'Proceedings', source: 'Source', norms: 'Cited provisions', related: 'Related decisions',
};
type DecisionCopy = typeof en;
const de: DecisionCopy = {
  summary: 'Zusammenfassung', outcome: 'Ergebnis', quote: 'Auszug', text: 'Indexierter Text',
  missingText: 'Der Entscheidungstext ist nicht indexiert. Er ist gegebenenfalls in der amtlichen Quelle verfügbar.',
  court: 'Gericht', date: 'Datum', reference: 'Aktenzeichen', kind: 'Entscheidungsart', jurisdiction: 'Rechtsordnung',
  proc: 'Verfahren', source: 'Quelle', norms: 'Zitierte Normen', related: 'Verknüpfte Entscheidungen',
};
const ru: DecisionCopy = {
  summary: 'Краткое описание', outcome: 'Результат', quote: 'Выдержка', text: 'Индексированный текст',
  missingText: 'Текст решения не индексирован. Он может быть доступен в официальном источнике.',
  court: 'Суд', date: 'Дата', reference: 'Номер дела', kind: 'Вид решения', jurisdiction: 'Юрисдикция',
  proc: 'Производство', source: 'Источник', norms: 'Упомянутые нормы', related: 'Связанные решения',
};
const ua: DecisionCopy = {
  summary: 'Короткий опис', outcome: 'Результат', quote: 'Уривок', text: 'Індексований текст',
  missingText: 'Текст рішення не індексовано. Він може бути доступний в офіційному джерелі.',
  court: 'Суд', date: 'Дата', reference: 'Номер справи', kind: 'Вид рішення', jurisdiction: 'Юрисдикція',
  proc: 'Провадження', source: 'Джерело', norms: 'Згадані норми', related: 'Пов’язані рішення',
};
export function decisionCopy(language: string): DecisionCopy {
  return ({ en, de, ru, ua })[normalizeLang(language) ?? 'en'];
}
