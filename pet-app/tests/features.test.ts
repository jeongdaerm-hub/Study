import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzePoop } from '../src/logic/poop.ts';
import { nextOccurrence, reminderTime, rollForward, sortSchedules } from '../src/logic/schedule.ts';
import { toDateKey, addDays } from '../src/logic/date.ts';
import type { DiaryEntry, PoopStatus, Schedule } from '../src/types.ts';

const today = new Date(2026, 9, 31, 12, 0);
const entry = (daysAgo: number, status: PoopStatus, petId = 'p1'): DiaryEntry => ({
  id: `${daysAgo}`,
  petId,
  date: toDateKey(addDays(today, -daysAgo)),
  mood: '🙂',
  text: '',
  photos: [],
  poop: { status, count: 1 },
  createdAt: 0,
});

test('analyzePoop', () => {
  assert.equal(analyzePoop([], 'p1', today).level, 'ok');
  assert.equal(analyzePoop([entry(0, 'normal'), entry(1, 'normal')], 'p1', today).level, 'ok');
  assert.equal(analyzePoop([entry(3, 'soft')], 'p1', today).level, 'watch');
  assert.equal(analyzePoop([entry(0, 'soft'), entry(1, 'diarrhea')], 'p1', today).level, 'vet');
  assert.equal(analyzePoop([entry(5, 'blood')], 'p1', today).level, 'vet');
  assert.equal(analyzePoop([entry(0, 'soft'), entry(2, 'soft')], 'p1', today).level, 'watch');
  assert.equal(analyzePoop([entry(0, 'blood', 'p2')], 'p1', today).level, 'ok');
  assert.equal(analyzePoop([entry(8, 'blood')], 'p1', today).level, 'ok');
});

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

test('sortSchedules', () => {
  const s = (id: string, h: number, done = false): Schedule => ({
    id, petId: 'p1', title: id, type: '병원', dateTime: new Date(2026, 10, 1, h).toISOString(),
    remindBefore: 0, repeat: 'none', done,
  });
  assert.deepEqual(sortSchedules([s('c', 8, true), s('b', 12), s('a', 9)]).map((x) => x.id), ['a', 'b', 'c']);
});

test('rollForward', () => {
  const now = new Date(2026, 9, 31, 12, 0);
  const s: Schedule = {
    id: 'w', petId: 'p1', title: '산책', type: '산책', remindBefore: 0, repeat: 'weekly', done: true,
    dateTime: new Date(2026, 9, 10, 9, 0).toISOString(),
  };
  const r = rollForward(s, now);
  assert.deepEqual([new Date(r.dateTime).getMonth(), new Date(r.dateTime).getDate(), r.done], [10, 7, false]);
  const once = { ...s, repeat: 'none' as const };
  assert.equal(rollForward(once, now), once);
});
