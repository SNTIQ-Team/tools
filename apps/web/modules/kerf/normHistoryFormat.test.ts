import assert from 'node:assert/strict';
import test from 'node:test';
import { amendmentLine, diffSummary, legalDate, normHistoryCopy, sourceRoleLabel, statusIsFailure, validityLine } from './normHistoryFormat';
import { normPath, validityKind, versionSelector, type KerfNormVersion } from './normHistoryClient';

test('legal dates are formatted without timezone shifts', () => {
  assert.equal(legalDate('2026-07-10', 'de'), '10.07.2026');
  assert.equal(legalDate('2026-07-10T00:00:00Z', 'ru'), '10.07.2026');
  assert.equal(legalDate('2026-07-10', 'en'), '10.07.2026', 'the site day format in every language');
  assert.equal(legalDate(null, 'de'), '—');
});

test('an observation date is never presented as a legal start', () => {
  const line = validityLine({ valid_from: null, valid_from_status: 'unresolved', valid_until_exclusive: '2026-07-10', observed_from: '2026-07-06', observed_until: null }, 'de', '2026-09-28');
  assert.equal(line.label, 'Rechtlicher Beginn nicht verifiziert');
  assert.match(line.basis, /06\.07\.2026 \(Abrufdatum, kein Rechtsdatum\)/);
  assert.equal(line.future, false);
});

test('verified, archived and future starts are distinguished', () => {
  const verified = validityLine({ valid_from: '2026-07-10', valid_from_status: 'official_verified', valid_until_exclusive: null, observed_from: '2026-07-13', observed_until: null }, 'de', '2026-09-28');
  assert.equal(verified.label, 'Gültig ab 10.07.2026');
  assert.match(verified.basis, /BGBl/);
  const future = validityLine({ valid_from: '2026-10-01', valid_from_status: 'official_verified', valid_until_exclusive: null, observed_from: '2026-07-29', observed_until: null }, 'de', '2026-09-28');
  assert.equal(future.label, 'tritt in Kraft am 01.10.2026');
  assert.equal(future.future, true);
  const archived = validityLine({ valid_from: '2022-01-01', valid_from_status: 'official_archived_version_date', valid_until_exclusive: null, observed_from: null, observed_until: null }, 'en', '2026-09-28');
  assert.match(archived.basis, /BAYERN\.RECHT/);
  assert.equal(validityKind({ valid_from: '2022-01-01', valid_from_status: 'official_archived_version_date', valid_until_exclusive: null, observed_from: null, observed_until: null }), 'archived');
});

test('GII stand notes are labelled as unverified commencement', () => {
  const line = amendmentLine({ act: 'Art. 1 G v. 23.4.2026 I Nr. 111', reference: 'Art. 1 G v. 23.4.2026 I Nr. 111', basis: 'gii_stand_note' }, 'de');
  assert.equal(line?.text, 'Art. 1 G v. 23.4.2026 I Nr. 111');
  assert.match(line?.note ?? '', /nicht verifiziert/);
  assert.equal(amendmentLine({ act: 'Gesetz X', reference: 'BGBl. 2026 I Nr. 199', basis: 'retrospective_interval' }, 'en')?.text, 'Gesetz X (BGBl. 2026 I Nr. 199)');
  assert.equal(amendmentLine(null, 'de'), null);
});

test('derived text is labelled as reconstruction, never as official text', () => {
  assert.match(sourceRoleLabel('verified_reconstruction', false, 'de'), /Rekonstruktion/);
  assert.match(sourceRoleLabel('official_consolidation_gii', false, 'en'), /reconstruction/);
  assert.equal(sourceRoleLabel('official_consolidation_gii', true, 'en'), normHistoryCopy('en').exact);
  assert.equal(sourceRoleLabel('archived_official_page_bayern_recht', true, 'de'), 'Archivierte amtliche Seite');
});

test('failures are separated from partial and unresolved answers', () => {
  assert.equal(statusIsFailure('integrity_check_failed'), true);
  assert.equal(statusIsFailure('not_in_corpus'), true);
  assert.equal(statusIsFailure('partial'), false);
  assert.equal(statusIsFailure('temporally_unresolved'), false);
});

test('diff summary keeps changes and counts unchanged sentences', () => {
  const summary = diffSummary([
    { op: 'equal', old: null, new: null, text: 'a' },
    { op: 'replace', old: null, new: null, old_text: 'x', new_text: 'y' },
    { op: 'equal', old: null, new: null, text: 'b' },
  ]);
  assert.equal(summary.changes.length, 1);
  assert.equal(summary.unchanged, 2);
});

test('canonical ids stay path segments and diff selectors are exact version ids', () => {
  assert.equal(normPath('de/bund/sgb_14/para/37'), 'de/bund/sgb_14/para/37');
  assert.equal(normPath('de/bund/x/anlage/0~2'), 'de/bund/x/anlage/0~2');
  const version = { version_id: 'de/bund/sgb_2/para/7@observed-2026-07-06#99028ed1d133', content_hash: { algorithm: 'sha256', value: 'fb72c4d3c1d3b100b19d82ee84c2635b', text_sha256: '' } } as KerfNormVersion;
  // The contract (and the deployed /diff) accept version_id; hashes of
  // identical wording in two roles would be ambiguous.
  assert.equal(versionSelector(version), 'de/bund/sgb_2/para/7@observed-2026-07-06#99028ed1d133');
});
