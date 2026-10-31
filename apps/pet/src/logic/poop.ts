import type { DiaryEntry, PoopStatus } from '../types.ts';
import { addDays, toDateKey } from '@daro/app-core/logic.ts';

export const POOP_LABEL: Record<PoopStatus, string> = {
  normal: '정상',
  hard: '딱딱함',
  soft: '무름',
  diarrhea: '설사',
  blood: '혈변',
  none: '안 봄',
};

const ABNORMAL: PoopStatus[] = ['hard', 'soft', 'diarrhea', 'blood', 'none'];

export interface PoopAlert {
  level: 'ok' | 'watch' | 'vet';
  message: string;
}

/**
 * 최근 기록으로 건강 신호 판단
 * - 혈변 1회라도 → 병원 권장
 * - 이상 배변 2일 연속 → 병원 권장
 * - 최근 기록 1건 이상 이상 → 관찰
 */
export function analyzePoop(entries: DiaryEntry[], petId: string, today = new Date()): PoopAlert {
  const byDate = new Map<string, PoopStatus>();
  for (const e of entries) {
    if (e.petId === petId && e.poop) byDate.set(e.date, e.poop.status);
  }
  const recent: (PoopStatus | undefined)[] = [];
  for (let i = 0; i < 7; i++) recent.push(byDate.get(toDateKey(addDays(today, -i))));

  if (recent.includes('blood')) return { level: 'vet', message: '최근 7일 내 혈변 기록이 있어요. 병원 진료를 권장해요.' };

  for (let i = 0; i < recent.length - 1; i++) {
    const a = recent[i];
    const b = recent[i + 1];
    if (a && b && ABNORMAL.includes(a) && ABNORMAL.includes(b)) {
      return { level: 'vet', message: '이상 배변이 2일 연속이에요. 병원 상담을 권장해요.' };
    }
  }
  if (recent.some((s) => s && ABNORMAL.includes(s))) {
    return { level: 'watch', message: '최근 이상 배변이 있었어요. 조금 더 지켜봐 주세요.' };
  }
  return { level: 'ok', message: '최근 배변 상태가 좋아요.' };
}
