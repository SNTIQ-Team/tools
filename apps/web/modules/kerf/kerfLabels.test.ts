import assert from 'node:assert/strict';
import test from 'node:test';
import type { KerfFeedEvent, KerfSearch } from './client';
import {
  actChangeSummary, berlinToday, collapseRepeatedObservations, commitEffectiveDay,
  coverageCount, dedupeFeedEvents, describeWatchTransition, effectNormLabel,
  feedBgblCounts, feedDateBasis, formatWatchStamp, groupEffectsByKind, humanizeKind,
  intlLocale, isAfterDay, isUpcomingCommit, normDesignator, normalizeSearchResult,
  parseCommitMessage, patchLocation, procedureStatusValue, sameText, searchTotalSummary,
  shownOfTotal, splitBgblTitle, unavailableSearchComponents,
} from './kerfLabels';

const bgbl = (issue: number, extra: Partial<KerfFeedEvent> = {}): KerfFeedEvent => ({
  time: '2026-09-25', juris: 'DE', source: 'BGBl', kind: 'verkündet',
  title: `BGBl. 2026 I Nr. ${issue}`, url: `https://www.recht.bund.de/eli/bund/BGBl_1/2026/${issue}`,
  badge: null, ...extra,
});

test('calendar days compare in German time and only strictly later days are future', () => {
  assert.equal(berlinToday(new Date('2026-09-27T22:30:00Z')), '2026-09-28');
  assert.equal(isAfterDay('2026-09-29', '2026-09-28'), true);
  assert.equal(isAfterDay('2026-09-28T23:59:00Z', '2026-09-28'), false);
  assert.equal(isAfterDay(null, '2026-09-28'), false);
  assert.equal(isAfterDay('garbage', '2026-09-28'), false);
});

test('date-only monitor stamps stay calendar days without an invented time', () => {
  const de = formatWatchStamp('2026-06-26', 'de');
  assert.match(de, /26\.06\.2026/);
  assert.doesNotMatch(de, /\d{1,2}:\d{2}/);
  // no day shift for locales west of UTC either: the day is formatted in UTC
  assert.equal(formatWatchStamp('2026-06-26', 'en'), '26.06.2026', 'the site format in every language');
  assert.match(formatWatchStamp('2026-07-15T02:59:08+00:00', 'de'), /\d{1,2}:\d{2}/);
  assert.equal(formatWatchStamp(null, 'de'), '—');
  assert.equal(formatWatchStamp('2026-02-31', 'de'), '2026-02-31');
  assert.equal(intlLocale('ua'), 'uk');
  assert.equal(intlLocale('de-DE'), 'de');
});

test('BGBl feed rows carry a GII reporting day unless the API marks a publication date', () => {
  assert.equal(feedDateBasis(bgbl(273)), 'reported');
  assert.equal(feedDateBasis(bgbl(273, { time_basis: 'official_publication_date' })), 'official_publication');
  assert.equal(feedDateBasis({ source: 'GVBl', time_basis: null }), 'event');
});

test('BGBl titles split into issue citation and act title', () => {
  assert.deepEqual(splitBgblTitle('BGBl. 2026 I Nr. 273'), { citation: 'BGBl. 2026 I Nr. 273', actTitle: null });
  assert.deepEqual(
    splitBgblTitle('BGBl. 2026 I Nr. 273 — Gesetz zur Änderung des SGB III'),
    { citation: 'BGBl. 2026 I Nr. 273', actTitle: 'Gesetz zur Änderung des SGB III' },
  );
  assert.deepEqual(splitBgblTitle('Bayerisches Gesetz'), { citation: null, actTitle: 'Bayerisches Gesetz' });
});

test('exact duplicate feed rows are merged and counted; issues are counted by URL', () => {
  const events = [bgbl(273), bgbl(273), bgbl(272), bgbl(273, { title: 'BGBl. 2026 I Nr. 273 — Zweites Gesetz' })];
  const { rows, merged } = dedupeFeedEvents(events);
  assert.equal(merged, 1);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].duplicates, 1);
  assert.deepEqual(feedBgblCounts(events), { reports: 4, issues: 2 });
  assert.deepEqual(feedBgblCounts([{ ...bgbl(1), source: 'BayMBl' }]), { reports: 0, issues: 0 });
});

