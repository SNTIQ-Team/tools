import assert from 'node:assert/strict';
import test from 'node:test';
import type { KerfAct, KerfDecision } from './client';
import { decisionSections, decisionLawReferences, getReaderDecisionTitle, safeDecisionSource } from './readerDecision';

const decision = {
  id: 'decision-1', court: 'Bundesverfassungsgericht', court_short: 'BVerfG', az: '2 BvE 3/26',
  title: 'A decision', summary: { de: 'German summary', ru: 'Описание' },
  outcome: null, quote: null, text: null, effects: [],
} as unknown as KerfDecision;
const acts = [{ id: 'fed_gg', jurabk: 'GG' }] as KerfAct[];

test('metadata-only decisions never promote their summary to indexed text', () => {
  assert.deepEqual(decisionSections(decision, 'ru'), [{ id: 'summary', text: 'Описание', language: 'ru' }]);
  assert.deepEqual(decisionSections(decision, 'en'), [{ id: 'summary', text: 'German summary', language: 'de' }]);
});

test('available sections preserve exact plaintext and keep quotation separate', () => {
  const text = '  Tenor\n\n<script>alert(1)</script>\n';
  const result = decisionSections({ ...decision, text, quote: 'An excerpt', outcome: 'Granted' }, 'de');
  assert.equal(result.find(section => section.id === 'text')?.text, text);
  assert.equal(result.find(section => section.id === 'quote')?.text, 'An excerpt');
  assert.equal(result.find(section => section.id === 'outcome')?.text, 'Granted');
  assert.equal(result.some(section => (section.id as string) === 'fullText'), false);
});

test('decision norm references retain indexed targets and never infer absent acts', () => {
  const result = decisionLawReferences({ ...decision, effects: [
    { act_id: 'fed_gg', jurabk: 'GG', paras: ['20', 'Art. 38', '20'], kind: 'cited', note: '' },
    { act_id: 'missing', jurabk: 'Unknown', paras: ['4'], kind: 'cited', note: '' },
    { act_id: 'fed_gg', jurabk: 'GG', paras: [], kind: 'cited', note: '' },
  ] }, acts);
  assert.deepEqual(result.map(ref => [ref.actId, ref.norm ?? null, ref.label]), [
    ['fed_gg', '20', 'GG 20'], ['fed_gg', 'Art. 38', 'GG Art. 38'], ['fed_gg', null, 'GG'],
  ]);
});

test('source links reject executable and relative URLs', () => {
  assert.equal(safeDecisionSource('javascript:alert(1)'), null);
  assert.equal(safeDecisionSource('/local'), null);
  assert.equal(safeDecisionSource('https://www.rechtsprechung-im-internet.de/a'), 'https://www.rechtsprechung-im-internet.de/a');
  assert.equal(getReaderDecisionTitle(decision), 'BVerfG 2 BvE 3/26');
});

test('indexed EU instruments have safe CELEX targets without invented article anchors', () => {
  const result = decisionLawReferences({ ...decision, effects: [
    { eu_celex: '32024L1346', jurabk: 'RL (EU) 2024/1346', paras: ['19', '23'], kind: 'applied', note: '' },
    { eu_celex: 'javascript:alert(1)', jurabk: 'Unknown', paras: [], kind: 'cited', note: '' },
  ] }, acts);
  assert.deepEqual(result, [{
    kind: 'external', url: 'https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32024L1346',
    label: 'RL (EU) 2024/1346 (19, 23)',
  }]);
});
