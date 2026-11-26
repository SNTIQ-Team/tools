import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_READER_PANES, MAX_READER_TABS, createWorkspace, decodeWorkspace,
  encodeWorkspace, readerDocKey, workspaceReducer,
  type ReaderWorkspace, type ReaderWorkspaceAction,
} from './readerWorkspace';

const open = (state: ReaderWorkspace, actId: string, norm: string | null = null, paneId?: string) =>
  workspaceReducer(state, { type: 'open', actId, norm, paneId, mode: 'new' });

const docs = (state: ReaderWorkspace) => state.panes.flatMap((pane) => pane.tabs.map((tab) => tab.actId));
const tabs = (state: ReaderWorkspace) => state.panes.flatMap((pane) => pane.tabs);
const hashFor = (value: unknown) => `#reader=${encodeURIComponent(JSON.stringify(value))}`;
const snapshot = (state: ReaderWorkspace) => JSON.parse(JSON.stringify({
  version: state.version, panes: state.panes, activePaneId: state.activePaneId, layout: state.layout,
}));

function invariants(state: ReaderWorkspace) {
  assert.equal(state.version, 1);
  assert.ok(state.panes.length >= 1 && state.panes.length <= MAX_READER_PANES);
  assert.ok(tabs(state).length <= MAX_READER_TABS);
  assert.equal(new Set(state.panes.map((pane) => pane.id)).size, state.panes.length);
  assert.equal(new Set(tabs(state).map((tab) => tab.id)).size, tabs(state).length);
  assert.ok(state.panes.some((pane) => pane.id === state.activePaneId));
  for (const pane of state.panes) {
    assert.equal(pane.tabs.length === 0, pane.activeTabId === null);
    if (pane.tabs.length) assert.ok(pane.tabs.some((tab) => tab.id === pane.activeTabId));
  }
  assert.ok(['columns', 'rows'].includes(state.layout));
}

test('starts with one independent empty pane and opens without mutating previous state', () => {
  const initial = createWorkspace();
  const before = JSON.stringify(initial);
  assert.deepEqual(snapshot(initial), {
    version: 1, panes: [{ id: 'p1', tabs: [], activeTabId: null }], activePaneId: 'p1', layout: 'columns',
  });
  assert.notEqual(initial.panes, createWorkspace().panes);
  const state = open(initial, 'sgb_12', '11');
  assert.equal(JSON.stringify(initial), before);
  assert.deepEqual(state.panes[0].tabs, [{ id: 't1', actId: 'sgb_12', norm: '11' }]);
  assert.equal(state.panes[0].activeTabId, 't1');
  invariants(state);
});

test('new opens activate existing documents only within their target pane', () => {
  let state = open(createWorkspace(), 'sgb_12', '11');
  state = open(state, 'sgb_2', '22');
  state = open(state, 'sgb_12', '11');
  assert.equal(tabs(state).length, 2);
  assert.equal(state.panes[0].activeTabId, 't1');
  state = workspaceReducer(state, { type: 'split' });
  assert.deepEqual(state.panes.map((pane) => pane.tabs.map((tab) => tab.id)), [['t1', 't2'], ['t3']]);
  assert.equal(state.activePaneId, 'p2');
  state = open(state, 'sgb_12', '11', 'p1');
  assert.equal(tabs(state).length, 3);
  assert.equal(state.activePaneId, 'p1');
  assert.equal(state.panes[1].tabs[0].actId, 'sgb_12');
});

test('replace navigates the active tab without changing identity or sibling documents', () => {
  let state = open(open(createWorkspace(), 'sgb_12', '10'), 'bgb', '1');
  state = workspaceReducer(state, { type: 'activate', paneId: 'p1', tabId: 't1' });
  state = workspaceReducer(state, { type: 'open', mode: 'replace', actId: 'sgb_12', norm: '11' });
  assert.deepEqual(state.panes[0].tabs, [
    { id: 't1', actId: 'sgb_12', norm: '11' }, { id: 't2', actId: 'bgb', norm: '1' },
  ]);
  state = workspaceReducer(state, { type: 'open', mode: 'replace', actId: 'sgb_12', norm: '10' });
  assert.equal(state.panes[0].tabs[0].norm, '10');
  assert.equal(state.closedTabs?.length, 0);
  assert.equal(workspaceReducer(createWorkspace(), { type: 'open', mode: 'replace', actId: 'bgb' }).panes[0].tabs.length, 1);
});

