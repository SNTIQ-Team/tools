import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspace, workspaceReducer, encodeWorkspace, decodeWorkspace, type ReaderAction } from './readerWorkspace';

test('each document retains its selected edition in shared and restored workspaces', () => {
  let state = workspaceReducer(createWorkspace(), { type: 'open', actId: 'fed_sgb_12', norm: '§ 11', mode: 'new' });
  state = workspaceReducer(state, { type: 'set-version', paneId: 'p1', tabId: 't1', at: '2026-07-06' } as ReaderAction);
  assert.equal((state.panes[0].tabs[0] as { at?: string }).at, '2026-07-06');
  assert.deepEqual(decodeWorkspace(encodeWorkspace(state))?.panes, state.panes);
  state = workspaceReducer(state, { type: 'open', actId: 'fed_sgb_12', norm: '§ 12', mode: 'replace' });
  assert.equal((state.panes[0].tabs[0] as { at?: string }).at, '2026-07-06');
  state = workspaceReducer(state, { type: 'open', actId: 'fed_gg', norm: null, mode: 'replace' });
  assert.equal((state.panes[0].tabs[0] as { at?: string }).at, undefined);
});

test('invalid dates and editions on decisions are rejected atomically', () => {
  const law = workspaceReducer(createWorkspace(), { type: 'open', actId: 'fed_sgb_12', mode: 'new' });
  for (const at of ['2026-02-30', '2026-13-01', '../secret', '', '2026-7-6']) {
    assert.equal(workspaceReducer(law, { type: 'set-version', paneId: 'p1', tabId: 't1', at } as ReaderAction), law);
  }
  const decision = workspaceReducer(createWorkspace(), { type: 'open', actId: 'case', documentType: 'decision', mode: 'new' });
  assert.equal(workspaceReducer(decision, { type: 'set-version', paneId: 'p1', tabId: 't1', at: '2026-07-06' } as ReaderAction), decision);
});

test('returning to HEAD removes the historic edition from the tab', () => {
  let state = workspaceReducer(createWorkspace(), { type: 'open', actId: 'fed_sgb_12', mode: 'new' });
  state = workspaceReducer(state, { type: 'set-version', paneId: 'p1', tabId: 't1', at: '2026-07-06' } as ReaderAction);
  state = workspaceReducer(state, { type: 'set-version', paneId: 'p1', tabId: 't1', at: 'HEAD' } as ReaderAction);
  assert.equal(Object.hasOwn(state.panes[0].tabs[0], 'at'), false);
});

test('opening an edition is atomic and keeps current and historical tabs independent', () => {
  let state = workspaceReducer(createWorkspace(), { type: 'open', actId: 'fed_sgb_12', norm: '§ 11', mode: 'new' });
  const head = state.panes[0].tabs[0];
  state = workspaceReducer(state, { type: 'open', actId: 'fed_sgb_12', norm: '§ 11', mode: 'new', at: '2026-07-06' } as ReaderAction);
  assert.equal(state.panes[0].tabs.length, 2);
  assert.deepEqual(state.panes[0].tabs[0], head);
  assert.equal(state.panes[0].tabs[1].at, '2026-07-06');
  assert.equal(state.panes[0].activeTabId, state.panes[0].tabs[1].id);
  const repeat = workspaceReducer(state, { type: 'open', actId: 'fed_sgb_12', norm: '§ 11', mode: 'new', at: '2026-07-06' } as ReaderAction);
  assert.equal(repeat, state);
  state = workspaceReducer(state, { type: 'open', actId: 'fed_sgb_12', norm: '§ 11', mode: 'new' });
  assert.equal(state.panes[0].activeTabId, head.id);
  assert.deepEqual(decodeWorkspace(encodeWorkspace(state))?.panes, state.panes);
});

test('explicit edition replacement works even for the active norm and HEAD clears its date', () => {
  let state = workspaceReducer(createWorkspace(), { type: 'open', actId: 'fed_sgb_12', norm: '§ 11', mode: 'new' });
  state = workspaceReducer(state, { type: 'open', actId: 'fed_sgb_12', norm: '§ 11', mode: 'replace', at: '2026-07-06' } as ReaderAction);
  assert.equal(state.panes[0].tabs[0].at, '2026-07-06');
  state = workspaceReducer(state, { type: 'open', actId: 'fed_sgb_12', norm: '§ 12', mode: 'replace' });
  assert.equal(state.panes[0].tabs[0].at, '2026-07-06');
  state = workspaceReducer(state, { type: 'open', actId: 'fed_sgb_12', norm: '§ 12', mode: 'replace', at: 'HEAD' } as ReaderAction);
  assert.equal(Object.hasOwn(state.panes[0].tabs[0], 'at'), false);
});

test('invalid and capacity-limited edition opens never change the active document', () => {
  let state = createWorkspace();
  for (let index = 0; index < 24; index++) state = workspaceReducer(state, { type: 'open', actId: `act_${index}`, mode: 'new' });
  const before = structuredClone(state);
  assert.equal(workspaceReducer(state, { type: 'open', actId: 'fed_bgb', norm: '§ 1', mode: 'new', at: '2026-07-06' } as ReaderAction), state);
  assert.deepEqual(state, before);
  for (const at of ['2026-02-30', '../secret', '', null, 123]) {
    assert.equal(workspaceReducer(state, { type: 'open', actId: 'act_0', mode: 'replace', at } as ReaderAction), state);
  }
  assert.equal(workspaceReducer(state, { type: 'open', actId: 'case', mode: 'replace', documentType: 'decision', at: '2026-07-06' } as ReaderAction), state);
});
