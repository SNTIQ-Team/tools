import assert from 'node:assert/strict';
import test from 'node:test';
import { editionQuality, frontMatterFields, gapLabels } from './readerProvenance';

const markdown = '---\nact_id: "fed_sgb_8"\nsource_exact: false\nverified_reconstruction: true\ncomplete: true\ndate_basis: "official_bgbl_command_and_commencement_clause"\nstate_sha256: "abc"\ncoverage_gaps: 0\n---\n\n# SGB VIII\n';

test('every front matter field survives, typed values are rendered', () => {
  const fields = Object.fromEntries(frontMatterFields(markdown));
  assert.equal(fields.act_id, 'fed_sgb_8');
  assert.equal(fields.source_exact, 'false');
  assert.equal(fields.verified_reconstruction, 'true');
  assert.equal(fields.state_sha256, 'abc');
  assert.equal(Object.keys(fields).length, 7);
  assert.deepEqual(frontMatterFields('# no front matter'), []);
});

test('derived editions are never labelled as exact official text', () => {
  assert.equal(editionQuality({ source_exact: false, verified_reconstruction: true, exact: false }), 'verified_reconstruction');
  assert.equal(editionQuality({ source_exact: false, verified_reconstruction: false, exact: false }), 'not_exact');
  assert.equal(editionQuality({ source_exact: true, verified_reconstruction: false, exact: true }), 'exact');
});

test('gap explanations are kept for display', () => {
  assert.deepEqual(gapLabels(['Only HEAD is complete', { label: 'Missing 2019 transition' }, { reason: 'no_source' }, {}]), ['Only HEAD is complete', 'Missing 2019 transition', 'no_source']);
});
