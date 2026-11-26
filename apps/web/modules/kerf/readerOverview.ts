import { normalizeLang } from '@/core/i18n/config';
import type { KerfAct, KerfCommit, KerfFeedEvent } from './client';
import { changeCitation, changeState, normalizeChangeSummary, type ChangeState } from './changeHistory';
import { commitEffectiveDay, dedupeFeedEvents, feedDateBasis, isUpcomingCommit, parseCommitMessage, splitBgblTitle, type FeedDateBasis } from './kerfLabels';

/** The acts the operator works with daily, in this order. */
export const PRIORITY_ACTS = [
  'fed_asylblg', 'fed_sgb_2', 'fed_sgb_12', 'fed_sgb_10', 'fed_sgg', 'fed_vwgo', 'fed_vwvfg',
  'fed_aufenthg_2004', 'fed_asylvfg_1992', 'fed_azrg', 'fed_bgb', 'fed_zpo', 'fed_gg',
  'by_agsg', 'by_agvwgo', 'by_dvasyl',
] as const;

export interface TileChange {
  /** Evidenced in-force day, or null (shown as unknown). */
  date: string | null;
  state: ChangeState;
  citation: string | null;
  /** Where the line comes from: the API's change summary or the commit graph. */
  source: 'summary' | 'git';
  basis?: string | null;
}
export interface OverviewTile { act: KerfAct; last: TileChange | null; next: TileChange | null }

const upcomingFor = (commits: readonly KerfCommit[], act: KerfAct, today: string) => commits
  .filter(commit => commit.acts?.includes(act.jurabk) && isUpcomingCommit(commit, today) && commit.effective_at)
  .sort((a, b) => commitEffectiveDay(a).localeCompare(commitEffectiveDay(b)))[0];

/**
 * Tile line for one act. The API's change_summary (law index row) is used
 * when served; otherwise only the next upcoming in-force day from the commit
 * graph is shown, with its basis. Nothing is inferred beyond that.
 */
export function overviewTile(act: KerfAct, commits: readonly KerfCommit[], today: string): OverviewTile {
  const summary = normalizeChangeSummary(act.change_summary);
  if (summary) {
    const line = (change: typeof summary.last_change): TileChange | null => change ? {
      date: change.dates.in_force?.date ?? null, state: changeState(change, today),
      citation: changeCitation(change.amending_act), source: 'summary',
    } : null;
    return { act, last: line(summary.last_change), next: line(summary.next_pending_change) };
  }
  const commit = upcomingFor(commits, act, today);
  return {
    act, last: null,
    next: commit ? {
      date: commitEffectiveDay(commit), state: 'pending', source: 'git', basis: commit.date_basis ?? null,
      citation: typeof commit.bgbl === 'object' && commit.bgbl?.document_id ? bgblCitation(commit.bgbl.document_id) : commit.refs?.find(ref => /^bgbl-/u.test(ref)) ? bgblCitation(commit.refs.find(ref => /^bgbl-/u.test(ref))!) : null,
    } : null,
  };
}

/** 'bgbl-1-2025-349' → 'BGBl. 2025 I Nr. 349' (identifier only, no date). */
export function bgblCitation(documentId: string): string | null {
  const match = /^bgbl-(1|2)-(\d{4})-(\d+)$/u.exec(documentId);
  return match ? `BGBl. ${match[2]} ${match[1] === '1' ? 'I' : 'II'} Nr. ${match[3]}` : null;
}

export function overviewTiles(acts: readonly KerfAct[], commits: readonly KerfCommit[], today: string): OverviewTile[] {
  const byId = new Map(acts.map(act => [act.id, act]));
  return PRIORITY_ACTS.map(id => byId.get(id)).filter((act): act is KerfAct => Boolean(act)).map(act => overviewTile(act, commits, today));
}

export interface UpcomingRow { key: string; date: string; acts: KerfAct[]; jurabks: string[]; subject: string; url: string | null; basis: string | null; priority: boolean }

