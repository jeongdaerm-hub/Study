import { addDays, toDateKey } from '@daro/app-core/logic.ts';
import type { DailyLog, PoopStatus } from '../types.ts';

export type Level = 'ok' | 'watch' | 'vet';
export interface Signal {
  level: Level;
  message: string;
}

const ABNORMAL: PoopStatus[] = ['hard', 'soft', 'diarrhea', 'blood', 'none'];
const SEVERITY: Record<PoopStatus, number> = { normal: 0, hard: 1, soft: 1, none: 1, diarrhea: 2, blood: 3 };

/**
 * 배변 신호 (최근 7일)
 * - 혈변 1회라도 → 병원 권장
 * - 이상 배변 2일 연속 → 병원 권장
 * - 이상 배변 있음 → 관찰
 */
export function poopSignal(logs: DailyLog[], petId: string, today = new Date()): Signal {
  const byDate = new Map<string, PoopStatus>();
  for (const l of logs) {
    if (l.petId !== petId || l.kind !== 'poop' || !l.poop) continue;
    const prev = byDate.get(l.date);
    if (!prev || SEVERITY[l.poop] > SEVERITY[prev]) byDate.set(l.date, l.poop); // 하루 중 가장 나쁜 상태
  }
  const recent: (PoopStatus | undefined)[] = [];
  for (let i = 0; i < 7; i++) recent.push(byDate.get(toDateKey(addDays(today, -i))));

  if (recent.includes('blood')) return { level: 'vet', message: '최근 7일 내 혈변이 있었어요. 병원 진료를 권장해요.' };
  for (let i = 0; i < recent.length - 1; i++) {
    const a = recent[i];
    const b = recent[i + 1];
    if (a && b && ABNORMAL.includes(a) && ABNORMAL.includes(b)) {
      return { level: 'vet', message: '이상 배변이 2일 연속이에요. 병원 상담을 권장해요.' };
    }
  }
  if (recent.some((s) => s && ABNORMAL.includes(s))) return { level: 'watch', message: '최근 이상 배변이 있었어요.' };
  if (recent.every((s) => !s)) return { level: 'ok', message: '최근 배변 기록이 없어요.' };
  return { level: 'ok', message: '배변 상태 양호' };
}

/**
 * 구토 신호
 * - 피 섞인 구토 (7일) → 병원
 * - 오늘·어제 합쳐 2회 이상 → 병원
 * - 7일간 3회 이상 → 관찰 (헤어볼 제외)
 */
export function vomitSignal(logs: DailyLog[], petId: string, today = new Date()): Signal {
  const week = new Set(Array.from({ length: 7 }, (_, i) => toDateKey(addDays(today, -i))));
  const twoDays = new Set([toDateKey(today), toDateKey(addDays(today, -1))]);
  const v = logs.filter((l) => l.petId === petId && l.kind === 'vomit' && week.has(l.date));
  if (v.some((l) => l.vomit === 'blood')) return { level: 'vet', message: '피 섞인 구토가 있었어요. 바로 병원에 문의하세요.' };
  const recent = v.filter((l) => twoDays.has(l.date)).length;
  if (recent >= 2) return { level: 'vet', message: `최근 이틀간 구토 ${recent}회. 병원 상담을 권장해요.` };
  const nonHairball = v.filter((l) => l.vomit !== 'hairball').length;
  if (nonHairball >= 3) return { level: 'watch', message: `이번 주 구토 ${nonHairball}회. 식사·컨디션을 지켜봐 주세요.` };
  if (v.length) return { level: 'ok', message: `이번 주 구토 ${v.length}회` };
  return { level: 'ok', message: '최근 7일 구토 없음' };
}

export interface DaySummary {
  mealCount: number;
  mealG: number;
  waterMl: number;
  poopCount: number;
  vomitCount: number;
}

export function daySummary(logs: DailyLog[], petId: string, date: string): DaySummary {
  const s: DaySummary = { mealCount: 0, mealG: 0, waterMl: 0, poopCount: 0, vomitCount: 0 };
  for (const l of logs) {
    if (l.petId !== petId || l.date !== date) continue;
    if (l.kind === 'meal') {
      s.mealCount++;
      s.mealG += l.amount ?? 0;
    } else if (l.kind === 'water') s.waterMl += l.amount ?? 0;
    else if (l.kind === 'poop' && l.poop !== 'none') s.poopCount++;
    else if (l.kind === 'vomit') s.vomitCount++;
  }
  return s;
}

/** 하루 음수량 참고치: 체중(kg) × 50ml */
export const recommendedWaterMl = (kg?: number) => (kg ? Math.round(kg * 50) : undefined);
