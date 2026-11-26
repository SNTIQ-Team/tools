import React from 'react';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { renderToStaticMarkup } from 'react-dom/server';
import type { KerfActArchive } from './client';

const require = createRequire(import.meta.url);
require.extensions['.css'] = module => { module.exports = {}; };

const archive = { head_date: '2026-09-26', entries: [], retrospective: {
  intervals: [], events: [], observations: [
    { observed_at: '2026-07-06', state_sha256: 'first' },
    { observed_at: '2026-07-07', state_sha256: 'first' },
    { observed_at: '2026-08-01', state_sha256: 'second' },
  ],
} } as unknown as KerfActArchive;

test('comparison preserves a dated document whose observation was deduplicated in the edition menu', async () => {
  const { default: ReaderComparison } = await import('./ReaderComparison');
  const html = renderToStaticMarkup(<ReaderComparison actId="law" norm="§ 1" at="2026-07-07" archive={archive} language="en" onChange={() => {}} />);
  const selects = [...html.matchAll(/<select\b[^>]*>(.*?)<\/select>/g)].map(match => match[1]);
  assert.match(selects[1], /<option[^>]*value="2026-07-07"[^>]*selected=""/);
  assert.doesNotMatch(selects[1], /<option[^>]*value="HEAD"[^>]*selected=""/);
});

test('comparison preserves both explicit deep-link dates even between indexed edition days', async () => {
  const { default: ReaderComparison } = await import('./ReaderComparison');
  const html = renderToStaticMarkup(<ReaderComparison actId="law" norm={null} archive={archive} language="en"
    value={{ from: '2026-07-07', to: '2026-07-12', split: true }} onChange={() => {}} />);
  const selects = [...html.matchAll(/<select\b[^>]*>(.*?)<\/select>/g)].map(match => match[1]);
  assert.match(selects[0], /<option[^>]*value="2026-07-07"[^>]*selected=""/);
  assert.match(selects[1], /<option[^>]*value="2026-07-12"[^>]*selected=""/);
});

test('an unavailable explicitly requested edition is shown without silently comparing another date', async () => {
  const { default: ReaderComparison } = await import('./ReaderComparison');
  const html = renderToStaticMarkup(<ReaderComparison actId="law" norm={null} archive={archive} language="en"
    value={{ from: '2026-07-06', to: '2027-01-01', split: false }} onChange={() => {}} />);
  const selects = [...html.matchAll(/<select\b[^>]*>(.*?)<\/select>/g)].map(match => match[1]);
  const selected = selects[1].match(/<option[^>]*value="2027-01-01"[^>]*selected=""[^>]*>/)?.[0];
  assert.ok(selected);
  assert.match(selected, /disabled=""/);
});

test('the default archive comparison starts with the nearest preceding edition', async () => {
  const { default: ReaderComparison } = await import('./ReaderComparison');
  const html = renderToStaticMarkup(<ReaderComparison actId="law" norm={null} archive={archive} language="en" onChange={() => {}} />);
  const selects = [...html.matchAll(/<select\b[^>]*>(.*?)<\/select>/g)].map(match => match[1]);
  assert.match(selects[0], /<option[^>]*value="2026-08-01"[^>]*selected=""/);
  assert.match(selects[1], /<option[^>]*value="HEAD"[^>]*selected=""/);
});
