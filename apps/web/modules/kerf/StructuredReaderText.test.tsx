import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import StructuredReaderText from './StructuredReaderText';
import { validateReaderBlocks, type ReaderNode } from './readerStructure';
import type { KerfAct, KerfStatutoryCitation } from './client';
const text = (text: string): ReaderNode => ({ type: 'text', text });
const el = (tag: string, ...children: ReaderNode[]): ReaderNode => ({ type: 'element', tag, children });
const acts = [{ id: 'fed_bgb', jurabk: 'BGB', title: 'Bürgerliches Gesetzbuch' }] as KerfAct[];
const render = (nodes: ReaderNode[], query = '') => renderToStaticMarkup(<StructuredReaderText nodes={nodes} actId="fed_bgb" acts={acts} norms={[{ enbez: '§ 1' }, { enbez: '§ 2' }]} citations={[{ source_act: 'fed_bgb', citation_text: '§ 1 BGB', target_act: 'fed_bgb', target_norm: '§ 1', status: 'resolved' } as KerfStatutoryCitation]} query={query} onReference={() => {}} />);

test('source inline semantics survive validation and rendering', () => {
  const nodes = [el('p', el('sup', text('1')), text('Das Verfahren. '), el('sup', text('2')), text('Es ist '), el('em', text('einfach')), text('.')), el('p', text('H'), el('sub', text('2')), text('O'))];
  assert.ok(validateReaderBlocks(nodes, '1Das Verfahren. 2Es ist einfach.H2O'));
  const html = render(nodes);
  assert.match(html, /<sup>1<\/sup>Das Verfahren/);
  assert.match(html, /<em>einfach<\/em>/);
  assert.match(html, /H<sub>2<\/sub>O/);
});
test('one citation can span inline markup and preserve its formatting', () => {
  const html = render([el('p', text('Gemäß § '), el('strong', text('1')), text(' BGB.'))]);
  assert.equal((html.match(/data-reference-norm=/g) ?? []).length, 1);
  assert.match(html, /data-reference-norm="§ 1"[^>]*>§ <strong>1<\/strong> BGB<\/a>/);
});
test('block and list labels cannot be parsed into the preceding legal reference', () => {
  const html = render([el('dl', el('dt', text('1.')), el('dd', text('Nach § 1,')), el('dt', text('2.')), el('dd', text('anderer Fall.')))]);
  assert.match(html, /<dt>2\.<\/dt>/);
  assert.doesNotMatch(html, /data-reference-norm="§ 2"/);
});
test('search highlights span inline elements without destroying markup or wording', () => {
  const html = render([el('p', text('Das '), el('em', text('einfache')), text(' Verfahren.'))], 'einfache Verfahren');
  assert.match(html, /<mark><em>einfache<\/em> Verfahren<\/mark>/);
});
test('hostile source text stays inert', () => {
  assert.match(render([el('p', text('<script>alert(1)</script>'))]), /&lt;script&gt;/);
});

test('leading, interior, trailing and standalone breaks remain visible', () => {
  for (const nodes of [[el('br')], [text('A'), el('br')], [el('br'), text('A')], [text('A'), el('br'), text('B')], [el('br'), el('br')]]) {
    assert.equal((render(nodes).match(/<br\/>/g) ?? []).length, nodes.filter(node => node.type === 'element' && node.tag === 'br').length);
  }
});
test('only explicit source sentence markers create sentence rows; exponents stay inline', () => {
  const sentence = (n: string): ReaderNode => ({ type: 'element', tag: 'sup', attrs: { role: 'sentence' }, children: [text(n)] });
  const nodes = [el('p', text('(1) '), sentence('1'), text('Erster Satz. '), sentence('2'), text('Zweiter Satz.'))];
  assert.ok(validateReaderBlocks(nodes, '(1) 1Erster Satz. 2Zweiter Satz.'));
  assert.equal((render(nodes).match(/data-reader-sentence/g) ?? []).length, 2);
  assert.doesNotMatch(render([text('m'), el('sup', text('2'))]), /data-reader-sentence/);
});

test('source footnote ordinals never concatenate with a referenced provision number', () => {
  const nodes: ReaderNode[] = [text('Nach § 1'), {type:'element', tag:'sup', attrs:{role:'footnote'}, children:[text('2)')]}, text(' gilt dies.')];
  const html = render(nodes);
  assert.match(html, /data-reference-norm="§ 1"/);
  assert.doesNotMatch(html, /data-reference-norm="§ 12"/);
  assert.match(html, /<sup data-reader-role="footnote">2\)<\/sup>/);
});

