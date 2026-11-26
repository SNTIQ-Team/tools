import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Native Node strip-types needs an explicit .ts suffix.
import { KERF_SHOWCASE_HREF, kerfShowcaseCopy } from './showcaseContent.ts';
// @ts-expect-error Native Node strip-types needs an explicit .ts suffix.
import { decodeWorkspace } from './readerWorkspace.ts';

test('homepage opens the depicted real provisions in separate reader panes', () => {
  const url = new URL(KERF_SHOWCASE_HREF, 'https://sntiq.com');
  assert.equal(url.pathname, '/dt/kerf');
  const workspace = decodeWorkspace(url.hash);
  assert.ok(workspace);
  assert.equal(workspace.layout, 'columns');
  assert.equal(workspace.panes.length, 2);
  assert.deepEqual(workspace.panes.map((pane) => pane.tabs.map((tab) => [tab.actId, tab.norm])), [
    [['fed_asylvfg_1992', '§ 3']], [['fed_aufenthg_2004', '§ 60']],
  ]);
  assert.ok(workspace.panes.every((pane) => pane.tabs.some((tab) => tab.id === pane.activeTabId)));
});

test('homepage showcase has complete four-language copy and regional fallback', () => {
  const keys = Object.keys(kerfShowcaseCopy('en'));
  for (const lang of ['en', 'de', 'ru', 'ua']) {
    const copy = kerfShowcaseCopy(lang);
    assert.deepEqual(Object.keys(copy), keys);
    assert.ok(Object.values(copy).every((value) => value.trim().length > 0));
    assert.ok(copy.preview.includes('AsylG') && copy.preview.includes('3'));
    assert.ok(!copy.preview.includes('AufenthG'), 'Alternative text must also describe the one-pane mobile capture');
  }
  assert.deepEqual(kerfShowcaseCopy('ru-RU'), kerfShowcaseCopy('ru'));
  assert.deepEqual(kerfShowcaseCopy('uk-UA'), kerfShowcaseCopy('ua'));
  assert.deepEqual(kerfShowcaseCopy('unsupported'), kerfShowcaseCopy('en'));
});
