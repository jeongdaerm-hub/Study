import { sortByUpcoming, toDateKey } from '@daro/app-core/logic.ts';
import type { PetDb, Schedule } from '../types.ts';
import { abnormalItems, latestVaccines, vaccineStatus } from './health.ts';
import { poopSignal, vomitSignal, type Level } from './logs.ts';
import { weightTrend } from './weight.ts';

export interface StatusItem {
  key: string;
  level: Level;
  icon: string;
  text: string;
}

/** 오늘 할 일: 오늘 일정 + 놓친(지난·미완료) 일정 */
export function todayTasks(schedules: Schedule[], petId: string, now = new Date()): Schedule[] {
  const today = toDateKey(now);
  return sortByUpcoming(
    schedules.filter((s) => {
      if (s.petId !== petId) return false;
      const d = toDateKey(new Date(s.dateTime));
      return d === today || (!s.done && d < today);
    }),
  );
}

/** 상태 요약: 위험도 높은 순 */
export function statusItems(db: PetDb, petId: string, now = new Date()): StatusItem[] {
  const items: StatusItem[] = [];
  const poop = poopSignal(db.logs, petId, now);
  items.push({ key: 'poop', level: poop.level, icon: '💩', text: poop.message });

  const vomit = vomitSignal(db.logs, petId, now);
  items.push({ key: 'vomit', level: vomit.level, icon: '🤮', text: vomit.message });

  const w = weightTrend(db.weights.filter((x) => x.petId === petId));
  items.push({ key: 'weight', level: w.level, icon: '⚖️', text: w.message });

  const vaccines = latestVaccines(db.vaccines.filter((v) => v.petId === petId));
  const overdue = vaccines.filter((v) => vaccineStatus(v, now) === 'overdue');
  const soon = vaccines.filter((v) => vaccineStatus(v, now) === 'soon');
  if (overdue.length) items.push({ key: 'vac', level: 'vet', icon: '💉', text: `접종 기한 지남: ${overdue.map((v) => v.name).join(', ')}` });
  else if (soon.length) items.push({ key: 'vac', level: 'watch', icon: '💉', text: `2주 내 접종: ${soon.map((v) => v.name).join(', ')}` });

  const lab = db.labs.filter((l) => l.petId === petId).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  if (lab) {
    const bad = abnormalItems(lab);
    if (bad.length) items.push({ key: 'lab', level: 'watch', icon: '🧪', text: `최근 검사(${lab.date}) 범위 밖: ${bad.map((i) => i.name).join(', ')}` });
  }

  const rank: Record<Level, number> = { vet: 0, watch: 1, ok: 2 };
  return items.sort((a, b) => rank[a.level] - rank[b.level]);
}

export function overallLevel(items: StatusItem[]): Level {
  if (items.some((i) => i.level === 'vet')) return 'vet';
  if (items.some((i) => i.level === 'watch')) return 'watch';
  return 'ok';
}
