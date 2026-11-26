import assert from 'node:assert/strict';
import test from 'node:test';
import { wordDiff, wordDiffSplit } from './diff';

test('word comparisons preserve unchanged text and escape source markup', () => {
  assert.equal(wordDiff('a <b>', 'a &c'), 'a <del>&lt;b&gt;</del><ins>&amp;c</ins>');
  assert.deepEqual(wordDiffSplit('same', 'same'), { oldHtml: 'same', newHtml: 'same' });
});

test('oversized Synopse fails explicitly before allocating the quadratic table', () => {
  // Bounded repro in red: 4M cells, not the live1.6B-cell input.
  const oldText = Array.from({ length: 1001 }, (_, i) => 'old' + i).join(' ');
  const newText = Array.from({ length: 1001 }, (_, i) => 'new' + i).join(' ');
  for (const compare of [wordDiff, wordDiffSplit]) {
    assert.throws(() => compare(oldText, newText), { name: 'DiffLimitError' });
  }
});

