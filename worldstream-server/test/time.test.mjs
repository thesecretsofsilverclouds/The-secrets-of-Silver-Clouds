import test from 'node:test';
import assert from 'node:assert/strict';
import { atLondon, londonDate, londonMidnight, nextLondonDay } from '../src/time.mjs';

const instant = (iso) => Date.parse(iso);
const HOUR = 3_600_000;

test('London date and midnight follow local time rather than the UTC calendar', () => {
  const summerLate = instant('2026-09-04T23:30:00Z');
  assert.equal(londonDate(summerLate), '2026-09-05');
  assert.equal(londonMidnight(summerLate), instant('2026-09-04T23:00:00Z'));
  assert.equal(atLondon('2026-09-05', '14:23'), instant('2026-09-05T13:23:00Z'));
  assert.equal(atLondon('2026-12-05', '14:23'), instant('2026-12-05T14:23:00Z'));
});

test('spring missing routine slots move to the first valid instant', () => {
  for (const missing of ['01:00', '01:30', '01:59']) {
    assert.equal(atLondon('2026-03-29', missing), instant('2026-03-29T01:00:00Z'));
  }
  assert.equal(atLondon('2026-03-29', '00:59'), instant('2026-03-29T00:59:00Z'));
  assert.equal(atLondon('2026-03-29', '02:00'), instant('2026-03-29T01:00:00Z'));
});

test('autumn ambiguous routine slots choose the first occurrence', () => {
  assert.equal(atLondon('2026-10-25', '01:00'), instant('2026-10-25T00:00:00Z'));
  assert.equal(atLondon('2026-10-25', '01:30'), instant('2026-10-25T00:30:00Z'));
  assert.equal(atLondon('2026-10-25', '01:59'), instant('2026-10-25T00:59:00Z'));
  assert.equal(atLondon('2026-10-25', '02:00'), instant('2026-10-25T02:00:00Z'));
});

test('successive London days span the 23-hour and 25-hour clock changes', () => {
  assert.equal(nextLondonDay('2026-03-29'), '2026-03-30');
  assert.equal(atLondon('2026-03-30', '00:00') - atLondon('2026-03-29', '00:00'), 23 * HOUR);
  assert.equal(nextLondonDay('2026-10-25'), '2026-10-26');
  assert.equal(atLondon('2026-10-26', '00:00') - atLondon('2026-10-25', '00:00'), 25 * HOUR);
  assert.equal(nextLondonDay('2026-12-31'), '2027-01-01');
  assert.equal(nextLondonDay('2028-02-28'), '2028-02-29');
});

test('invalid civil dates and times are rejected instead of normalized into a different routine', () => {
  for (const date of ['2026-02-29', '2026-02-30', '2026-13-01', '2026-00-01', '2026-9-04']) {
    assert.throws(() => atLondon(date, '12:00'), RangeError);
  }
  for (const time of ['24:00', '12:60', '9:00', '12:00:00', 'later']) {
    assert.throws(() => atLondon('2026-09-04', time), RangeError);
  }
});
