import { normalizeLang } from '@/core/i18n/config';
import { formatDay } from '@/core/formatDay';
import { changeState, type ChangeDateField, type ChangeState, type KerfChangeDate, type KerfChangeRecord, type SourceRole } from './changeHistory';

/** Legal calendar day without timezone conversion (YYYY-MM-DD in, locale out). */
export function historyDate(value: string | null | undefined, language: string): string {
  // The site's day format in every language (core/formatDay.ts).
  void language;
  if (!/^(\d{4})-(\d{2})-(\d{2})/u.test(value ?? '')) return '—';
  return formatDay(value);
}

const en = {
  normVersions: 'provision versions',
  summaryDetails: 'Counts and notes',
  actVersions: 'Versions of the act', knownRange: 'known {from}–{until}', knownOn: 'known {from}', sources: { gii_daily: 'GII (daily retrieval)', wayback_gii: 'Wayback copy of GII', neuris: 'NeuRIS', bayern_recht: 'BAYERN.RECHT', reconstruction: 'Kerf reconstruction' } as Record<string, string>,
  futureVersion: 'Future version from {date}: reconstructed from the promulgated amending command, not an official text', giiDocumentation: 'GII documentation',
  attribution: { future_version_reconstructed: 'future version reconstructed from the promulgated command', replay_unverified: 'replay not verified', predates_text_history: 'present before the stored text history', bracketed_by_captures: 'change attributed between two captures', bracketed_promulgation_only: 'only the promulgation lies between the captures', multiple_amendments_between_captures: 'several amendments between the captures; attribution open', replay_verified_between_captures: 'verified by replaying the command between captures', reconstructed_between_captures: 'reconstructed between two captures', replay_verified: 'verified by replaying the command', command_wording_reflected: 'command wording found in the text' } as Record<string, string>,
  lastUndated: 'Latest change in the text without a documented in-force date', openChanges: 'All changes', eventsPending: 'pending', eventsUndated: 'without in-force date', amendingActs: 'amending acts', actStates: 'official act states',
  noteKinds: { incorporated: 'Incorporated in the text', announcement_incorporated: 'Announcement incorporated', change_not_executable: 'Change could not be executed', commencement_note: 'Note on entry into force', repeal_announced: 'Repeal announced', replaces_act: 'Replaces an earlier act', amended_by_note: 'Amendment note', textually_incorporated_documentation_pending: 'Text incorporated, documentation not yet complete', not_yet_incorporated: 'Not yet incorporated in the text', indirect_change_incorporated: 'Indirect change incorporated', other: 'Note' } as Record<string, string>,
  changes: 'Changes', text: 'Wording', versions: 'Versions', compare: 'Compare',
  lastChange: 'Last change', nextPending: 'Next pending change', pendingChanges: 'Pending changes', none: 'none recorded',
  versionsCount: 'versions', eventsCount: 'change events', withInForce: 'with an in-force date',
  standNote: 'GII status note', standScope: 'applies to the whole act, not specifically to this provision',
  documentationNotes: 'Documentation notes', unknownDates: 'Undocumented dates',
  eventHistoryComplete: 'Change history complete since {date}', eventHistoryPartial: 'Change history incomplete (records from {date})',
  eventHistoryUnknown: 'Completeness of the change history not stated', textHistoryStart: 'Stored wording from {date}',
  derived: 'Summary derived from older API fields; the full change summary is not yet served for this item.',
  summary: 'Change summary',
  dates: { adopted: 'Act dated', promulgated: 'Promulgated', in_force: 'In force from', applies_from: 'Applies from' } as Record<ChangeDateField, string>,
  unknown: 'unknown', notStated: 'not stated', unverified: 'not verified',
  dateStatus: {
    official: 'official source', official_commencement_clause: 'per commencement clause',
    computed_from_commencement_clause: 'computed from the commencement clause', not_stated: 'not stated', unknown: 'unknown', unverified: 'not verified',
  } as Record<string, string>,
  types: { 'geändert': 'amended', 'eingefügt': 'inserted', 'neugefasst': 'redrafted', 'aufgehoben': 'repealed', 'ersetzt': 'replaced', 'unbekannt': 'type of change unknown' } as Record<string, string>,
  states: { pending: 'Pending', in_force: 'In force', date_unknown: 'In-force date unknown', incorporated_date_unknown: 'In the text; in-force date unknown', not_yet_promulgated: 'Not yet promulgated' } as Record<ChangeState, string>,
  entersOn: 'enters into force on {date}',
  effects: { replay_verified: 'text change verified by replaying the command', bracketed_by_captures: 'text change bracketed by archived captures', not_verified: 'text change not verified' } as Record<string, string>,
  showDiff: 'Show text change', commands: 'Amending command (verbatim)', noChanges: 'No recorded changes for this provision.',
  noActChanges: 'No recorded changes for this act.',
  legacyChanges: 'Derived from the older amendment records: the date of the amending act is not in that data and shows as unknown.',
  officialAct: 'Amending act',
  roles: {
    official_consolidation: 'Official consolidated text', official_promulgation: 'Text as promulgated in the official gazette',
    archived_capture: 'Archived copy of an official page', reconstruction: 'Reconstruction: derived by applying the amending commands, not an official text',
  } as Record<SourceRole, string>,
  rolesShort: { official_consolidation: 'official', official_promulgation: 'promulgated', archived_capture: 'archived copy', reconstruction: 'reconstruction' } as Record<SourceRole, string>,
  knownSince: 'archived copy, known since {date}',
  completeness: { complete: 'complete', partial: 'incomplete', reconstructed: 'reconstructed', unavailable: 'text unavailable' } as Record<string, string>,
  crossSource: { agree: 'sources agree', single_source: 'single source', disagree: 'sources disagree' } as Record<string, string>,
  attestations: 'Shown by', showText: 'Show wording', compareCurrent: 'Compare with current', compareBefore: 'Compare with previous',
  current: 'current', currentOption: 'Current version', swap: 'Swap', sameVersion: 'Both sides are the same version.',
  mismatch: 'For this date the server returned a different version (#{got}) than the one selected (#{want}); the returned text is shown.',
  textUnavailable: 'The wording of this version is not available.', chooseVersion: 'Version',
  reconstructionWarning: 'Reconstructed wording: derived, not an official text.',
  partialWarning: 'Incomplete wording', unavailableWarning: 'Wording unavailable',
  actHistory: 'Change history', actChangesUnavailable: 'The change history of the whole act is not yet served by the API. Versions and changes are available per provision.',
  openNorm: 'Open versions', affected: 'Affected provisions', structureFallback: 'No structure data for this version; paragraphs are shown as in the source.',
  loadMore: 'Load more', shownOf: '{shown} of {total}', notes: 'Notes',
};
type Copy = typeof en;

