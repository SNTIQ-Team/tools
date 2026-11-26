import assert from 'node:assert/strict';
import test from 'node:test';
import type { KerfActDetail } from './client';
import { actNotesForNorm, loadNormSummary } from './readerChangeSummary';

const envelope = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify({ status: 'ok', searched: [], warnings: [], failed_components: [], total: null, evidence: [], ...body }), { status, headers: { 'content-type': 'application/json' } });

test('the reader header uses a served norm summary and stops probing once the route is missing', async t => {
  const urls: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    urls.push(String(url));
    if (String(url).includes('/norms/resolve')) {
      const norm = new URL(String(url)).searchParams.get('norm')!.replace('§ ', '');
      return envelope({ evidence: [{ canonical_id: `de/bund/sgb_2/para/${norm}` }] });
    }
    if (String(url).includes('/para/7/changes')) return envelope({ change_summary: { schema: 'kerf-change-summary/1', scope: 'norm', subject: 'de/bund/sgb_2/para/7', last_change: null, next_pending_change: null, counts: { versions: 17, events: 9 } } });
    // The deployed API: a framework 404 without an envelope.
    return new Response(JSON.stringify({ detail: 'Not Found' }), { status: 404, headers: { 'content-type': 'application/json' } });
  });
  const served = await loadNormSummary('fed_sgb_2', '§ 7');
  assert.equal(served?.counts?.versions, 17);
  assert.match(urls.find(url => url.includes('/changes')) ?? '', /limit=0/);
  assert.equal(await loadNormSummary('fed_sgb_2', '§ 8'), null, 'missing route → no summary');
  const before = urls.length;
  assert.equal(await loadNormSummary('fed_sgb_2', '§ 9'), null);
  assert.equal(urls.length, before, 'no further requests after the route proved missing');
});

test('for a single provision only the act-wide GII notes are restated, never the act\'s last or next change', () => {
  const act = { id: 'fed_sgb_2', jurabk: 'SGB 2', stand: 'Stand: zuletzt geändert durch Art. 1a G v. 16.4.2026 I Nr. 107',
    change_summary: { schema: 'kerf-change-summary/1', scope: 'act', subject: 'fed_sgb_2', last_change: { change_id: 'c', norm_label: '§ 11a', in_force: '2026-01-01' },
      next_pending_change: { change_id: 'n', norm_label: '§ 6b', in_force: '2027-01-01', state: 'pending' }, counts: { versions: 718 },
      act_stand_note: { scope: 'act', text: 'zuletzt geändert durch Art. 1a G v. 16.4.2026 I Nr. 107', norm_specific: false } } } as unknown as KerfActDetail;
  const notes = actNotesForNorm(act, '2026-09-28')!;
  assert.equal(notes.scope, 'norm');
  assert.equal(notes.last_change, null);
  assert.equal(notes.next_pending_change, null);
  assert.equal(notes.counts, null);
  assert.equal(notes.act_stand_note?.norm_specific, false);
});
