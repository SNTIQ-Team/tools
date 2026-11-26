import React from 'react';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { renderToStaticMarkup } from 'react-dom/server';
import { readerCopy } from './readerI18n';
import type { ReaderNode } from './readerStructure';

const require = createRequire(import.meta.url);
require.extensions['.css'] = module => { module.exports = {}; };

const annotations: ReaderNode[] = [{ type: 'element', tag: 'div', children: [{ type: 'element', tag: 'p', children: [
  { type: 'element', tag: 'sup', attrs: { role: 'footnote' }, children: [{ type: 'text', text: '*' }] },
  { type: 'text', text: 'Ab 01.01.2027 gilt 750000 Euro. <script>literal text</script>' },
] }] }];

test('official source annotations remain a separately labelled note with literal source markers in all reader languages', async () => {
  const { default: ReaderSourceAnnotations } = await import('./ReaderSourceAnnotations');
  const labels = new Set<string>();
  for (const language of ['de', 'en', 'ru', 'ua']) {
    const label = readerCopy(language).sourceAnnotations;
    labels.add(label);
    const html = renderToStaticMarkup(<ReaderSourceAnnotations annotations={annotations} label={label} acts={[]} actId="fed_ao_1977" norms={[]} onReference={() => {}} />);
    assert.match(html, /<aside[^>]*role="note"/);
    assert.ok(html.includes(`aria-label="${label}"`));
    assert.match(html, /<sup[^>]*>\*<\/sup>/);
    assert.ok(html.includes('750000 Euro. &lt;script&gt;literal text&lt;/script&gt;'));
    assert.doesNotMatch(html, /<script>/);
  }
  assert.equal(labels.size, 4);
});