const de: Copy = {
  normVersions: 'Normfassungen',
  summaryDetails: 'Zahlen und Hinweise',
  actVersions: 'Fassungen des Gesetzes', knownRange: 'bekannt {from}–{until}', knownOn: 'bekannt {from}', sources: { gii_daily: 'GII (täglicher Abruf)', wayback_gii: 'Wayback-Kopie von GII', neuris: 'NeuRIS', bayern_recht: 'BAYERN.RECHT', reconstruction: 'Kerf-Rekonstruktion' },
  futureVersion: 'Künftige Fassung ab {date}: rekonstruiert aus dem verkündeten Änderungsbefehl, kein amtlicher Text', giiDocumentation: 'GII-Dokumentation',
  attribution: { future_version_reconstructed: 'künftige Fassung aus dem verkündeten Befehl rekonstruiert', replay_unverified: 'Nachvollzug nicht geprüft', predates_text_history: 'bereits vor Beginn der gespeicherten Texthistorie vorhanden', bracketed_by_captures: 'Änderung zwischen zwei Abrufen zugeordnet', bracketed_promulgation_only: 'zwischen den Abrufen liegt nur die Verkündung', multiple_amendments_between_captures: 'mehrere Änderungen zwischen den Abrufen; Zuordnung offen', replay_verified_between_captures: 'durch Nachvollzug des Befehls zwischen den Abrufen geprüft', reconstructed_between_captures: 'zwischen zwei Abrufen rekonstruiert', replay_verified: 'durch Nachvollzug des Befehls geprüft', command_wording_reflected: 'Wortlaut des Befehls im Text wiedergefunden' },
  lastUndated: 'Zuletzt in den Text eingearbeitet, ohne belegtes Inkrafttreten', openChanges: 'Alle Änderungen', eventsPending: 'ausstehend', eventsUndated: 'ohne Datum des Inkrafttretens', amendingActs: 'Änderungsgesetze', actStates: 'amtliche Gesetzesstände',
  noteKinds: { incorporated: 'Im Text berücksichtigt', announcement_incorporated: 'Bekanntmachung berücksichtigt', change_not_executable: 'Änderung nicht ausführbar', commencement_note: 'Hinweis zum Inkrafttreten', repeal_announced: 'Aufhebung angekündigt', replaces_act: 'Ersetzt ein früheres Gesetz', amended_by_note: 'Änderungshinweis', textually_incorporated_documentation_pending: 'Textlich nachgewiesen, Dokumentation noch nicht abgeschlossen', not_yet_incorporated: 'Im Text noch nicht berücksichtigt', indirect_change_incorporated: 'Mittelbare Änderung berücksichtigt', other: 'Hinweis' },
  changes: 'Änderungen', text: 'Wortlaut', versions: 'Fassungen', compare: 'Vergleich',
  lastChange: 'Letzte Änderung', nextPending: 'Nächste ausstehende Änderung', pendingChanges: 'Ausstehende Änderungen', none: 'keine erfasst',
  versionsCount: 'Fassungen', eventsCount: 'Änderungsereignisse', withInForce: 'mit Datum des Inkrafttretens',
  standNote: 'GII-Standangabe', standScope: 'gilt für das ganze Gesetz, nicht speziell für diese Vorschrift',
  documentationNotes: 'Dokumentationshinweise', unknownDates: 'Nicht belegte Daten',
  eventHistoryComplete: 'Änderungshistorie vollständig seit {date}', eventHistoryPartial: 'Änderungshistorie unvollständig (Nachweise ab {date})',
  eventHistoryUnknown: 'Vollständigkeit der Änderungshistorie nicht angegeben', textHistoryStart: 'Gespeicherter Wortlaut ab {date}',
  derived: 'Übersicht aus älteren API-Feldern abgeleitet; die vollständige Änderungsübersicht liefert der Server hierfür noch nicht.',
  summary: 'Änderungsübersicht',
  dates: { adopted: 'Gesetz vom', promulgated: 'Verkündet', in_force: 'In Kraft ab', applies_from: 'Anzuwenden ab' },
  unknown: 'unbekannt', notStated: 'nicht angegeben', unverified: 'nicht verifiziert',
  dateStatus: {
    official: 'amtliche Quelle', official_commencement_clause: 'laut Inkrafttretensregel',
    computed_from_commencement_clause: 'aus der Inkrafttretensregel berechnet', not_stated: 'nicht angegeben', unknown: 'unbekannt', unverified: 'nicht verifiziert',
  },
  types: { 'geändert': 'geändert', 'eingefügt': 'eingefügt', 'neugefasst': 'neugefasst', 'aufgehoben': 'aufgehoben', 'ersetzt': 'ersetzt', 'unbekannt': 'Art der Änderung unbekannt' },
  states: { pending: 'Ausstehend', in_force: 'In Kraft', date_unknown: 'Inkrafttreten unbekannt', incorporated_date_unknown: 'Im Text; Inkrafttreten unbekannt', not_yet_promulgated: 'Noch nicht verkündet' },
  entersOn: 'tritt am {date} in Kraft',
  effects: { replay_verified: 'Textänderung durch Nachvollzug des Befehls geprüft', bracketed_by_captures: 'Textänderung durch Archivabrufe eingegrenzt', not_verified: 'Textänderung nicht geprüft' },
  showDiff: 'Textänderung anzeigen', commands: 'Änderungsbefehl (Wortlaut)', noChanges: 'Für diese Vorschrift sind keine Änderungen erfasst.',
  noActChanges: 'Für dieses Gesetz sind keine Änderungen erfasst.',
  legacyChanges: 'Aus den älteren Änderungsnachweisen abgeleitet: Das Datum des Änderungsgesetzes ist dort nicht enthalten und wird als unbekannt angezeigt.',
  officialAct: 'Änderungsgesetz',
  roles: {
    official_consolidation: 'Amtlicher konsolidierter Text', official_promulgation: 'Text wie im Gesetzblatt verkündet',
    archived_capture: 'Archivierte Kopie einer amtlichen Seite', reconstruction: 'Rekonstruktion: durch Anwendung der Änderungsbefehle abgeleitet, kein amtlicher Text',
  },
  rolesShort: { official_consolidation: 'amtlich', official_promulgation: 'verkündet', archived_capture: 'Archivkopie', reconstruction: 'Rekonstruktion' },
  knownSince: 'archivierte Kopie, bekannt seit {date}',
  completeness: { complete: 'vollständig', partial: 'unvollständig', reconstructed: 'rekonstruiert', unavailable: 'Text nicht verfügbar' },
  crossSource: { agree: 'Quellen stimmen überein', single_source: 'nur eine Quelle', disagree: 'Quellen widersprechen sich' },
  attestations: 'Belegt durch', showText: 'Wortlaut anzeigen', compareCurrent: 'Mit aktueller Fassung vergleichen', compareBefore: 'Mit Vorgängerfassung vergleichen',
  current: 'aktuell', currentOption: 'Aktuelle Fassung', swap: 'Tauschen', sameVersion: 'Beide Seiten sind dieselbe Fassung.',
  mismatch: 'Für dieses Datum lieferte der Server eine andere Fassung (#{got}) als die gewählte (#{want}); angezeigt wird der gelieferte Text.',
  textUnavailable: 'Der Wortlaut dieser Fassung ist nicht verfügbar.', chooseVersion: 'Fassung',
  reconstructionWarning: 'Rekonstruierter Wortlaut: abgeleitet, kein amtlicher Text.',
  partialWarning: 'Unvollständiger Wortlaut', unavailableWarning: 'Wortlaut nicht verfügbar',
  actHistory: 'Änderungshistorie', actChangesUnavailable: 'Die Änderungshistorie des gesamten Gesetzes liefert der Server noch nicht. Fassungen und Änderungen sind für einzelne Vorschriften verfügbar.',
  openNorm: 'Fassungen öffnen', affected: 'Betroffene Vorschriften', structureFallback: 'Für diese Fassung liegen keine Gliederungsdaten vor; Absätze wie in der Quelle.',
  loadMore: 'Mehr laden', shownOf: '{shown} von {total}', notes: 'Hinweise',
};

