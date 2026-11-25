/**
 * 인식 결과 → 가져오기 계획
 *  - 이미 있는 기록과 중복이면 기본 '선택 해제'
 *  - 같은 백신은 가장 최근 접종에만 다음 접종일 적용 (예전 기록으로 낡은 일정이 생기지 않게)
 *  - 다음 접종일이 없으면 일반 간격으로 '추정' 제안
 *  - 지난 날짜의 예정 일정은 제외
 */
import type { Confidence, ScanResult, ScannedFollowUp, ScannedLab, ScannedVaccine, ScannedVisit } from './types.ts';
import { addMonthsKey } from './dates.ts';
import { normalizeVaccineName, vaccineIntervalMonths } from './vaccines.ts';

export interface ExistingRecords {
  visits: { date: string; hospital: string; reason: string }[];
  labs: { date: string; items: { name: string }[] }[];
  vaccines: { name: string; date: string }[];
  schedules: { dateTime: string; title: string; type: string }[];
}

interface Base {
  key: string;
  selected: boolean;
  /** 이미 저장된 기록과 같아 보임 */
  duplicate: boolean;
  /** AI 가 흐리게 읽음 → 확인 필요 */
  lowConfidence: boolean;
}
export type ImportItem =
  | (Base & { kind: 'vaccine'; data: ScannedVaccine; nextEstimated: boolean })
  | (Base & { kind: 'visit'; data: ScannedVisit })
  | (Base & { kind: 'lab'; data: ScannedLab })
  | (Base & { kind: 'followUp'; data: ScannedFollowUp });

export interface ImportPlan {
  items: ImportItem[];
  /** 문서의 이름이 선택한 반려동물과 다름 */
  petNameMismatch: string | null;
  skippedPastFollowUps: number;
}

const norm = (s: string) => s.toLowerCase().replace(/[\s()[\]\-_.,·/]/g, '');
const low = (c: Confidence) => c === 'low';
const dayOf = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export function buildImportPlan(
  scan: ScanResult,
  existing: ExistingRecords,
  opts: { todayKey: string; petName?: string },
): ImportPlan {
  const items: ImportItem[] = [];
  let seq = 0;
  const key = (k: string) => `${k}-${seq++}`;

  // ── 예방접종
  const latestByName = new Map<string, string>();
  for (const v of [...existing.vaccines, ...scan.vaccines]) {
    const n = normalizeVaccineName(v.name);
    if (!latestByName.has(n) || v.date > latestByName.get(n)!) latestByName.set(n, v.date);
  }
  for (const v of scan.vaccines) {
    const dup = existing.vaccines.some((e) => normalizeVaccineName(e.name) === v.name && e.date === v.date);
    const isLatest = latestByName.get(v.name) === v.date;
    let nextDate = isLatest ? v.nextDate : null;
    let nextEstimated = false;
    if (isLatest && !nextDate) {
      const m = vaccineIntervalMonths(v.name);
      if (m) {
        nextDate = addMonthsKey(v.date, m);
        nextEstimated = true;
      }
    }
    items.push({
      kind: 'vaccine',
      key: key('vac'),
      data: { ...v, nextDate },
      nextEstimated,
      duplicate: dup,
      selected: !dup,
      lowConfidence: low(v.confidence),
    });
  }

  // ── 진료
  for (const v of scan.visits) {
    const dup = existing.visits.some(
      (e) => e.date === v.date && ((v.hospital && norm(e.hospital) === norm(v.hospital)) || norm(e.reason) === norm(v.reason)),
    );
    items.push({ kind: 'visit', key: key('visit'), data: v, duplicate: dup, selected: !dup, lowConfidence: low(v.confidence) });
  }

  // ── 검사
  for (const l of scan.labs) {
    const names = new Set(l.items.map((i) => norm(i.name)));
    const dup = existing.labs.some((e) => {
      if (e.date !== l.date) return false;
      const overlap = e.items.filter((i) => names.has(norm(i.name))).length;
      return overlap >= Math.ceil(names.size / 2);
    });
    items.push({ kind: 'lab', key: key('lab'), data: l, duplicate: dup, selected: !dup, lowConfidence: low(l.confidence) });
  }

  // ── 앞으로의 일정
  let skippedPastFollowUps = 0;
  for (const f of scan.followUps) {
    if (f.date < opts.todayKey) {
      skippedPastFollowUps++;
      continue;
    }
    const dup = existing.schedules.some(
      (s) => dayOf(s.dateTime) === f.date && (norm(s.title) === norm(f.title) || s.type === f.type),
    );
    items.push({ kind: 'followUp', key: key('fu'), data: f, duplicate: dup, selected: !dup, lowConfidence: low(f.confidence) });
  }

  const mismatch =
    scan.petName && opts.petName && norm(scan.petName) !== norm(opts.petName) && !norm(scan.petName).includes(norm(opts.petName))
      ? scan.petName
      : null;

  return { items, petNameMismatch: mismatch, skippedPastFollowUps };
}

/** 선택된 항목 개수 요약 */
export function summarize(items: ImportItem[]): Record<ImportItem['kind'], number> {
  const s = { vaccine: 0, visit: 0, lab: 0, followUp: 0 };
  for (const i of items) if (i.selected) s[i.kind]++;
  return s;
}
