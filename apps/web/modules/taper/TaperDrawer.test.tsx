import assert from 'node:assert/strict';
import test from 'node:test';
import { hookHost, nodes } from '../chamfer/components/testHooks';

test('closed or superseded authority requests cannot replace a new drawer or its navigation trail', async () => {
  const original = globalThis.fetch;
  const pending = new Map<number, { resolve: (value: Response) => void; signal?: AbortSignal }>();
  const host = hookHost(() => ({ register() {}, unregister() {} }));
  const Viewer = host.load<any>('../../taper/TaperModule.tsx').default;
  globalThis.fetch = async (input, options) => {
    const id = Number(String(input).split('/').at(-1));
    return new Promise<Response>(resolve => pending.set(id, { resolve, signal: options?.signal ?? undefined }));
  };
  const settle = () => new Promise<void>(resolve => setImmediate(resolve));
  const detail = (id: number) => ({ id, kind: 'court', name: `Court ${id}`, related: [], related_incoming: [], street: null, plz: null, city: null,
    postal_address: null, phone: null, fax: null, email: null, web: null, external_ids: {}, provenance: { source: 'synthetic', url: null, fetched_at: '2026-09-30' } });
  const drawer = (tree: any) => nodes(tree).find(n => Array.isArray(n.props?.stack));
  try {
    let tree = host.render(Viewer); host.effects();
    nodes(tree).find(n => n.type === 'button' && JSON.stringify(n.props.children).includes('germanyBtn')).props.onClick(); tree = host.render(Viewer);
    const inspect = nodes(tree).find(n => n.props?.onInspect).props.onInspect;
    inspect(1); tree = host.render(Viewer);
    drawer(tree).props.onClose();
    inspect(2); tree = host.render(Viewer);
    pending.get(2)!.resolve(Response.json(detail(2))); await settle();
    pending.get(1)!.resolve(Response.json(detail(1))); await settle(); tree = host.render(Viewer);
    assert.deepEqual(drawer(tree).props.stack.map((n: any) => n.id), [2], 'late closed-drawer result must not appear in a new trail');
    assert.equal(pending.get(1)?.signal?.aborted, true);
    drawer(tree).props.onOpen(3); tree = host.render(Viewer);
    drawer(tree).props.onOpen(4); tree = host.render(Viewer);
    pending.get(3)!.resolve(Response.json(detail(3))); await settle(); tree = host.render(Viewer);
    assert.equal(drawer(tree).props.loading, true, 'old completion must not hide the current request spinner');
    pending.get(4)!.resolve(Response.json(detail(4))); await settle(); tree = host.render(Viewer);
    assert.deepEqual(drawer(tree).props.stack.map((n: any) => n.id), [2, 4]);
    drawer(tree).props.onOpen(5); tree = host.render(Viewer);
    drawer(tree).props.onBack();
    pending.get(5)!.resolve(Response.json(detail(5))); await settle(); tree = host.render(Viewer);
    assert.deepEqual(drawer(tree).props.stack.map((n: any) => n.id), [2], 'Back must cancel pending forward navigation');
  } finally { host.unmount(); globalThis.fetch = original; }
});
