import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { renderToStaticMarkup } from 'react-dom/server';
import { versionTree, versionTreeText } from './normVersionText';
import NormVersionText from './NormVersionText';
import type { KerfNormAt, KerfNormVersion } from './normHistoryClient';

const require = createRequire(import.meta.url);
require.extensions['.css'] = module => { module.exports = {}; };
const fixture = <T,>(name: string): T => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
// Real /norms/{id}/at?version=… response of the core API: § 85a AufenthG as of 2026-07-06.
const at = fixture<KerfNormAt>('core-norm-at-aufenthg-85a-old.json');
const version = at.evidence[0];
const squash = (value: string) => value.replace(/\s+/gu, '');

test('an old version renders completely: every source character exactly once', () => {
  const tree = versionTree(version.text, version.structure)!;
  assert.ok(tree);
  assert.equal(squash(versionTreeText(tree)), squash(version.text!));
  assert.deepEqual(tree.units.map(unit => [unit.type, unit.marker]), [['absatz', '(1)'], ['absatz', '(2)'], ['absatz', '(3)'], ['absatz', '(4)']]);
  const absatz2 = tree.units[1];
  const satz = absatz2.segments.find(segment => segment.kind === 'unit')!;
  assert.equal(satz.kind === 'unit' && satz.unit.type, 'satz');
  const items = satz.kind === 'unit' ? satz.unit.segments.filter(segment => segment.kind === 'unit').map(segment => segment.kind === 'unit' ? `${segment.unit.type}:${segment.unit.marker}` : '') : [];
  assert.deepEqual(items, ['text_block:null', 'nummer:1.', 'nummer:2.', 'nummer:3.', 'nummer:4.', 'text_block:null']);
});

test('structure markup: Absatz markers, list items as blocks, sentences inline', () => {
  const html = renderToStaticMarkup(<NormVersionText text={version.text!} structure={version.structure} />);
  assert.match(html, /^<div data-version-text="structured">/);
  assert.equal((html.match(/data-unit="absatz"/g) ?? []).length, 4);
  assert.equal((html.match(/data-unit="nummer"/g) ?? []).length, 4);
  assert.match(html, /<div data-unit="nummer" data-locator="abs\/2\/satz\/1\/nr\/1"><span data-marker="true">1\.<\/span><div>der Anerkennende/);
  assert.match(html, /<span data-marker="true">\(1\)<\/span> <span data-unit="satz"/);
});

test('invalid or missing structure falls back to the full plain text, never a truncated one', () => {
  const broken = { ...version.structure!, units: [{ type: 'absatz', start: 50, end: 10 }] };
  assert.equal(versionTree(version.text, broken as never), null);
  const html = renderToStaticMarkup(<NormVersionText text={version.text!} structure={broken as never} fallbackNote="no structure" />);
  assert.match(html, /data-version-text="plain"/);
  assert.match(html, /no structure/);
  assert.ok(squash(html.replace(/<[^>]+>/gu, '')).includes(squash(version.text!.slice(-60))));
  assert.match(renderToStaticMarkup(<NormVersionText text="(1) Eins.(2) Zwei." />), /<p>\(1\) Eins\.<\/p><p>\(2\) Zwei\.<\/p>/);
});

test('version helpers: the current version is never a future one; date fallback never invents a legal date', async () => {
  const { currentVersion, previousVersion, versionDate, versionOptionLabel, isFutureVersion } = await import('./NormHistory');
  const log = fixture<{ evidence: KerfNormVersion[] }>('core-norm-log-sgb2-7.json').evidence;
  const future = { ...log[0], version_id: 'future', future: true, temporal: { ...log[0].temporal, valid_from: '2027-01-01', valid_from_status: 'official_commencement_clause' } } as KerfNormVersion;
  const undated = { ...log[1], temporal: { ...log[1].temporal, known_at: null, observed_from: null }, source: { ...log[1].source, observed_at: null }, attestations: [] };
  assert.equal(previousVersion([log[0], undated], 0), undefined);
  assert.equal(previousVersion([log[0], undated, log[1]], 0), log[1]);
  assert.equal(isFutureVersion(future, '2026-09-28'), true);
  assert.equal(currentVersion([future, ...log], '2026-09-28')?.version_id, log[0].version_id);
  assert.equal(currentVersion([log[1], log[2]], '2026-09-28'), null, 'archive observations cannot establish legal currency');
  assert.equal(currentVersion([{ ...log[0], temporal: { ...log[0].temporal, valid_until_exclusive: '2026-09-28' } }], '2026-09-28'), null, 'the exclusive end is the first day outside the version');
  assert.equal(versionDate(log[0]), '2024-06-01', 'a verified legal start');
  assert.equal(versionDate(log[1]), '2024-01-12', 'an archived capture is selected by its capture day');
  assert.equal(versionOptionLabel(log[1], log[0], 'de'), 'Gespeichert am 12.01.2024');
  assert.match(versionOptionLabel(log[0], log[0], 'de'), /· aktuell$/);
});
