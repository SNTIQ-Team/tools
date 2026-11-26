import assert from 'node:assert/strict';
import test from 'node:test';
import { hookHost, nodes } from '../chamfer/components/testHooks';

test('court lookup uses selected locality and clears the previous chain while postcode is edited', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const original = globalThis.fetch;
  const courtUrls: URL[] = [];
  const host = hookHost(() => ({ register() {}, unregister() {} }));
  const Viewer = host.load<any>('../../taper/TaperModule.tsx').default;
  globalThis.fetch = async input => {
    const url = new URL(String(input), 'https://audit.invalid');
    if (url.pathname.endsWith('/places')) return Response.json({ matches: [{ ags: '09161000', name: 'Ingolstadt', land: 'Bayern', kreis: 'Ingolstadt', plz_count: 6, plz: '85047' }] });
    if (url.pathname.endsWith('/resolve/court')) {
      courtUrls.push(url);
      return Response.json({ chain: [
        { id: 2, name: 'Synthetic Prosecutor', position: 1, role: 'prosecution' },
        { id: 1, name: 'Synthetic Court', position: 1, role: 'court' },
      ] });
    }
    if (url.pathname.endsWith('/matters')) return Response.json([]);
    return new Response('', { status: 404 });
  };
  const settle = () => new Promise<void>(resolve => setImmediate(resolve));
  try {
    let tree = host.render(Viewer); host.effects();
    nodes(tree).find(n => n.type === 'input').props.onChange({ target: { value: 'Ingolstadt' } });
    tree = host.render(Viewer); host.effects(); t.mock.timers.tick(250); await settle();
    tree = host.render(Viewer);
    nodes(tree).find(n => n.type === 'button' && 'data-taper-match' in n.props).props.onClick();
    tree = host.render(Viewer); host.effects(); await settle();
    assert.equal(courtUrls.length, 0, 'name MIN postcode never triggers court lookup');
    tree = host.render(Viewer);
    nodes(tree).find(n => n.type === 'button' && JSON.stringify(n.props.children).includes('tab.courts')).props.onClick();
    tree = host.render(Viewer); host.effects();
    nodes(tree).find(n => n.props?.id === 'taper-plz').props.onChange({ target: { value: '85049' } });
    tree = host.render(Viewer); host.effects(); await settle();
    tree = host.render(Viewer);
    const instances = nodes(tree).find(n => n.type === 'ol');
    assert.deepEqual(nodes(instances).filter(n => n.props?.a).map(n => n.props.a.name), ['Synthetic Court']);
    assert.ok(nodes(tree).some(n => n.props?.a?.name === 'Synthetic Prosecutor'));
    nodes(tree).find(n => n.props?.id === 'taper-plz').props.onChange({ target: { value: '8504' } });
    host.render(Viewer); host.effects(); tree = host.render(Viewer);
    assert.deepEqual({ locality: courtUrls.at(-1)?.searchParams.get('ort'), staleChain: nodes(tree).some(n => n.props?.a?.name === 'Synthetic Court') },
      { locality: 'Ingolstadt', staleChain: false });
  } finally { host.unmount(); globalThis.fetch = original; }
});