const ru: Copy = {
  normVersions: 'редакций норм',
  summaryDetails: 'Числа и примечания',
  actVersions: 'Редакции закона', knownRange: 'известна {from}–{until}', knownOn: 'известна {from}', sources: { gii_daily: 'GII (ежедневная выгрузка)', wayback_gii: 'копия GII в Wayback', neuris: 'NeuRIS (портал права ФРГ)', bayern_recht: 'BAYERN.RECHT (Бавария)', reconstruction: 'реконструкция Kerf' },
  futureVersion: 'Будущая редакция с {date}: реконструирована по опубликованной изменяющей команде, не официальный текст', giiDocumentation: 'Документирование GII',
  attribution: { future_version_reconstructed: 'будущая редакция реконструирована по опубликованной команде', replay_unverified: 'повторное применение не проверено', predates_text_history: 'существовало до начала сохранённой истории текста', bracketed_by_captures: 'изменение отнесено к промежутку между двумя снимками', bracketed_promulgation_only: 'между снимками лежит только опубликование', multiple_amendments_between_captures: 'несколько изменений между снимками; отнесение открыто', replay_verified_between_captures: 'проверено повторным применением команды между снимками', reconstructed_between_captures: 'реконструировано между двумя снимками', replay_verified: 'проверено повторным применением команды', command_wording_reflected: 'формулировка команды найдена в тексте' },
  lastUndated: 'Последнее внесённое в текст изменение без подтверждённой даты вступления в силу', openChanges: 'Все изменения', eventsPending: 'ожидается', eventsUndated: 'без даты вступления в силу', amendingActs: 'изменяющих законов', actStates: 'официальных состояний закона',
  noteKinds: { incorporated: 'Учтено в тексте', announcement_incorporated: 'Объявление учтено', change_not_executable: 'Изменение невыполнимо', commencement_note: 'Примечание о вступлении в силу', repeal_announced: 'Объявлена отмена', replaces_act: 'Заменяет прежний закон', amended_by_note: 'Примечание об изменении', textually_incorporated_documentation_pending: 'Текст учтён, документирование не завершено', not_yet_incorporated: 'В тексте ещё не учтено', indirect_change_incorporated: 'Косвенное изменение учтено', other: 'Примечание' },
  changes: 'Изменения', text: 'Текст', versions: 'Редакции', compare: 'Сравнение',
  lastChange: 'Последнее изменение', nextPending: 'Следующее ожидаемое изменение', pendingChanges: 'Ожидаемые изменения', none: 'не зафиксировано',
  versionsCount: 'редакций', eventsCount: 'изменений', withInForce: 'с датой вступления в силу',
  standNote: 'Отметка GII о состоянии', standScope: 'относится ко всему закону, а не именно к этой норме',
  documentationNotes: 'Примечания о документировании', unknownDates: 'Неподтверждённые даты',
  eventHistoryComplete: 'История изменений полная с {date}', eventHistoryPartial: 'История изменений неполная (сведения с {date})',
  eventHistoryUnknown: 'Полнота истории изменений не указана', textHistoryStart: 'Сохранённый текст с {date}',
  derived: 'Сводка выведена из старых полей API; полную сводку изменений сервер для этого пока не отдаёт.',
  summary: 'Сводка изменений',
  dates: { adopted: 'Закон от', promulgated: 'Опубликован', in_force: 'Вступает в силу', applies_from: 'Применяется с' },
  unknown: 'неизвестно', notStated: 'не указано', unverified: 'не проверено',
  dateStatus: {
    official: 'официальный источник', official_commencement_clause: 'по норме о вступлении в силу',
    computed_from_commencement_clause: 'вычислено по норме о вступлении в силу', not_stated: 'не указано', unknown: 'неизвестно', unverified: 'не проверено',
  },
  types: { 'geändert': 'изменена', 'eingefügt': 'вставлена', 'neugefasst': 'изложена в новой редакции', 'aufgehoben': 'отменена', 'ersetzt': 'заменена', 'unbekannt': 'вид изменения неизвестен' },
  states: { pending: 'Ожидается', in_force: 'Действует', date_unknown: 'Дата вступления неизвестна', incorporated_date_unknown: 'В тексте; дата вступления неизвестна', not_yet_promulgated: 'Ещё не опубликовано' },
  entersOn: 'вступит в силу {date}',
  effects: { replay_verified: 'изменение текста проверено повторным применением команды', bracketed_by_captures: 'изменение текста ограничено архивными снимками', not_verified: 'изменение текста не проверено' },
  showDiff: 'Показать изменение текста', commands: 'Изменяющая команда (дословно)', noChanges: 'Для этой нормы изменения не зафиксированы.',
  noActChanges: 'Для этого закона изменения не зафиксированы.',
  legacyChanges: 'Выведено из старых сведений об изменениях: даты изменяющего закона в них нет, она показана как неизвестная.',
  officialAct: 'Изменяющий закон',
  roles: {
    official_consolidation: 'Официальный консолидированный текст', official_promulgation: 'Текст в редакции официального вестника',
    archived_capture: 'Архивная копия официальной страницы', reconstruction: 'Реконструкция: выведена применением изменяющих команд, не официальный текст',
  },
  rolesShort: { official_consolidation: 'официальный', official_promulgation: 'опубликованный', archived_capture: 'архивная копия', reconstruction: 'реконструкция' },
  knownSince: 'архивная копия, известна с {date}',
  completeness: { complete: 'полный', partial: 'неполный', reconstructed: 'реконструирован', unavailable: 'текст недоступен' },
  crossSource: { agree: 'источники совпадают', single_source: 'один источник', disagree: 'источники расходятся' },
  attestations: 'Подтверждено', showText: 'Показать текст', compareCurrent: 'Сравнить с действующей', compareBefore: 'Сравнить с предыдущей',
  current: 'действующая', currentOption: 'Действующая редакция', swap: 'Поменять местами', sameVersion: 'С обеих сторон одна и та же редакция.',
  mismatch: 'На эту дату сервер вернул другую редакцию (#{got}), а не выбранную (#{want}); показан полученный текст.',
  textUnavailable: 'Текст этой редакции недоступен.', chooseVersion: 'Редакция',
  reconstructionWarning: 'Реконструированный текст: выведен, не официальный.',
  partialWarning: 'Неполный текст', unavailableWarning: 'Текст недоступен',
  actHistory: 'История изменений', actChangesUnavailable: 'Историю изменений всего закона сервер пока не отдаёт. Редакции и изменения доступны для отдельных норм.',
  openNorm: 'Открыть редакции', affected: 'Затронутые нормы', structureFallback: 'Для этой редакции нет данных о структуре; абзацы показаны как в источнике.',
  loadMore: 'Загрузить ещё', shownOf: '{shown} из {total}', notes: 'Примечания',
};

