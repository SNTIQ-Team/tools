import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import type { KerfActNorm } from './client';
import { readerDesignator, readerNormMatches, readerOutline } from './readerOutline';
import { createWorkspace, workspaceReducer, encodeWorkspace, decodeWorkspace } from './readerWorkspace';

test('article and paragraph survive outline selection and opening a saved URL', () => {
  const norms = [{ enbez: '§ 1', glied: 'Art 224' }, { enbez: '§ 1', glied: 'Art 229' }];
  const reference = readerDesignator(norms[1]);
  const workspace = workspaceReducer(createWorkspace(), { type: 'open', actId: 'fed_bgbeg', norm: reference, mode: 'new' });
  const saved = decodeWorkspace(encodeWorkspace(workspace))!.panes[0].tabs[0].norm!;
  assert.equal(saved, 'Art. 229 § 1');
  assert.deepEqual(readerNormMatches(norms, saved), [norms[1]]);
  assert.deepEqual(readerNormMatches(norms, '§ 1'), norms);
  assert.deepEqual(readerNormMatches([{ enbez: saved }], '§ 1'), [{ enbez: saved }]);
});

const pstg: KerfActNorm[] = JSON.parse(readFileSync(new URL('./fixtures/pstg-outline.json', import.meta.url), 'utf8'));

test('PStG outline keeps source order across repeated section titles', () => {
  const groups = readerOutline(pstg, 'PStG');
  assert.deepEqual(groups.flatMap(group => group.norms.map(norm => norm.enbez)), pstg.map(norm => norm.enbez));
  const repeated = groups.filter(group => group.label === 'Abschnitt 1 Anzeige und Beurkundung');
  assert.deepEqual(repeated.map(group => group.norms.map(norm => norm.enbez)), [
    ['§ 18', '§ 19', '§ 20', '§ 21'], ['§ 28', '§ 29', '§ 30', '§ 31'],
  ]);
  assert.notEqual(repeated[0].start, repeated[1].start);
});

test('search does not merge separated sections or change their identity', () => {
  const all = readerOutline(pstg, 'PStG');
  const filtered = readerOutline(pstg, 'PStG', norm => ['§ 18', '§ 28'].includes(norm.enbez));
  assert.equal(filtered.length, 2);
  assert.deepEqual(filtered.map(group => group.start), all.filter(group => group.label === 'Abschnitt 1 Anzeige und Beurkundung').map(group => group.start));
  assert.deepEqual(filtered.flatMap(group => group.norms.map(norm => norm.enbez)), ['§ 18', '§ 28']);
});
