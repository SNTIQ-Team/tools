import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import type { KerfActDetail, KerfActNorm } from './client';
import { isTocNorm, isTocPseudoNorm, provisionsText, readerProvisions, stripTocPlaceholders } from './readerToc';
import ReaderTocOutline from './ReaderTocOutline';
import ReaderArchivedText from './ReaderArchivedText';
import { dispositionFilename } from './readerExport';

// Real GII shape: SGB II's first "norm" is the body-less table of contents.
const sgb2: KerfActNorm[] = [
  { enbez: 'Inhaltsübersicht', titel: '', text: '', glied: '' },
  { enbez: '§ 1', titel: 'Aufgabe und Ziel der Grundsicherung für Arbeitsuchende', text: '(1) Die Grundsicherung für Arbeitsuchende soll es Leistungsberechtigten ermöglichen, ein Leben zu führen, das der Würde des Menschen entspricht.', glied: 'Kapitel 1 Fördern und Fordern' },
  { enbez: '§ 16j', titel: '(weggefallen)', text: '', glied: 'Kapitel 3 Leistungen' },
];
const pstg: KerfActNorm[] = JSON.parse(readFileSync(new URL('./fixtures/pstg-outline.json', import.meta.url), 'utf8'));

test('only the table of contents is a pseudo-norm; repealed provisions stay provisions', () => {
  assert.equal(isTocPseudoNorm(sgb2[0]), true);
  assert.equal(isTocPseudoNorm(sgb2[2]), false);
  assert.equal(isTocPseudoNorm({ enbez: 'Inhaltsübersicht', text: 'Kapitel 1 …' }), false, 'a TOC with its own source text is kept');
  assert.equal(isTocNorm({ enbez: 'Inhaltsübersicht', text: 'Kapitel 1 …' }), true);
  assert.deepEqual(readerProvisions(sgb2).map(norm => norm.enbez), ['§ 1', '§ 16j']);
  assert.doesNotMatch(provisionsText(sgb2), /Inhaltsübersicht/);
  assert.match(provisionsText(sgb2), /^§ 1 Aufgabe und Ziel/);
});

test('the collapsed outline lists the provisions by section and never says "no text"', () => {
  const html = renderToStaticMarkup(<ReaderTocOutline label="Inhaltsübersicht" norms={pstg} fallback="PStG" note="generated" />);
  assert.match(html, /^<details data-reader-toc="generated"><summary>Inhaltsübersicht<\/summary>/);
  assert.doesNotMatch(html, / open=""/);
  assert.match(html, /<strong>Kapitel 1 Allgemeine Bestimmungen<\/strong><ul><li><span>§ 1<\/span> Personenstand, Aufgaben des Standesamts<\/li>/);
  assert.equal((html.match(/<li>/g) ?? []).length, pstg.length - 1);
  assert.doesNotMatch(html, /keinen Text|no text/i);
});

test('archived editions: the export placeholder becomes a generated outline, consistently', () => {
  const act = { id: 'fed_sgb_2', jurabk: 'SGB 2', norms: sgb2 } as KerfActDetail;
  const markdown = '# SGB II\n\n## Inhaltsübersicht\n\n_Kein Normtext im konsolidierten Quellsnapshot._\n\n## § 1 — Aufgabe und Ziel der Grundsicherung für Arbeitsuchende\n\n(1) Text.';
  const html = renderToStaticMarkup(<ReaderArchivedText markdown={markdown} act={act} acts={[]} at="2026-07-06" query="" onReference={() => {}} />);
  assert.doesNotMatch(html, /Kein Normtext/);
  assert.match(html, /<details data-reader-toc="generated"><summary>Inhaltsübersicht<\/summary><div data-reader-toc-list="true">/);
  assert.match(html, /<h2>§ 1 — Aufgabe und Ziel/);
});

test('Markdown exports drop only body-less TOC sections, byte for byte otherwise', () => {
  const markdown = '---\nact_id: "fed_sgb_2"\n---\n\n# Titel\n\n## Inhaltsübersicht\n\n_Kein Normtext im konsolidierten Quellsnapshot._\n\n## § 1 — Aufgabe\n\n(1) Text.\n\n### Unterüberschrift\n\nMehr.\n\n## § 16j — (weggefallen)\n\n_Kein Normtext im konsolidierten Quellsnapshot._\n';
  const stripped = stripTocPlaceholders(markdown);
  assert.doesNotMatch(stripped, /Inhaltsübersicht/);
  assert.equal(stripped, markdown.replace('## Inhaltsübersicht\n\n_Kein Normtext im konsolidierten Quellsnapshot._\n\n', ''));
  assert.match(stripped, /## § 16j — \(weggefallen\)\n\n_Kein Normtext/, 'a repealed provision keeps its placeholder');
  const withSource = '## Inhaltsübersicht\n\nKapitel 1 Allgemeine Bestimmungen\n\n## § 1\n\nText.';
  assert.equal(stripTocPlaceholders(withSource), withSource);
});

test('download names come from Content-Disposition when the API sends one', () => {
  assert.equal(dispositionFilename('attachment; filename="sgb_2.md"'), 'sgb_2.md');
  assert.equal(dispositionFilename("attachment; filename*=UTF-8''SGB%202%20%C2%A7%207.md"), 'SGB 2 § 7.md');
  assert.equal(dispositionFilename(null), null);
});
