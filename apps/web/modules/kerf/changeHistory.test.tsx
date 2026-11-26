import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  attestationSummary, changeCitation, changeDiffPair, changeState, classifyDocumentationNote, diffUrlParams, legacyNormChanges,
  normChangeSummary, normalizeActChangeGroup, normalizeChangeRecord, normalizeChangeSummary, parseStandEntries, sortChanges, versionRole,
  actChangeSummaryFrom, type KerfChangeRecord,
} from './changeHistory';
import { CHANGE_HISTORY_COPIES, changeDateCell, changeDateRows, roleLine } from './changeHistoryFormat';
import type { KerfNormLog, KerfNormVersion } from './normHistoryClient';

const require = createRequire(import.meta.url);
require.extensions['.css'] = module => { module.exports = {}; };
const fixture = <T,>(name: string): T => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
const today = '2026-09-28';
// Real responses: core API (new contract) and the deployed production API (older shape).
const coreChanges = fixture<{ evidence: unknown[]; change_summary: unknown }>('core-norm-changes-sgb2-7.json');
const coreActChanges = fixture<{ evidence: unknown[]; change_summary: unknown }>('core-act-changes-sgb2.json');
const coreLog = fixture<KerfNormLog>('core-norm-log-sgb2-7.json');
const prodLog = fixture<KerfNormLog>('prod-norm-log-sgb2-7.json');

test('core change records keep evidenced dates and keep unknown dates unknown', () => {
  const [first, second, , oldest] = coreChanges.evidence.map(normalizeChangeRecord) as KerfChangeRecord[];
  assert.equal(first.amending_act?.citation, 'Art. 6 Nr. 1 G v. 16.8.2023 (BGBl. 2023 I Nr. 217)');
  assert.deepEqual(first.amending_act?.items, ['1']);
  assert.equal(first.dates.in_force?.date, '2024-06-01');
  assert.equal(first.dates.in_force?.status, 'official_commencement_clause');
  assert.equal(first.dates.promulgated?.date, '2023-08-18');
  assert.equal(first.dates.adopted?.date, '2023-08-16');
  assert.equal(changeState(first, today), 'in_force');
  // In force unknown: shown as unknown, never hidden or guessed.
  assert.equal(second.dates.in_force?.date, null);
  assert.equal(changeState(second, today), 'date_unknown');
  assert.equal(changeState(oldest, today), 'incorporated_date_unknown');
  assert.equal(oldest.dates.adopted?.date, null);
  assert.equal(oldest.dates.adopted?.status, 'unknown');
  assert.match(oldest.dates.adopted?.basis ?? '', /Ausfertigungsdatum/, 'the reason is kept as the basis');
  const adopted = changeDateCell(oldest.dates.adopted, 'de');
  assert.deepEqual([adopted.value, adopted.known], ['unbekannt', false]);
  assert.equal(changeDateCell(first.dates.applies_from, 'de').value, 'nicht angegeben');
  // applies_from "not stated" is not a row; the three core dates always are.
  assert.deepEqual(changeDateRows(first, 'de').map(row => row.field), ['adopted', 'promulgated', 'in_force']);
});

test('the served norm summary is used as is: last change, undated incorporation, typed GII notes', () => {
  const summary = normChangeSummary(coreLog, today);
  assert.equal(summary.derived, undefined);
  assert.equal(summary.scope, 'norm');
  assert.equal(summary.last_change?.dates.in_force?.date, '2024-06-01');
  assert.equal(summary.next_pending_change, null);
  assert.equal(summary.last_incorporated_undated?.state, 'date_unknown');
  assert.equal(summary.last_incorporated_undated?.dates.in_force?.date, null);
  assert.equal(summary.counts?.versions, 17);
  assert.equal(summary.counts?.versions_by_role?.archived_capture, 16);
  assert.equal(summary.act_stand_note?.norm_specific, false);
  assert.equal(summary.documentation_notes[0].kind, 'indirect_change_incorporated');
  assert.ok((summary.unknown_dates_total ?? 0) >= summary.unknown_dates.length);
});

