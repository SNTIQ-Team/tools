import assert from 'node:assert/strict';
import test from 'node:test';
import { validateReaderBlocks, validateReaderSourceAnnotations } from './readerStructure';

test('structured content is accepted only when its complete text equals the canonical source', () => {
  const blocks = [{ type: 'element', tag: 'p', children: [{ type: 'text', text: '  A  B' }] }, { type: 'element', tag: 'dl', children: [{ type: 'element', tag: 'dt', children: [{ type: 'text', text: '1.' }] }, { type: 'element', tag: 'dd', children: [{ type: 'text', text: 'Text' }] }] }];
  assert.deepEqual(validateReaderBlocks(blocks, 'A B1.Text'), blocks);
  assert.equal(validateReaderBlocks(blocks, 'A B1.Different'), null);
});
test('malformed, executable or unbounded optional structures fall back to canonical plain text', () => {
  for (const value of [[null], [{ type: 'element', tag: 'p' }], [{ type: 'element', tag: 'script', children: [] }], [{ type: 'text', text: {} }], [{ type: 'element', tag: 'p', children: [], attrs: { onclick: 'alert(1)' } }]]) assert.equal(validateReaderBlocks(value, ''), null);
  let deep: unknown = { type: 'text', text: '' };
  for (let index = 0; index < 70; index++) deep = { type: 'element', tag: 'div', children: [deep] };
  assert.equal(validateReaderBlocks([deep], ''), null);
});
test('table spans and line breaks are bounded structural values, never HTML attributes', () => {
  const cell = { type: 'element', tag: 'td', attrs: { colspan: 2, rowspan: 1 }, children: [{ type: 'text', text: 'A' }, { type: 'element', tag: 'br', children: [] }, { type: 'text', text: 'B' }] };
  assert.deepEqual(validateReaderBlocks([cell], 'AB'), [cell]);
  assert.equal(validateReaderBlocks([{ ...cell, attrs: { colspan: -1 } }], 'AB'), null);
});
test('source PRE keeps exact alignment while its normalized text matches canonical text', () => {
  const block = { type: 'element', tag: 'pre', children: [{ type: 'text', text: '  Coal    5.5' }, { type: 'element', tag: 'br', children: [] }, { type: 'text', text: '  Coke    8.0' }] };
  assert.deepEqual(validateReaderBlocks([block], 'Coal 5.5 Coke 8.0'), [block]);
  assert.equal(validateReaderBlocks([{ ...block, attrs: { style: 'position:fixed' } }], 'Coal 5.5 Coke 8.0'), null);
  assert.equal(validateReaderBlocks([block], 'Coal 8.0 Coke 5.5'), null);
});


test('source annotations have bounded nodes, depth and exact independent text', () => {
  const input = (nodes: unknown, text = '') => ({ source_annotations: nodes, source_annotations_text: text, source_annotations_sha256: '0'.repeat(64) });
  assert.equal(validateReaderSourceAnnotations(input([{ type: 'text', text: 'A  B' }], 'A B')), null);
  assert.equal(validateReaderSourceAnnotations(input([{ type: 'text', text: 'x'.repeat(4_000_001) }], 'x'.repeat(4_000_001))), null);
  assert.equal(validateReaderSourceAnnotations(input(Array.from({ length: 50_001 }, () => ({ type: 'text', text: '' })))), null);
  let nested: unknown = { type: 'text', text: '' };
  for (let depth = 0; depth < 66; depth++) nested = { type: 'element', tag: 'div', children: [nested] };
  assert.equal(validateReaderSourceAnnotations(input([nested])), null);
  assert.equal(validateReaderSourceAnnotations({ source_annotations: [] }), null);
});
