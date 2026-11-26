import assert from 'node:assert/strict';
import test from 'node:test';
import { previewValues, previewWarnings, type Widget } from './previewState';

const widgets: Widget[] = [
  { id: '1R', field: 'Name', kind: 'text' },
  { id: '2R', field: 'Restschuld', kind: 'text' },
  { id: '3R', field: 'Restschuld', kind: 'text' },
  { id: '4R', field: 'B1 Nein', kind: 'checkbox' },
  { id: '5R', field: 'B1 Ja', kind: 'checkbox' },
];

test('every widget gets a value: filled, checked, or reset to empty', () => {
  const values = previewValues([{ op: 'text', field: 'Name', value: 'Muster' }, { op: 'check', field: 'B1 Nein' }], widgets);
  assert.deepEqual(Object.fromEntries(values), {
    '1R': { value: 'Muster' }, '2R': { value: '' }, '3R': { value: '' },
    '4R': { value: true }, '5R': { value: false },
  });
});

test('a field shown in two places gets the value in both', () => {
  const values = previewValues([{ op: 'text', field: 'Restschuld', value: '120,00' }], widgets);
  assert.equal(values.get('2R')?.value, '120,00');
  assert.equal(values.get('3R')?.value, '120,00');
});

test('warnings name fields the template lacks and fields with characters the font cannot print', () => {
  const ops = [
    { op: 'text', field: 'Name', value: 'Олег' },
    { op: 'text', field: 'Gibt es nicht', value: 'x' },
    { op: 'check', field: 'B1 Ja' },
  ] as const;
  const latinOnly = (cp: number) => cp < 0x400;
  assert.deepEqual(previewWarnings([...ops], widgets, latinOnly), ['UNSUPPORTED_CHARS:Name', 'Gibt es nicht']);
  assert.deepEqual(previewWarnings([...ops], widgets, null), ['Gibt es nicht'], 'no coverage data yet: only the structural warning');
});

test('spaces never count as unprintable', () => {
  assert.deepEqual(previewWarnings([{ op: 'text', field: 'Name', value: 'A B\nC' }], widgets, (cp) => cp > 32), []);
});