test('search submission is scoped to the latest input and a joint office retains every kind', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const host = hookHost(() => ({ register() {}, unregister() {} }));
  const Viewer = host.load<any>('../../taper/TaperModule.tsx').default;
  t.mock.method(globalThis, 'fetch', async (input: string) => {
    const url = new URL(input, 'https://example.invalid');
    if (url.pathname.endsWith('/places')) return Response.json({ matches: [{
      ags: '01058001', name: url.searchParams.get('q'), land: 'SH', kreis: 'Kreis', plz: null,
    }] });
    if (url.pathname.endsWith('/matters')) return Response.json([]);
    if (['jugendamt', 'auslaenderbehoerde'].includes(url.searchParams.get('kind') ?? '')) {
      return Response.json({ resolved: { id: 2458, name: 'Gemeinsames Amt' }, candidates: [],
        supervisory: [], caveats: [] });
    }
    return new Response('', {status: 404});
  });
  const settle = () => new Promise<void>(resolve => setImmediate(resolve));
  const change = (tree: unknown, value: string) =>
    nodes(tree).find(n => n.props?.id === 'taper-place').props.onChange({ target: { value } });
  try {
    let tree = host.render(Viewer); host.effects();
    change(tree, 'Erding');
    host.render(Viewer); host.effects(); t.mock.timers.tick(250); await settle();
    tree = host.render(Viewer);
    assert.ok(nodes(tree).some(n => n.props?.['data-taper-match'] === ''));
    change(tree, 'Achterwehr');
    tree = host.render(Viewer); host.effects();
    nodes(tree).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
    assert.ok(nodes(host.render(Viewer)).some(n => n.props?.id === 'taper-place'));
    t.mock.timers.tick(250); await settle();
    tree = host.render(Viewer);
    nodes(tree).find(n => n.props?.['data-taper-match'] === '').props.onClick();
    host.render(Viewer); host.effects(); await settle();
    tree = host.render(Viewer);
    const heading = nodes(tree).find(n => n.type === 'h3');
    assert.deepEqual(nodes(heading).filter(n => n.type === 'span').map(n => n.props.children),
      ['kind.auslaenderbehoerde','kind.jugendamt']);
    assert.equal(nodes(tree).filter(n => n.props?.a?.id === 2458).length, 1);
  } finally { host.unmount(); }
});

test('the place search stays on the folded band: another place is found without going back', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const host = hookHost(() => ({ register() {}, unregister() {} }));
  const Viewer = host.load<any>('../../taper/TaperModule.tsx').default;
  t.mock.method(globalThis, 'fetch', async (input: string) => {
    const url = new URL(input, 'https://example.invalid');
    if (url.pathname.endsWith('/places')) return Response.json({ matches: [{
      ags: url.searchParams.get('q') === 'Erding' ? '09177117' : '01058001', name: url.searchParams.get('q'), land: 'Bayern', kreis: 'Kreis', plz: null,
    }] });
    if (url.pathname.endsWith('/matters')) return Response.json([]);
    return Response.json({ resolved: null, candidates: [], supervisory: [], caveats: [] });
  });
  const settle = () => new Promise<void>(resolve => setImmediate(resolve));
  const type = async (value: string) => {
    nodes(host.render(Viewer)).find(n => n.props?.id === 'taper-place').props.onChange({ target: { value } });
    host.render(Viewer); host.effects(); t.mock.timers.tick(250); await settle();
    return host.render(Viewer);
  };
  const band = (tree: unknown) => nodes(tree).find(n => n.props?.module === 'taper');
  const title = (tree: unknown) => JSON.stringify(nodes(tree).find(n => n.type === 'h2')?.props.children);
  try {
    host.render(Viewer); host.effects();
    let tree = await type('Erding');
    assert.equal(band(tree).props.compact, false, 'the band is open on entry');
    nodes(tree).find(n => n.props?.['data-taper-match'] === '').props.onClick();
    host.render(Viewer); host.effects(); await settle();
    tree = host.render(Viewer);
    assert.equal(band(tree).props.compact, true, 'at work the band folds');
    assert.match(title(tree), /Erding/);
    assert.equal(nodes(tree).find(n => n.props?.id === 'taper-place').props.value, '', 'the field is free for the next place');
    tree = await type('Achterwehr');
    assert.match(title(tree), /Erding/, 'the open place stays while the hits are shown');
    nodes(tree).find(n => n.props?.['data-taper-match'] === '').props.onClick();
    host.render(Viewer); host.effects(); await settle();
    assert.match(title(host.render(Viewer)), /Achterwehr/);
  } finally { host.unmount(); }
});
