import { normalizeLang } from '@/core/i18n/config';
import { formatDay } from '@/core/formatDay';
import { validityKind, type KerfEnvelopeStatus, type KerfNormAmendment, type KerfNormTemporal, type KerfSentenceOp } from './normHistoryClient';

/** Format a legal date without any timezone conversion (YYYY-MM-DD only). */
export function legalDate(value: string | null | undefined, language: string): string {
  // The site's day format in every language (core/formatDay.ts).
  void language;
  if (!/^(\d{4})-(\d{2})-(\d{2})/.test(value ?? '')) return '—';
  return formatDay(value);
}

const en = {
  commencementBasis: 'per the commencement clause of the amending act', 
  title: 'Versions', log: 'Log', diff: 'Compare', blame: 'Origin', loading: 'Loading…', retry: 'Retry',
  chooseNorm: 'Versions are shown per provision.',
  verified: 'In force from', verifiedBasis: 'verified against the final BGBl command and its commencement clause',
  archived: 'In force from', archivedBasis: 'per the archived official BAYERN.RECHT page',
  unresolved: 'Legal start not verified', observed: 'served by the official source since', observedNote: 'retrieval date, not a legal date',
  until: 'until (exclusive)', future: 'enters into force', current: 'latest stored version',
  amendedBy: 'Amending act', standNote: 'per GII’s own “last amended by” note; commencement not verified',
  derived: 'Replay-verified reconstruction, not an exact official capture', exact: 'Official consolidated text',
  archivedPage: 'Archived official page', dailySnapshot: 'Kerf daily snapshot of the official source',
  officialNorm: 'Official text of this provision', compareWithPrevious: 'Compare with previous version',
  events: 'Amendment records without reconstructed text', eventNote: 'Record of an amending command; no historical full text is claimed',
  effectiveUnresolved: 'effective date not resolved', published: 'published', effective: 'effective',
  from: 'Before', to: 'After', identical: 'No text change between these versions.',
  unchanged: 'unchanged sentences', moved: 'unchanged wording at a new locator',
  predates: 'Present since the start of Kerf’s text history', introducedBy: 'Introduced by version',
  candidates: 'Parser candidates (unverified)', historyStart: 'Text history starts',
  verifiedStarts: 'versions with a verified legal start', noVersions: 'No stored version of this provision.',
  note: 'Note', predatesSummary: '{n} of {total} sentences predate Kerf’s text history; the amendment that introduced them is not attributed.',
  materials: 'Legislative materials', explains: 'Explains this provision (heading targets it)', mentions: 'Only mentions this provision, not a justification',
  drafts: 'Draft wording', materialsNote: 'Draft numbering; correspondence to the enacted provision is not verified.', page: 'p.',
  roles: { entwurf: 'Draft', begruendung: 'Explanatory memorandum', stellungnahme_bundesrat: 'Bundesrat opinion', gegenaeusserung_bundesregierung: 'Government reply', beschlussempfehlung: 'Committee recommendation', bericht: 'Committee report', stellungnahme_normenkontrollrat: 'Regulatory Control Council', vorblatt: 'Cover sheet' } as Record<string, string>,
  positions: { agrees: 'agrees', rejects: 'rejects', examines: 'will examine', partially_agrees: 'partially agrees' } as Record<string, string>,
  statuses: {
    ok: 'Complete', partial: 'Partial: a component was unavailable', unavailable: 'Unavailable',
    not_in_corpus: 'Not in the Kerf corpus', not_found_in_searched_scope: 'Not found in the searched scope',
    ambiguous_identity: 'Ambiguous identity', temporally_unresolved: 'Legal validity not verified for this date',
    unsupported_temporal_request: 'Unsupported date request', stale_snapshot: 'Stale data snapshot',
    integrity_check_failed: 'Integrity check failed. Data not shown.', upstream_representation_unusable: 'Source representation unusable',
    invalid_argument: 'Invalid request',
  } as Record<KerfEnvelopeStatus, string>,
};
type Copy = typeof en;

