import assert from 'node:assert/strict';
import test from 'node:test';
import type { KerfActArchive } from './client';
import { archiveCoverage } from './archiveCoverage';

test('old amendment metadata never widens complete text coverage', () => {
  const archive = { act_id: 'fed_sgb_12', head_date: '2026-09-21', entries: [], retrospective: {
    intervals: [], events: [
      { id: 'old', published_at: '2006-12-07', effective_at: '2007-01-01' },
      { id: 'new', published_at: '2022-12-20', effective_at: '2023-01-01' },
    ], observations: [
      { observed_at: '2026-07-06', state_sha256: 'a' },
      { observed_at: '2026-07-07', state_sha256: 'a' },
      { observed_at: '2026-09-21', state_sha256: 'b' },
    ],
  } } as KerfActArchive;
  assert.deepEqual(archiveCoverage(archive), {
    eventsFrom: '2006-12-07', eventCount: 2,
    textsFrom: '2026-07-06', textCount: 2, hasEarlierEvents: true,
  });
});

test('metadata-only history has no archived text count or text start', () => {
  const archive = { entries: [], retrospective: { intervals: [], events: [
    { id: 'one', published_at: '1993-06-30' },
  ] } } as unknown as KerfActArchive;
  assert.deepEqual(archiveCoverage(archive), {
    eventsFrom: '1993-06-30', eventCount: 1,
    textsFrom: null, textCount: 0, hasEarlierEvents: true,
  });
  assert.equal(archiveCoverage(null).eventCount, 0);
});

test('complete verified legal reconstruction contributes its interval, not publication date', () => {
  const archive = { entries: [], retrospective: { events: [], intervals: [{
    effective_from: '2024-01-01', published_at: '2023-12-12',
    state_sha256: 'replayed', body_complete: true, source_exact: false,
    verified_reconstruction: true,
  }] } } as unknown as KerfActArchive;
  assert.equal(archiveCoverage(archive).textsFrom, '2024-01-01');
  assert.equal(archiveCoverage(archive).textCount, 1);
});

test('partial or unverifiable legacy reconstructions are not counted as complete texts', () => {
  const archive = { entries: [
    { date: '2006-01-01', effective_at: '2006-01-01', partial: true, exact: false,
      state_digest: 'partial' },
    { date: '2007-01-01', effective_at: '2007-01-01', exact: false,
      state_digest: 'unverified' },
    { date: '2008-01-01', effective_at: '2008-01-01', exact: true },
    { date: '2026-07-06', observed_at: '2026-07-06', exact: true,
      state_digest: 'complete' },
  ] } as unknown as KerfActArchive;
  assert.equal(archiveCoverage(archive).textCount, 1);
  assert.equal(archiveCoverage(archive).textsFrom, '2026-07-06');
});
