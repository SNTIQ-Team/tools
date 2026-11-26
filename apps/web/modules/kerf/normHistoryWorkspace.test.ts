import assert from 'node:assert/strict';
import test from 'node:test';
import * as workspace from './readerWorkspace';
import { readerShortcut } from './readerShortcuts';

test('the norm versions view persists in the shared workspace link', () => {
  let state = workspace.workspaceReducer(workspace.createWorkspace(), { type: 'open', actId: 'fed_sgb_14', norm: '§ 37', mode: 'new' });
  state = workspace.workspaceReducer(state, { type: 'set-view', paneId: 'p1', tabId: 't1', view: 'versions' });
  assert.equal(state.panes[0].tabs[0].view, 'versions');
  const decoded = workspace.decodeWorkspace(workspace.encodeWorkspace(state));
  assert.equal(decoded?.panes[0].tabs[0].view, 'versions');
  // Unknown views are still rejected by the strict decoder.
  const raw = JSON.parse(decodeURIComponent(workspace.encodeWorkspace(state).slice(8)));
  raw.panes[0].tabs[0].view = 'blame-everything';
  assert.equal(workspace.decodeWorkspace('#reader=' + encodeURIComponent(JSON.stringify(raw))), null);
});

test('Alt+Shift+V opens the versions view', () => {
  assert.equal(readerShortcut({ key: 'V', altKey: true, shiftKey: true }, false), 'versions');
});
