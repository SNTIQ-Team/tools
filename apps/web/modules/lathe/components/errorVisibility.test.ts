import assert from 'node:assert/strict';
import test from 'node:test';
import { visibleErrors } from './errorVisibility';

const errors = { courtInfo: 'validation.required', birthDate: 'validation.date', rent: 'validation.amount' };

test('nothing is shown before the person has left a field or tried to go on', () => {
  assert.deepEqual(visibleErrors(errors), {});
});

test('a half-typed date is not called wrong while the person is still typing in it', () => {
  assert.deepEqual(visibleErrors(errors, new Set(['courtInfo'])), { courtInfo: 'validation.required' });
});

test('after leaving the field the format error shows', () => {
  assert.deepEqual(visibleErrors(errors, new Set(['birthDate'])), { birthDate: 'validation.date' });
});

test('after Next on the step every error shows', () => {
  assert.deepEqual(visibleErrors(errors, new Set(), true), errors);
});

test('after Next, the field being typed in does not flash its format error; the others still show', () => {
  assert.deepEqual(visibleErrors(errors, new Set(), true, 'birthDate'), { courtInfo: 'validation.required', rent: 'validation.amount' });
});
