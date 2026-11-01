import type { WeightEntry } from '../types.ts';

export function sortByDate(list: WeightEntry[]): WeightEntry[] {
  return [...list].sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1));
}

export interface WeightTrend {
  latest?: WeightEntry;
  /** 직전 기록 대비 (kg) */
  diff?: number;
  /** 약 30일 전 기록 대비 변화율 (%) */
  monthPct?: number;
  level: 'ok' | 'watch';
  message: string;
}

const DAY = 86_400_000;
const ts = (d: string) => {
  const [y, m, dd] = d.split('-').map(Number);
  return new Date(y, m - 1, dd).getTime();
};

/** 한 달 새 체중 10% 이상 변화 → 관찰 필요 (급격한 증감은 질병 신호일 수 있음) */
export function weightTrend(list: WeightEntry[]): WeightTrend {
  const s = sortByDate(list);
  const latest = s[s.length - 1];
  if (!latest) return { level: 'ok', message: '체중 기록이 없어요.' };
  const prev = s[s.length - 2];
  const diff = prev ? Math.round((latest.kg - prev.kg) * 100) / 100 : undefined;

  // 최근 기록 기준 23~37일 전 사이의 가장 가까운 기록과 비교
  const target = ts(latest.date) - 30 * DAY;
  const candidates = s.filter((w) => w !== latest && Math.abs(ts(w.date) - target) <= 7 * DAY);
  const base = candidates.sort((a, b) => Math.abs(ts(a.date) - target) - Math.abs(ts(b.date) - target))[0];
  const monthPct = base ? Math.round(((latest.kg - base.kg) / base.kg) * 1000) / 10 : undefined;

  if (monthPct !== undefined && Math.abs(monthPct) >= 10) {
    return {
      latest,
      diff,
      monthPct,
      level: 'watch',
      message: `한 달 새 체중 ${monthPct > 0 ? '+' : ''}${monthPct}% 변화. 수의사 상담을 권장해요.`,
    };
  }
  return { latest, diff, monthPct, level: 'ok', message: `현재 ${latest.kg}kg` };
}

export interface ChartPoint {
  x: number;
  y: number;
  entry: WeightEntry;
}

/** 그래프 좌표 계산 (날짜 간격 비례 X축, 여유 있는 Y축 범위) */
export function chartPoints(
  list: WeightEntry[],
  w: number,
  h: number,
  pad = { l: 40, r: 16, t: 16, b: 28 },
): { points: ChartPoint[]; min: number; max: number; ticks: number[]; yOf: (kg: number) => number } {
  const s = sortByDate(list);
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  if (!s.length) return { points: [], min: 0, max: 0, ticks: [], yOf: () => 0 };
  const kgs = s.map((e) => e.kg);
  const lo = Math.min(...kgs);
  const hi = Math.max(...kgs);
  const span = Math.max(hi - lo, 0.5);
  const min = Math.max(0, Math.floor((lo - span * 0.25) * 10) / 10);
  const max = Math.ceil((hi + span * 0.25) * 10) / 10;
  const yOf = (kg: number) => pad.t + ih - ((kg - min) / (max - min)) * ih;
  const t0 = ts(s[0].date);
  const t1 = ts(s[s.length - 1].date);
  const points = s.map((entry) => ({
    entry,
    x: pad.l + (t1 === t0 ? iw / 2 : ((ts(entry.date) - t0) / (t1 - t0)) * iw),
    y: yOf(entry.kg),
  }));
  const ticks = [min, (min + max) / 2, max].map((v) => Math.round(v * 10) / 10);
  return { points, min, max, ticks, yOf };
}