/** Upcoming in-force changes, nearest first; acts resolved against the index. */
export function upcomingChanges(commits: readonly KerfCommit[], acts: readonly KerfAct[], today: string, limit = 8): UpcomingRow[] {
  const byJurabk = new Map(acts.map(act => [act.jurabk, act]));
  const priority = new Set<string>(PRIORITY_ACTS);
  const rows = new Map<string, UpcomingRow>();
  for (const commit of commits) {
    if (!commit.effective_at || !isUpcomingCommit(commit, today)) continue;
    const date = commitEffectiveDay(commit);
    const document = (typeof commit.bgbl === 'object' ? commit.bgbl?.document_id : null) ?? commit.refs?.find(ref => /^bgbl-/u.test(ref)) ?? commit.url ?? commit.hash;
    const key = `${date}|${document}`;
    const known = (commit.acts ?? []).map(jurabk => byJurabk.get(jurabk)).filter((act): act is KerfAct => Boolean(act));
    const row = rows.get(key) ?? { key, date, acts: [], jurabks: [], subject: bgblCitation(String(document)) ?? parseCommitMessage(commit.msg).subject, url: commit.url ?? null, basis: commit.date_basis ?? null, priority: false };
    for (const act of known) if (!row.acts.some(item => item.id === act.id)) row.acts.push(act);
    for (const jurabk of commit.acts ?? []) if (!row.jurabks.includes(jurabk)) row.jurabks.push(jurabk);
    row.priority ||= known.some(act => priority.has(act.id));
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => a.date.localeCompare(b.date) || Number(b.priority) - Number(a.priority)).slice(0, limit);
}

export interface RecentRow { key: string; date: string; basis: FeedDateBasis; source: string; juris: string; title: string; citation: string | null; url: string | null; kind: string }

/** Official publications only (no court decisions, no drafts), newest first.
 * A BGBl row from the GII update service carries its reporting day. */
export function recentOfficial(events: readonly KerfFeedEvent[], limit = 8, perSource = 4): RecentRow[] {
  const official = dedupeFeedEvents(events.filter(event => /^(?:gemeldet|verkündet|veröffentlicht)$/iu.test(event.kind ?? ''))).rows;
  // One busy gazette day must not hide the other gazettes: cap each source,
  // then fill up with the newest remaining rows, keeping newest-first order.
  const counts = new Map<string, number>();
  const picked = new Set<number>();
  official.forEach((event, index) => {
    const count = counts.get(event.source) ?? 0;
    if (picked.size < limit && count < perSource) { picked.add(index); counts.set(event.source, count + 1); }
  });
  for (let index = 0; index < official.length && picked.size < limit; index++) picked.add(index);
  return official.filter((_, index) => picked.has(index)).map((event, index) => {
    const basis = feedDateBasis(event);
    const { citation, actTitle } = basis === 'event' ? { citation: null, actTitle: event.title } : splitBgblTitle(event.title);
    return { key: `${event.time}:${event.url ?? ''}:${index}`, date: event.time.slice(0, 10), basis, source: event.source, juris: event.juris, title: actTitle ?? citation ?? event.title, citation: actTitle ? citation : null, url: event.url, kind: event.kind };
  });
}

