import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { readFileSync } from 'node:fs';
import { archiveNorms } from './readerArchiveStructure';
import { renderToStaticMarkup } from 'react-dom/server';
import ReaderArchivedText from './ReaderArchivedText';
import { loadArchivedStructuredNorms } from './readerStructuredResources';
import type { KerfActDetail, KerfActMarkdown } from './client';
const act = { id: 'test', jurabk: 'Test', norms: [{enbez:'Art. 2'}] } as KerfActDetail;
const render = (markdown: string) => renderToStaticMarkup(<ReaderArchivedText markdown={markdown} act={act} acts={[]} at="2026-07-06" query="Art. 2" onReference={() => {}} />);

test('archived citations and highlights include nested emphasis and carry the requested edition', () => {
  const html = render('## Art. 1\n\nSiehe Art. **2**.\n\n## Art. 2\n\nText.');
  assert.match(html, /data-reference-at="2026-07-06"/);
  assert.match(html, /<mark>Art\. <strong>2<\/strong><\/mark>/);
});
test('only a leading export header is omitted; real law headings remain', () => {
  assert.match(render('## Art. 1\n\n# Besondere Vorschriften\n\nText.'), /<h1>Besondere Vorschriften<\/h1>/);
});
test('numbered archival paragraphs are separated without losing source text', () => {
  const html = render('## Art. 1\n\n(1) Erster Absatz.(2) Zweiter Absatz.(2a) Zusatz.(3) Dritter Absatz.');
  assert.match(html, /<p>\(1\) Erster Absatz\.<\/p><p>\(2\)/);
  assert.match(html, /<p>\(2a\) Zusatz\.<\/p>/);
});
test('a norm absent from the selected archive is not inferred from current metadata', () => {
  const html = render('## Art. 1\n\nSiehe Art. 2.');
  assert.doesNotMatch(html, /data-reference-norm="Art\. 2"/);
});


test('2016 Bavarian inventory retains source §8a–§8e and never substitutes modern Art designations in scoped links', () => {
  const full = readFileSync(new URL('./fixtures/bayvwvfg-2016-mixed-designations.md', import.meta.url), 'utf8');
  const inventory = archiveNorms(full);
  assert.deepEqual(inventory.filter(norm => /^§ 8[a-e]$/.test(norm.enbez)).map(norm => norm.enbez), ['§ 8a', '§ 8b', '§ 8c', '§ 8d', '§ 8e']);
  assert.ok(!inventory.some(norm => /^Art\. 8[a-e]$/.test(norm.enbez)));
  const head = { id: 'by_bayvwvfg', jurabk: 'BayVwVfG', title: 'Modern title', norms: ['a', 'b', 'c', 'd', 'e'].map(letter => ({ enbez: `Art. 8${letter}` })) } as KerfActDetail;
  const html = renderToStaticMarkup(<ReaderArchivedText markdown={'## § 8a — Grundsätze der Hilfeleistung\n\nSiehe § 8b. Art. 8b wird nicht aus HEAD übernommen.'}
    act={head} acts={[]} at="2016-01-29" norms={inventory} query="" onReference={() => {}} />);
  assert.match(html, /data-reference-norm="§ 8b"/);
  assert.match(html, /data-reference-at="2016-01-29"/);
  assert.doesNotMatch(html, /data-reference-norm="Art\. 8b"/);
  const actual = renderToStaticMarkup(<ReaderArchivedText markdown={full} act={head} acts={[]} at="2016-01-29" norms={inventory} query="" onReference={() => {}} />);
  for (const label of ['Art. 5', 'Art. 7', 'Art. 8']) assert.ok(actual.includes(`data-reference-norm="${label}"`));
});


