import assert from 'node:assert/strict';
import test from 'node:test';
import type { KerfActDetail } from './client';
// @ts-expect-error Native Node strip-types needs an explicit .ts suffix.
import { buildSynopsisTimeline, commandMatchesNorm } from './synopsisTimeline.ts';

const detail = {
  id: 'fed_sgb_12', jurabk: 'SGB 12', juris: 'DE', title: 'Sozialhilfe',
  norms: [], patches: [], versions: [],
} as unknown as KerfActDetail;

test('official event-only amendments remain visible and preserve same-day articles', () => {
  const events = [
    { id: 'first', date: '2023-06-13', published_at: '2023-06-13', affected_norms: ['§ 11'] },
    { id: 'second', date: '2023-06-13', affected_norms: ['§ 12'] },
    { id: 'superseded', date: '2024-01-01', knowledge_to: '2026-07-16T00:00:00Z' },
  ];
  const items = buildSynopsisTimeline(detail, events);
  assert.equal(items.length, 2);
  assert.deepEqual(items.map((item) => item.kind), ['event', 'event']);
});

test('provision filter includes matching official commands without matching section 110', () => {
  const events = [
    { date: '2023-01-01', commands: [{ ref: { para: '11' }, operation: 'repeal' }] },
    { date: '2023-01-01', affected_norms: ['§ 110'] },
  ];
  const items = buildSynopsisTimeline(detail, events, '§ 11');
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, 'event');
});

test('repeal patches stay visible even when no old or replacement text exists', () => {
  const act = { ...detail, patches: [
    { status: 'proposed', op: 'repeal', para: '11', old: null, new: null },
    { status: 'rejected', op: 'repeal', para: '11', old: null, new: null },
  ] } as KerfActDetail;
  assert.equal(buildSynopsisTimeline(act, [], '§ 11').length, 1);
});

test('undotted GII article labels match the corresponding command reference', () => {
  const events = [{ date: '2023-01-01', commands: [{ ref: { para: '1' } }] }];
  assert.equal(buildSynopsisTimeline(detail, events, 'Art 1').length, 1);
  assert.equal(buildSynopsisTimeline(detail, events, 'Art. 1').length, 1);
});

test('joint replacement command remains visible for each affected provision', () => {
  const command = { ref: { para: '11', paras: ['11', '12'] }, operation: 'replace' };
  const events = [{ date: '2023-01-01', commands: [command] }];
  for (const norm of ['§ 11', '§ 12']) {
    assert.equal(buildSynopsisTimeline(detail, events, norm).length, 1);
    assert.equal(commandMatchesNorm(command, norm), true);
  }
  assert.equal(commandMatchesNorm(command, '§ 110'), false);
});
