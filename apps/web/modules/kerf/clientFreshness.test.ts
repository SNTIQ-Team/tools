import assert from 'node:assert/strict';
import test from 'node:test';
import { kerfAct, kerfActs, kerfActMarkdownUrl, kerfActMarkdown } from './client';

test('HEAD Markdown omits the date query instead of sending an invalid date literal', () => {
  const url = new URL(kerfActMarkdownUrl('fed_asylvfg_1992', { at: 'HEAD', norm: '\u00a7 3', download: true }), 'https://example.test');
  assert.equal(url.searchParams.has('at'), false);
  assert.equal(url.searchParams.get('norm'), '\u00a7 3');
  assert.equal(url.searchParams.get('download'), 'true');
  assert.equal(new URL(kerfActMarkdownUrl('fed_asylvfg_1992', { at: '2026-07-06' }), 'https://example.test').searchParams.get('at'), '2026-07-06');
});

test('law index and current text revalidate even a previously fresh browser cache', async () => {
  const original = globalThis.fetch;
  const requests: RequestInit[] = [];
  const controller = new AbortController();
  globalThis.fetch = async (_url, options) => {
    requests.push(options ?? {});
    return new Response(JSON.stringify([]), { headers: { 'content-type': 'application/json' } });
  };
  try {
    await kerfActs(controller.signal);
    await kerfAct('fed_sgb_12', controller.signal);
    assert.equal(requests.length, 2);
    for (const request of requests) {
      assert.equal(request.cache, 'no-cache');
      // The request carries its own deadline signal, linked to the caller's.
      assert.ok(request.signal instanceof AbortSignal);
      assert.equal(request.signal!.aborted, false);
    }
  } finally {
    globalThis.fetch = original;
  }
});


test('historical source provenance survives raw Markdown without new CORS-exposed headers', async t => {
  const source = 'http://www.gesetze-bayern.de:80/Content/Document/BayVwVfG/true';
  const archived = 'https://web.archive.org/web/20160129083149id_/' + source;
  const markdown = `---\nsource: "BAYERN.RECHT"\nsource_url: ${JSON.stringify(source)}\narchive_url: ${JSON.stringify(archived)}\narchive_timestamp: "20160129083149"\n---\n\n# Historical title\n\n## Art. 10\n\nBody.`;
  t.mock.method(globalThis, 'fetch', async () => new Response(markdown, { headers: { 'content-type': 'text/markdown', 'x-kerf-date-basis': 'archive_capture_not_effective_date' } }));
  const result = await kerfActMarkdown('by_bayvwvfg', { at: '2016-01-29' });
  assert.equal(result.source, 'BAYERN.RECHT');
  assert.equal(result.source_url, source);
  assert.equal(result.archive_url, archived);
  assert.equal(result.archive_timestamp, '20160129083149');
  assert.equal(result.observed_at, '2016-01-29');
  assert.equal(result.legal_effect_verified, false);
  assert.equal(result.markdown, markdown);
});

test('provenance parsing ignores body imitations and retains HTTP metadata precedence', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('# Title\n\nsource: "Fake"\narchive_url: "https://fake.test"', {
    headers: { 'content-type': 'text/markdown', 'x-kerf-source-url': 'https://www.gesetze-bayern.de/official' },
  }));
  const result = await kerfActMarkdown('by_test', { at: '2016-01-29' });
  assert.equal(result.source, null);
  assert.equal(result.archive_url, null);
  assert.equal(result.source_url, 'https://www.gesetze-bayern.de/official');
});
