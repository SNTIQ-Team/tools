import { normalizeLang } from '@/core/i18n/config';
import { encodeWorkspace } from './readerWorkspace';

const en = {
  description: 'German law in context.',
  openKerf: 'Open Kerf',
  openChamfer: 'Open Chamfer',
  preview: 'Kerf: AsylG section 3 with legal references',
};
type ShowcaseCopy = typeof en;
const de: ShowcaseCopy = {
  description: 'Deutsches Recht im Zusammenhang.',
  openKerf: 'Kerf öffnen',
  openChamfer: 'Chamfer öffnen',
  preview: 'Kerf: § 3 AsylG mit Normverweisen',
};
const ru: ShowcaseCopy = {
  description: 'Немецкое право в контексте.',
  openKerf: 'Открыть Kerf',
  openChamfer: 'Открыть Chamfer',
  preview: 'Kerf: § 3 AsylG со ссылками на нормы',
};
const ua: ShowcaseCopy = {
  description: 'Німецьке право в контексті.',
  openKerf: 'Відкрити Kerf',
  openChamfer: 'Відкрити Chamfer',
  preview: 'Kerf: § 3 AsylG з посиланнями на норми',
};

export function kerfShowcaseCopy(language: string): ShowcaseCopy {
  return ({ en, de, ru, ua })[normalizeLang(language) ?? 'en'];
}

export const KERF_SHOWCASE_HREF = `/dt/kerf${encodeWorkspace({
  version: 1,
  panes: [
    { id: 'p1', tabs: [{ id: 't1', actId: 'fed_asylvfg_1992', norm: '§ 3' }], activeTabId: 't1' },
    { id: 'p2', tabs: [{ id: 't2', actId: 'fed_aufenthg_2004', norm: '§ 60' }], activeTabId: 't2' },
  ],
  activePaneId: 'p1',
  layout: 'columns',
})}`;
