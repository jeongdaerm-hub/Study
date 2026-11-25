import type { LabItem, LabResult, Vaccination } from '../types.ts';

export type LabFlag = 'low' | 'high' | 'normal' | 'unknown';

/** 검사지 참고 범위 기준 높음/낮음 판정 */
export function labFlag(i: LabItem): LabFlag {
  if (i.refMin === undefined && i.refMax === undefined) return 'unknown';
  if (i.refMin !== undefined && i.value < i.refMin) return 'low';
  if (i.refMax !== undefined && i.value > i.refMax) return 'high';
  return 'normal';
}

export function abnormalItems(lab: LabResult): LabItem[] {
  return lab.items.filter((i) => {
    const f = labFlag(i);
    return f === 'low' || f === 'high';
  });
}

/** 자주 쓰는 검사 항목 (참고 범위는 병원·검사기마다 달라 검사지 값을 직접 입력) */
export const LAB_PRESETS: { name: string; unit: string }[] = [
  { name: 'BUN', unit: 'mg/dL' },
  { name: 'CREA', unit: 'mg/dL' },
  { name: 'SDMA', unit: 'µg/dL' },
  { name: 'ALT', unit: 'U/L' },
  { name: 'ALP', unit: 'U/L' },
  { name: 'GLU', unit: 'mg/dL' },
  { name: 'WBC', unit: '10³/µL' },
  { name: 'HCT', unit: '%' },
  { name: 'PLT', unit: '10³/µL' },
];

export type VaccineStatus = 'overdue' | 'soon' | 'ok' | 'none';

const DAY = 86_400_000;
const toDay = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
};
const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function daysUntil(dateKey: string, today = new Date()): number {
  return Math.round((toDay(dateKey) - startOf(today)) / DAY);
}

/** 다음 접종일 기준: 지남 / 14일 이내 / 여유 / 예정 없음 */
export function vaccineStatus(v: Vaccination, today = new Date()): VaccineStatus {
  if (!v.nextDate) return 'none';
  const diff = daysUntil(v.nextDate, today);
  if (diff < 0) return 'overdue';
  if (diff <= 14) return 'soon';
  return 'ok';
}

/** 접종명별 가장 최근 기록만 (같은 백신의 과거 기록은 상태 판단에서 제외) */
export function latestVaccines(list: Vaccination[]): Vaccination[] {
  const map = new Map<string, Vaccination>();
  for (const v of list) {
    const key = v.name.trim().toLowerCase();
    const prev = map.get(key);
    if (!prev || v.date > prev.date) map.set(key, v);
  }
  return [...map.values()];
}
