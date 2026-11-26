import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { createRequire } from 'node:module';
import { hookHost, nodes, button } from '../chamfer/components/testHooks';

const act = { id: 'fed_test', jurabk: 'TestG', title: 'Synthetic act', norms: [] };
const archive = (builtAt: string) => ({ act_id: act.id, head_date: '2026-09-30', entries: [],
  retrospective: { built_at: builtAt, available: true, intervals: [
    { id: 'a', effective_from: '2020-01-01', effective_to: '2021-01-01', state_sha256: 'a', text_status: 'official_exact' },
    { id: 'b', effective_from: '2021-01-01', effective_to: null, verified_through_observed_at: '2026-09-30', state_sha256: 'b', text_status: 'official_exact' },
  ] } });

function setup(t: TestContext, archiveResponse: (url: URL, index: number) => Promise<Response> | Response) {
  const require = createRequire(import.meta.url);
  const originalCss = require.extensions['.css'];
  require.extensions['.css'] = module => { module.exports = {}; };
  const host = hookHost();
  const Panel = host.load<any>('../../kerf/KerfModule.tsx').ActArchivePanel;
  if (originalCss) require.extensions['.css'] = originalCss;
  else delete require.extensions['.css'];
  const requests: URL[] = [];
  let archiveCount = 0;
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL): Promise<Response> => {
    const url = new URL(String(input), 'https://synthetic.test');
    requests.push(url);
    if (url.pathname.endsWith('/archive')) return archiveResponse(url, ++archiveCount);
    if (url.pathname.endsWith('/diff')) return Response.json({ from: {}, to: {}, changes: [], exact: true });
    return Response.json({ act_id: act.id, markdown: '# Synthetic act\nRetained text', exact: true, partial: false });
  });
  t.after(() => host.unmount());
  const render = () => host.render(() => Panel({ act }));
  const flush = async () => {
    let tree;
    for (let i = 0; i < 5; i++) { tree = render(); host.effects(); await new Promise<void>(resolve => setImmediate(resolve)); }
    return tree;
  };
  const open = async () => {
    const tree = render(); host.effects();
    tree.props.onToggle({ currentTarget: { open: true } });
    return flush();
  };
  return { open, flush, requests };
}

// Dates are the site's IsoDateField (core/DateField): it hands the module a
// whole ISO day. The helper speaks to it the way the tests spoke to the old
// native input, so each test keeps saying what it means.
const dateInput = (tree: any, label: string) => {
  const field = nodes(nodes(tree).find(node =>
    node.type === 'label' && Array.isArray(node.props.children) && node.props.children.includes(label)))
    .find(node => node.type?.name === 'IsoDateField');
  return field && { props: { value: field.props.value, onChange: (e: { target: { value: string } }) => field.props.onChange(e.target.value) } };
};

test('archive failure can be retried in place without discarding a selected legal date', async t => {
  const { open, flush, requests } = setup(t, (_url, index) => index === 1 || index === 3
    ? new Response('', { status: 503 }) : Response.json(archive('2026-09-30T12:00:00Z')));
  let tree = await open();
  const retry = button(tree, 'Retry');
  assert.ok(retry, 'initial archive outage must offer Retry without a reload');
  retry.props.onClick(); tree = await flush();
  assert.ok(dateInput(tree, 'archiveLegalDate'));
  assert.equal(requests.filter(url => url.pathname.endsWith('/archive')).length, 2);
  dateInput(tree, 'archiveLegalDate').props.onChange({ target: { value: '2022-05-01' } });
  tree = await flush();
  dateInput(tree, 'archiveKnowledgeDate').props.onChange({ target: { value: '2025-09-30' } });
  tree = await flush();
  assert.ok(button(tree, 'Retry'));
  const latest = button(tree, 'archiveKnowledgeLatest');
  assert.ok(latest, 'a failed knowledge slice must still allow return to latest knowledge');
  latest.props.onClick(); tree = await flush();
  assert.equal(dateInput(tree, 'archiveKnowledgeDate').props.value, '');
  assert.equal(dateInput(tree, 'archiveLegalDate').props.value, '2022-05-01');
  assert.equal(requests.filter(url => url.pathname.endsWith('/archive')).length, 4);
});

test('comparison follows the resolved knowledge horizon while legal-date edits do not refetch the archive', async t => {
  const oldHorizon = '2026-09-30T12:00:00Z';
  const newHorizon = '2026-09-30T13:00:00Z';
  let finishReload: (response: Response) => void = () => {};
  const { open, flush, requests } = setup(t, (_url, index) => index === 2
    ? new Promise<Response>(resolve => { finishReload = resolve; })
    : Response.json(archive(index === 1 ? oldHorizon : newHorizon)));
  let tree = await open();
  dateInput(tree, 'archiveLegalDate').props.onChange({ target: { value: '2022-05-01' } });
  tree = await flush();
  assert.equal(requests.filter(url => url.pathname.endsWith('/archive')).length, 1);
  button(tree, 'archiveCompare').props.onClick(); tree = await flush();
  dateInput(tree, 'archiveKnowledgeDate').props.onChange({ target: { value: '2026-09-30' } });
  await flush();
  finishReload(Response.json(archive(newHorizon))); tree = await flush();
  const comparisons = requests.filter(url => url.pathname.endsWith('/diff'));
  assert.equal(comparisons.at(-1)?.searchParams.get('as_of'), newHorizon,
    'the comparison must use the same updated knowledge horizon as the visible archive');
  assert.ok(!comparisons.some(url => url.searchParams.get('as_of') === '2026-09-30T23:59:59.999Z'),
    'clearing a loading archive must not temporarily remove the known horizon');
  assert.equal(dateInput(tree, 'archiveLegalDate').props.value, '2022-05-01');
  assert.equal(requests.filter(url => url.pathname.endsWith('/archive')).length, 3,
    'one bounded follow-up resolves the newly advertised horizon, without an effect loop');
});

test('end-of-day knowledge is clamped against a whole-second horizon by time, not string order', async t => {
  const horizon = '2026-09-30T23:59:59Z';
  const { open, flush, requests } = setup(t, () => Response.json(archive(horizon)));
  const tree = await open();
  dateInput(tree, 'archiveKnowledgeDate').props.onChange({ target: { value: '2026-09-30' } });
  await flush();
  assert.equal(requests.filter(url => url.pathname.endsWith('/archive')).at(-1)?.searchParams.get('as_of'), horizon);
});

test('an automatically selected legacy event is not treated as a legal-text checkout', async t => {
  const { open, flush, requests } = setup(t, () => Response.json({
    act_id: act.id, head_date: '2020-01-01', entries: [{ id: 'event', date: '2020-01-01', label: 'Publication event' }],
  }));
  const tree = await open();
  assert.equal(requests.filter(url => url.pathname.endsWith('/markdown')).length, 0,
    'an event marker alone does not assert a complete legal-text state');
  dateInput(tree, 'archiveLegalDate').props.onChange({ target: { value: '2020-01-01' } });
  await flush();
  assert.equal(requests.filter(url => url.pathname.endsWith('/markdown')).length, 1,
    'an explicit legacy free-date checkout remains a distinct supported action');
});