const de: Copy = {
  ...en, commencementBasis: 'laut Inkrafttretensregel des Änderungsgesetzes', title: 'Versionen', log: 'Verlauf', diff: 'Vergleich', blame: 'Herkunft', loading: 'Lädt…', retry: 'Erneut versuchen',
  chooseNorm: 'Versionen werden je Vorschrift angezeigt.',
  verified: 'Gültig ab', verifiedBasis: 'geprüft am endgültigen BGBl-Änderungsbefehl und seiner Inkrafttretensregel',
  archived: 'Gültig ab', archivedBasis: 'laut archivierter amtlicher Seite BAYERN.RECHT',
  unresolved: 'Rechtlicher Beginn nicht verifiziert', observed: 'von der amtlichen Quelle ausgeliefert seit', observedNote: 'Abrufdatum, kein Rechtsdatum',
  until: 'bis (ausschließlich)', future: 'tritt in Kraft am', current: 'jüngste gespeicherte Fassung',
  amendedBy: 'Änderungsgesetz', standNote: 'laut GII-Standangabe „zuletzt geändert durch“; Inkrafttreten nicht verifiziert',
  derived: 'Durch Rückrechnung verifizierte Rekonstruktion, kein amtlich exakter Abruf', exact: 'Amtlicher konsolidierter Text',
  archivedPage: 'Archivierte amtliche Seite', dailySnapshot: 'Täglicher Kerf-Abruf der amtlichen Quelle',
  officialNorm: 'Amtlicher Text dieser Vorschrift', compareWithPrevious: 'Mit Vorgängerfassung vergleichen',
  events: 'Änderungsnachweise ohne rekonstruierten Text', eventNote: 'Nachweis eines Änderungsbefehls; kein historischer Volltext behauptet',
  effectiveUnresolved: 'Inkrafttreten nicht aufgelöst', published: 'verkündet', effective: 'wirksam',
  from: 'Vorher', to: 'Nachher', identical: 'Zwischen diesen Fassungen keine Textänderung.',
  unchanged: 'unveränderte Sätze', moved: 'unveränderter Wortlaut an neuer Stelle',
  predates: 'Seit Beginn der Kerf-Texthistorie vorhanden', introducedBy: 'Eingeführt durch Fassung',
  candidates: 'Parser-Kandidaten (ungeprüft)', historyStart: 'Texthistorie ab',
  verifiedStarts: 'Fassungen mit verifiziertem Rechtsbeginn', noVersions: 'Keine gespeicherte Fassung dieser Vorschrift.',
  note: 'Hinweis', predatesSummary: '{n} von {total} Sätzen liegen vor Beginn der Kerf-Texthistorie; das einführende Änderungsgesetz ist nicht zugeordnet.',
  materials: 'Gesetzesmaterialien', explains: 'Erläutert diese Vorschrift (Überschrift nennt sie)', mentions: 'Erwähnt diese Vorschrift nur, keine Begründung',
  drafts: 'Entwurfswortlaut', materialsNote: 'Nummerierung des Entwurfs; Entsprechung zur geltenden Vorschrift nicht geprüft.', page: 'S.',
  roles: { entwurf: 'Entwurf', begruendung: 'Begründung', stellungnahme_bundesrat: 'Stellungnahme des Bundesrates', gegenaeusserung_bundesregierung: 'Gegenäußerung der Bundesregierung', beschlussempfehlung: 'Beschlussempfehlung', bericht: 'Bericht', stellungnahme_normenkontrollrat: 'Normenkontrollrat', vorblatt: 'Vorblatt' },
  positions: { agrees: 'stimmt zu', rejects: 'lehnt ab', examines: 'prüft', partially_agrees: 'stimmt teilweise zu' },
  statuses: {
    ok: 'Vollständig', partial: 'Teilweise: Eine Komponente war nicht verfügbar', unavailable: 'Nicht verfügbar',
    not_in_corpus: 'Nicht im Kerf-Korpus', not_found_in_searched_scope: 'Im durchsuchten Bereich nicht gefunden',
    ambiguous_identity: 'Mehrdeutige Identität', temporally_unresolved: 'Rechtliche Geltung für dieses Datum nicht verifiziert',
    unsupported_temporal_request: 'Datumsanfrage nicht unterstützt', stale_snapshot: 'Veralteter Datenstand',
    integrity_check_failed: 'Integritätsprüfung fehlgeschlagen. Keine Daten angezeigt.', upstream_representation_unusable: 'Quelldarstellung unbrauchbar',
    invalid_argument: 'Ungültige Anfrage',
  },
};

