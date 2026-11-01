import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, toDateKey } from '@daro/app-core/logic.ts';
import type { DailyLog, PetDb, PoopStatus, Schedule, VomitType } from '../src/types.ts';
import { poopSignal, vomitSignal, daySummary } from '../src/logic/logs.ts';
import { labFlag, vaccineStatus, latestVaccines, abnormalItems } from '../src/logic/health.ts';
import { weightTrend, chartPoints } from '../src/logic/weight.ts';
import { ageText } from '../src/logic/age.ts';
import { todayTasks, statusItems, overallLevel } from '../src/logic/dashboard.ts';

const today = new Date(2026, 10, 1, 12, 0);
const day = (n: number) => toDateKey(addDays(today, -n));
let seq = 0;
const log = (daysAgo: number, kind: DailyLog['kind'], extra: Partial<DailyLog> = {}, petId = 'p1'): DailyLog => ({
  id: String(seq++), petId, date: day(daysAgo), time: '09:00', kind, memo: '', photos: [], ...extra,
});
const poop = (d: number, s: PoopStatus, petId = 'p1') => log(d, 'poop', { poop: s }, petId);
const vomit = (d: number, v: VomitType) => log(d, 'vomit', { vomit: v });

test('poopSignal', () => {
  assert.equal(poopSignal([], 'p1', today).message, '최근 배변 기록이 없어요.');
  assert.equal(poopSignal([poop(0, 'normal'), poop(1, 'normal')], 'p1', today).level, 'ok');
  assert.equal(poopSignal([poop(3, 'soft')], 'p1', today).level, 'watch');
  assert.equal(poopSignal([poop(0, 'soft'), poop(1, 'diarrhea')], 'p1', today).level, 'vet');
  assert.equal(poopSignal([poop(5, 'blood')], 'p1', today).level, 'vet');
  assert.equal(poopSignal([poop(0, 'soft'), poop(2, 'soft')], 'p1', today).level, 'watch');
  assert.equal(poopSignal([poop(0, 'blood', 'p2')], 'p1', today).level, 'ok'); // 다른 펫 기록 분리
  assert.equal(poopSignal([poop(8, 'blood')], 'p1', today).level, 'ok');
  // 같은 날 정상 + 설사 → 그날은 설사로 판단
  assert.equal(poopSignal([poop(0, 'normal'), poop(0, 'diarrhea'), poop(1, 'soft')], 'p1', today).level, 'vet');
});

test('vomitSignal', () => {
  assert.equal(vomitSignal([], 'p1', today).level, 'ok');
  assert.equal(vomitSignal([vomit(3, 'blood')], 'p1', today).level, 'vet');
  assert.equal(vomitSignal([vomit(0, 'food'), vomit(1, 'foam')], 'p1', today).level, 'vet');
  assert.equal(vomitSignal([vomit(2, 'food'), vomit(4, 'foam'), vomit(6, 'food')], 'p1', today).level, 'watch');
  assert.equal(vomitSignal([vomit(2, 'hairball'), vomit(4, 'hairball'), vomit(6, 'hairball')], 'p1', today).level, 'ok');
});

test('daySummary', () => {
  const logs = [
    log(0, 'meal', { amount: 80 }), log(0, 'meal', { amount: 70 }), log(0, 'water', { amount: 200 }),
    poop(0, 'normal'), poop(0, 'none'), vomit(0, 'food'), log(1, 'meal', { amount: 100 }),
  ];
  assert.deepEqual(daySummary(logs, 'p1', day(0)), { mealCount: 2, mealG: 150, waterMl: 200, poopCount: 1, vomitCount: 1 });
});

test('labFlag / abnormalItems', () => {
  assert.equal(labFlag({ name: 'BUN', value: 40, unit: 'mg/dL', refMin: 7, refMax: 27 }), 'high');
  assert.equal(labFlag({ name: 'HCT', value: 30, unit: '%', refMin: 37, refMax: 55 }), 'low');
  assert.equal(labFlag({ name: 'GLU', value: 100, unit: 'mg/dL', refMin: 70, refMax: 143 }), 'normal');
  assert.equal(labFlag({ name: 'X', value: 1, unit: '' }), 'unknown');
  const lab = { id: 'l', petId: 'p1', date: day(0), title: '', memo: '', items: [
    { name: 'BUN', value: 40, unit: '', refMax: 27 }, { name: 'ALT', value: 50, unit: '', refMax: 100 },
  ] };
  assert.deepEqual(abnormalItems(lab).map((i) => i.name), ['BUN']);
});

test('vaccineStatus / latestVaccines', () => {
  const v = (name: string, date: string, nextDate?: string) => ({ id: name + date, petId: 'p1', name, date, nextDate, hospital: '' });
  assert.equal(vaccineStatus(v('DHPPL', day(400), day(35)), today), 'overdue');
  assert.equal(vaccineStatus(v('DHPPL', day(0), toDateKey(addDays(today, 10))), today), 'soon');
  assert.equal(vaccineStatus(v('DHPPL', day(0), toDateKey(addDays(today, 60))), today), 'ok');
  assert.equal(vaccineStatus(v('DHPPL', day(0)), today), 'none');
  const latest = latestVaccines([v('광견병', '2025-01-01', '2026-01-01'), v('광견병', '2026-01-02', '2027-01-02')]);
  assert.equal(latest.length, 1);
  assert.equal(latest[0].date, '2026-01-02');
});

test('weightTrend / chartPoints', () => {
  const w = (d: number, kg: number) => ({ id: `${d}`, petId: 'p1', date: day(d), kg });
  assert.equal(weightTrend([]).message, '체중 기록이 없어요.');
  const stable = weightTrend([w(60, 5.0), w(30, 5.1), w(0, 5.2)]);
  assert.equal(stable.level, 'ok');
  assert.equal(stable.diff, 0.1);
  const drop = weightTrend([w(30, 6.0), w(0, 5.2)]);
  assert.equal(drop.level, 'watch');
  assert.equal(drop.monthPct, -13.3);
  const c = chartPoints([w(10, 5), w(0, 6)], 300, 200);
  assert.equal(c.points.length, 2);
  assert.ok(c.points[0].x < c.points[1].x);
  assert.ok(c.points[0].y > c.points[1].y); // 무거울수록 위
  assert.ok(c.min < 5 && c.max > 6);
});

test('ageText', () => {
  assert.equal(ageText('2023-08-15', today), '3살 2개월');
  assert.equal(ageText('2026-05-01', today), '6개월');
  assert.equal(ageText('2025-11-01', today), '1살');
  assert.equal(ageText('', today), '');
  assert.equal(ageText('2030-01-01', today), '');
});

test('todayTasks / statusItems', () => {
  const s = (id: string, dt: Date, done = false): Schedule => ({
    id, petId: 'p1', title: id, type: 'medicine', memo: '', dateTime: dt.toISOString(), remindBefore: 0, repeat: 'none', done,
  });
  const tasks = todayTasks([
    s('today', new Date(2026, 10, 1, 20)),
    s('missed', new Date(2026, 9, 30, 9)),
    s('pastDone', new Date(2026, 9, 30, 9), true),
    s('tomorrow', new Date(2026, 10, 2, 9)),
  ], 'p1', today);
  assert.deepEqual(tasks.map((t) => t.id), ['missed', 'today']);

  const db: PetDb = { pets: [], visits: [], labs: [], vaccines: [], weights: [], schedules: [], logs: [poop(0, 'blood')] };
  const items = statusItems(db, 'p1', today);
  assert.equal(items[0].key, 'poop');
  assert.equal(overallLevel(items), 'vet');
});