const sentenceMarker = (n: string): ReaderNode => ({type:'element',tag:'sup',attrs:{role:'sentence'},children:[text(n)]});
const footnoteMarker = (n: string): ReaderNode => ({type:'element',tag:'sup',attrs:{role:'footnote'},children:[text(n)]});
const footnoteText = (value: string): ReaderNode => ({type:'element',tag:'small',attrs:{role:'footnote'},children:[text(value)]});

test('Art. 80 continuation after a list is separate from the next numbered sentence', () => {
  const html = render([el('div', sentenceMarker('2'), text('im Rahmen')), el('dl', el('dt', text('1.')), el('dd', text('einer Dienstpflicht'))), el('div', text(' erlassen wurde.'), sentenceMarker('3'), text('Ist der Widerspruch zum Teil erfolgreich.'))]);
  assert.match(html, /erlassen wurde\.<\/span><span data-reader-sentence="true"><sup data-reader-role="sentence">3/);
});

test('Art. 61 footnotes keep the body sentence together and appear below the norm', () => {
  const html = render([el('div',text('(2)'),sentenceMarker('1'),text('Auf § 1'),footnoteMarker('9)'),footnoteText('BayRS 2010-2-I'),text(' entsprechend anzuwenden.'),sentenceMarker('2'),text('Zweiter Satz.'))]);
  assert.match(html, /<sup data-reader-role="footnote">9\)<\/sup> entsprechend anzuwenden\.<\/span>/);
  assert.equal((html.match(/data-reader-sentence="true"/g) ?? []).length, 2);
  assert.match(html, /data-reference-norm="§ 1"/);
  assert.doesNotMatch(html, /data-reference-norm="§ 19"/);
  assert.ok(html.indexOf('BayRS 2010-2-I') > html.indexOf('Zweiter Satz.'));
  assert.match(html, /data-reader-footnotes="true"/);
  assert.match(html, /<small data-reader-role="footnote"><sup>9\)<\/sup> /);
});

test('footnotes inside inline emphasis stay superscript and do not split a sentence', () => {
  const html = render([el('div',sentenceMarker('1'),text('Nach '),el('em',text('§ 1'),footnoteMarker('2)'),footnoteText('Amtliche Anmerkung')),text(' gilt dies.'),sentenceMarker('2'),text('Danach.'))]);
  assert.match(html, /<em>.*data-reference-norm="§ 1".*<sup data-reader-role="footnote">2\)<\/sup><\/em> gilt dies\.<\/span>/);
  assert.equal((html.match(/data-reader-sentence="true"/g) ?? []).length, 2);
  assert.ok(html.indexOf('Amtliche Anmerkung') > html.indexOf('Danach.'));
});

test('IfSG editorial emphasis around nested lists remains valid block markup', () => {
  const html = render([el('p',el('em',text('Nach § 1:'),el('dl',el('dt',text('1.')),el('dd',text('Erste Stufe'),el('dl',el('dt',text('a)')),el('dd',text('Unterpunkt'))))),text(' Ende.')))]);
  assert.match(html, /^<div data-reader-source-tag="p"><div data-reader-source-tag="em">/);
  assert.equal((html.match(/<dl>/g) ?? []).length, 2);
  assert.doesNotMatch(html, /<p>|<em>/);
  assert.match(html, /data-reference-norm="§ 1"/);
});

test('FeV table within bold source formatting remains valid block markup', () => {
  const html = render([el('strong',text('Tabelle'),el('table',el('tbody',el('tr',el('td',text('Wert'))))))]);
  assert.match(html, /^<div data-reader-source-tag="strong">Tabelle<table>/);
  assert.doesNotMatch(html, /<strong>/);
});

test('official image and PDF assets survive zero-text sources and reject foreign URLs', () => {
  const image: ReaderNode = {type:'element', tag:'img', attrs:{src:'https://www.gesetze-im-internet.de/normengrafiken/bgbl1_2016/j0162-1_0130.jpg',alt:'Amtliche Darstellung',width:100},children:[]};
  const file: ReaderNode = {type:'element', tag:'source-file', attrs:{src:'https://www.gesetze-im-internet.de/normengrafiken/bgbl1_2022/j0500_0010.pdf'},children:[]};
  assert.ok(validateReaderBlocks([image,file], ''));
  const html=render([image,file]);
  assert.match(html, /<img /);
  assert.match(html, /PDF · j0500_0010.pdf/);
  assert.equal((html.match(/data-reader-source-asset/g)??[]).length,2);
  for(const src of ['javascript:alert(1)','https://evil.test/a.jpg','https://www.gesetze-im-internet.de.evil.test/a.jpg','https://www.gesetze-im-internet.de/normengrafiken/bgbl1_2016/../a.jpg']) assert.equal(validateReaderBlocks([{...image,attrs:{src}}],''),null);
});