test('closing active tabs selects the right neighbour, then left, then an empty pane', () => {
  let state = open(open(open(createWorkspace(), 'a'), 'b'), 'c');
  state = workspaceReducer(state, { type: 'activate', paneId: 'p1', tabId: 't2' });
  state = workspaceReducer(state, { type: 'close-tab', paneId: 'p1', tabId: 't2' });
  assert.equal(state.panes[0].activeTabId, 't3');
  state = workspaceReducer(state, { type: 'close-tab', paneId: 'p1', tabId: 't3' });
  assert.equal(state.panes[0].activeTabId, 't1');
  state = workspaceReducer(state, { type: 'close-tab', paneId: 'p1', tabId: 't1' });
  assert.equal(state.panes[0].activeTabId, null);
  assert.equal(state.panes.length, 1);
  state = workspaceReducer(state, { type: 'reopen' });
  assert.deepEqual(docs(state), ['a']);
  assert.equal(state.panes[0].activeTabId, 't1');
  state = workspaceReducer(state, { type: 'reopen' });
  state = workspaceReducer(state, { type: 'reopen' });
  assert.deepEqual(docs(state), ['a', 'b', 'c']);
  assert.equal(state.panes[0].activeTabId, 't2');
  invariants(state);
});

test('closing a pane merges every tab into its neighbour and never removes the last pane', () => {
  let state = open(open(createWorkspace(), 'a'), 'b');
  state = workspaceReducer(state, { type: 'split' });
  state = open(state, 'c');
  const originalIds = tabs(state).map((tab) => tab.id).sort();
  state = workspaceReducer(state, { type: 'close-pane', paneId: 'p2' });
  assert.deepEqual(docs(state), ['a', 'b', 'b', 'c']);
  assert.deepEqual(tabs(state).map((tab) => tab.id).sort(), originalIds);
  assert.equal(state.panes[0].activeTabId, 't4');
  assert.equal(state.activePaneId, 'p1');
  assert.equal(workspaceReducer(state, { type: 'close-pane', paneId: 'p1' }), state);
  state = workspaceReducer(state, { type: 'split' });
  state = workspaceReducer(state, { type: 'activate', paneId: 'p1', tabId: 't1' });
  state = workspaceReducer(state, { type: 'close-pane', paneId: 'p2' });
  assert.equal(state.panes[0].activeTabId, 't1', 'closing an inactive pane must preserve focused document');
  invariants(state);
});

test('moving the final tab leaves a usable empty pane and preserves tab identity', () => {
  let state = workspaceReducer(open(createWorkspace(), 'a'), { type: 'split' });
  state = workspaceReducer(state, { type: 'move-tab', fromPaneId: 'p1', toPaneId: 'p2', tabId: 't1', index: 0 });
  assert.deepEqual(state.panes[0].tabs, []);
  assert.equal(state.panes[0].activeTabId, null);
  assert.deepEqual(state.panes[1].tabs.map((tab) => tab.id), ['t1', 't2']);
  assert.equal(state.panes[1].activeTabId, 't1');
  assert.equal(state.activePaneId, 'p2');
  state = workspaceReducer(state, { type: 'reorder-tab', paneId: 'p2', tabId: 't1', index: 1 });
  assert.deepEqual(state.panes[1].tabs.map((tab) => tab.id), ['t2', 't1']);
  assert.equal(state.panes[1].activeTabId, 't1');
  state = workspaceReducer(state, { type: 'move-tab', fromPaneId: 'p2', toPaneId: 'p2', tabId: 't1', index: 0 });
  assert.deepEqual(state.panes[1].tabs.map((tab) => tab.id), ['t1', 't2']);
  invariants(state);
});

test('undo restores to the original pane or active pane after its original pane was removed', () => {
  let state = workspaceReducer(open(createWorkspace(), 'a'), { type: 'split' });
  state = workspaceReducer(state, { type: 'close-tab', paneId: 'p2', tabId: 't2' });
  state = workspaceReducer(state, { type: 'close-pane', paneId: 'p2' });
  state = workspaceReducer(state, { type: 'reopen' });
  assert.deepEqual(state.panes[0].tabs.map((tab) => tab.id), ['t2', 't1']);
  assert.equal(state.panes[0].activeTabId, 't2');
  invariants(state);
});