test('the compact law-index summary (flat dates, string gazette, note count) is understood', () => {
  const compact = normalizeChangeSummary({ schema: 'kerf-change-summary/1', scope: 'act', as_of: today,
    last_change: { change_id: 'chg:1', norm_label: '§ 11a', citation: 'Art. 8 Nr. 1 G (BGBl. 2025 I Nr. 363)', gazette: 'BGBl. 2025 I Nr. 363', in_force: '2026-01-01', promulgated: '2025-12-23', adopted: null, state: 'in_force' },
    next_pending_change: null, counts: { versions: 158, events: 235 }, documentation_notes: 1 })!;
  assert.equal(compact.last_change?.dates.in_force?.date, '2026-01-01');
  assert.equal(compact.last_change?.dates.adopted?.date, null);
  assert.equal(compact.last_change?.amending_act?.gazette?.reference, 'BGBl. 2025 I Nr. 363');
  assert.equal(compact.documentation_notes_count, 1);
  assert.equal(normalizeChangeSummary({ scope: 'act', schema: 'something-else/2' }), null, 'unknown schema → feature not detected');
  assert.equal(normalizeChangeSummary(undefined), null);
});

test('act change groups: amending act + article with the provisions it changed; pending ones marked', () => {
  const groups = coreActChanges.evidence.map((row, index) => normalizeActChangeGroup(row, index)!);
  assert.ok(groups.every(group => group.norms.length > 0 && group.amending_act?.citation));
  const pending = groups.find(group => group.pending);
  assert.ok(pending, 'SGB II has promulgated changes that are not yet in force');
  assert.equal(changeState({ ...pending!.norms[0], state: pending!.state, pending: pending!.pending, dates: pending!.dates }, today), 'pending');
  assert.ok(pending!.dates.in_force!.date! > today);
  const summary = normalizeChangeSummary(coreActChanges.change_summary)!;
  assert.ok(summary.next_pending_change && summary.next_pending_change.dates.in_force!.date! > today);
});

test('production (older API): changes derived from log events, act date unknown, nothing promoted', () => {
  const changes = legacyNormChanges(prodLog, today);
  assert.equal(changes.length, 3);
  assert.ok(changes.every(change => change.legacy && change.dates.adopted?.date === null));
  const verified = changes.find(change => change.dates.in_force?.date === '2024-06-01')!;
  assert.equal(verified.dates.in_force?.status, 'official_commencement_clause');
  assert.equal(verified.dates.promulgated?.date, '2023-08-18');
  assert.equal(changeCitation(verified.amending_act), 'Art. 6 (BGBl. 2023 I Nr. 217)', 'composed from evidence fields, no date');
  const undated = changes.filter(change => !change.dates.in_force?.date);
  assert.ok(undated.length >= 1 && undated.every(change => changeState(change, today) === 'date_unknown'));
  const summary = normChangeSummary(prodLog, today);
  assert.equal(summary.derived, 'legacy');
  assert.equal(summary.last_change?.change_id, verified.change_id);
  assert.equal(summary.documentation_notes[0].kind, 'textually_incorporated_documentation_pending');
  assert.equal(summary.documentation_notes[0].amending_act?.citation_text, 'Art. 1 G v. 16.4.2026 I Nr. 107');
  assert.ok(summary.unknown_dates.length >= 1);
});