const ru: Copy = {
  ...en, commencementBasis: 'по норме о вступлении в силу изменяющего закона', title: 'Редакции', log: 'Журнал', diff: 'Сравнение', blame: 'Происхождение', loading: 'Загрузка…', retry: 'Повторить',
  chooseNorm: 'Редакции показываются для каждой нормы отдельно.',
  verified: 'Действует с', verifiedBasis: 'проверено по окончательной команде BGBl и норме о вступлении в силу',
  archived: 'Действует с', archivedBasis: 'по архивной официальной странице BAYERN.RECHT',
  unresolved: 'Юридическое начало не проверено', observed: 'официальный источник выдаёт с', observedNote: 'дата получения, не юридическая дата',
  until: 'до (не включая)', future: 'вступает в силу', current: 'последняя сохранённая редакция',
  amendedBy: 'Изменяющий закон', standNote: 'по отметке GII «последнее изменение»; вступление в силу не проверено',
  derived: 'Проверенная реконструкция, не точная официальная копия', exact: 'Официальный консолидированный текст',
  archivedPage: 'Архивная официальная страница', dailySnapshot: 'Ежедневный снимок официального источника',
  officialNorm: 'Официальный текст нормы', compareWithPrevious: 'Сравнить с предыдущей редакцией',
  events: 'Сведения об изменениях без восстановленного текста', eventNote: 'Сведения о команде изменения; исторический полный текст не заявляется',
  effectiveUnresolved: 'дата вступления не установлена', published: 'опубликовано', effective: 'действует',
  from: 'Было', to: 'Стало', identical: 'Между этими редакциями текст не менялся.',
  unchanged: 'неизменённые предложения', moved: 'тот же текст на новом месте',
  predates: 'Есть с начала текстовой истории Kerf', introducedBy: 'Введено редакцией',
  candidates: 'Кандидаты парсера (не проверено)', historyStart: 'Текстовая история с',
  verifiedStarts: 'редакций с проверенным началом действия', noVersions: 'Нет сохранённых редакций нормы.',
  note: 'Примечание', predatesSummary: '{n} из {total} предложений старше текстовой истории Kerf; вносивший их закон не установлен.',
  materials: 'Законодательные материалы', explains: 'Поясняет эту норму (заголовок её называет)', mentions: 'Только упоминает норму, не обоснование',
  drafts: 'Текст проекта', materialsNote: 'Нумерация проекта; соответствие действующей норме не проверено.', page: 'с.',
  roles: { entwurf: 'Проект', begruendung: 'Пояснительная записка', stellungnahme_bundesrat: 'Заключение Бундесрата', gegenaeusserung_bundesregierung: 'Ответ правительства', beschlussempfehlung: 'Рекомендация комитета', bericht: 'Доклад комитета', stellungnahme_normenkontrollrat: 'Совет по нормоконтролю', vorblatt: 'Титульный лист' },
  positions: { agrees: 'согласно', rejects: 'не согласно', examines: 'изучит', partially_agrees: 'частично согласно' },
  statuses: {
    ok: 'Полностью', partial: 'Частично: компонент недоступен', unavailable: 'Недоступно',
    not_in_corpus: 'Нет в корпусе Kerf', not_found_in_searched_scope: 'Не найдено в просмотренной области',
    ambiguous_identity: 'Неоднозначная идентификация', temporally_unresolved: 'Действие на эту дату не проверено',
    unsupported_temporal_request: 'Запрос по дате не поддерживается', stale_snapshot: 'Устаревший снимок данных',
    integrity_check_failed: 'Проверка целостности не пройдена. Данные не показаны.', upstream_representation_unusable: 'Представление источника непригодно',
    invalid_argument: 'Неверный запрос',
  },
};

