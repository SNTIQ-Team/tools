import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReaderText, { readerDocumentHref } from './ReaderText';
import { decodeWorkspace } from './readerWorkspace';
import type { KerfAct, KerfStatutoryCitation } from './client';

const act: KerfAct = { id: 'fed_asylvfg_1992', jurabk: 'AsylG', juris: 'DE', title: 'Asylgesetz', norms: 4, last_change: null, next_change: null, pending: 0 };

test('rendered legal links are sibling anchors and source markup remains escaped text', () => {
  const text = 'Artikel 14 Absatz 2 der Verordnung (EU) 2024/1347; § 3. <img src=x onerror=alert(1)> <gco-l-u>Text</gco-l-u>';
  const html = renderToStaticMarkup(<ReaderText text={text} actId={act.id} acts={[act]} norms={[{ enbez: '§ 3' }]} citations={[]} onReference={() => {}} />);
  assert.equal((html.match(/<a\s/g) ?? []).length, 2);
  assert.equal((html.match(/<\/a>/g) ?? []).length, 2);
  assert.doesNotMatch(html, /<a[^>]*>[^]*<a[^>]*>[^]*<\/a>[^]*<\/a>/);
  assert.doesNotMatch(html, /<img|<gco-l-u>|type=urteil/);
  assert.match(html, /&lt;img/);
  assert.match(html, /eur-lex\.europa\.eu/);
});

test('AGSG compound reference renders separate BGB navigation links and preserves parentheses', () => {
  const phrase = '§§ 1835 Abs. 1 und 1849 des Bürgerlichen Gesetzbuches (BGB)';
  const bgb = { ...act, id: 'fed_bgb', jurabk: 'BGB', title: 'Bürgerliches Gesetzbuch' };
  const citations = ['§ 1835', '§ 1849'].map(norm => ({
    status: 'resolved', source_act: act.id, source_norm: '§ 3',
    citation_text: phrase, target_act: bgb.id, target_jurabk: 'BGB', target_norm: norm,
  })) as KerfStatutoryCitation[];
  const html = renderToStaticMarkup(<ReaderText text={`(${phrase}).`} actId={act.id} acts={[act, bgb]} norms={[]} citations={citations} query="BGB" onReference={() => {}} />);
  const links = [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g)];
  assert.equal(links.length, 2);
  assert.deepEqual(links.map(link => {
    const workspace = decodeWorkspace(link[1].slice(link[1].indexOf('#')));
    const tab = workspace?.panes[0].tabs[0];
    return [tab?.actId, tab?.norm];
  }), [['fed_bgb', '§ 1835'], ['fed_bgb', '§ 1849']]);
  assert.equal(links[1][2], '1849 des Bürgerlichen Gesetzbuches (<mark>BGB</mark>)');
  assert.equal(html.replace(/<[^>]*>/g, ''), `(${phrase}).`);
});

test('a provision link contains complete stable ids before metadata is fetched', () => {
  const href = readerDocumentHref('fed_sgb_12', '§ 11');
  assert.doesNotMatch(href, /undefined/);
  const restored = decodeWorkspace(href.slice(href.indexOf('#')));
  assert.equal(restored?.panes[0].tabs[0].actId, 'fed_sgb_12');
  assert.equal(restored?.panes[0].tabs[0].norm, '§ 11');
});
