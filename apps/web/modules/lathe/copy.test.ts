import assert from 'node:assert/strict';
import test from 'node:test';
import { en } from './i18n/en';
import { de } from './i18n/de';
import { ru } from './i18n/ru';
import { ua } from './i18n/ua';

/** DESIGN.md section 9 on the Lathe strings. */
const LOCALES = { en, de, ru, ua } as const;

/** Russian and Ukrainian copula (noun subject, noun predicate). */
const GRAMMATICAL_DASH = new Set(['ru.footer.disclaimer', 'ua.footer.disclaimer']);

test('Lathe strings use no em dash outside the grammatical exceptions', () => {
  const found: string[] = [];
  for (const [lang, bundle] of Object.entries(LOCALES)) {
    for (const [key, s] of Object.entries(bundle)) {
      if (s.includes('—') && !GRAMMATICAL_DASH.has(`${lang}.${key}`)) found.push(`${lang}.${key}: ${s.slice(0, 70)}`);
    }
  }
  assert.deepEqual(found, []);
});

test('the grammatical exceptions are still used and spaced', () => {
  for (const path of GRAMMATICAL_DASH) {
    const [lang, ...rest] = path.split('.');
    const s = (LOCALES as Record<string, Record<string, string>>)[lang][rest.join('.')];
    assert.ok(s?.includes(' — '), path);
  }
});

test('the module line under the name says what the tool does in every language', () => {
  for (const [lang, bundle] of Object.entries(LOCALES)) {
    const line = bundle['app.subtitle'];
    assert.ok(line && line.includes('ZP 1a'), `${lang}: the line names the form`);
    assert.ok(line.length <= 100, `${lang}: one line`);
  }
});

test('every Lathe key exists in all four languages', () => {
  const keys = Object.keys(en).sort();
  for (const [lang, bundle] of Object.entries(LOCALES)) assert.deepEqual(Object.keys(bundle).sort(), keys, lang);
});
