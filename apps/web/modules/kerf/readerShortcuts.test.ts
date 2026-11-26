import assert from 'node:assert/strict';
import test from 'node:test';
import { readerShortcut } from './readerShortcuts';

test('workbench shortcuts do not intercept typing, composition or browser tab commands', () => {
  const key = { key: 'D', altKey: true, shiftKey: true, ctrlKey: false, metaKey: false };
  assert.equal(readerShortcut(key, false), 'diff');
  assert.equal(readerShortcut(key, true), null);
  assert.equal(readerShortcut({ ...key, isComposing: true }, false), null);
  assert.equal(readerShortcut({ ...key, key: 'w', ctrlKey: true, altKey: false }, false), null);
  assert.equal(readerShortcut({ ...key, key: 'ArrowRight' }, false), 'split-right');
  assert.equal(readerShortcut({ ...key, key: 'PageDown', shiftKey: false }, false), 'next-tab');
  assert.equal(readerShortcut({ ...key, key: 'k', ctrlKey: true, altKey: false, shiftKey: false }, true), 'search');
});
