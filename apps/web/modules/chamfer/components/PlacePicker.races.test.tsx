import assert from 'node:assert/strict';
import test from 'node:test';
import { hookHost, nodes, button } from './testHooks';

test('editing postcode cancels its pending confirmation and only the newly confirmed value advances', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const original = globalThis.fetch;
  const selected: any[] = [];
  const host = hookHost(() => ({ setPlace: (place: unknown) => selected.push(place), skipPlace() {} }));
  const Picker = host.load<{ default: () => any }>('./PlacePicker.tsx').default;
  const municipality = { ags: '09161000', name: 'Ingolstadt', kind: 'Stadt', land: 'Bayern', kreis: 'Ingolstadt', plz_count: 6, plz: null };
  let releaseOld: (response: Response) => void = () => {};
  let oldSignal: AbortSignal | undefined;
  globalThis.fetch = async (input, options) => {
    const q = new URL(String(input), 'https://fixture.invalid').searchParams.get('q');
    if (q === '85049') {
      oldSignal = options?.signal ?? undefined;
      return new Promise<Response>(resolve => { releaseOld = resolve; });
    }
    return Response.json({ query: q, matches: [{ ...municipality, plz: q === '85051' ? q : null, explicit_postcode: q === '85051' }], court_register_only: [] });
  };
  const settle = () => new Promise<void>(resolve => setImmediate(resolve));
  try {
    let tree = host.render(Picker); host.effects();
    nodes(tree).find(n => n.type === 'input').props.onChange({ target: { value: 'Ingolstadt' } });
    host.render(Picker); host.effects(); t.mock.timers.tick(250); await settle();
    tree = host.render(Picker);
    nodes(tree).find(n => n.type === 'button' && n.props.className.includes('sntiq-radio-card')).props.onClick();
    host.render(Picker); host.effects(); tree = host.render(Picker);
    nodes(tree).find(n => n.props?.id === 'chamfer-plz').props.onChange({ target: { value: '85049' } });
    tree = host.render(Picker);
    const pending = button(tree, 'common.next').props.onClick();
    tree = host.render(Picker);
    nodes(tree).find(n => n.props?.id === 'chamfer-plz').props.onChange({ target: { value: '85051' } });
    releaseOld(Response.json({ query: '85049', matches: [{ ...municipality, plz: '85049', explicit_postcode: true }] }));
    await pending; await settle(); tree = host.render(Picker);
    assert.deepEqual(selected, [], 'an obsolete postcode response must not advance the wizard');
    assert.equal(oldSignal?.aborted, true, 'editing releases the obsolete request');
    assert.equal(button(tree, 'common.next').props.disabled, false);
    await button(tree, 'common.next').props.onClick();
    assert.equal(selected[0].plz, '85051');
  } finally { host.unmount(); globalThis.fetch = original; }
});
