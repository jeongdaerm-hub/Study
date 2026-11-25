import { sha256Hex } from './sha256.ts';

/**
 * 관리자(나) 모드 잠금 — 순수 로직 (단위 테스트 대상)
 *
 * - 앱에는 관리자 코드 '원문'이 아니라 해시(지문)만 들어감
 *   → 코드는 GitHub Secret DARO_ADMIN_CODE_HASH 로 빌드 때만 주입
 * - 5번 틀리면 잠깐 잠금, 계속 틀리면 잠금 시간이 늘어남 (무작정 대입 방지)
 * - 관리자 모드로 할 수 있는 일: 배포 전(테스트) 버전 미리 보기. 다른 사용자 데이터 접근 없음
 */
export const ADMIN_SALT = 'daro-admin-v1:';
export const MIN_CODE_LENGTH = 8;
export const MAX_FAILS = 5;
const BASE_LOCK_MS = 5 * 60 * 1000;
const MAX_LOCK_MS = 60 * 60 * 1000;

export function normalizeCode(code: string): string {
  return code.normalize('NFKC').trim();
}

/** 관리자 코드 → 앱에 넣을 해시 (scripts/admin-code-hash.mjs 와 같은 계산) */
export function hashAdminCode(code: string): string {
  return sha256Hex(ADMIN_SALT + normalizeCode(code));
}

export function isValidHash(hash: unknown): hash is string {
  return typeof hash === 'string' && /^[0-9a-f]{64}$/.test(hash);
}

/** 길이가 같은 문자열 비교를 끝까지 수행 (비교 시간으로 힌트를 주지 않음) */
function sameHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function verifyAdminCode(code: string, expectedHash: string): boolean {
  if (!isValidHash(expectedHash)) return false;
  if (normalizeCode(code).length < MIN_CODE_LENGTH) return false;
  return sameHex(hashAdminCode(code), expectedHash);
}

export interface LockState {
  fails: number;
  lockedUntil: number;
}

export const EMPTY_LOCK: LockState = { fails: 0, lockedUntil: 0 };

export function isLocked(st: LockState, now: number): boolean {
  return st.lockedUntil > now;
}

/** 시도 결과 반영 → 다음 잠금 상태 */
export function recordAttempt(st: LockState, ok: boolean, now: number): LockState {
  if (ok) return EMPTY_LOCK;
  const fails = st.fails + 1;
  if (fails < MAX_FAILS) return { fails, lockedUntil: 0 };
  const rounds = Math.floor(fails / MAX_FAILS) - 1; // 5회:5분, 10회:10분, 15회:20분 … 최대 1시간
  const ms = Math.min(BASE_LOCK_MS * 2 ** rounds, MAX_LOCK_MS);
  return { fails, lockedUntil: fails % MAX_FAILS === 0 ? now + ms : st.lockedUntil };
}

export function sanitizeLock(x: unknown): LockState {
  const o = x as Partial<LockState> | null;
  const fails = Number.isInteger(o?.fails) && (o!.fails as number) >= 0 ? (o!.fails as number) : 0;
  const lockedUntil = Number.isFinite(o?.lockedUntil) ? Math.max(0, o!.lockedUntil as number) : 0;
  return { fails: Math.min(fails, 1000), lockedUntil };
}

/** 잠금 남은 시간 안내 문구 */
export function lockMessage(st: LockState, now: number): string {
  const min = Math.max(1, Math.ceil((st.lockedUntil - now) / 60000));
  return `여러 번 틀려서 잠겼어요. ${min}분 뒤에 다시 시도해 주세요.`;
}