test('GII notes: fixed wordings are typed, text is kept verbatim, no date is taken from citations', () => {
  const pendingDoc = classifyDocumentationNote('Änderung durch Art. 1 G v. 16.4.2026 I Nr. 107 textlich nachgewiesen, dokumentarisch noch nicht abschließend bearbeitet');
  assert.equal(pendingDoc.kind, 'textually_incorporated_documentation_pending');
  assert.equal(pendingDoc.text_incorporated, true);
  assert.equal(pendingDoc.documentation_complete, false);
  assert.equal(JSON.stringify(pendingDoc).includes('2026-04-16'), false);
  assert.equal(classifyDocumentationNote('Mittelbare Änderung durch Art. 1b G v. 16.4.2026 I Nr. 107 ist berücksichtigt').kind, 'indirect_change_incorporated');
  assert.equal(classifyDocumentationNote('Die Änderung durch Art. 2 G v. 1.1.2026 I Nr. 1 ist noch nicht berücksichtigt').kind, 'not_yet_incorporated');
  assert.deepEqual(parseStandEntries('Neuf: Neugefasst durch Bek. v. 13.5.2011 I 850 | Stand: zuletzt geändert durch Art. 1a G v. 16.4.2026 I Nr. 107').map(entry => entry.type), ['Neuf', 'Stand']);
  const act = actChangeSummaryFrom({ id: 'fed_sgb_2', stand: 'Stand: zuletzt geändert durch Art. 1a G v. 16.4.2026 I Nr. 107 | Hinweis: Mittelbare Änderung durch Art. 1b G v. 16.4.2026 I Nr. 107 ist berücksichtigt' }, today)!;
  assert.equal(act.act_stand_note?.text, 'zuletzt geändert durch Art. 1a G v. 16.4.2026 I Nr. 107');
  assert.equal(act.last_change, null);
});

test('diff links: unencoded version ids (with #) survive, and index-form text effects resolve', () => {
  assert.deepEqual(diffUrlParams('/norms/de/bund/x/para/1/diff?from=de/bund/x/para/1@observed-2026-07-06#6f5887ff9790&to=de/bund/x/para/1@2026-07-29#5a8de7dcc1d8'),
    { from: 'de/bund/x/para/1@observed-2026-07-06#6f5887ff9790', to: 'de/bund/x/para/1@2026-07-29#5a8de7dcc1d8' });
  assert.deepEqual(diffUrlParams('/diff?from=a%23b&to=c%23d'), { from: 'a#b', to: 'c#d' });
  const change = normalizeChangeRecord({ change_id: 'c', text_effect: { before_version: 0, after_version: 1, verification: 'bracketed_by_captures' }, dates: {} })!;
  assert.deepEqual(changeDiffPair(change, [{ version_id: 'v0' }, { version_id: 'v1' }]), { from: 'v0', to: 'v1' });
  assert.equal(changeDiffPair(normalizeChangeRecord({ change_id: 'x', dates: {} })!), null);
});

test('sorting: newest evidenced date first, pending (future) on top, undated last', () => {
  const make = (id: string, inForce: string | null, promulgated: string | null = null) => normalizeChangeRecord({ change_id: id, dates: { in_force: { date: inForce, status: inForce ? 'official_commencement_clause' : 'unknown' }, promulgated: { date: promulgated, status: promulgated ? 'official' : 'unknown' } } })!;
  assert.deepEqual(sortChanges([make('a', '2020-01-01'), make('b', null), make('c', '2027-01-01'), make('d', null, '2023-01-01')]).map(change => change.change_id), ['c', 'd', 'a', 'b']);
});

test('source roles: contract role wins; older versions map conservatively; archived copies name their capture date', () => {
  const [official, archived] = coreLog.evidence as KerfNormVersion[];
  assert.equal(versionRole(official), 'official_consolidation');
  assert.equal(versionRole(archived), 'archived_capture');
  assert.equal(versionRole({ source: { role: 'official_consolidation_gii' }, quality: { source_exact: true, reconstruction_status: 'not_reconstructed' } }), 'official_consolidation');
  assert.equal(versionRole({ source: { role: 'archived_official_page_bayern_recht', capture: { source: 'wayback' } }, quality: { source_exact: true } }), 'archived_capture');
  assert.equal(versionRole({ source: { role: 'verified_reconstruction' }, quality: { source_exact: false } }), 'reconstruction');
  assert.equal(roleLine('archived_capture', 'de', '2024-01-12'), 'archivierte Kopie, bekannt seit 12.01.2024');
  assert.match(roleLine('reconstruction', 'de'), /^Rekonstruktion: .*kein amtlicher Text$/);
  const attestation = attestationSummary((official.attestations ?? [])[0]);
  assert.ok(attestation.source && attestation.from);
});

