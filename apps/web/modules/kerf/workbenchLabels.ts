import { normalizeLang } from '@/core/i18n/config';

const labels = {
  en: { reader: 'Read', wiki: 'Library', synopse: 'Editions', decisions: 'Decisions', gitlog: 'Timeline', hierarchy: 'Hierarchy', graph: 'Graph' },
  de: { reader: 'Lesen', wiki: 'Bibliothek', synopse: 'Fassungen', decisions: 'Urteile', gitlog: 'Chronik', hierarchy: 'Hierarchie', graph: 'Graph' },
  ru: { reader: 'Чтение', wiki: 'Обзор', synopse: 'Редакции', decisions: 'Решения', gitlog: 'Хроника', hierarchy: 'Иерархия', graph: 'Граф' },
  ua: { reader: 'Читання', wiki: 'Огляд', synopse: 'Редакції', decisions: 'Рішення', gitlog: 'Хроніка', hierarchy: 'Ієрархія', graph: 'Граф' },
};
/** Rail labels double as the top bar's location label: one name per place. */
export function workbenchLabels(language: string) { return labels[(normalizeLang(language) ?? 'en') as keyof typeof labels] ?? labels.en; }

/** Chronicle lanes (0 = EU, 1 = Bund, 2 = Bayern, 3 = Länder). The API names
 * are German proper names and stay as served in German and English. */
const lanes: Record<string, readonly string[]> = {
  ru: ['ЕС', 'Федерация', 'Бавария', 'Земли'],
  ua: ['ЄС', 'Федерація', 'Баварія', 'Землі'],
};
export const laneLabel = (language: string, index: number, name: string) => lanes[normalizeLang(language) ?? 'en']?.[index] ?? name;
