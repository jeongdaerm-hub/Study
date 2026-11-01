/**
 * AI 결과 검증·정제 — AI 출력은 '외부 입력'으로 취급하고 믿지 않음
 *  - 형식이 틀린 항목은 버림 (앱 크래시·이상 데이터 방지)
 *  - 날짜 표기 통일, 미래의 접종·진료일 제거
 *  - 문자열 길이·항목 수 제한, 제어문자 제거
 */
import type {
  Confidence,
  DocumentType,
  FollowUpType,
  ScanResult,
  ScannedFollowUp,
  ScannedLab,
  ScannedLabItem,
  ScannedVaccine,
  ScannedVisit,
} from './types.ts';
import { normalizeDate } from './dates.ts';
import { normalizeVaccineName } from './vaccines.ts';

export const SCAN_LIMITS = {
  visits: 30,
  labs: 10,
  labItems: 60,
  vaccines: 60,
  followUps: 20,
  warnings: 10,
  short: 50,
  text: 300,
  cost: 100_000_000,
  labValue: 1_000_000,
} as const;

const DOC_TYPES: DocumentType[] = ['vaccination_record', 'vet_receipt', 'lab_report', 'prescription', 'other'];
const CONF: Confidence[] = ['high', 'medium', 'low'];
const FOLLOW: FollowUpType[] = ['vaccine', 'medicine', 'hospital', 'etc'];

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => !!x && typeof x === 'object' && !Array.isArray(x);
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);

export function cleanStr(x: unknown, max: number): string {
  if (typeof x !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return x.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** 숫자 또는 '1,200' 같은 숫자 문자열 → 0 이상 유한수, 아니면 null */
export function cleanNum(x: unknown, max: number): number | null {
  let n: number;
  if (typeof x === 'number') n = x;
  else if (typeof x === 'string' && /^\s*\d{1,12}(\.\d+)?\s*$/.test(x.replace(/,/g, ''))) n = Number(x.replace(/,/g, ''));
  else return null;
  if (!Number.isFinite(n) || n < 0 || n > max) return null;
  return Math.round(n * 1000) / 1000;
}

const conf = (x: unknown): Confidence => (CONF.includes(x as Confidence) ? (x as Confidence) : 'low');

export interface SanitizeOutcome {
  result: ScanResult;
  /** 검증에서 버려진 항목 수 */
  dropped: number;
}

export function sanitizeScan(raw: unknown, todayKey: string): SanitizeOutcome | null {
  if (!isObj(raw)) return null;
  let dropped = 0;
  const warnings: string[] = arr(raw.warnings)
    .map((w) => cleanStr(w, 120))
    .filter(Boolean);
  const past = (d: string | null): d is string => !!d && d <= todayKey;

  const visits: ScannedVisit[] = [];
  for (const v of arr(raw.visits).slice(0, SCAN_LIMITS.visits)) {
    const date = isObj(v) ? normalizeDate(v.date) : null;
    const reason = isObj(v) ? cleanStr(v.reason, SCAN_LIMITS.short) : '';
    const hospital = isObj(v) ? cleanStr(v.hospital, SCAN_LIMITS.short) : '';
    if (!isObj(v) || !past(date) || (!reason && !hospital)) {
      dropped++;
      continue;
    }
    visits.push({
      date,
      hospital,
      reason: reason || '진료',
      diagnosis: cleanStr(v.diagnosis, SCAN_LIMITS.text),
      treatment: cleanStr(v.treatment, SCAN_LIMITS.text),
      cost: cleanNum(v.cost, SCAN_LIMITS.cost),
      confidence: conf(v.confidence),
    });
  }

  const labs: ScannedLab[] = [];
  for (const l of arr(raw.labs).slice(0, SCAN_LIMITS.labs)) {
    const date = isObj(l) ? normalizeDate(l.date) : null;
    if (!isObj(l) || !past(date)) {
      dropped++;
      continue;
    }
    const items: ScannedLabItem[] = [];
    const seen = new Set<string>();
    for (const i of arr(l.items).slice(0, SCAN_LIMITS.labItems)) {
      if (!isObj(i)) continue;
      const name = cleanStr(i.name, 16);
      const value = cleanNum(i.value, SCAN_LIMITS.labValue);
      if (!name || value === null || seen.has(name.toUpperCase())) {
        dropped++;
        continue;
      }
      seen.add(name.toUpperCase());
      let refMin = cleanNum(i.refMin, SCAN_LIMITS.labValue);
      let refMax = cleanNum(i.refMax, SCAN_LIMITS.labValue);
      if (refMin !== null && refMax !== null && refMin > refMax) refMin = refMax = null;
      items.push({ name, value, unit: cleanStr(i.unit, 12), refMin, refMax });
    }
    if (!items.length) {
      dropped++;
      continue;
    }
    labs.push({ date, title: cleanStr(l.title, SCAN_LIMITS.short) || '검사', items, confidence: conf(l.confidence) });
  }

  const vaccines: ScannedVaccine[] = [];
  const vSeen = new Set<string>();
  for (const v of arr(raw.vaccines).slice(0, SCAN_LIMITS.vaccines)) {
    const date = isObj(v) ? normalizeDate(v.date) : null;
    const rawName = isObj(v) ? cleanStr(v.name, SCAN_LIMITS.short) : '';
    if (!isObj(v) || !past(date) || !rawName) {
      dropped++;
      continue;
    }
    const name = normalizeVaccineName(rawName);
    const key = `${name}|${date}`;
    if (vSeen.has(key)) continue; // 같은 사진 안의 중복
    vSeen.add(key);
    const next = normalizeDate(v.nextDate);
    vaccines.push({
      name,
      date,
      nextDate: next && next > date ? next : null,
      hospital: cleanStr(v.hospital, SCAN_LIMITS.short),
      confidence: conf(v.confidence),
    });
  }

  const followUps: ScannedFollowUp[] = [];
  for (const f of arr(raw.followUps).slice(0, SCAN_LIMITS.followUps)) {
    const date = isObj(f) ? normalizeDate(f.date) : null;
    if (!isObj(f) || !date) {
      dropped++;
      continue;
    }
    const type = FOLLOW.includes(f.type as FollowUpType) ? (f.type as FollowUpType) : 'hospital';
    followUps.push({
      date,
      type,
      title: cleanStr(f.title, SCAN_LIMITS.short) || (type === 'medicine' ? '투약' : '병원 방문'),
      confidence: conf(f.confidence),
    });
  }

  const documentType = DOC_TYPES.includes(raw.documentType as DocumentType) ? (raw.documentType as DocumentType) : 'other';
  const petName = cleanStr(raw.petName, 20) || null;

  return {
    result: { documentType, petName, visits, labs, vaccines, followUps, warnings: warnings.slice(0, SCAN_LIMITS.warnings) },
    dropped,
  };
}
