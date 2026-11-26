import './cssStub'; // CSS modules → class names (Node cannot parse CSS)
import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { GermanDateInput } from './inputs';

async function renderDate(value: string, max?: string) {
  const i18n = createInstance();
  await i18n.init({ lng: 'en', initImmediate: false, resources: { en: { chamfer: {} } } });
  return renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <GermanDateInput id="birth" value={value} onChange={() => {}} max={max} />
    </I18nextProvider>,
  );
}

test('impossible complete dates expose an accessible validation state', async () => {
  const html = await renderDate('31.02.2026');
  assert.match(html, /aria-invalid="true"/);
  assert.match(html, /aria-describedby="birth-error"/);
  assert.match(html, /id="birth-error"/);
  assert.equal((await renderDate('29.02.2024')).includes('aria-invalid="true"'), false);
});

test('birth-date controls reject future dates without restricting ordinary deadlines', async () => {
  assert.match(await renderDate('22.09.2026', '2026-09-21'), /aria-invalid="true"/);
  assert.equal((await renderDate('21.09.2026', '2026-09-21')).includes('aria-invalid="true"'), false);
  assert.equal((await renderDate('22.09.2026')).includes('aria-invalid="true"'), false);
});

test('dates use the site\'s date field: typed TT.MM.JJJJ, the system calendar behind a button', async () => {
  const html = await renderDate('01.02.1990', '2026-11-25');
  assert.match(html, /class="sntiq-date"/);
  assert.match(html, /<input[^>]*type="date"[^>]*tabindex="-1"/i);
  assert.match(html, /max="2026-11-25"/, 'a birth date stops at today in Berlin');
  assert.match(html, /aria-label="calendar"/, "the calendar button is named by the platform texts");
  assert.match(html, /placeholder="date_placeholder"/, "the hint comes from the platform texts in the reader's language");
});
