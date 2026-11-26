import assert from 'node:assert/strict';
import test from 'node:test';
import { readerLawLabel } from './readerLabels';

test('reader uses current familiar abbreviations without changing stable act ids', () => {
  const act = { id: 'fed_asylvfg_1992', jurabk: 'AsylVfG 1992' };
  assert.equal(readerLawLabel(act), 'AsylG');
  assert.equal(act.id, 'fed_asylvfg_1992');
  assert.equal(readerLawLabel({ id: 'fed_aufenthg_2004', jurabk: 'AufenthG 2004' }), 'AufenthG');
  assert.equal(readerLawLabel({ id: 'fed_sgb_12', jurabk: 'SGB 12' }), 'SGB XII');
  assert.equal(readerLawLabel({ id: 'fed_sgb_9_2018', jurabk: 'SGB 9 2018' }), 'SGB IX');
  assert.equal(readerLawLabel({ id: 'by_AGSG', jurabk: 'AGSG' }), 'AGSG');
  assert.equal(readerLawLabel({ id: 'unknown', jurabk: 'Act 23' }), 'Act 23');
});