test('change-history copy is complete and translated in all four languages', () => {
  const flat = (value: unknown, prefix = ''): Record<string, string> => Object.entries(value as Record<string, unknown>).reduce((all, [key, item]) =>
    typeof item === 'string' ? { ...all, [`${prefix}${key}`]: item } : { ...all, ...flat(item, `${prefix}${key}.`) }, {} as Record<string, string>);
  const en = flat(CHANGE_HISTORY_COPIES.en);
  // Proper nouns and identical loanwords may match English.
  const same = new Set(['types.geändert', 'types.eingefügt', 'types.neugefasst', 'types.aufgehoben', 'types.ersetzt']);
  for (const language of ['de', 'ru', 'ua']) {
    const copy = flat(CHANGE_HISTORY_COPIES[language]);
    assert.deepEqual(Object.keys(copy).sort(), Object.keys(en).sort(), language);
    for (const key of Object.keys(en)) if (!same.has(key) && language !== 'de') assert.notEqual(copy[key], en[key], `${language}.${key}`);
  }
});

test('change cards render the buzer-style row with explicit unknowns and a pending mark', async () => {
  const { ChangeRecordCard, ChangeSummaryBlock, NormChangeList } = await import('./ChangeHistoryViews');
  const records = coreChanges.evidence.map(normalizeChangeRecord) as KerfChangeRecord[];
  const html = renderToStaticMarkup(<ChangeRecordCard change={records[0]} language="de" today={today} />);
  assert.match(html, /Art\. 6 Nr\. 1 G v\. 16\.8\.2023 \(BGBl\. 2023 I Nr\. 217\)/);
  assert.match(html, /<dt>In Kraft ab<\/dt><dd data-known="true" data-field="in_force"[^>]*>01\.06\.2024<small> · laut Inkrafttretensregel<\/small>/);
  const undated = renderToStaticMarkup(<ChangeRecordCard change={records[3]} language="de" today={today} />);
  assert.match(undated, /<dt>Gesetz vom<\/dt><dd data-known="false" data-field="adopted"[^>]*>unbekannt/);
  assert.match(undated, /<dt>In Kraft ab<\/dt><dd data-known="false" data-field="in_force"[^>]*>unbekannt/);
  assert.match(undated, /Im Text; Inkrafttreten unbekannt/);
  const pending = normalizeActChangeGroup(coreActChanges.evidence.find(row => (row as { pending?: boolean }).pending), 0)!.norms[0];
  const pendingHtml = renderToStaticMarkup(<ChangeRecordCard change={{ ...pending, state: 'pending', pending: true }} language="de" today={today} />);
  assert.match(pendingHtml, /data-state="pending"/);
  assert.match(pendingHtml, /Ausstehend/);
  assert.match(pendingHtml, /tritt am \d{2}\.\d{2}\.\d{4} in Kraft/);
  const summaryHtml = renderToStaticMarkup(<ChangeSummaryBlock summary={normChangeSummary(prodLog, today)} language="de" />);
  assert.match(summaryHtml, /Textlich nachgewiesen, Dokumentation noch nicht abgeschlossen/);
  assert.match(summaryHtml, /gilt für das ganze Gesetz, nicht speziell für diese Vorschrift/);
  assert.match(summaryHtml, /data-derived="legacy"/);
  const notesOnly = renderToStaticMarkup(<ChangeSummaryBlock summary={actChangeSummaryFrom({ id: 'fed_sgb_2', stand: 'Stand: zuletzt geändert durch Art. 1a G v. 16.4.2026 I Nr. 107' }, today)} language="de" compact />);
  assert.match(notesOnly, /GII-Standangabe/);
  assert.doesNotMatch(notesOnly, /keine erfasst/, 'without event data there is no "none recorded" claim');
  const legacyHtml = renderToStaticMarkup(<NormChangeList changes={legacyNormChanges(prodLog, today)} language="en" legacy />);
  assert.match(legacyHtml, /Derived from the older amendment records/);
  assert.match(legacyHtml, /unknown/);
});
