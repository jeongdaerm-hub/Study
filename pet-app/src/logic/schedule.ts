import type { Repeat, Schedule } from '../types.ts';

/** 반복 일정의 다음 회차 */
export function nextOccurrence(iso: string, repeat: Repeat): string | null {
  if (repeat === 'none') return null;
  const d = new Date(iso);
  if (repeat === 'daily') d.setDate(d.getDate() + 1);
  if (repeat === 'weekly') d.setDate(d.getDate() + 7);
  if (repeat === 'monthly') {
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, lastDay)); // 1/31 → 2/28 처럼 말일 보정
  }
  return d.toISOString();
}

/** 알림 울릴 시각. 이미 지났으면 null (예약 안 함) */
export function reminderTime(s: Pick<Schedule, 'dateTime' | 'remindBefore'>, now = new Date()): Date | null {
  const t = new Date(new Date(s.dateTime).getTime() - s.remindBefore * 60_000);
  return t.getTime() > now.getTime() ? t : null;
}

/** 다가오는 일정 순 정렬 (완료 일정은 뒤로) */
export function sortSchedules(list: Schedule[]): Schedule[] {
  return [...list].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime();
  });
}

export const REMIND_OPTIONS: { label: string; minutes: number }[] = [
  { label: '정각', minutes: 0 },
  { label: '30분 전', minutes: 30 },
  { label: '1시간 전', minutes: 60 },
  { label: '하루 전', minutes: 1440 },
];

export const REPEAT_LABEL: Record<Repeat, string> = {
  none: '반복 없음',
  daily: '매일',
  weekly: '매주',
  monthly: '매월',
};

/** 지난 반복 일정을 다음 미래 회차로 이동 (앱 실행 시 정리용) */
export function rollForward(s: Schedule, now = new Date()): Schedule {
  if (s.repeat === 'none') return s;
  let iso = s.dateTime;
  let guard = 0;
  while (new Date(iso).getTime() <= now.getTime() && guard++ < 1000) {
    iso = nextOccurrence(iso, s.repeat)!;
  }
  return iso === s.dateTime ? s : { ...s, dateTime: iso, done: false };
}
