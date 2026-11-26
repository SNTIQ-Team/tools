import React from 'react';
import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { readerEditions } from './readerEditions';
import ReaderArchivedText from './ReaderArchivedText';
import type { KerfActArchive, KerfActDetail } from './client';

test('edition selector deduplicates unchanged observations and excludes event-only dates', () => {
  const archive = { act_id: 'fed_sgb_12', head_date: '2026-09-21', entries: [], retrospective: {
    intervals: [], observations: [
      { observed_at: '2026-07-06', state_sha256: 'before' },
      { observed_at: '2026-07-07', state_sha256: 'before' },
      { observed_at: '2026-08-01', state_sha256: 'after' },
    ], events: [{ date: '2026-01-01', published_at: '2026-01-01', effective_at: '2026-04-01' }],
  } } as KerfActArchive;
  assert.deepEqual(readerEditions(archive).map(item => [item.date, item.kind]), [['2026-08-01', 'observed'], ['2026-07-06', 'observed']]);
  assert.deepEqual(readerEditions(null), []);
});

test('historical Markdown uses safe structure and links without exposing export metadata', () => {
  const act = { id: 'fed_sgb_12', jurabk: 'SGB 12', norms: [{ enbez: '§ 11' }] } as KerfActDetail;
  const html = renderToStaticMarkup(<ReaderArchivedText act={act} acts={[]} query="" onReference={() => {}} markdown={'---\nact_id: private-metadata\n---\n\n# Export title\n\n> Archive status: **exact**\n> captured date\n\n## § 11\n\nSee § 11.\n\n> A real quotation.\n\n<img src=x onerror="alert(1)">\n\n[bad](javascript:alert%281%29)'} />);
  assert.ok(html.includes('<h2>§ 11</h2>'));
  assert.ok(html.includes('A real quotation.'));
  assert.ok(html.includes('&lt;img'));
  assert.ok(html.includes('#reader='));
  for (const value of ['private-metadata', 'Export title', 'Archive status', '<img', 'javascript:']) assert.ok(!html.includes(value), value);
});