const ua: Copy = {
  normVersions: 'редакцій норм',
  summaryDetails: 'Числа та примітки',
  actVersions: 'Редакції закону', knownRange: 'відома {from}–{until}', knownOn: 'відома {from}', sources: { gii_daily: 'GII (щоденне завантаження)', wayback_gii: 'копія GII у Wayback', neuris: 'NeuRIS (портал права ФРГ)', bayern_recht: 'BAYERN.RECHT (Баварія)', reconstruction: 'реконструкція Kerf' },
  futureVersion: 'Майбутня редакція з {date}: реконструйована за оприлюдненою командою змін, не офіційний текст', giiDocumentation: 'Документування GII',
  attribution: { future_version_reconstructed: 'майбутню редакцію реконструйовано за оприлюдненою командою', replay_unverified: 'повторне застосування не перевірено', predates_text_history: 'існувало до початку збереженої історії тексту', bracketed_by_captures: 'зміну віднесено до проміжку між двома знімками', bracketed_promulgation_only: 'між знімками лежить лише оприлюднення', multiple_amendments_between_captures: 'кілька змін між знімками; віднесення відкрите', replay_verified_between_captures: 'перевірено повторним застосуванням команди між знімками', reconstructed_between_captures: 'реконструйовано між двома знімками', replay_verified: 'перевірено повторним застосуванням команди', command_wording_reflected: 'формулювання команди знайдено в тексті' },
  lastUndated: 'Остання внесена в текст зміна без підтвердженої дати набрання чинності', openChanges: 'Усі зміни', eventsPending: 'очікується', eventsUndated: 'без дати набрання чинності', amendingActs: 'законів про зміни', actStates: 'офіційних станів закону',
  noteKinds: { incorporated: 'Враховано в тексті', announcement_incorporated: 'Оголошення враховано', change_not_executable: 'Зміну неможливо виконати', commencement_note: 'Примітка щодо набрання чинності', repeal_announced: 'Оголошено скасування', replaces_act: 'Замінює попередній закон', amended_by_note: 'Примітка про зміну', textually_incorporated_documentation_pending: 'Текст враховано, документування не завершено', not_yet_incorporated: 'У тексті ще не враховано', indirect_change_incorporated: 'Опосередковану зміну враховано', other: 'Примітка' },
  changes: 'Зміни', text: 'Текст', versions: 'Редакції', compare: 'Порівняння',
  lastChange: 'Остання зміна', nextPending: 'Наступна очікувана зміна', pendingChanges: 'Очікувані зміни', none: 'не зафіксовано',
  versionsCount: 'редакцій', eventsCount: 'змін', withInForce: 'з датою набрання чинності',
  standNote: 'Позначка GII про стан', standScope: 'стосується всього закону, а не саме цієї норми',
  documentationNotes: 'Примітки щодо документування', unknownDates: 'Непідтверджені дати',
  eventHistoryComplete: 'Історія змін повна з {date}', eventHistoryPartial: 'Історія змін неповна (відомості з {date})',
  eventHistoryUnknown: 'Повноту історії змін не зазначено', textHistoryStart: 'Збережений текст з {date}',
  derived: 'Зведення виведено зі старих полів API; повного зведення змін сервер для цього ще не надає.',
  summary: 'Зведення змін',
  dates: { adopted: 'Закон від', promulgated: 'Оприлюднено', in_force: 'Набирає чинності', applies_from: 'Застосовується з' },
  unknown: 'невідомо', notStated: 'не зазначено', unverified: 'не перевірено',
  dateStatus: {
    official: 'офіційне джерело', official_commencement_clause: 'за нормою про набрання чинності',
    computed_from_commencement_clause: 'обчислено за нормою про набрання чинності', not_stated: 'не зазначено', unknown: 'невідомо', unverified: 'не перевірено',
  },
  types: { 'geändert': 'змінена', 'eingefügt': 'вставлена', 'neugefasst': 'викладена в новій редакції', 'aufgehoben': 'скасована', 'ersetzt': 'замінена', 'unbekannt': 'вид зміни невідомий' },
  states: { pending: 'Очікується', in_force: 'Чинна', date_unknown: 'Дата набрання чинності невідома', incorporated_date_unknown: 'У тексті; дата набрання чинності невідома', not_yet_promulgated: 'Ще не оприлюднено' },
  entersOn: 'набере чинності {date}',
  effects: { replay_verified: 'зміну тексту перевірено повторним застосуванням команди', bracketed_by_captures: 'зміну тексту обмежено архівними знімками', not_verified: 'зміну тексту не перевірено' },
  showDiff: 'Показати зміну тексту', commands: 'Команда змін (дослівно)', noChanges: 'Для цієї норми зміни не зафіксовано.',
  noActChanges: 'Для цього закону зміни не зафіксовано.',
  legacyChanges: 'Виведено зі старих відомостей про зміни: дати закону про зміни в них немає, вона показана як невідома.',
  officialAct: 'Закон про зміни',
  roles: {
    official_consolidation: 'Офіційний консолідований текст', official_promulgation: 'Текст у редакції офіційного вісника',
    archived_capture: 'Архівна копія офіційної сторінки', reconstruction: 'Реконструкція: виведена застосуванням команд змін, не офіційний текст',
  },
  rolesShort: { official_consolidation: 'офіційний', official_promulgation: 'оприлюднений', archived_capture: 'архівна копія', reconstruction: 'реконструкція' },
  knownSince: 'архівна копія, відома з {date}',
  completeness: { complete: 'повний', partial: 'неповний', reconstructed: 'реконструйований', unavailable: 'текст недоступний' },
  crossSource: { agree: 'джерела збігаються', single_source: 'одне джерело', disagree: 'джерела розходяться' },
  attestations: 'Підтверджено', showText: 'Показати текст', compareCurrent: 'Порівняти з чинною', compareBefore: 'Порівняти з попередньою',
  current: 'чинна', currentOption: 'Чинна редакція', swap: 'Поміняти місцями', sameVersion: 'З обох боків та сама редакція.',
  mismatch: 'На цю дату сервер повернув іншу редакцію (#{got}), а не вибрану (#{want}); показано отриманий текст.',
  textUnavailable: 'Текст цієї редакції недоступний.', chooseVersion: 'Редакція',
  reconstructionWarning: 'Реконструйований текст: виведений, не офіційний.',
  partialWarning: 'Неповний текст', unavailableWarning: 'Текст недоступний',
  actHistory: 'Історія змін', actChangesUnavailable: 'Історію змін усього закону сервер ще не надає. Редакції та зміни доступні для окремих норм.',
  openNorm: 'Відкрити редакції', affected: 'Зачеплені норми', structureFallback: 'Для цієї редакції немає даних про структуру; абзаци показано як у джерелі.',
  loadMore: 'Завантажити ще', shownOf: '{shown} з {total}', notes: 'Примітки',
};

