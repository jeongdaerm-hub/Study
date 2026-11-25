/**
 * 입력 검증 + 저장 데이터 형식 검사
 * - 사용자 입력: 범위/길이 제한 (오입력·과도한 데이터 방지)
 * - 저장 데이터: 로드 시 형식 검사 (손상·변조 데이터로 인한 크래시 방지)
 */
import type {
  DailyLog,
  LabResult,
  Pet,
  Schedule,
  Vaccination,
  VisitRecord,
  WeightEntry,
} from '../types.ts';

export const LIMITS = {
  name: 20,
  short: 50,
  text: 1000,
  weightKg: 150,
  mealG: 5000,
  waterMl: 10000,
  cost: 100_000_000,
  labItems: 40,
  labValue: 1_000_000,
} as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export function isDateKey(s: unknown): s is string {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/** 사용자 입력 숫자 파싱: 쉼표 허용, 음수/NaN/무한대/지수표기 거부 */
export function parseNumber(input: string): number | null {
  const cleaned = input.replace(/,/g, '').trim();
  if (!/^\d{1,9}(\.\d{1,3})?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export const round = (n: number, digits = 2) => Math.round(n * 10 ** digits) / 10 ** digits;

export function validateWeight(kg: number | null): string | null {
  if (kg === null) return '체중을 숫자로 입력해 주세요.';
  if (kg <= 0 || kg > LIMITS.weightKg) return `체중은 0 ~ ${LIMITS.weightKg}kg 사이로 입력해 주세요.`;
  return null;
}

export function validateAmount(kind: 'meal' | 'water', n: number | null): string | null {
  if (n === null) return null; // 선택 입력
  const max = kind === 'meal' ? LIMITS.mealG : LIMITS.waterMl;
  if (n <= 0 || n > max) return `${kind === 'meal' ? '식사량' : '음수량'}은 0 ~ ${max.toLocaleString()} 사이로 입력해 주세요.`;
  return null;
}

export function validateRequired(label: string, v: string, max: number): string | null {
  const t = v.trim();
  if (!t) return `${label}을(를) 입력해 주세요.`;
  if (t.length > max) return `${label}은(는) ${max}자 이내로 입력해 주세요.`;
  return null;
}

/** 텍스트 정리: 제어문자 제거 + 앞뒤 공백 제거 + 길이 제한 */
export function cleanText(v: string, max: number = LIMITS.text): string {
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
}

/* ───────── 저장 데이터 형식 검사 ───────── */
type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => !!x && typeof x === 'object' && !Array.isArray(x);
const str = (o: Obj, k: string) => typeof o[k] === 'string';
const num = (o: Obj, k: string) => typeof o[k] === 'number' && Number.isFinite(o[k] as number);
const strArr = (o: Obj, k: string) => Array.isArray(o[k]) && (o[k] as unknown[]).every((x) => typeof x === 'string');
const oneOf = (o: Obj, k: string, vals: readonly string[]) => vals.includes(o[k] as string);
const base = (o: Obj) => str(o, 'id') && str(o, 'petId');

export const isPet = (x: unknown): x is Pet =>
  isObj(x) &&
  str(x, 'id') &&
  str(x, 'name') &&
  oneOf(x, 'species', ['dog', 'cat', 'other']) &&
  oneOf(x, 'sex', ['M', 'F', 'U']) &&
  typeof x.neutered === 'boolean' &&
  str(x, 'birthDate') &&
  num(x, 'createdAt');

export const isVisit = (x: unknown): x is VisitRecord =>
  isObj(x) && base(x) && isDateKey(x.date) && str(x, 'hospital') && str(x, 'reason') && strArr(x, 'photos');

export const isLab = (x: unknown): x is LabResult =>
  isObj(x) &&
  base(x) &&
  isDateKey(x.date) &&
  Array.isArray(x.items) &&
  (x.items as unknown[]).every((i) => isObj(i) && str(i, 'name') && num(i, 'value') && str(i, 'unit'));

export const isVaccine = (x: unknown): x is Vaccination =>
  isObj(x) && base(x) && str(x, 'name') && isDateKey(x.date) && (x.nextDate === undefined || isDateKey(x.nextDate));

export const isWeight = (x: unknown): x is WeightEntry =>
  isObj(x) && base(x) && isDateKey(x.date) && num(x, 'kg') && (x.kg as number) > 0;

export const isLog = (x: unknown): x is DailyLog =>
  isObj(x) &&
  base(x) &&
  isDateKey(x.date) &&
  typeof x.time === 'string' &&
  TIME_RE.test(x.time) &&
  oneOf(x, 'kind', ['meal', 'water', 'poop', 'vomit', 'note']) &&
  strArr(x, 'photos');

export const isSchedule = (x: unknown): x is Schedule =>
  isObj(x) &&
  base(x) &&
  str(x, 'title') &&
  oneOf(x, 'type', ['vaccine', 'medicine', 'hospital', 'grooming', 'etc']) &&
  str(x, 'dateTime') &&
  !Number.isNaN(new Date(x.dateTime as string).getTime()) &&
  oneOf(x, 'repeat', ['none', 'daily', 'weekly', 'monthly']) &&
  num(x, 'remindBefore') &&
  typeof x.done === 'boolean';