test('German commit messages are parsed for localisation and future wording', () => {
  assert.deepEqual(parseCommitMessage('Amtliche Änderung wirksam · GKG 2004'), { kind: 'effective', subject: 'GKG 2004' });
  assert.deepEqual(parseCommitMessage('Amtliche Änderung veröffentlicht · SGB 4'), { kind: 'published', subject: 'SGB 4' });
  assert.deepEqual(parseCommitMessage('Amtlicher konsolidierter Stand beobachtet'), { kind: 'observed', subject: '' });
  assert.deepEqual(parseCommitMessage('Gesetz zur Änderung des Grundgesetzes'), { kind: null, subject: 'Gesetz zur Änderung des Grundgesetzes' });
  const future = { date: '2036-01-01', effective_at: '2036-01-01' };
  assert.equal(commitEffectiveDay(future), '2036-01-01');
  assert.equal(isUpcomingCommit(future, '2026-09-28'), true);
  assert.equal(isUpcomingCommit({ date: '2026-09-28', effective_at: null }, '2026-09-28'), false);
  assert.equal(isUpcomingCommit({ date: '2026-01-01', effective_at: '2026-10-01' }, '2026-09-28'), true);
});

test('decision norm labels use Art. for articles and never print an orphan section sign', () => {
  assert.equal(effectNormLabel({ jurabk: 'GG', paras: ['1', '2'], act_id: 'fed_gg' }), 'Art. 1, 2 GG');
  assert.equal(effectNormLabel({ jurabk: 'RL 2013/33/EU', paras: ['17', '2'], eu_celex: '32013L0033' }), 'Art. 17, 2 RL 2013/33/EU');
  assert.equal(effectNormLabel({ jurabk: 'RL (EU) 2024/1346', paras: ['23'] }), 'Art. 23 RL (EU) 2024/1346');
  assert.equal(effectNormLabel({ jurabk: 'SGB 5', paras: [], act_id: 'fed_sgb_5' }), 'SGB 5');
  assert.equal(effectNormLabel({ jurabk: 'BGB', paras: ['1626', '1671'], act_id: 'fed_bgb' }), '§§ 1626, 1671 BGB');
  assert.equal(effectNormLabel({ jurabk: 'ZPO', paras: ['256'], act_id: 'fed_zpo' }), '§ 256 ZPO');
  assert.equal(effectNormLabel({ jurabk: 'AsylbLG', paras: ['Art. 3'] }), 'Art. 3 AsylbLG');
  assert.equal(normDesignator({ jurabk: 'AGSG', paras: ['64'], act_id: 'by_agsg' }), 'Art.');
  assert.equal(normDesignator({ jurabk: 'DVAsyl', paras: ['9'], act_id: 'by_dvasyl' }), '§');
  assert.equal(normDesignator({ jurabk: 'BGBEG', paras: ['229'] }), 'Art.');
});

test('decision effects group strongest first with mentions last', () => {
  const groups = groupEffectsByKind([
    { kind: 'cited', id: 1 }, { kind: 'applied', id: 2 }, { kind: 'disapplied', id: 3 },
    { kind: 'cited', id: 4 }, { kind: 'new_kind', id: 5 },
  ]);
  assert.deepEqual(groups.map((group) => group.kind), ['disapplied', 'applied', 'new_kind', 'cited']);
  assert.deepEqual(groups[3].effects.map((effect) => effect.id), [1, 4]);
  assert.equal(groups[3].mention, true);
  assert.equal(humanizeKind('NEW_KIND'), 'new kind');
  assert.equal(sameText('Beschluss zur Sache.', ' beschluss   zur Sache'), true);
  assert.equal(sameText('', ''), false);
});

const search = (extra: Partial<KerfSearch>): KerfSearch => ({
  query: 'x', total: 0, matches: [], result_total: 0, act_total: 0, norm_total: 0,
  act_matches: [], norm_matches: [], ...extra,
});

test('search totals never turn null into zero', () => {
  assert.deepEqual(searchTotalSummary(search({ result_total: 1812, status: 'ok' })), { kind: 'exact', total: 1812 });
  assert.deepEqual(
    searchTotalSummary(search({ result_total: null, result_total_lower_bound: 900, result_total_is_partial: true, status: 'partial' })),
    { kind: 'lowerBound', lower: 900 },
  );
  assert.deepEqual(searchTotalSummary(search({ result_total: null })), { kind: 'unknown' });
  assert.deepEqual(shownOfTotal(40, 155), { shown: 40, total: 155, complete: false });
  assert.deepEqual(shownOfTotal(40, null), { shown: 40, total: null, complete: false });
  assert.deepEqual(unavailableSearchComponents(search({
    components: { acts: { status: 'ok' }, norms: { status: 'unavailable', reason: 'index_not_built' }, changes: { status: 'unavailable' } },
  })), ['norms', 'changes']);
});

test('normalizing a partial search keeps unavailable totals null', () => {
  const partial = normalizeSearchResult(search({
    status: 'partial', result_total: null, result_total_lower_bound: 12, norm_total: null,
    norm_matches: [], change_total: null, decision_total: 1,
    decision_matches: [], components: { norms: { status: 'unavailable' } },
  }), 'Aufenthalt');
  assert.equal(partial.result_total, null);
  assert.equal(partial.norm_total, null);
  assert.equal(partial.change_total, null);
  assert.equal(partial.decision_total, 1);
  assert.equal(partial.query, 'x');
  // a legacy API without component reporting still gets its row-count sum
  const legacy = normalizeSearchResult({
    query: '', total: 2, matches: [], act_matches: [], norm_matches: [],
  } as unknown as KerfSearch, 'q');
  assert.equal(legacy.result_total, 0);
  assert.equal(legacy.query, 'q');
});

