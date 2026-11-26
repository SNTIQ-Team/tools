import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { renderToStaticMarkup } from 'react-dom/server';
import type { KerfAct, KerfCommit, KerfFeedEvent } from './client';
import { OVERVIEW_COPIES, PRIORITY_ACTS, bgblCitation, overviewTile, overviewTiles, recentOfficial, upcomingChanges } from './readerOverview';

const require = createRequire(import.meta.url);
require.extensions['.css'] = module => { module.exports = {}; };
const fixture = <T,>(name: string): T => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
// Law index rows as served by the core API (compact change_summary), and the
// same rows as served by the deployed API (no change_summary).
const coreActs = fixture<KerfAct[]>('core-acts-index-change-summary.json');
const legacyActs = coreActs.map(({ change_summary: _drop, ...act }) => act as KerfAct);
const commits = fixture<KerfCommit[]>('git-upcoming-sample.json');
const feed = fixture<KerfFeedEvent[]>('feed-sample.json');
const today = '2026-09-28';
const byId = (acts: KerfAct[], id: string) => acts.find(act => act.id === id)!;

test('tiles use the served change summary: evidenced dates, pending marked, unknown kept unknown', () => {
  const sgb2 = overviewTile(byId(coreActs, 'fed_sgb_2'), commits, today);
  assert.equal(sgb2.last?.source, 'summary');
  assert.equal(sgb2.last?.date, '2026-01-01');
  assert.equal(sgb2.last?.state, 'in_force');
  assert.equal(sgb2.last?.citation, 'Art. 8 Nr. 1 G (BGBl. 2025 I Nr. 363)');
  assert.equal(sgb2.next?.date, '2027-01-01');
  assert.equal(sgb2.next?.state, 'pending');
  const agsg = overviewTile(byId(coreActs, 'by_agsg'), commits, today);
  assert.equal(agsg.last, null, 'no recorded event: nothing is invented');
  assert.equal(agsg.next, null);
});

test('without a change summary only an evidenced upcoming in-force day is shown, from the commit graph', () => {
  const sgb2 = overviewTile(byId(legacyActs, 'fed_sgb_2'), commits, today);
  assert.equal(sgb2.last, null, 'no "last change" is derived from the index row');
  assert.equal(sgb2.next?.source, 'git');
  assert.equal(sgb2.next?.date, '2027-01-01');
  assert.equal(sgb2.next?.citation, 'BGBl. 2024 I Nr. 323');
  assert.match(sgb2.next?.basis ?? '', /commencement/);
  assert.equal(overviewTile(byId(legacyActs, 'fed_asylblg'), commits, today).next, null);
  // Tiles follow the operator's priority order and skip acts missing from the index.
  assert.deepEqual(overviewTiles(coreActs, commits, today).map(tile => tile.act.id), PRIORITY_ACTS.filter(id => coreActs.some(act => act.id === id)));
});

test('upcoming changes: future in-force days only, nearest first, grouped per gazette issue and day', () => {
  const acts = [...legacyActs, { id: 'fed_zpo', jurabk: 'ZPO', juris: 'DE', title: 'Zivilprozessordnung', norms: 1, last_change: null, next_change: null, pending: 0 } as KerfAct];
  const rows = upcomingChanges(commits, acts, today, 40);
  assert.ok(rows.every(row => row.date > today));
  assert.deepEqual(rows.map(row => row.date), [...rows.map(row => row.date)].sort());
  const oct = rows.find(row => row.date === '2026-10-01' && row.subject === 'BGBl. 2026 I Nr. 152')!;
  assert.deepEqual(oct.jurabks.sort(), ['SGB 10', 'SGG', 'VwGO', 'ZPO']);
  assert.equal(oct.priority, true);
  assert.deepEqual(oct.acts.map(act => act.id), ['fed_zpo']);
  assert.equal(rows.at(-1)!.date, '2036-01-01');
});

test('recent publications: official gazettes only, GII rows keep their reporting-day basis, no source crowds out the rest', () => {
  const rows = recentOfficial(feed, 8, 4);
  assert.ok(rows.every(row => row.kind !== 'Entscheidung'));
  assert.ok(rows.filter(row => row.source === 'BGBl').length <= 4 + 8 - rows.filter(row => row.source !== 'BGBl').length);
  assert.ok(rows.some(row => row.source === 'GVBl' || row.source === 'BayMBl'), 'Bavarian gazettes stay visible next to a busy BGBl day');
  const bgbl = rows.find(row => row.source === 'BGBl')!;
  assert.equal(bgbl.basis, 'reported');
  assert.match(bgbl.citation ?? '', /^BGBl\. 2026 I Nr\. \d+$/);
});

test('gazette identifiers become citations without inventing dates', () => {
  assert.equal(bgblCitation('bgbl-1-2025-349'), 'BGBl. 2025 I Nr. 349');
  assert.equal(bgblCitation('bgbl-2-2024-7'), 'BGBl. 2024 II Nr. 7');
  assert.equal(bgblCitation('gvbl-2026-585'), null);
});

test('overview copy is complete and translated in all four languages', () => {
  const keys = Object.keys(OVERVIEW_COPIES.en).sort();
  for (const language of ['de', 'ru', 'ua']) {
    const copy = OVERVIEW_COPIES[language] as Record<string, string>;
    assert.deepEqual(Object.keys(copy).sort(), keys, language);
    for (const key of keys) assert.notEqual(copy[key], (OVERVIEW_COPIES.en as Record<string, string>)[key], `${language}.${key}`);
  }
});

test('the landing renders the overview, not an empty reader', async () => {
  const { default: ReaderOverview } = await import('./ReaderOverview');
  const html = renderToStaticMarkup(<ReaderOverview acts={coreActs} language="de" recent={[{ actId: 'fed_sgb_2', norm: '§ 7' }]} bookmarks={[]}
    title={item => `${item.actId} ${item.norm ?? ''}`} onOpen={() => {}} canReopen={false} onReopen={() => {}} />);
  assert.match(html, /data-reader-overview/);
  assert.doesNotMatch(html, /Keine geöffneten Dokumente/);
  assert.match(html, /Wichtige Gesetze/);
  assert.match(html, /Weiterlesen/);
  assert.match(html, /data-overview-act="fed_sgb_2"/);
  assert.match(html, /tritt am 01\.01\.2027 in Kraft/);
  assert.match(html, /in Kraft seit 01\.01\.2026/);
  assert.equal((html.match(/data-load-state="loading"/g) ?? []).length, 2, 'feed and commit graph show their own loading state');
});
