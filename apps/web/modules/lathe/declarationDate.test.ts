import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialData } from './wizard';
import { formReducer } from './components/FormContext';
import { isPastGermanDate } from './validation';

const lateNightUtc = new Date('2026-11-24T23:30:00Z'); // 25.11. in Berlin

test('the signing date starts as today in Berlin and is marked automatic', () => {
  const data = createInitialData(lateNightUtc);
  assert.equal(data.declaration.date, '25.11.2026');
  assert.equal(data.declaration.dateIsAuto, true);
});

test('an automatic date moves to the new day; a date the person chose stays', () => {
  const auto = createInitialData(lateNightUtc);
  const next = formReducer(auto, { type: 'REFRESH_AUTO_DATE', date: '26.11.2026' });
  assert.equal(next.declaration.date, '26.11.2026');

  const chosen = formReducer(auto, { type: 'UPDATE_FIELD', path: 'declaration.date', value: '20.11.2026' });
  assert.equal(chosen.declaration.dateIsAuto, false);
  assert.equal(formReducer(chosen, { type: 'REFRESH_AUTO_DATE', date: '26.11.2026' }).declaration.date, '20.11.2026');
});

test('"not in the future" is judged against the Berlin date', () => {
  assert.equal(isPastGermanDate('25.11.2026', '25.11.2026'), true);
  assert.equal(isPastGermanDate('26.11.2026', '25.11.2026'), false);
  assert.equal(isPastGermanDate('31.12.1999', '25.11.2026'), true);
});