test('pane and tab limits refuse operations atomically without silently dropping documents', () => {
  let state = createWorkspace();
  for (let index = 0; index < MAX_READER_TABS; index++) state = open(state, `act-${index}`);
  assert.equal(tabs(state).length, 24);
  assert.equal(open(state, 'overflow'), state);
  assert.equal(workspaceReducer(state, { type: 'split' }), state);
  state = workspaceReducer(state, { type: 'close-tab', paneId: 'p1', tabId: 't1' });
  state = open(state, 'replacement');
  assert.equal(workspaceReducer(state, { type: 'reopen' }), state);
  assert.equal(state.closedTabs?.length, 1, 'blocked undo remains available');
  const replaced = workspaceReducer(state, { type: 'open', mode: 'replace', actId: 'new-current' });
  assert.equal(tabs(replaced).length, 24);
  assert.ok(docs(replaced).includes('new-current'));
  state = createWorkspace();
  for (let index = 1; index < MAX_READER_PANES; index++) state = workspaceReducer(state, { type: 'split', layout: 'rows' });
  assert.equal(state.panes.length, 4);
  assert.equal(state.layout, 'rows');
  assert.equal(workspaceReducer(state, { type: 'split', layout: 'columns' }), state);
  assert.equal(state.layout, 'rows', 'failed splits cannot partially change the layout');
});

test('invalid targets, indices and documents are no-ops', () => {
  const state = open(createWorkspace(), 'a');
  const actions: ReaderWorkspaceAction[] = [
    { type: 'activate', paneId: 'unknown' },
    { type: 'activate', paneId: 'p1', tabId: 'unknown' },
    { type: 'open', mode: 'new', paneId: 'unknown', actId: 'a' },
    { type: 'open', mode: 'new', actId: '' },
    { type: 'open', mode: 'new', actId: 'a\nmalformed' },
    { type: 'open', mode: 'new', actId: '\ud800' },
    { type: 'close-tab', paneId: 'p1', tabId: 'unknown' },
    { type: 'close-pane', paneId: 'unknown' },
    { type: 'reorder-tab', paneId: 'p1', tabId: 't1', index: -1 },
    { type: 'reorder-tab', paneId: 'p1', tabId: 't1', index: Infinity },
    { type: 'move-tab', fromPaneId: 'p1', toPaneId: 'unknown', tabId: 't1' },
    { type: 'split', paneId: 'unknown' },
  ];
  for (const action of actions) assert.equal(workspaceReducer(state, action), state, JSON.stringify(action));
});

test('shared links retain Unicode documents, pane order, active tabs and layout but omit undo', () => {
  let state = open(open(createWorkspace(), 'gesetz-\u00fcber-\u00a7', '\u00a7 11 / \u041f\u0440\u0430\u0432\u043e'), 'bgb', '1');
  state = workspaceReducer(state, { type: 'split', layout: 'rows' });
  state = workspaceReducer(state, { type: 'close-tab', paneId: 'p1', tabId: 't2' });
  state = workspaceReducer(state, { type: 'activate', paneId: 'p1', tabId: 't1' });
  const hash = encodeWorkspace(state);
  assert.ok(hash.startsWith('#reader='));
  assert.equal(decodeURIComponent(hash.slice(8)).includes('closedTabs'), false);
  const restored = decodeWorkspace(hash);
  assert.ok(restored);
  assert.deepEqual(snapshot(restored), snapshot(state));
  assert.equal(restored.closedTabs?.length ?? 0, 0);
  assert.equal(encodeWorkspace(restored), hash, 'serialization is canonical and stable');
  assert.notEqual(readerDocKey('a:b', 'c'), readerDocKey('a', 'b:c'));
  assert.equal(readerDocKey('x'), readerDocKey('x', null));
});

test('law and decision tabs with the same id are distinct and each kind deduplicates', () => {
  let state = open(createWorkspace(), 'same-id');
  state = workspaceReducer(state, { type: 'open', mode: 'new', actId: 'same-id', documentType: 'decision' });
  assert.equal(tabs(state).length, 2);
  assert.equal(tabs(state)[1].documentType, 'decision');
  const current = state;
  assert.equal(workspaceReducer(state, { type: 'open', mode: 'new', actId: 'same-id', documentType: 'decision' }), current);
  state = workspaceReducer(state, { type: 'open', mode: 'new', actId: 'same-id', documentType: 'law' });
  assert.equal(tabs(state).length, 2);
  assert.equal(state.panes[0].activeTabId, 't1');
  assert.equal(readerDocKey('same-id', null, 'law'), readerDocKey('same-id'));
  assert.notEqual(readerDocKey('same-id', null, 'decision'), readerDocKey('same-id'));
});

