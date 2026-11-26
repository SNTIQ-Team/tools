import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { hookHost, nodes, button } from '../chamfer/components/testHooks';

test('Git Log retries a transient outage and leaves other lanes usable after a lane failure', async () => {
  const require = createRequire(import.meta.url);
  const originalCss = require.extensions['.css'];
  require.extensions['.css'] = module => { module.exports = {}; };
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  globalThis.window = { addEventListener() {}, removeEventListener() {} } as any;
  const host = hookHost(() => ({ register() {}, unregister() {} }));
  const Viewer = host.load<any>('../../kerf/KerfModule.tsx').default;
  const requests: string[] = [];
  globalThis.fetch = async input => {
    const url = new URL(String(input), 'https://synthetic.test');
    if (url.pathname.endsWith('/git')) {
      const lane = url.searchParams.get('lane') ?? 'all';
      requests.push(lane);
      if (requests.length === 1 || lane === '0') return new Response('', { status: 503 });
      return Response.json({ lanes: ['EU', 'Bund'], total: 0, commits: [] });
    }
    return Response.json(url.pathname.endsWith('/acts') ? [] : {});
  };
  const settle = () => new Promise<void>(resolve => setImmediate(resolve));
  const panel = (tree: any) => nodes(tree).find(node => node.props?.onLane);
  // Render the actual tab and its error child after its parent's hook slots.
  const tabTree = (tree: any) => {
    const child = panel(tree);
    const rendered = child.type(child.props);
    return [rendered, ...nodes(rendered)
      .filter(node => typeof node.type === 'function' && node.type.name === 'LoadError')
      .map(node => node.type(node.props))];
  };
  try {
    let tree = host.render(Viewer); host.effects(); await settle();
    nodes(tree).find(node => node.type === 'button' && node.props.title?.includes('tab.gitlog')).props.onClick();
    tree = host.render(Viewer); host.effects(); await settle();
    tree = host.render(Viewer); host.effects();
    assert.equal(panel(tree).props.error, true);
    const retry = button(tabTree(tree), 'Retry');
    assert.ok(retry, 'a failed Git Log must offer an in-place retry');
    retry.props.onClick();
    tree = host.render(Viewer); host.effects(); await settle();
    tree = host.render(Viewer); host.effects();
    assert.equal(panel(tree).props.error, false);
    assert.ok(panel(tree).props.git);
    assert.deepEqual(requests, ['all', 'all']);

    const laneButton = (rendered: any, name: string) => nodes(rendered).find(node =>
      node.type === 'button' && Array.isArray(node.props.children) && node.props.children.includes(name));
    laneButton(tabTree(tree), 'EU').props.onClick();
    tree = host.render(Viewer); host.effects(); await settle();
    tree = host.render(Viewer); host.effects();
    assert.equal(panel(tree).props.error, true);
    const otherLane = laneButton(tabTree(tree), 'Bund');
    assert.ok(otherLane, 'a failed lane must not hide the other lane controls');
    otherLane.props.onClick();
    tree = host.render(Viewer); host.effects(); await settle();
    tree = host.render(Viewer); host.effects();
    assert.equal(panel(tree).props.error, false);
    assert.equal(panel(tree).props.lane, 1);
    assert.ok(panel(tree).props.git);
    assert.deepEqual(requests, ['all', 'all', '0', '1']);
  } finally {
    host.unmount(); globalThis.fetch = originalFetch; globalThis.window = originalWindow;
    if (originalCss) require.extensions['.css'] = originalCss;
    else delete require.extensions['.css'];
  }
});
