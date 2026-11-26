import assert from 'node:assert/strict';
import test from 'node:test';
import { monthsSince, profileComplete, todayISO } from './logic';

// The device is in Los Angeles; in Berlin it is already the next day.
const lateEvening = new Date('2026-11-25T07:30:00Z'); // 25.11. 08:30 Berlin, 24.11. 23:30 LA
const withTz = <T>(tz: string, fn: () => T): T => {
  const before = process.env.TZ; process.env.TZ = tz;
  try { return fn(); } finally { if (before === undefined) delete process.env.TZ; else process.env.TZ = before; }
};

test('Chamfer\'s "today" is the Berlin date, not the device date', () => {
  withTz('America/Los_Angeles', () => {
    assert.equal(todayISO(lateEvening), '2026-11-25');
  });
});

test('months elapsed (waiting periods) count Berlin days', () => {
  withTz('America/Los_Angeles', () => {
    assert.equal(monthsSince('2026-10-25', lateEvening), 1, 'a month is full on the 25th in Berlin');
  });
});

test('a birth date of today in Berlin is not in the future', () => {
  withTz('America/Los_Angeles', () => {
    assert.equal(profileComplete({ name: 'A', surname: 'B', dob: '25.11.2026', street: 'S 1', plzCity: '10115 Berlin' } as never, lateEvening), true);
  });
});
