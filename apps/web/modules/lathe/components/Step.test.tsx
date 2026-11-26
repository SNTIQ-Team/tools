import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import StepView from './Step';
import Questionnaire from './Questionnaire';
import { INITIAL_DATA, STEPS } from '../wizard';
import { getStepErrors } from '../formValidation';
import { visibleErrors } from './errorVisibility';

async function render(child: React.ReactNode) {
  const i18n = createInstance();
  await i18n.init({ lng: 'en', initImmediate: false, resources: { en: { lathe: {} } } });
  return renderToStaticMarkup(<I18nextProvider i18n={i18n}>{child}</I18nextProvider>);
}

test('Lathe choices expose a labelled native radio group and keyboard-capable controls', async () => {
  const html = await render(<StepView step={STEPS.find(s => s.id === 'dependents')!} />);
  assert.match(html, /role="radiogroup"/);
  assert.match(html, /aria-labelledby="hasDependents-label"/);
  assert.equal((html.match(/type="radio"/g) || []).length, 2);
  assert.equal((html.match(/name="hasDependents"/g) || []).length, 2);
});

test('Lathe Back keeps an accessible name below the text breakpoint', async () => {
  const html = await render(<Questionnaire />);
  assert.match(html, /aria-label="nav.back"/);
});

// Required-field errors are a presentation matter: they wait until the user
// has left the field or pressed Next on the step. Validity itself is unchanged.
const intro = STEPS.find(s => s.id === 'intro')!;

test('a fresh step shows no required-field error and marks nothing invalid', async () => {
  assert.equal(getStepErrors(intro, INITIAL_DATA).courtInfo, 'validation.required', 'the step is still invalid');
  const html = await render(<StepView step={intro} />);
  assert.doesNotMatch(html, /validation\.required/);
  assert.doesNotMatch(html, /aria-invalid="true"/);
  assert.match(html, /aria-required="true"/, 'required stays announced');
  const whole = await render(<Questionnaire />);
  assert.doesNotMatch(whole, /validation\.required/);
});

test('a required-field error appears for a field the user has left, and only for that one', async () => {
  const html = await render(<StepView step={intro} touched={new Set(['courtInfo'])} />);
  assert.equal((html.match(/validation\.required/g) || []).length, 1);
  assert.match(html, /id="courtInfo"[^>]*aria-invalid="true"|aria-invalid="true"[^>]*id="courtInfo"/);
  assert.match(html, /id="courtInfo-error"/);
});

test('after Next was pressed on the step every missing required answer is named', async () => {
  const html = await render(<StepView step={intro} attempted />);
  const missing = Object.values(getStepErrors(intro, INITIAL_DATA)).filter(code => code === 'validation.required').length;
  assert.ok(missing >= 2);
  assert.equal((html.match(/validation\.required/g) || []).length, missing);
});

test('errors about what the user typed wait until the field is left, like required ones', () => {
  const data = structuredClone(INITIAL_DATA);
  data.financials.income.employment = '-100,00';
  data.financials.income.other1Amount = '350,00';
  const errors = getStepErrors(STEPS.find(s => s.id === 'income')!, data);
  const shown = visibleErrors(errors);
  assert.equal(shown.self_employment, undefined, 'still being typed: not shown yet');
  assert.equal(visibleErrors(errors, new Set(['self_employment'])).self_employment, 'validation.nonnegative');
  assert.equal(shown.other1Label, undefined, 'required waits for touch');
  assert.equal(visibleErrors(errors, new Set(['other1Label'])).other1Label, 'validation.required');
  assert.deepEqual(visibleErrors(errors, new Set(), true), errors);
});

test('dates are typed as TT.MM.JJJJ in every browser, with a calendar button beside them', async () => {
  const html = await render(<StepView step={STEPS.find(s => s.id === 'personal')!} />);
  const field = html.match(/<input[^>]*id="birthDate"[^>]*>/)?.[0] ?? '';
  assert.match(field, /type="text"/, 'the visible field is text: the system picker would follow the browser language (mm/dd/yyyy)');
  assert.match(field, /inputMode="numeric"|inputmode="numeric"/i);
  assert.match(html, /<button[^>]*type="button"[^>]*aria-label="calendar"/);
  const picker = html.match(/<input[^>]*type="date"[^>]*>/)?.[0] ?? '';
  assert.match(picker, /tabindex="-1"/i, 'the system picker is reached through the button, not by Tab');
  assert.match(picker, /aria-hidden="true"/);
  assert.match(picker, /max="\d{4}-\d{2}-\d{2}"/, 'a birth date cannot be in the future');
});

test('personal fields tell the browser what they hold, so it can fill them', async () => {
  const html = await render(<StepView step={STEPS.find(s => s.id === 'personal')!} />);
  for (const [id, ac] of [['firstName', 'given-name'], ['lastName', 'family-name'], ['address', 'street-address'], ['phone', 'tel']] as const) {
    assert.match(html, new RegExp(`id="${id}"[^>]*autoComplete="${ac}"|autoComplete="${ac}"[^>]*id="${id}"`, 'i'), id);
  }
  assert.match(html, /type="tel"[^>]*id="phone"|id="phone"[^>]*type="tel"/);
});
