import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextOccurrence, reminderTime, rollForward, sortByUpcoming, type Recurring } from '../src/logic/recurrence.ts';

test('nextOccurrence', () => {
  const base = new Date(2026, 0, 31, 9, 0).toISOString();
  assert.equal(nextOccurrence(base, 'none'), null);
  assert.equal(new Date(nextOccurrence(base, 'daily')!).getDate(), 1);
  assert.equal(new Date(nextOccurrence(base, 'weekly')!).getDate(), 7);
  const m = new Date(nextOccurrence(base, 'monthly')!);
  assert.deepEqual([m.getMonth(), m.getDate()], [1, 28]);
});

test('reminderTime', () => {
  const now = new Date(2026, 9, 31, 12, 0);
  const at = new Date(2026, 9, 31, 15, 0).toISOString();
  assert.equal(reminderTime({ dateTime: at, remindBefore: 60 }, now)!.getHours(), 14);
  assert.equal(reminderTime({ dateTime: at, remindBefore: 1440 }, now), null);
});

test('sortByUpcoming', () => {
  const s = (id: string, h: number, done = false) => ({ id, dateTime: new Date(2026, 10, 1, h).toISOString(), done });
  assert.deepEqual(sortByUpcoming([s('c', 8, true), s('b', 12), s('a', 9)]).map((x) => x.id), ['a', 'b', 'c']);
});

test('rollForward', () => {
  const now = new Date(2026, 9, 31, 12, 0);
  const s: Recurring & { id: string } = {
    id: 'w', remindBefore: 0, repeat: 'weekly', done: true,
    dateTime: new Date(2026, 9, 10, 9, 0).toISOString(),
  };
  const r = rollForward(s, now);
  assert.deepEqual([new Date(r.dateTime).getMonth(), new Date(r.dateTime).getDate(), r.done, r.id], [10, 7, false, 'w']);
  const once = { ...s, repeat: 'none' as const };
  assert.equal(rollForward(once, now), once);
});
