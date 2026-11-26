import assert from 'node:assert/strict';
import test from 'node:test';
import * as workspace from './readerWorkspace';

test('splits only the chosen leaf, retaining the orientation of its siblings', () => {
  let state = workspace.createWorkspace();
  state = workspace.workspaceReducer(state, { type: 'split', layout: 'columns' });
  state = workspace.workspaceReducer(state, { type: 'split', paneId: 'p2', layout: 'rows' });
  assert.deepEqual(state.tiles, { axis: 'columns', ratio: 0.5, first: { paneId: 'p1' },
    second: { axis: 'rows', ratio: 0.5, first: { paneId: 'p2' }, second: { paneId: 'p3' } } });
  assert.deepEqual(workspace.decodeWorkspace(workspace.encodeWorkspace(state))?.tiles, state.tiles);
});

test('ratios survive sharing and close collapses the empty branch without losing tabs', () => {
  let state = workspace.workspaceReducer(workspace.createWorkspace(), { type: 'open', actId: 'fed_bgb', mode: 'new' });
  state = workspace.workspaceReducer(state, { type: 'split', layout: 'columns' });
  state = workspace.workspaceReducer(state, { type: 'split', paneId: 'p2', layout: 'rows' });
  state = workspace.workspaceReducer(state, { type: 'resize-tile', path: '1', ratio: 0.65 });
  assert.equal((state.tiles as any).second.ratio, 0.65);
  assert.deepEqual(workspace.decodeWorkspace(workspace.encodeWorkspace(state))?.tiles, state.tiles);
  state = workspace.workspaceReducer(state, { type: 'close-pane', paneId: 'p3' });
  assert.deepEqual(state.tiles, { axis: 'columns', ratio: 0.5, first: { paneId: 'p1' }, second: { paneId: 'p2' } });
  assert.equal(state.panes.flatMap(pane => pane.tabs).length, 3);
});

test('untrusted layouts cannot omit, repeat or invent panes or use unbounded ratios', () => {
  const state = workspace.workspaceReducer(workspace.createWorkspace(), { type: 'split' });
  const raw = JSON.parse(decodeURIComponent(workspace.encodeWorkspace(state).slice(8)));
  for (const tiles of [
    { paneId: 'p1' }, { paneId: 'p9' },
    { axis: 'columns', ratio: 0.5, first: { paneId: 'p1' }, second: { paneId: 'p1' } },
    { axis: 'columns', ratio: -1, first: { paneId: 'p1' }, second: { paneId: 'p2' } },
  ]) assert.equal(workspace.decodeWorkspace('#reader=' + encodeURIComponent(JSON.stringify({ ...raw, tiles }))), null);
});

test('tab modes and pin survive share links and bulk close preserves pinned tabs', () => {
  let state = workspace.workspaceReducer(workspace.createWorkspace(), { type: 'open', actId: 'fed_bgb', mode: 'new' });
  state = workspace.workspaceReducer(state, { type: 'pin-tab', paneId: 'p1', tabId: 't1' });
  state = workspace.workspaceReducer(state, { type: 'open', actId: 'fed_sgb_12', mode: 'new' });
  state = workspace.workspaceReducer(state, { type: 'set-view', paneId: 'p1', tabId: 't2', view: 'diff' });
  assert.equal(state.panes[0].tabs[1].view, 'diff');
  assert.deepEqual(workspace.decodeWorkspace(workspace.encodeWorkspace(state))?.panes, state.panes);
  state = workspace.workspaceReducer(state, { type: 'close-others', paneId: 'p1', tabId: 't2' });
  assert.equal(state.panes[0].tabs.length, 2);
});

test('comparison dates and mode survive sharing, splitting and navigating within the law', () => {
  let state = workspace.workspaceReducer(workspace.createWorkspace(), { type: 'open', actId: 'fed_bgb', mode: 'new' });
  const comparison = { from: '2026-07-06', to: 'HEAD', split: true };
  state = workspace.workspaceReducer(state, { type: 'set-comparison', paneId: 'p1', tabId: 't1', comparison });
  assert.deepEqual(state.panes[0].tabs[0].comparison, comparison);
  state = workspace.workspaceReducer(state, { type: 'open', actId: 'fed_bgb', norm: '§ 1', mode: 'replace' });
  assert.deepEqual(state.panes[0].tabs[0].comparison, comparison);
  state = workspace.workspaceReducer(state, { type: 'split' });
  assert.deepEqual(state.panes[1].tabs[0].comparison, comparison);
  assert.deepEqual(workspace.decodeWorkspace(workspace.encodeWorkspace(state))?.panes, state.panes);
  const invalid = { ...comparison, from: '2026-02-31' };
  assert.equal(workspace.workspaceReducer(state, { type: 'set-comparison', paneId: 'p1', tabId: 't1', comparison: invalid }), state);
  const raw = JSON.parse(decodeURIComponent(workspace.encodeWorkspace(state).slice(8)));
  raw.panes[0].tabs[0].comparison = invalid;
  assert.equal(workspace.decodeWorkspace('#reader=' + encodeURIComponent(JSON.stringify(raw))), null);
});

test('provision comparison shares exact version IDs and does not follow a different provision or checkout', () => {
  const tab = { paneId: 'p1', tabId: 't1' };
  const open = (norm: string | null) => ({ type: 'open' as const, actId: 'fed_sgb_8', norm, mode: 'replace' as const });
  const selected = workspace.workspaceReducer(workspace.createWorkspace(), open('§ 42'));
  const comparison = { kind: 'norm' as const, from: 'de/bund/sgb_8/para/42@1991-01-01#6aa5ace13986', to: 'de/bund/sgb_8/para/42@1993-04-01#d3c3d367d24d', split: true };
  const state = workspace.workspaceReducer(selected, { type: 'set-comparison', ...tab, comparison });
  assert.deepEqual(workspace.decodeWorkspace(workspace.encodeWorkspace(state))?.panes[0].tabs[0].comparison, comparison);
  assert.equal(workspace.workspaceReducer(state, open('§ 41')).panes[0].tabs[0].comparison, undefined);
  assert.equal(workspace.workspaceReducer(state, open(null)).panes[0].tabs[0].comparison, undefined);
  const dated = workspace.workspaceReducer(state, { type: 'set-version', ...tab, at: '1991-01-01' });
  assert.equal(dated.panes[0].tabs[0].comparison, undefined);
  const whole = workspace.workspaceReducer(state, open(null));
  assert.equal(workspace.workspaceReducer(whole, { type: 'set-comparison', ...tab, comparison }), whole);
});
