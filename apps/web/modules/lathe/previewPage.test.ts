import assert from 'node:assert/strict';
import test from 'node:test';
import { previewPageFor } from './previewPage';

test('the preview follows the step to the page of ZP 1a it fills', () => {
  for (const id of ['intro', 'personal', 'insurance', 'maintenance', 'dependents']) assert.equal(previewPageFor(id), 1, id);
  for (const id of ['income', 'partnerIncome']) assert.equal(previewPageFor(id), 2, id);
  for (const id of ['deductions', 'assets']) assert.equal(previewPageFor(id), 3, id);
  for (const id of ['housing', 'obligations', 'special', 'declaration']) assert.equal(previewPageFor(id), 4, id);
  assert.equal(previewPageFor('unknown'), null);
});
