import assert from 'node:assert/strict';
import test from 'node:test';
import { hookHost, nodes, button } from './testHooks';
test('city-name result asks actual postcode; explicit postcode result preserves its locality', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const original = globalThis.fetch;
  const selected: any[] = [];
  const host = hookHost(() => ({ setPlace: (place: unknown) => selected.push(place), skipPlace() {} }));
  const Picker = host.load<{ default: () => any }>('./PlacePicker.tsx').default;
  let responseQuery = 'Ingolstadt';
  globalThis.fetch = async () => Response.json({ query: responseQuery, matches: [{
    ags: '09161000', name: 'Ingolstadt', kind: 'Stadt', land: 'Bayern', kreis: 'Ingolstadt', plz_count: 6,
    plz: responseQuery === 'Ingolstadt' ? '85047' : '85049',
  }], court_register_only: [] });
  try {
    let tree = host.render(Picker); host.effects();
    nodes(tree).find(n => n.type === 'input').props.onChange({ target: { value: 'Ingolstadt' } });
    tree = host.render(Picker); host.effects(); t.mock.timers.tick(250);
    await new Promise<void>(resolve => setImmediate(resolve));
    tree = host.render(Picker);
    nodes(tree).find(n => n.type === 'button' && n.props.className.includes('sntiq-radio-card')).props.onClick();
    tree = host.render(Picker);
    assert.equal(selected.length, 0, 'minimum postcode from name query is not chosen');
    assert.ok(nodes(tree).some(n => n.props?.id === 'chamfer-plz'), 'ask actual postcode');
    nodes(tree).find(n => n.props?.id === 'chamfer-plz').props.onChange({ target: { value: '85049' } });
    tree = host.render(Picker);
    responseQuery = '85049';
    await button(tree, 'common.next').props.onClick();
    assert.equal(selected[0].plz, '85049');
    assert.equal(selected[0].name, 'Ingolstadt');
  } finally { host.unmount(); globalThis.fetch = original; }
});