test('act header does not present a missing change count as zero amendments', () => {
  assert.deepEqual(actChangeSummary({ temporal: { change_count: 3 } }), { kind: 'changes', count: 3 });
  assert.deepEqual(
    actChangeSummary({ temporal: { change_count: 0 }, retrospective: { available: true, current_events: 5 } }),
    { kind: 'bgblRecords', count: 5 },
  );
  assert.deepEqual(actChangeSummary({ temporal: { change_count: 0 } }), { kind: 'unknown' });
  assert.deepEqual(actChangeSummary({ temporal: null, retrospective: { available: false, current_events: 5 } }), { kind: 'unknown' });
});

test('draft patches without a section get an explicit unknown-section location', () => {
  assert.deepEqual(patchLocation({ para: '5', absatz: '2' }), { kind: 'section', label: '§ 5 Abs. 2' });
  assert.deepEqual(patchLocation({ para: 'Art. 3', absatz: null }), { kind: 'section', label: 'Art. 3' });
  assert.deepEqual(patchLocation({ para: null, absatz: '2' }), { kind: 'unknownSection', absatz: '2' });
  assert.deepEqual(patchLocation({ para: null, absatz: null }), { kind: 'unknownSection', absatz: null });
});

test('layers with unavailable coverage report "not covered" instead of zero', () => {
  assert.deepEqual(coverageCount(0, 'origin_verification_required'), { kind: 'notCovered' });
  assert.deepEqual(coverageCount(4, 'research_only'), { kind: 'count', count: 4, partial: true });
  assert.deepEqual(coverageCount(0, undefined), { kind: 'count', count: 0, partial: false });
});

test('monitor transitions are described without an invented "— →" start', () => {
  assert.deepEqual(describeWatchTransition({ event: 'first_seen', from_status: null, to_status: 'Ongoing', stage: 'Discussions' }), { kind: 'first', to: 'Discussions' });
  assert.deepEqual(describeWatchTransition({ event: 'status_changed', from_status: 'Ongoing', to_status: 'Completed' }), { kind: 'status', from: 'Ongoing', to: 'Completed' });
  assert.deepEqual(
    describeWatchTransition({ event: 'status_changed', from_status: 'Ongoing', to_status: 'Ongoing', from_stage: 'A', stage: 'B' }),
    { kind: 'stage', from: 'A', to: 'B' },
  );
  assert.deepEqual(describeWatchTransition({ event: 'evidence_changed', from_status: 'Überwiesen', to_status: 'Überwiesen', stage: 'Überwiesen', from_stage: 'Überwiesen' }), { kind: 'evidence' });
  assert.equal(describeWatchTransition({}), null);
  assert.deepEqual(procedureStatusValue('Completed (Adopted act: 32026D1912 )'), { key: 'completedAdopted', params: { act: '32026D1912' } });
  assert.deepEqual(procedureStatusValue('Überwiesen'), { key: 'referred' });
  assert.equal(procedureStatusValue('Something new'), null);
});

test('repeated identical monitor observations collapse into one row', () => {
  const rows = collapseRepeatedObservations([
    { label: 'A', kind: 'official_event', date: '2026-07-01' },
    { label: 'Done', kind: 'watch_transition', date: '2026-07-02T08:00:00Z' },
    { label: 'Done', kind: 'watch_transition', date: '2026-07-03T08:00:00Z' },
    { label: 'Done', kind: 'watch_transition', date: '2026-07-04T08:00:00Z' },
    { label: 'Done', kind: 'official_event', date: '2026-07-05' },
  ]);
  assert.equal(rows.length, 3);
  assert.equal(rows[1].repeats, 2);
  assert.equal(rows[1].lastDate, '2026-07-04T08:00:00Z');
  assert.equal(rows[2].repeats, 0);
  // an evidence-only refresh folds into the preceding observation, too
  const folded = collapseRepeatedObservations([
    { label: 'Completed', kind: 'watch_transition', date: '2026-08-29T20:00:00Z' },
    { label: 'Evidence updated', kind: 'watch_transition', date: '2026-08-29T22:00:00Z', noChange: true },
    { label: 'Completed', kind: 'watch_transition', date: '2026-08-30T08:00:00Z' },
    { label: 'Evidence updated', kind: 'watch_transition', date: '2026-08-31T08:00:00Z', noChange: false },
  ]);
  assert.deepEqual(folded.map((row) => [row.label, row.repeats]), [['Completed', 2], ['Evidence updated', 0]]);
});
