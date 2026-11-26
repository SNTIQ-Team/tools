import assert from 'node:assert/strict';
import test from 'node:test';
import { comparisonChanges, comparisonReady } from './readerComparison';

test('comparison ignores export metadata and retains changed provisions and literal hostile text', () => {
  const document = (date: string, text: string) => `---\nrequested_at: ${date}\n---\n\n# Test\n\n> Archive status: exact ${date}\n\n## \u00a7 1 Title\n\n${text}\n\n## \u00a7 2 Same\n\nUnchanged.`;
  assert.deepEqual(comparisonChanges(document('2025', 'A'), document('2026', 'A')), []);
  const changes = comparisonChanges(document('2025', 'A <x>'), document('2026', 'B <x>'));
  assert.equal(changes.length, 1);
  assert.equal(changes[0].label, '\u00a7 1 Title');
  assert.ok(changes[0].parts.some(part => part.removed && part.value.includes('A')));
  assert.ok(changes[0].parts.some(part => part.added && part.value.includes('B')));
});

test('partial historical responses cannot be displayed as a complete diff', () => {
  assert.equal(comparisonReady({ complete: true, partial: false }), true);
  assert.equal(comparisonReady({ complete: false, partial: true }), false);
  assert.equal(comparisonReady({ complete: true, partial: true }), false);
});

test('comparison retains legal enumeration boundaries and numbering', () => {
  const list = (body: string) => `# Export\n\n## § 1 Title\n\n${body}`;
  for (const [before, after] of [
    ['1. ab\n2. c', '1. a\n2. bc'],
    ['1. a\n2. b', '3. a\n4. b'],
    ['- ab\n- c', '- a\n- bc'],
    ['1. A\n   1. ab\n   2. c', '1. A\n   1. a\n   2. bc'],
  ]) {
    const changes = comparisonChanges(list(before), list(after));
    assert.equal(changes.length, 1, `${before} => ${after}`);
    assert.notEqual(changes[0].oldText, changes[0].newText);
  }
});

test('comparison retains literal source markers, code, and text without provision headings', () => {
  assert.equal(comparisonChanges('# Export\n\nSource text A', '# Export\n\nSource text B').length, 1);
  const changes = comparisonChanges('## § 1\n\n1. **Old**\n2. `x`', '## § 1\n\n3. **Old**\n4. `x`');
  assert.match(changes[0].oldText, /1\. \*\*Old\*\*/);
  assert.match(changes[0].newText, /3\. \*\*Old\*\*/);
});

test('escaped plain-text exports compare decoded source text without serialization false positives', () => {
  const plain = '# Export\n\n## § 1\n\n[Fe(CN)6]_3 and source_name.';
  const escaped = '---\nnorm_body_format: escaped_plain_text\n---\n\n# Export\n\n## § 1\n\n\\[Fe\\(CN\\)6\\]\\_3 and source\\_name\\.';
  assert.deepEqual(comparisonChanges(plain, escaped), []);
  const changed = comparisonChanges(escaped, escaped.replace('source\\_name', 'other\\_name'));
  assert.equal(changed.length, 1);
  assert.match(changed[0].oldText, /source_name/);
  assert.match(changed[0].newText, /other_name/);
  assert.ok(!changed[0].newText.includes('\\'));
});