const ua: Copy = {
  ...en, commencementBasis: 'за нормою про набрання чинності закону про зміни', title: 'Редакції', log: 'Журнал', diff: 'Порівняння', blame: 'Походження', loading: 'Завантаження…', retry: 'Повторити',
  chooseNorm: 'Редакції наводяться для кожної норми окремо.',
  verified: 'Чинна з', verifiedBasis: 'перевірено за остаточною командою BGBl і нормою про набрання чинності',
  archived: 'Чинна з', archivedBasis: 'за архівною офіційною сторінкою BAYERN.RECHT',
  unresolved: 'Юридичний початок не перевірено', observed: 'офіційне джерело надає з', observedNote: 'дата отримання, не юридична дата',
  until: 'до (не включно)', future: 'набирає чинності', current: 'остання збережена редакція',
  amendedBy: 'Закон про зміни', standNote: 'за позначкою GII «востаннє змінено»; набрання чинності не перевірено',
  derived: 'Перевірена реконструкція, не точна офіційна копія', exact: 'Офіційний консолідований текст',
  archivedPage: 'Архівна офіційна сторінка', dailySnapshot: 'Щоденний знімок офіційного джерела',
  officialNorm: 'Офіційний текст норми', compareWithPrevious: 'Порівняти з попередньою редакцією',
  events: 'Відомості про зміни без відновленого тексту', eventNote: 'Відомості про команду змін; історичний повний текст не заявляється',
  effectiveUnresolved: 'дату набрання чинності не встановлено', published: 'опубліковано', effective: 'чинна',
  from: 'Було', to: 'Стало', identical: 'Між цими редакціями текст не змінювався.',
  unchanged: 'незмінені речення', moved: 'той самий текст на новому місці',
  predates: 'Є від початку текстової історії Kerf', introducedBy: 'Запроваджено редакцією',
  candidates: 'Кандидати парсера (не перевірено)', historyStart: 'Текстова історія з',
  verifiedStarts: 'редакцій із перевіреним початком дії', noVersions: 'Немає збережених редакцій норми.',
  note: 'Примітка', predatesSummary: '{n} з {total} речень старші за текстову історію Kerf; закон, що їх запровадив, не встановлено.',
  materials: 'Законодавчі матеріали', explains: 'Пояснює цю норму (заголовок її називає)', mentions: 'Лише згадує норму, не обґрунтування',
  drafts: 'Текст проєкту', materialsNote: 'Нумерація проєкту; відповідність чинній нормі не перевірено.', page: 'с.',
  roles: { entwurf: 'Проєкт', begruendung: 'Пояснювальна записка', stellungnahme_bundesrat: 'Висновок Бундесрату', gegenaeusserung_bundesregierung: 'Відповідь уряду', beschlussempfehlung: 'Рекомендація комітету', bericht: 'Доповідь комітету', stellungnahme_normenkontrollrat: 'Рада з нормоконтролю', vorblatt: 'Титульний аркуш' },
  positions: { agrees: 'погоджується', rejects: 'не погоджується', examines: 'розгляне', partially_agrees: 'частково погоджується' },
  statuses: {
    ok: 'Повністю', partial: 'Частково: компонент недоступний', unavailable: 'Недоступно',
    not_in_corpus: 'Немає в корпусі Kerf', not_found_in_searched_scope: 'Не знайдено в переглянутій області',
    ambiguous_identity: 'Неоднозначна ідентифікація', temporally_unresolved: 'Чинність на цю дату не перевірено',
    unsupported_temporal_request: 'Запит за датою не підтримується', stale_snapshot: 'Застарілий знімок даних',
    integrity_check_failed: 'Перевірку цілісності не пройдено. Дані не показано.', upstream_representation_unusable: 'Подання джерела непридатне',
    invalid_argument: 'Неправильний запит',
  },
};

const copies: Record<string, Copy> = { en, de, ru, ua };
export const normHistoryCopy = (language: string): Copy => copies[normalizeLang(language) ?? 'en'] ?? en;

/** One-line validity statement; never turns an observation into a legal date. */
export function validityLine(temporal: KerfNormTemporal, language: string, today = new Date().toISOString().slice(0, 10)): { label: string; basis: string; future: boolean } {
  const c = normHistoryCopy(language);
  const kind = validityKind(temporal);
  if (kind === 'unresolved') {
    return { label: c.unresolved, basis: temporal.observed_from ? `${c.observed} ${legalDate(temporal.observed_from, language)} (${c.observedNote})` : '', future: false };
  }
  const future = Boolean(temporal.valid_from && temporal.valid_from > today);
  return {
    label: `${future ? c.future : kind === 'archived' ? c.archived : c.verified} ${legalDate(temporal.valid_from, language)}`,
    basis: kind === 'verified' ? c.verifiedBasis : kind === 'commencement' ? c.commencementBasis : kind === 'archived' ? c.archivedBasis : '',
    future,
  };
}

export function amendmentLine(amendment: KerfNormAmendment | null | undefined, language: string): { text: string; note?: string } | null {
  if (!amendment || !(amendment.act || amendment.reference)) return null;
  const c = normHistoryCopy(language);
  const name = amendment.act && amendment.reference && !amendment.act.includes(amendment.reference)
    ? `${amendment.act} (${amendment.reference})` : amendment.act ?? amendment.reference ?? '';
  return { text: name, note: amendment.basis === 'gii_stand_note' ? c.standNote : undefined };
}

export function sourceRoleLabel(role: string, sourceExact: boolean, language: string): string {
  const c = normHistoryCopy(language);
  if (!sourceExact || role === 'verified_reconstruction') return c.derived;
  if (role.startsWith('archived_official_page')) return c.archivedPage;
  if (role.startsWith('official_daily_snapshot')) return c.dailySnapshot;
  return c.exact;
}

/** Split sentence ops into changes (shown) and the count of unchanged ones. */
export function diffSummary(ops: KerfSentenceOp[]): { changes: KerfSentenceOp[]; unchanged: number } {
  return { changes: ops.filter(op => op.op !== 'equal'), unchanged: ops.filter(op => op.op === 'equal').length };
}

export const statusIsFailure = (status: KerfEnvelopeStatus) =>
  !['ok', 'partial', 'temporally_unresolved'].includes(status);
