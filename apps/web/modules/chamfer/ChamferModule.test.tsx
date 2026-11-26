import './components/cssStub';
import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ModuleActionsProvider } from '@/core/shell/ModuleActions';
import ChamferModule from './ChamferModule';

test('Chamfer opens on its module band: the name is the page heading', () => {
  const html = renderToStaticMarkup(<ModuleActionsProvider><ChamferModule /></ModuleActionsProvider>);
  assert.match(html, /data-size="module"[^>]*data-preset="chamfer"|data-preset="chamfer"[^>]*data-size="module"/);
  assert.match(html, /<h1[^>]*>Chamfer<\/h1>/);
  assert.doesNotMatch(html, /data-compact="true"/, 'open on entry');
  assert.match(html, /data-module="chamfer"/);
});
