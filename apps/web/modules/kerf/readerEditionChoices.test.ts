import assert from 'node:assert/strict';
import test from 'node:test';
import * as editions from './readerEditions';
import type { KerfActArchive } from './client';

test('reading history retains old source events, separately from selectable text editions', () => {
  assert.equal(typeof editions.readerHistoryEvents, 'function');
  const archive = { entries: [], retrospective: { intervals: [], observations: [], events: [
    { id: 'old', date: '2001-12-28', published_at: '2001-12-28', procedure_title: 'Old amendment' },
    { id: 'new', date: '2026-07-10', published_at: '2026-07-09', effective_at: '2026-07-10' },
  ] } } as KerfActArchive;
  assert.deepEqual(editions.readerHistoryEvents(archive).map(event => event.id), ['new', 'old']);
  assert.deepEqual(editions.readerEditionChoices(archive, 'en').map(choice => choice.value), ['HEAD']);
});

test('edition choices separate source captures from legal dates and mark future editions', () => {
  assert.equal(typeof editions.readerEditionChoices, 'function');
  const archive = { entries: [
    { date: '2026-07-10', effective_from: '2026-07-10' },
    { date: '2026-10-01', effective_from: '2026-10-01' },
    { date: '2026-07-29', observed_at: '2026-07-29', state_digest: 'capture' },
  ] } as KerfActArchive;
  const choices = editions.readerEditionChoices(archive, 'ru', '2026-09-21');
  assert.deepEqual(choices.map(item => [item.value, item.group, item.future]), [
    ['HEAD', 'latest', false], ['2026-10-01', 'legal', true],
    ['2026-07-10', 'legal', false], ['2026-07-29', 'observed', false],
  ]);
  assert.match(choices[1].detail, /Вступит/);
  assert.match(choices[2].detail, /Действует с/);
  assert.match(choices[3].detail, /Сохранён/);
  assert.match(choices[2].label, /10\.07\.2026/, 'the site day format');
});

test('edition date formatting has no timezone shift and tolerates unavailable dates', () => {
  assert.equal(typeof editions.readerEditionDate, 'function');
  assert.equal(editions.readerEditionDate('2026-07-10', 'de'), '10.07.2026');
  assert.equal(editions.readerEditionDate('2026-07-10', 'en'), '10.07.2026', 'the same in every language');
  assert.equal(editions.readerEditionDate('unknown', 'en'), 'unknown');
  assert.equal(editions.readerEditionChoices(null, 'en', '2026-09-21').length, 1);
});

test('compact comparison labels fit narrow date controls without truncating the selected value', () => {
  assert.equal(editions.readerEditionDate('2026-09-22', 'ru'), '22.09.2026');
  for (const language of ['en', 'de', 'ru', 'ua']) assert.ok(editions.readerEditionCopy(language).latestShort.length <= 10);
});

test('date-only checkout never offers two indistinguishable choices on the same day', () => {
  const archive = { entries: [
    { date: '2026-07-10', effective_from: '2026-07-10' },
    { date: '2026-07-10', observed_at: '2026-07-10', state_digest: 'capture' },
  ] } as KerfActArchive;
  const choices = editions.readerEditionChoices(archive, 'en', '2026-09-21');
  assert.deepEqual(choices.map(item => [item.value, item.group]), [['HEAD', 'latest'], ['2026-07-10', 'legal']]);
});

test('dates beyond the archive HEAD remain visible but cannot be checked out', () => {
  const archive = { head_date: '2026-09-22', entries: [
    { date: '2026-07-10', effective_from: '2026-07-10' },
    { date: '2026-10-01', effective_from: '2026-10-01' },
  ] } as KerfActArchive;
  const choices = editions.readerEditionChoices(archive, 'en', '2026-10-04');
  assert.equal(choices.find(item => item.value === '2026-10-01')?.available, false);
  assert.equal(choices.find(item => item.value === '2026-07-10')?.available, true);
  assert.equal(choices[0].available, true);
});

test('history search finds affected provisions, amendment wording and localized visible dates', () => {
  assert.equal(typeof editions.filterReaderHistoryEvents, 'function');
  const events = [
    { id: 'change', date: '2001-12-28', published_at: '2001-12-28', procedure_title: 'Rechtsmittelgesetz',
      affected_norms: ['§ 79'], commands: [{ raw: 'Absatz 2 wird neu gefasst', new_text: 'Verfahren eingestellt' }], document_id: 'bgbl-1-2001-s3987' },
    { id: 'other', date: '2002-01-02', procedure_title: 'Andere Änderung', affected_norms: ['§ 790'] },
  ];
  for (const query of ['§79', '  § 79  ', 'VERFAHREN eingestellt', '28.12.2001', '28. Dezember 2001', 'bgbl-1-2001-s3987']) {
    assert.equal(editions.filterReaderHistoryEvents(events, query, 'de')[0]?.id, 'change', query);
  }
  assert.deepEqual(editions.filterReaderHistoryEvents(events, 'nicht vorhanden', 'de'), []);
  assert.equal(editions.filterReaderHistoryEvents(events, '   ', 'de'), events);
});


test('historical source links accept official and archived HTTP sources without executable schemes or credentials', () => {
  const archived = 'https://web.archive.org/web/20160129083149id_/http://www.gesetze-bayern.de:80/Content/Document/BayVwVfG/true';
  assert.equal(editions.readerSourceUrl(archived), archived);
  assert.equal(editions.readerSourceUrl('http://www.gesetze-bayern.de/Content/Document/BayVwVfG'), 'http://www.gesetze-bayern.de/Content/Document/BayVwVfG');
  for (const value of ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', 'https://user:password@example.test/', '', '/relative']) assert.equal(editions.readerSourceUrl(value), undefined);
});