test('decision types survive replacement, pane operations, undo and share links', () => {
  let state = workspaceReducer(open(createWorkspace(), 'law'), { type: 'open', mode: 'replace', actId: 'decision-1', documentType: 'decision' });
  assert.deepEqual(tabs(state), [{ id: 't1', actId: 'decision-1', norm: null, documentType: 'decision' }]);
  state = workspaceReducer(state, { type: 'split' });
  state = workspaceReducer(state, { type: 'close-tab', paneId: 'p2', tabId: 't2' });
  state = workspaceReducer(state, { type: 'reopen' });
  state = workspaceReducer(state, { type: 'move-tab', fromPaneId: 'p2', toPaneId: 'p1', tabId: 't2' });
  assert.ok(tabs(state).every((tab) => tab.documentType === 'decision'));
  assert.deepEqual(snapshot(decodeWorkspace(encodeWorkspace(state))!), snapshot(state));
  state = workspaceReducer(state, { type: 'open', mode: 'replace', actId: 'law', norm: '§ 3' });
  assert.equal(tabs(state).find((tab) => tab.id === 't2')?.documentType, undefined);
  assert.equal(tabs(state).find((tab) => tab.id === 't2')?.norm, '§ 3');
  invariants(state);
});

test('typed documents keep strict schemas and old law links remain canonical', () => {
  const state = open(createWorkspace(), 'law');
  const oldHash = encodeWorkspace(state);
  const explicitLaw = snapshot(state);
  explicitLaw.panes[0].tabs[0].documentType = 'law';
  assert.equal(encodeWorkspace(decodeWorkspace(hashFor(explicitLaw))!), oldHash);
  for (const documentType of ['case', '', null, 1, {}, ['decision']]) {
    const invalid = snapshot(state);
    invalid.panes[0].tabs[0].documentType = documentType;
    assert.equal(decodeWorkspace(hashFor(invalid)), null);
    assert.equal(workspaceReducer(state, { type: 'open', mode: 'new', actId: 'x', documentType } as ReaderWorkspaceAction), state);
  }
  const decisionWithNorm = snapshot(state);
  decisionWithNorm.panes[0].tabs[0] = { ...decisionWithNorm.panes[0].tabs[0], documentType: 'decision', norm: '§ 3' };
  assert.equal(decodeWorkspace(hashFor(decisionWithNorm)), null);
  assert.equal(workspaceReducer(state, { type: 'open', mode: 'new', actId: 'x', documentType: 'decision', norm: '§ 3' }), state);
  assert.deepEqual(snapshot(decodeWorkspace(oldHash)!), snapshot(state));
});

