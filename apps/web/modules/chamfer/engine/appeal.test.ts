import assert from 'node:assert/strict';
import test from 'node:test';
import { letterById } from '../data/letters';
import { manualAuthority } from '../data/recipients';
import { remedyFor } from '../data/remedies';
import { compose } from './compose';
import { evaluateGate } from './gating';
import { emptyAnswers } from './logic';
import { appealDeadlineISO } from './deadline-calendar';

const appeal = letterById('widerspruch_aufenthg')!;
const brandenburg = remedyFor('12');
const profile = { name: 'Ada', surname: 'Muster', dob: '02.03.2000', street: 'Testweg 1', plzCity: '14467 Potsdam' };
const recipient = manualAuthority('Teststelle', ['Testweg 2', '14467 Potsdam']);

test('Bescheid date identifies the act; notification date alone starts the appeal period', () => {
  const a = emptyAnswers();
  a.fields.bescheidDate = '2026-10-13';
  a.fields.notificationDate = '2026-10-20';
  a.choices.appealInstruction = 'proper';
  const on = (day: number) => evaluateGate(appeal, a, brandenburg, new Date(2026, 10, day, 12));
  assert.equal(on(18).issues.find(i => i.key === 'gate.deadline.oneMonth')?.params?.deadline, '20.11.2026');
  assert.equal(on(20).allowed, true);
  const late = on(21).issues.find(i => i.key === 'gate.deadline.passed');
  assert.equal(late?.kind, 'blocker');
  assert.ok(!late.stop, 'a typo in either date can still be corrected in place');
  const document = compose({ letter: appeal, profile, recipient, answers: a, remedy: brandenburg });
  assert.match(document.subject, /13\.10\.2026/);
  delete a.fields.notificationDate;
  assert.ok(on(21).issues.some(i => i.key === 'gate.deadline.unknownNotification'));
  a.fields.notificationDate = '2026-10-12';
  assert.ok(on(21).issues.some(i => i.key === 'gate.deadline.invalidNotification'));
  a.fields.notificationDate = '2026-11-22';
  assert.equal(on(21).allowed, false);
});

test('end of period rolls over Saturdays, consecutive holidays and holidays at the receiving authority', () => {
  assert.equal(appealDeadlineISO('2026-10-14', 1, '12'), '2026-11-16');
  assert.equal(appealDeadlineISO('2026-03-03', 1, '12'), '2026-04-07'); // Good Friday through Easter Monday
  assert.equal(appealDeadlineISO('2026-10-18', 1, '14'), '2026-11-19'); // Buß- und Bettag
  assert.equal(appealDeadlineISO('2026-10-18', 1, '12'), '2026-11-18');
  assert.equal(appealDeadlineISO('2025-04-08', 1, '11'), '2025-05-09'); // one-off Berlin holiday
  assert.equal(appealDeadlineISO('2026-05-04', 1, '14'), null); // Corpus Christi is municipal in Saxony
  assert.equal(appealDeadlineISO('2026-05-04', 1, ''), null);
  assert.equal(appealDeadlineISO('2027-06-04', 12, '12'), null); // an unverified calendar year
  assert.equal(appealDeadlineISO('2026-03', 1, '12'), null);
});

test('unknown instruction, including legacy no/unsure flag, never asserts a year in the banner or document', () => {
  const a = emptyAnswers();
  a.fields.bescheidDate = a.fields.notificationDate = '2026-10-15';
  a.flags.hadRechtsbehelfsbelehrung = false;
  const gate = () => evaluateGate(appeal, a, brandenburg, new Date(2026, 10, 18));
  const body = () => compose({ letter: appeal, profile, recipient, answers: a, remedy: brandenburg }).body;
  for (const choice of [undefined, 'unknown']) {
    a.choices.appealInstruction = choice;
    assert.ok(gate().issues.some(i => i.key === 'gate.deadline.unknownInstruction'));
    assert.doesNotMatch(body(), /ein Jahr|fristgerecht/);
  }
  a.choices.appealInstruction = 'missing_or_wrong';
  assert.equal(gate().issues.find(i => i.key === 'gate.deadline.yearRule')?.params?.deadline, '15.10.2027');
  assert.match(body(), /ein Jahr/);
});

test('translation costs require the benefit regime before generating the legal request', () => {
  const translation = letterById('translation_costs')!;
  const a = emptyAnswers();
  a.fields.authorityLetterDate = '2026-11-05';
  const body = () => compose({ letter: translation, profile, recipient, answers: a, remedy: brandenburg }).body;
  assert.equal(evaluateGate(translation, a, brandenburg).allowed, false);
  assert.doesNotMatch(body(), /AsylbLG|§ 21 Abs\. 6/);
  a.choices.benefitRegime = 'sgb2';
  assert.match(body(), /§ 21 Abs\. 6 SGB II/);
  assert.equal(evaluateGate(translation, a, brandenburg).allowed, true);
});

test('legacy Potsdam resolver entry naming an SGB XII office is not assigned to an SGB II letter', async (t) => {
  const incompatible = { ...recipient, name: 'Arbeitsgruppe Grundsicherung und Hilfe zum Lebensunterhalt SGB XII' };
  const compatible = { ...recipient, name: 'Jobcenter Musterstadt' };
  t.mock.method(globalThis, 'fetch', async () => Response.json({
    resolved: incompatible, candidates: [incompatible, compatible], caveats: [],
  }));
  const { resolveRecipient } = await import('../data/recipients');
  const result = await resolveRecipient('jobcenter', { ags: '12054000', plz: '14467' });
  assert.equal(result.recipient, null);
  assert.deepEqual(result.candidates.map(row => row.name), ['Jobcenter Musterstadt']);
});

test('mailing address takes priority over visiting address and preserves a Postfach or free-form manual address', async () => {
  const { addressLines, hasPostalAddress } = await import('../data/recipients');
  const dept = { ...recipient, kind: 'jobcenter', name: 'Jobcenter Potsdam, Stadt',
    postal_address: null, street: null, plz: null, city: null };
  assert.equal(hasPostalAddress(dept), false);
  assert.equal(hasPostalAddress({ ...dept, plz: '14467', city: 'Potsdam' }), false);
  const postal_address = 'Friedrich-Ebert-Straße 79/81, 14469, Potsdam';
  for (const street of [null, 'Haus M/N, Behlertstr. 3a']) {
    const office = { ...dept, street, city: 'Potsdam', postal_address };
    assert.equal(hasPostalAddress(office), true);
    assert.deepEqual(addressLines(office).slice(1), ['Friedrich-Ebert-Straße 79/81', '14469 Potsdam']);
  }
  const box = { ...dept, postal_address: 'Postfach 12 07 09 01008 Dresden' };
  assert.deepEqual(addressLines(box).slice(1), ['Postfach 12 07 09', '01008 Dresden']);
  assert.equal(hasPostalAddress(box), true);
  assert.equal(hasPostalAddress({ ...dept, postal_address: '90300 Nürnberg' }), true);
  const manual = manualAuthority(dept.name, ['Postfach 12345', 'c/o Dienststelle, Zimmer 5', '14467 Potsdam']);
  assert.deepEqual(addressLines(manual).slice(1), ['Postfach 12345', 'c/o Dienststelle, Zimmer 5', '14467 Potsdam']);
});
