import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Native Node strip-types needs an explicit .ts suffix.
import * as logic from './logic.ts';

test('ISO dates reject calendar rollover and malformed partial input', () => {
  for (const value of ['2026-02-31', '2026-02-29', '2026-04-31', '2026-13-01', '2026-00-01', '2026-01-00', '0000-01-01', '2026-2-01', '2026-01-01 ', 'not-a-date', '', undefined]) {
    assert.equal(logic.parseISO(value), null, String(value));
    assert.equal(logic.formatDE(value), '', String(value));
  }
});

test('month-only dates reject invalid months and keep conservative month-end semantics', () => {
  for (const value of ['2026-00', '2026-13', '0000-01', '2026-2']) {
    assert.equal(logic.isMonthOnly(value), false, value);
    assert.equal(logic.parseISO(value), null, value);
    assert.equal(logic.formatDE(value), '', value);
  }
  assert.equal(logic.toLocalISO(logic.parseISO('2026-02')!), '2026-02-28');
  assert.equal(logic.toLocalISO(logic.parseISO('2024-02')!), '2024-02-29');
  assert.equal(logic.formatDE('2026-02'), '02.2026');
});

test('valid ISO dates survive leap years and local timezone boundaries exactly', () => {
  for (const value of ['2024-02-29', '2000-02-29', '2026-03-29', '2026-10-25', '0099-12-31', '1900-02-28']) {
    const date = logic.parseISO(value);
    assert.ok(date, value);
    assert.equal(logic.toLocalISO(date), value, value);
  }
  assert.equal(logic.parseISO('1900-02-29'), null);
});

test('invalid dates cannot enter elapsed-month or deadline calculations', () => {
  const now = new Date('2026-09-21T12:00:00');
  assert.equal(logic.monthsSince('2026-02-31', now), null);
  assert.equal(logic.monthDeadlineISO('2026-02-31', 1), null);
  assert.equal(logic.monthDeadlineISO('2026-01-31', 1), '2026-02-28');
  assert.equal(logic.monthsSince('2026-02', new Date('2026-05-27T12:00:00')), 2);
});

test('required letter fields must contain text and supplied date fields must be valid', () => {
  assert.equal(typeof logic.requiredFieldsComplete, 'function');
  assert.equal(logic.requiredFieldsComplete(['aktenzeichen'], { aktenzeichen: ' \n\t ' }), false);
  assert.equal(logic.requiredFieldsComplete(['aktenzeichen'], { aktenzeichen: ' 84308//0172859 ' }), true);
  assert.equal(logic.requiredFieldsComplete(['aktenzeichen'], {}), false);
  const dateFields = new Set(['applicationDate', 'bescheidDate'] as const);
  assert.equal(logic.requiredFieldsComplete(['applicationDate'], { applicationDate: '2026-02-31' }, dateFields), false);
  assert.equal(logic.requiredFieldsComplete(['applicationDate'], { applicationDate: '2026-02' }, dateFields), true);
  assert.equal(logic.requiredFieldsComplete(['bescheidDate'], { bescheidDate: '2026-02' }, dateFields), false);
  assert.equal(logic.requiredFieldsComplete(['bescheidDate'], { bescheidDate: '2026-02-28' }, dateFields), true);
  assert.equal(logic.requiredFieldsComplete([], {}, dateFields), true);
});

test('profile dates require complete real German dates and cannot be future births', () => {
  assert.equal(typeof logic.isValidGermanDate, 'function');
  assert.equal(typeof logic.profileComplete, 'function');
  const profile = { name: 'Olena', surname: 'Test', dob: '29.02.2000', street: 'Musterstr. 1', plzCity: '80331 München' };
  const now = new Date('2026-09-21T12:00:00');
  assert.equal(logic.profileComplete(profile, now), true);
  for (const dob of ['1', '01.01.', '31.02.2000', '29.02.1900', '00.01.1990', '01.00.1990', '01.01.0000', '01.01.2030']) {
    assert.equal(logic.profileComplete({ ...profile, dob }, now), false, dob);
  }
  assert.equal(logic.profileComplete({ ...profile, surname: ' \n ' }, now), false);
  assert.equal(logic.isValidGermanDate('29.02.2000'), true);
  assert.equal(logic.isValidGermanDate('01.01.2030'), true);
  assert.equal(logic.isValidGermanDate('2026-01-01'), false);
});