test('share parser rejects malformed and hostile schemas without throwing or partially restoring', () => {
  const valid = snapshot(open(createWorkspace(), 'a'));
  const cases: unknown[] = [
    '', '#reader=%', '#reader=%ED%A0%80', '#reader=null', '#reader=[]', '#wrong=value',
    '#reader=' + 'x'.repeat(150_000), hashFor({ ...valid, version: 2 }),
    hashFor({ ...valid, activePaneId: 'missing' }), hashFor({ ...valid, layout: 'grid' }),
    hashFor({ ...valid, panes: [] }), hashFor({ ...valid, extra: true }),
    hashFor({ ...valid, panes: [{ id: 'p1', tabs: [], activeTabId: 't1' }] }),
    hashFor({ ...valid, panes: [{ id: 'p1', tabs: [{ id: 't1', actId: 'a', norm: null }], activeTabId: null }] }),
    hashFor({ ...valid, panes: [{ id: 'p1', tabs: [{ id: '__proto__', actId: 'a', norm: null }], activeTabId: '__proto__' }] }),
    hashFor({ ...valid, panes: [{ id: 'p1', tabs: [{ id: 't1', actId: 'a', norm: {} }], activeTabId: 't1' }] }),
    hashFor({ ...valid, panes: [{ id: 'p1', tabs: [{ id: 't1', actId: 'x'.repeat(257), norm: null }], activeTabId: 't1' }] }),
    hashFor({ ...valid, panes: [{ id: 'p1', tabs: [{ id: 't1', actId: '\u0000', norm: null }], activeTabId: 't1' }] }),
    hashFor({ ...valid, panes: [{ id: 'p1', tabs: [{ id: 't1', actId: '\ud800', norm: null }], activeTabId: 't1' }] }),
    hashFor({ ...valid, panes: [...valid.panes, ...valid.panes] }),
    hashFor({ ...valid, panes: Array.from({ length: 5 }, (_, index) => ({ id: `p${index + 1}`, tabs: [], activeTabId: null })) }),
    hashFor({ ...valid, panes: [{ id: 'p1', tabs: Array.from({ length: 25 }, (_, index) => ({ id: `t${index + 1}`, actId: 'a', norm: null })), activeTabId: 't1' }] }),
    hashFor({ ...valid, panes: [...valid.panes, { ...valid.panes[0], id: 'p2' }] }),
    '#reader=' + encodeURIComponent('{"version":1,"__proto__":{"polluted":true},"panes":[],"activePaneId":"p1","layout":"rows"}'),
    hashFor({ ...valid, closedTabs: [] }),
    undefined, null, {}, 42,
  ];
  for (const value of cases) assert.equal(decodeWorkspace(value as string), null, String(value).slice(0, 140));
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
  assert.throws(() => encodeWorkspace({ ...valid, activePaneId: 'missing' }));
});

test('maximum-size Unicode workspace has a reversible share link', () => {
  let state = createWorkspace();
  for (let index = 0; index < MAX_READER_TABS; index++) {
    state = open(state, `${index}${'\u754c'.repeat(250)}`, '\u00a7'.repeat(128));
  }
  assert.equal(tabs(state).length, MAX_READER_TABS);
  assert.deepEqual(snapshot(decodeWorkspace(encodeWorkspace(state))!), snapshot(state));
});

test('deterministic mixed action sequences preserve invariants, existing state and share round trips', () => {
  let seed = 0x12345678;
  const pick = (length: number) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % length;
  };
  let state = createWorkspace();
  for (let index = 0; index < 1800; index++) {
    const pane = state.panes[pick(state.panes.length)];
    const target = state.panes[pick(state.panes.length)];
    const tab = pane.tabs[pick(Math.max(pane.tabs.length, 1))];
    const actions: ReaderWorkspaceAction[] = [
      { type: 'open', actId: `act-${pick(40)}`, norm: String(pick(20)), paneId: pane.id, mode: 'new' },
      { type: 'open', actId: `act-${pick(40)}`, paneId: pane.id, mode: 'replace' },
      { type: 'activate', paneId: pane.id, tabId: tab?.id },
      { type: 'close-tab', paneId: pane.id, tabId: tab?.id ?? 'missing' },
      { type: 'close-pane', paneId: pane.id },
      { type: 'reopen' },
      { type: 'reorder-tab', paneId: pane.id, tabId: tab?.id ?? 'missing', index: pick(Math.max(pane.tabs.length, 1)) },
      { type: 'move-tab', fromPaneId: pane.id, toPaneId: target.id, tabId: tab?.id ?? 'missing', index: pick(target.tabs.length + 1) },
      { type: 'split', paneId: pane.id, layout: pick(2) ? 'rows' : 'columns' },
      { type: 'set-layout', layout: pick(2) ? 'rows' : 'columns' },
    ];
    const action = actions[pick(actions.length)];
    const oldState = JSON.stringify(state);
    const next = workspaceReducer(state, action);
    assert.equal(JSON.stringify(state), oldState, `mutation at action ${index}`);
    assert.deepEqual(next, workspaceReducer(state, action), `nondeterministic action ${index}`);
    if (['close-pane', 'move-tab', 'reorder-tab', 'activate', 'set-layout'].includes(action.type)) {
      assert.deepEqual(tabs(next).map((item) => item.id).sort(), tabs(state).map((item) => item.id).sort(), `lost tab at action ${index}`);
    }
    state = next;
    invariants(state);
    assert.deepEqual(snapshot(decodeWorkspace(encodeWorkspace(state))!), snapshot(state));
  }
});
