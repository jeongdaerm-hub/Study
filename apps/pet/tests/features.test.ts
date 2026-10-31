import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzePoop } from '../src/logic/poop.ts';
import { toDateKey, addDays } from '@daro/app-core/logic.ts';
import type { DiaryEntry, PoopStatus } from '../src/types.ts';

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
