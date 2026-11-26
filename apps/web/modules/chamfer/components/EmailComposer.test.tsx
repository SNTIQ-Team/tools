import './cssStub'; // CSS modules → class names (Node cannot parse CSS)
import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import EmailComposer from './EmailComposer';

async function renderDraft(body: string) {
  const i18n = createInstance();
  await i18n.init({ lng: 'en', initAsync: false, resources: { en: { chamfer: {} } } });
  return renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <EmailComposer to="case+123@example.org" subject="Case & documents" body={body} />
    </I18nextProvider>,
  );
}

function links(html: string) {
  return [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1].replace(/&amp;/g, '&'));
}

test('long Unicode email drafts preserve complete content in both client links', async () => {
  const body = 'Sehr geehrte Damen und Herren,\n\n' + '\u0417\u0430\u044f\u0432\u0430 & \u00a7 11 + 100%\n'.repeat(250) + '\nMit freundlichen Gruessen';
  const hrefs = links(await renderDraft(body));
  const gmail = new URL(hrefs.find((href) => href.startsWith('https://mail.google.com/'))!);
  const mailto = new URL(hrefs.find((href) => href.startsWith('mailto:'))!);
  assert.equal(gmail.searchParams.get('to'), 'case+123@example.org');
  assert.equal(gmail.searchParams.get('su'), 'Case & documents');
  assert.equal(gmail.searchParams.get('body'), body);
  assert.equal(decodeURIComponent(mailto.pathname), 'case+123@example.org');
  assert.equal(mailto.searchParams.get('subject'), 'Case & documents');
  assert.equal(mailto.searchParams.get('body'), body.replace(/\n/g, '\r\n'));
});

test('email fields are named and body has a native read-only control before editing', async () => {
  const html = await renderDraft('A plain letter.');
  assert.match(html, /aria-label="email.to"/);
  assert.match(html, /aria-label="email.subject"/);
  assert.match(html, /<textarea[^>]*aria-label="email.body"/);
  assert.match(html, /<textarea[^>]*readOnly=""/);
  assert.equal(html.includes('contenteditable='), false);
});
