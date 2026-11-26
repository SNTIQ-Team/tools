import type { KerfAct } from './client';
import type { KerfEdge, KerfNode } from './kerfArenaLayout';
import { normalizeLang } from '@/core/i18n/config';
import { readerLawLabel } from './readerLabels';

const folded = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();

export function graphMatches(nodes: KerfNode[], query: string, hidden: Set<string>, tick: number, labels: string[] = []): number[] {
  const tokens = folded(query.trim()).split(/\s+/).filter(Boolean);
  return nodes.flatMap((node, id) => !hidden.has(node.kind) && node.born <= tick
    && tokens.every(token => folded(`${node.label} ${labels[id] ?? ''}`).includes(token)) ? [id] : []);
}

export function graphConnections(nodes: KerfNode[], edges: KerfEdge[], id: number, hidden: Set<string>, tick: number) {
  const seen = new Set<string>();
  return edges.flatMap(edge => {
    if (edge.s !== id && edge.t !== id) return [];
    const nodeId = edge.s === id ? edge.t : edge.s;
    const node = nodes[nodeId];
    const key = `${edge.s}:${edge.t}:${edge.r}`;
    if (!node || hidden.has(node.kind) || node.born > tick || seen.has(key)) return [];
    seen.add(key);
    return [{ nodeId, relation: edge.r, outgoing: edge.s === id }];
  });
}

export function graphActId(node: KerfNode, acts: KerfAct[]) {
  const juris = node.kind === 'fed-act' ? 'DE' : node.kind === 'by-act' ? 'DE-BY' : null;
  if (!juris) return null;
  const abbreviation = node.label.split(' — ')[0].trim();
  const matches = acts.filter(act => act.juris === juris && act.jurabk === abbreviation);
  return matches.length === 1 ? matches[0].id : null;
}

export function graphNodeLabel(node: KerfNode, acts: KerfAct[]) {
  const id = graphActId(node, acts);
  const act = id ? acts.find(item => item.id === id) : null;
  return act ? `${readerLawLabel(act)} — ${act.title}` : node.label;
}

const SHORT_KINDS = {
  ru: { eu:'ЕС', 'fed-act':'Законы ФРГ', 'by-act':'Бавария', initiator:'Инициаторы', vorgang:'Инициативы', topic:'Темы', land:'Земли', hub:'Публикации', 'by-bill':'Бав. проекты' },
  ua: { eu:'ЄС', 'fed-act':'Закони ФРН', 'by-act':'Баварія', initiator:'Ініціатори', vorgang:'Ініціативи', topic:'Теми', land:'Землі', hub:'Публікації', 'by-bill':'Бав. проєкти' },
  de: { eu:'EU', 'fed-act':'Bund', 'by-act':'Bayern', initiator:'Initiatoren', vorgang:'Vorgänge', topic:'Themen', land:'Länder', hub:'Belege', 'by-bill':'BY-Vorgänge' },
  en: { eu:'EU', 'fed-act':'Federal laws', 'by-act':'Bavaria', initiator:'Initiators', vorgang:'Procedures', topic:'Topics', land:'States', hub:'Publications', 'by-bill':'BY procedures' },
};
export const graphShortKind = (kind: string, language: string) => (SHORT_KINDS[normalizeLang(language) ?? 'en'] as Record<string, string>)[kind] ?? kind;

const COPY = {
  en: { browse: 'Documents', resize: 'Resize the graph and documents', connections: 'Connections', search: 'Find a law, topic or procedure', empty: 'No matching documents', noConnections: 'No connections in this selection', all: 'All categories', filters: 'Categories', back: 'Back to results', open: 'Read law', more: 'Show more', date: 'Data through', clearSearch: 'Clear search', reset: 'Reset filters', retry: 'Retry', incoming: 'Incoming relation', outgoing: 'Outgoing relation', relations: { 10: 'Initiated by', 20: 'Possible amendment', 21: 'Amendment in text', 30: 'Published in', 40: 'Topic', 60: 'Directive implementation', 61: 'EU regulation link', 63: 'Transposed into German law' } },
  de: { browse: 'Dokumente', resize: 'Größe von Grafik und Dokumentenliste ändern', connections: 'Verbindungen', search: 'Gesetz, Thema oder Vorgang suchen', empty: 'Keine passenden Dokumente', noConnections: 'Keine Verbindungen in dieser Auswahl', all: 'Alle Kategorien', filters: 'Kategorien', back: 'Zurück zu Ergebnissen', open: 'Gesetz lesen', more: 'Mehr anzeigen', date: 'Daten bis', clearSearch: 'Suche leeren', reset: 'Filter zurücksetzen', retry: 'Erneut versuchen', incoming: 'Eingehende Verbindung', outgoing: 'Ausgehende Verbindung', relations: { 10: 'Initiiert von', 20: 'Mögliche Änderung', 21: 'Änderung im Text', 30: 'Veröffentlicht in', 40: 'Thema', 60: 'Richtlinienumsetzung', 61: 'EU-Verordnungsbezug', 63: 'In deutsches Recht umgesetzt' } },
  ru: { browse: 'Документы', resize: 'Изменить размер графа и списка документов', connections: 'Связи', search: 'Закон, тема или законопроект', empty: 'Документы не найдены', noConnections: 'В этой выборке связей нет', all: 'Все категории', filters: 'Категории', back: 'К результатам', open: 'Читать закон', more: 'Показать ещё', date: 'Данные по', clearSearch: 'Очистить поиск', reset: 'Сбросить фильтры', retry: 'Повторить', incoming: 'Входящая связь', outgoing: 'Исходящая связь', relations: { 10: 'Инициатор', 20: 'Возможное изменение', 21: 'Изменение в тексте', 30: 'Опубликовано в', 40: 'Тема', 60: 'Имплементация директивы', 61: 'Связь с регламентом ЕС', 63: 'Перенесено в право Германии' } },
  ua: { browse: 'Документи', resize: 'Змінити розмір графа й списку документів', connections: 'Зв’язки', search: 'Закон, тема або законопроєкт', empty: 'Документи не знайдено', noConnections: 'У цій вибірці зв’язків немає', all: 'Усі категорії', filters: 'Категорії', back: 'До результатів', open: 'Читати закон', more: 'Показати ще', date: 'Дані до', clearSearch: 'Очистити пошук', reset: 'Скинути фільтри', retry: 'Повторити', incoming: 'Вхідний зв’язок', outgoing: 'Вихідний зв’язок', relations: { 10: 'Ініціатор', 20: 'Можлива зміна', 21: 'Зміна в тексті', 30: 'Опубліковано в', 40: 'Тема', 60: 'Імплементація директиви', 61: 'Зв’язок з регламентом ЄС', 63: 'Перенесено у право Німеччини' } },
};
export const graphCopy = (language: string) => COPY[normalizeLang(language) ?? 'en'];
