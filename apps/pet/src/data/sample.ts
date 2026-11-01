import { addDays, newId, toDateKey } from '@daro/app-core/logic.ts';
import type { DailyLog, PetDb, Schedule } from '../types.ts';

/** 둘러보기용 샘플 데이터 (다로 + 나비) */
export function buildSample(now: Date): PetDb {
  const d = (n: number) => toDateKey(addDays(now, -n));
  const at = (daysFromNow: number, h: number, m = 0) => {
    const x = addDays(now, daysFromNow);
    x.setHours(h, m, 0, 0);
    return x.toISOString();
  };
  const daro = newId();
  const nabi = newId();

  const logs: DailyLog[] = [];
  const L = (petId: string, n: number, time: string, kind: DailyLog['kind'], extra: Partial<DailyLog> = {}) =>
    logs.push({ id: newId(), petId, date: d(n), time, kind, memo: '', photos: [], ...extra });
  for (let n = 0; n < 7; n++) {
    L(daro, n, '08:00', 'meal', { amount: 90, food: '연어 사료' });
    L(daro, n, '18:30', 'meal', { amount: 90, food: '연어 사료' });
    L(daro, n, '09:00', 'water', { amount: n === 0 ? 150 : 280 });
    L(daro, n, '10:00', 'poop', { poop: n === 1 ? 'soft' : 'normal' });
    L(nabi, n, '07:30', 'meal', { amount: 35, food: '습식 캔' });
    L(nabi, n, '12:00', 'water', { amount: 120 });
  }
  L(nabi, 2, '22:10', 'vomit', { vomit: 'hairball' });
  L(daro, 0, '20:00', 'note', { memo: '산책 40분, 컨디션 좋음' });

  const sched = (petId: string, type: Schedule['type'], title: string, dateTime: string, extra: Partial<Schedule> = {}): Schedule => ({
    id: newId(), petId, type, title, dateTime, memo: '', remindBefore: 0, repeat: 'none', done: false, ...extra,
  });

  return {
    pets: [
      { id: daro, name: '다로', species: 'dog', breed: '푸들', sex: 'M', neutered: true, birthDate: toDateKey(addDays(now, -365 * 3 - 70)), createdAt: Date.now() },
      { id: nabi, name: '나비', species: 'cat', breed: '코리안 숏헤어', sex: 'F', neutered: true, birthDate: toDateKey(addDays(now, -365 - 40)), createdAt: Date.now() + 1 },
    ],
    visits: [
      { id: newId(), petId: daro, date: d(20), hospital: '다로동물병원', reason: '정기 건강검진', diagnosis: '경미한 신장 수치 상승', treatment: '수액, 처방식 권장', cost: 180000, photos: [] },
      { id: newId(), petId: daro, date: d(95), hospital: '다로동물병원', reason: '귀 가려움', diagnosis: '외이염', treatment: '귀 세정제, 연고 7일', cost: 45000, photos: [] },
    ],
    labs: [
      {
        id: newId(), petId: daro, date: d(20), title: '혈액검사', memo: '1개월 후 재검',
        items: [
          { name: 'BUN', value: 31, unit: 'mg/dL', refMin: 7, refMax: 27 },
          { name: 'CREA', value: 1.4, unit: 'mg/dL', refMin: 0.5, refMax: 1.8 },
          { name: 'ALT', value: 62, unit: 'U/L', refMin: 10, refMax: 125 },
          { name: 'GLU', value: 98, unit: 'mg/dL', refMin: 70, refMax: 143 },
        ],
      },
    ],
    vaccines: [
      { id: newId(), petId: daro, name: '종합백신(DHPPL)', date: d(355), nextDate: toDateKey(addDays(now, 10)), hospital: '다로동물병원' },
      { id: newId(), petId: daro, name: '광견병', date: d(200), nextDate: toDateKey(addDays(now, 165)), hospital: '다로동물병원' },
      { id: newId(), petId: nabi, name: '종합백신(FVRCP)', date: d(60), nextDate: toDateKey(addDays(now, 305)), hospital: '나비고양이병원' },
    ],
    weights: [
      ...[120, 90, 60, 45, 30, 14, 0].map((n, i) => ({ id: newId(), petId: daro, date: d(n), kg: [5.6, 5.7, 5.9, 5.8, 6.0, 6.1, 6.0][i] })),
      ...[90, 45, 0].map((n, i) => ({ id: newId(), petId: nabi, date: d(n), kg: [3.6, 3.8, 3.9][i] })),
    ],
    logs,
    schedules: [
      sched(daro, 'medicine', '심장사상충 예방약', at(0, 20), { repeat: 'monthly', remindBefore: 60 }),
      sched(daro, 'medicine', '관절 영양제', at(0, 8, 30), { repeat: 'daily', done: true }),
      sched(daro, 'hospital', '신장 수치 재검', at(9, 11), { remindBefore: 1440, memo: '공복 8시간' }),
      sched(nabi, 'grooming', '발톱 정리', at(2, 19)),
    ],
  };
}