test('unchanged archived bodies reuse verified list structure with the historical heading and date only', () => {
  const norm = { enbez: '§ 1', titel: 'Historischer Titel', text: '(1) Siehe § 2.1.eins2.zwei' };
  const head = { id: 'test', jurabk: 'Test', norms: [norm, { enbez: '§ 2', titel: 'Ziel', text: 'Ziel.' }] } as KerfActDetail;
  const structures = { '§ 1': { text_sha256: 'verified', blocks: [
    { type: 'element' as const, tag: 'p', children: [{ type: 'text' as const, text: '(1) Siehe § 2.' }] },
    { type: 'element' as const, tag: 'dl', children: [
      { type: 'element' as const, tag: 'dt', children: [{ type: 'text' as const, text: '1.' }] },
      { type: 'element' as const, tag: 'dd', children: [{ type: 'text' as const, text: 'eins' }] },
      { type: 'element' as const, tag: 'dt', children: [{ type: 'text' as const, text: '2.' }] },
      { type: 'element' as const, tag: 'dd', children: [{ type: 'text' as const, text: 'zwei' }] },
    ] },
  ], source_annotations_text: 'CURRENT NOTE MUST NOT APPEAR', source_annotations: [{ type: 'text' as const, text: 'CURRENT NOTE MUST NOT APPEAR' }] } };
  const markdown = `## § 1 — Historischer Titel\n\n${norm.text}\n\n## § 2 — Ziel\n\nZiel.`;
  const renderEdition = (source = markdown, current = head) => renderToStaticMarkup(<ReaderArchivedText markdown={source}
    act={current} acts={[]} at="2026-07-16" query="eins" structures={structures} onReference={() => {}} />);
  const html = renderEdition();
  assert.match(html, /<h2>§ 1 — Historischer Titel<\/h2>/);
  assert.match(html, /<dl><dt>1\.<\/dt><dd><mark>eins<\/mark><\/dd><dt>2\.<\/dt><dd>zwei<\/dd><\/dl>/);
  assert.match(html, /data-reference-norm="§ 2"/);
  assert.match(html, /data-reference-at="2026-07-16"/);
  assert.doesNotMatch(html, /CURRENT NOTE/);
  for (const changed of [markdown.replace('1.eins', '1.früher'), markdown.replace('Historischer Titel', 'Anderer Titel'), markdown.replace('1.eins', '1. eins')]) {
    assert.doesNotMatch(renderEdition(changed), /<dl>/);
  }
  assert.doesNotMatch(renderEdition(markdown, { ...head, norms: [...head.norms!, norm] }), /<dl>/);
  assert.doesNotMatch(renderEdition(`${markdown}\n\n## § 1 — Historischer Titel\n\n${norm.text}`), /<dl>/);
  const scoped = renderToStaticMarkup(<ReaderArchivedText markdown={`## § 1 — Historischer Titel\n\n${norm.text}`}
    act={head} acts={[]} at="2026-07-16" query="" norms={[norm, norm]} structures={structures} onReference={() => {}} />);
  assert.doesNotMatch(scoped, /<dl>/);
});


// Exact two-section extract from official 2026-06-26 HTML, whose full source
// was verified against the PStG CAS observed on 2026-07-16 (86/86 norms).
test('PStG old TOC and section 44 use their own verified snapshot instead of changed HEAD bodies', async t => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/pstg-2026-07-16-structure.json', import.meta.url), 'utf8'));
  const edition: KerfActMarkdown = { act_id: 'fed_pstg', requested_at: '2026-07-16', resolved_at: '2026-07-16',
    exact: true, partial: false, complete: true, source_exact: true, state_sha256: fixture.payload.state_sha256, markdown: fixture.markdown };
  t.mock.method(globalThis, 'fetch', async () => Response.json(fixture.payload));
  const historical = await loadArchivedStructuredNorms(edition);
  const head = { id: 'fed_pstg', jurabk: 'PStG', norms: fixture.head_norms } as KerfActDetail;
  const renderEdition = (at = edition.requested_at, selected = historical) => renderToStaticMarkup(<ReaderArchivedText
    markdown={edition.markdown} act={head} acts={[]} at={at} query="" editionStructures={selected} onReference={() => {}} />);
  const html = renderEdition();
  assert.equal((html.match(/<table>/g) ?? []).length, 1);
  assert.equal((html.match(/<tr>/g) ?? []).length, 158);
  assert.ok(html.includes('des Mannes, der dem Kind bislang als Vater zugeordnet war'));
  assert.ok(!html.includes('§ 44b'));
  assert.deepEqual([...html.matchAll(/<h2>([^<]+)<\/h2>/g)].map(match => match[1]), [
    '§ 44 — Erklärungen zur Anerkennung der Vaterschaft und der Mutterschaft',
  ]);
  // The source's own table of contents keeps its verified table, collapsed.
  assert.match(html, /<details data-reader-toc="source"><summary>Inhaltsübersicht<\/summary><div><table>/);
  assert.doesNotMatch(renderEdition('2026-07-29'), /<table>/);
  assert.doesNotMatch(renderEdition(edition.requested_at, { ...historical, act: { ...historical.act, id: 'wrong_act' } }), /<table>/);
});