const copies: Record<string, Copy> = { en, de, ru, ua };
export type ChangeHistoryCopy = Copy;
export const changeHistoryCopy = (language: string): Copy => copies[normalizeLang(language) ?? 'en'] ?? en;
export const CHANGE_HISTORY_COPIES = copies;

export const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/gu, (_, key: string) => String(values[key] ?? `{${key}}`));

/** One date cell: the date, or an explicit "unknown"/"not stated". */
export function changeDateCell(date: KerfChangeDate | null | undefined, language: string): { value: string; known: boolean; status: string | null; basis: string | null } {
  const c = changeHistoryCopy(language);
  if (!date || !date.date) {
    const notStated = date?.status === 'not_stated';
    return { value: notStated ? c.notStated : c.unknown, known: false, status: null, basis: date?.basis ?? null };
  }
  const status = date.status && date.status !== 'official' && date.status !== 'stated' ? c.dateStatus[date.status] ?? date.status : null;
  return { value: historyDate(date.date, language), known: true, status, basis: date.basis ?? null };
}

/** Rows of the date grid. applies_from is shown only when it says something. */
export function changeDateRows(change: KerfChangeRecord, language: string) {
  const c = changeHistoryCopy(language);
  const fields: ChangeDateField[] = ['adopted', 'promulgated', 'in_force'];
  const applies = change.dates.applies_from;
  if (applies && (applies.date || (applies.status !== 'not_stated' && applies.status !== 'unknown'))) fields.push('applies_from');
  return fields.map(field => ({ field, label: c.dates[field], ...changeDateCell(change.dates[field], language) }));
}

export function changeTypeLabel(type: string, language: string): string {
  const c = changeHistoryCopy(language);
  return c.types[type] ?? type;
}

export function changeStateLine(change: KerfChangeRecord, language: string, today: string): { state: ChangeState; label: string } {
  const c = changeHistoryCopy(language);
  const state = changeState(change, today);
  const day = change.dates.in_force?.date;
  return { state, label: state === 'pending' && day ? `${c.states.pending} · ${fill(c.entersOn, { date: historyDate(day, language) })}` : c.states[state] };
}

/** Role line of a version. An archived capture names its knowledge date and
 * never presents it as a legal date. */
export function roleLine(role: SourceRole, language: string, knownAt?: string | null): string {
  const c = changeHistoryCopy(language);
  if (role === 'archived_capture' && knownAt) return fill(c.knownSince, { date: historyDate(knownAt, language) });
  return c.roles[role];
}

export const completenessLabel = (status: string | null | undefined, language: string) =>
  status ? changeHistoryCopy(language).completeness[status] ?? status : null;
