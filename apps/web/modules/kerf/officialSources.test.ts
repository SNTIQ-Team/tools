import assert from 'node:assert/strict';
import test from 'node:test';
import { officialActSource } from './officialSources';

test('EU links distinguish a consolidated source edition from the original act', () => {
  const source_url = 'https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32013R0604';
  const act = { id: 'eu_32013r0604', juris: 'EU', jurabk: 'Dublin-III-VO', source_url };
  assert.equal(officialActSource({ ...act, stand: '02013R0604-20130629' }), source_url.replace('32013R0604', '02013R0604-20130629'));
  assert.equal(officialActSource({ ...act, stand: '32013R0604' }), source_url);
  assert.equal(officialActSource({ ...act, stand: '02016R0679-20160504' }), source_url);
  assert.equal(officialActSource({ ...act, id: 'eu_32016r0679' }), null);
});

test('stable public IDs preserve renamed and hyphenated official source paths', () => {
  for (const [id, slug] of [['fed_rustag', 'stag'], ['fed_azrg_dv', 'azrg-dv'], ['fed_vwdg_dv', 'vwdg-dv']]) {
    assert.equal(officialActSource({ id, juris: 'DE', jurabk: id }), `https://www.gesetze-im-internet.de/${slug}/`);
  }
});

test('verified metadata is preferred and untrusted origins or executable IDs never become links', () => {
  assert.equal(officialActSource({ id: 'fed_old', juris: 'DE', jurabk: 'Old', source_url: 'https://www.gesetze-im-internet.de/new-path/' }), 'https://www.gesetze-im-internet.de/new-path/');
  assert.equal(officialActSource({ id: 'fed_old', juris: 'DE', jurabk: 'Old', source_url: 'https://www.gesetze-im-internet.de.evil.test/x/' }), null);
  assert.equal(officialActSource({ id: 'fed_../bad', juris: 'DE', jurabk: 'Bad' }), null);
  assert.equal(officialActSource({ id: 'eu_x', juris: 'EU', jurabk: 'X' }), null);
});

test('Bavarian sources open exact verified act permalinks instead of the search page', () => {
  assert.equal(officialActSource({ id: 'by_agsg', juris: 'DE-BY', jurabk: 'AGSG', permalink: 'https://www.gesetze-bayern.de/Content/Document/BayAGSG' }), 'https://www.gesetze-bayern.de/Content/Document/BayAGSG');
  assert.equal(officialActSource({ id: 'by_agsg', juris: 'DE-BY', jurabk: 'AGSG', permalink: 'https://evil.test/Content/Document/BayAGSG' }), 'https://www.gesetze-bayern.de/Search?q=AGSG');
});
