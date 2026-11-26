import assert from 'node:assert/strict';
import test from 'node:test';

import type { KerfActArchive } from './client';
// @ts-expect-error Native Node strip-types needs an explicit .ts suffix.
import { buildArchiveTimeline, intervalContains, isVerifiedReconstruction, resolveArchiveTimelineItem } from './retrospectiveTimeline.ts';

test('same-day legal and observation facts remain distinct', () => {
  const archive: KerfActArchive = {
    act_id: 'fed_test',
    head_date: '2026-07-16',
    entries: [
      { date: '2026-07-10', effective_at: '2026-07-10', legal_effect_verified: true },
      { date: '2026-07-10', observed_at: '2026-07-10', date_basis: 'retrieval_observation_not_effective_date' },
    ],
  };
  const items = buildArchiveTimeline(archive);
  assert.equal(items.length, 2);
  assert.deepEqual(items.map(({ kind }) => kind), ['legal', 'observed']);
  assert.notEqual(items[0].id, items[1].id);
  assert.deepEqual(items.map(({ checkoutable }) => checkoutable), [true, false]);
});

test('publication, legal effect and observation stay separate on one day', () => {
  const archive: KerfActArchive = {
    act_id: 'fed_test',
    head_date: '2026-07-16',
    entries: [],
    retrospective: {
      available: true,
      intervals: [{
        segment_id: 'observation-only', effective_from: null,
        state_sha256: 'a',
      }],
      events: [{
        id: 'effect', date: '2026-07-10', published_at: '2026-07-10',
        effective_at: '2026-07-10',
      }],
      observations: [{
        id: 'seen', date: '2026-07-10', observed_at: '2026-07-10',
        state_sha256: 'seen-state',
      }],
    },
  };
  const items = buildArchiveTimeline(archive);
  assert.equal(items.length, 3);
  assert.deepEqual(
    items.map(({ kind }) => kind),
    ['publication', 'effective', 'observed'],
  );
  assert.deepEqual(
    items.map(({ checkoutable }) => checkoutable),
    [false, false, true],
  );
  assert.equal(new Set(items.map(({ id }) => id)).size, 3);
});

test('event-only retrospective history is visible before full-state checkout', () => {
  const archive: KerfActArchive = {
    act_id: 'fed_test',
    head_date: '2026-07-16',
    entries: [{ date: '2026-07-16', label: 'HEAD' }],
    retrospective: {
      available: true,
      intervals: [],
      events: [{ id: 'bgbl', date: '2024-03-01', label: 'BGBl' }],
      observations: [],
    },
  };
  const items = buildArchiveTimeline(archive);
  assert.deepEqual(items.map(({ date }) => date), [
    '2024-03-01', '2026-07-16',
  ]);
  assert.deepEqual(items.map(({ kind }) => kind), ['event', 'head']);
  assert.deepEqual(items.map(({ checkoutable }) => checkoutable), [false, true]);
});

test('legal intervals are half-open and capped by verified observation', () => {
  const archive: KerfActArchive = {
    act_id: 'fed_test',
    head_date: '2026-07-16',
    entries: [],
    retrospective: {
      available: true,
      intervals: [
        {
          effective_from: '2020-01-01', effective_to: '2022-01-01',
          verified_through_observed_at: '2021-01-01', state_sha256: 'a',
        },
        {
          effective_from: '2022-01-01', effective_to: null,
          verified_through_observed_at: '2024-05-01T12:30:00Z',
          state_sha256: 'b',
        },
      ],
    },
  };
  const items = buildArchiveTimeline(archive);
  assert.equal(intervalContains(items[0].interval!, '2021-12-31'), true);
  assert.equal(intervalContains(items[0].interval!, '2022-01-01'), false);
  assert.equal(intervalContains(items[1].interval!, '2024-05-01'), true);
  assert.equal(intervalContains(items[1].interval!, '2024-05-02'), false);
  assert.equal(
    resolveArchiveTimelineItem(items, '', '2021-06-01')?.interval?.state_sha256,
    'a',
  );
  assert.equal(
    resolveArchiveTimelineItem(items, '', '2022-01-01')?.interval?.state_sha256,
    'b',
  );
  assert.equal(resolveArchiveTimelineItem(items, '', '2025-01-01'), null);
});

test('future legal-effect marker is labelled from archive HEAD', () => {
  const archive: KerfActArchive = {
    act_id: 'fed_test',
    head_date: '2026-07-16',
    entries: [{ date: '2026-07-16', label: 'HEAD' }],
    retrospective: {
      available: true,
      intervals: [],
      events: [{
        id: 'future', date: '2026-07-01', published_at: '2026-07-01',
        effective_at: '2027-01-01',
      }],
    },
  };
  const items = buildArchiveTimeline(archive);
  const effect = items.find(({ kind }) => kind === 'effective');
  assert.equal(effect?.future, true);
  assert.equal(effect?.checkoutable, false);
});

test('derived verified body is complete and checkoutable but never source-exact', () => {
  const archive: KerfActArchive = {
    act_id: 'fed_sgb_8',
    head_date: '2026-07-16',
    entries: [],
    retrospective: {
      available: true,
      intervals: [{
        segment_id: 'verified-replay',
        effective_from: '2026-04-29',
        effective_to: '2026-06-12',
        state_sha256: 'derived-state',
        text_status: 'derived_verified',
        body_complete: true,
        complete: true,
        source_exact: false,
        verified_reconstruction: true,
        reverse_replay_verified: true,
      }],
    },
  };

  const [item] = buildArchiveTimeline(archive);
  assert.equal(isVerifiedReconstruction(item.interval!), true);
  assert.equal(item.complete, true);
  assert.equal(item.sourceExact, false);
  assert.equal(item.verifiedReconstruction, true);
  assert.equal(item.checkoutable, true);
});


test('independent official archived captures remain selectable beside event-only retrospective history without duplicate observations', () => {
  const archive = { head_date: '2026-09-27', entries: [
    { date: '2016-01-29', date_basis: 'archive_capture_not_effective_date', state_digest: 'by-old', exact: true, source: 'BAYERN.RECHT' },
    { date: '2026-07-06', observed_at: '2026-07-06', state_digest: 'same', exact: true },
  ], retrospective: { intervals: [], events: [{ id: 'amendment', date: '2020-01-01', published_at: '2020-01-01' }],
    observations: [{ observed_at: '2026-07-06', state_sha256: 'same' }] } } as KerfActArchive;
  const timeline = buildArchiveTimeline(archive);
  assert.equal(timeline.filter(item => item.kind === 'observed').length, 2);
  const captured = timeline.find(item => item.date === '2016-01-29');
  assert.equal(captured?.kind, 'observed');
  assert.equal(captured?.checkoutable, true);
  assert.equal(captured?.entry?.source, 'BAYERN.RECHT');
  assert.equal(timeline.filter(item => item.date === '2026-07-06').length, 1);
});