const en = {
  keyActs: 'Key acts', continueReading: 'Continue reading', recentOfficial: 'Recently published', upcoming: 'Entering into force',
  lastChange: 'Last change', nextChange: 'Next change', inForce: 'in force {date}', entersOn: 'enters into force {date}',
  dateUnknown: 'in-force date unknown', noChangeData: 'change data not served yet',
  reported: 'reported', promulgated: 'promulgated', published: 'published',
  reportedHint: 'Reporting day of the GII update service, not the promulgation date',
  perClause: 'per commencement clause', keyOnly: 'Key acts only', allLaws: 'All laws in the Library',
  nothingUpcoming: 'No upcoming changes recorded.', nothingRecent: 'No recent publications.',
  searchLaws: 'Laws', searchProvisions: 'Provisions', reopen: 'Reopen closed tab', fromGit: 'from the commencement records',
};
type Copy = typeof en;
const de: Copy = {
  keyActs: 'Wichtige Gesetze', continueReading: 'Weiterlesen', recentOfficial: 'Zuletzt veröffentlicht', upcoming: 'Demnächst in Kraft',
  lastChange: 'Letzte Änderung', nextChange: 'Nächste Änderung', inForce: 'in Kraft seit {date}', entersOn: 'tritt am {date} in Kraft',
  dateUnknown: 'Inkrafttreten unbekannt', noChangeData: 'Änderungsdaten noch nicht verfügbar',
  reported: 'gemeldet', promulgated: 'verkündet', published: 'veröffentlicht',
  reportedHint: 'Meldetag des GII-Aktualitätendienstes, nicht das Verkündungsdatum',
  perClause: 'laut Inkrafttretensregel', keyOnly: 'Nur wichtige Gesetze', allLaws: 'Alle Gesetze in der Bibliothek',
  nothingUpcoming: 'Keine bevorstehenden Änderungen erfasst.', nothingRecent: 'Keine aktuellen Veröffentlichungen.',
  searchLaws: 'Gesetze', searchProvisions: 'Normen', reopen: 'Geschlossenen Tab wiederherstellen', fromGit: 'aus den Inkrafttretensnachweisen',
};
const ru: Copy = {
  keyActs: 'Основные законы', continueReading: 'Продолжить чтение', recentOfficial: 'Недавно опубликовано', upcoming: 'Скоро вступают в силу',
  lastChange: 'Последнее изменение', nextChange: 'Следующее изменение', inForce: 'в силе с {date}', entersOn: 'вступит в силу {date}',
  dateUnknown: 'дата вступления неизвестна', noChangeData: 'данные об изменениях пока недоступны',
  reported: 'сообщено', promulgated: 'опубликовано официально', published: 'опубликовано',
  reportedHint: 'День сообщения службы обновлений GII, не дата официального опубликования',
  perClause: 'по норме о вступлении в силу', keyOnly: 'Только основные законы', allLaws: 'Все законы в «Обзоре»',
  nothingUpcoming: 'Предстоящих изменений не зафиксировано.', nothingRecent: 'Нет недавних публикаций.',
  searchLaws: 'Законы', searchProvisions: 'Нормы', reopen: 'Вернуть закрытую вкладку', fromGit: 'по сведениям о вступлении в силу',
};
const ua: Copy = {
  keyActs: 'Основні закони', continueReading: 'Продовжити читання', recentOfficial: 'Нещодавно оприлюднено', upcoming: 'Незабаром набирають чинності',
  lastChange: 'Остання зміна', nextChange: 'Наступна зміна', inForce: 'чинна з {date}', entersOn: 'набере чинності {date}',
  dateUnknown: 'дата набрання чинності невідома', noChangeData: 'дані про зміни ще недоступні',
  reported: 'повідомлено', promulgated: 'оприлюднено офіційно', published: 'опубліковано',
  reportedHint: 'День повідомлення служби оновлень GII, не дата офіційного оприлюднення',
  perClause: 'за нормою про набрання чинності', keyOnly: 'Лише основні закони', allLaws: 'Усі закони в «Огляді»',
  nothingUpcoming: 'Майбутніх змін не зафіксовано.', nothingRecent: 'Немає нещодавніх публікацій.',
  searchLaws: 'Закони', searchProvisions: 'Норми', reopen: 'Повернути закриту вкладку', fromGit: 'за відомостями про набрання чинності',
};
const copies: Record<string, Copy> = { en, de, ru, ua };
export const OVERVIEW_COPIES = copies;
export const overviewCopy = (language: string): Copy => copies[normalizeLang(language) ?? 'en'] ?? en;
