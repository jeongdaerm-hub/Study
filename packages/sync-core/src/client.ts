import type { SyncConfig } from './config.ts';
import type { ServerRow } from './engine.ts';

/**
 * Supabase REST 최소 클라이언트 (라이브러리 없이 fetch 만 사용)
 *  - 로그인: 이메일로 받은 인증 코드 (비밀번호 없음)
 *  - 기록: RPC(upsert_item) 로 쓰고, items 표에서 읽기 (권한은 서버 RLS 가 검사)
 */
export interface Session {
  accessToken: string;
  refreshToken: string;
  /** ms */
  expiresAt: number;
  userId: string;
  email: string;
}

export class SyncError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'SyncError';
    this.code = code;
  }
}

const TIMEOUT_MS = 15_000;

/** 서버 오류 → 사용자에게 보여줄 말 */
const FRIENDLY: Record<string, string> = {
  network: '인터넷 연결을 확인해 주세요.',
  invalid_code: '인증 코드가 맞지 않거나 시간이 지났어요. 새 코드를 받아 주세요.',
  rate_limited: '요청이 너무 많아요. 잠시 뒤에 다시 시도해 주세요.',
  already_in_family: '이미 가족에 들어가 있어요.',
  invalid_invite: '초대 코드가 맞지 않거나, 이미 사용했거나, 24시간이 지났어요.',
  family_full: '가족은 최대 10명까지예요.',
  too_many_invites: '아직 쓰지 않은 초대 코드가 너무 많아요. 잠시 뒤에 다시 만들어 주세요.',
  not_in_family: '가족에 들어가 있지 않아요.',
  unauthorized: '다시 로그인해 주세요.',
  server: '서버에 문제가 있어요. 잠시 뒤에 다시 시도해 주세요.',
};

export function friendly(code: string): string {
  return FRIENDLY[code] ?? FRIENDLY.server;
}

async function call(cfg: SyncConfig, path: string, init: { method: string; body?: unknown; token?: string; headers?: Record<string, string> }): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${cfg.url}${path}`, {
      method: init.method,
      headers: {
        apikey: cfg.anonKey,
        'Content-Type': 'application/json',
        Authorization: `Bearer ${init.token ?? cfg.anonKey}`,
        ...init.headers,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: ctrl.signal,
    });
  } catch {
    throw new SyncError('network', friendly('network'));
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (res.ok) return json;
  const msg = String((json as { message?: unknown; msg?: unknown; error_description?: unknown } | null)?.message ?? (json as { msg?: unknown } | null)?.msg ?? (json as { error_description?: unknown } | null)?.error_description ?? '');
  const known = Object.keys(FRIENDLY).find((k) => msg.includes(k));
  const code = known ?? (res.status === 401 || res.status === 403 ? 'unauthorized' : res.status === 429 ? 'rate_limited' : 'server');
  throw new SyncError(code, friendly(code));
}

export const isEmail = (s: string) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(s.trim());

/** 1) 이메일로 인증 코드 보내기 (처음이면 계정도 만들어짐) */
export async function sendEmailCode(cfg: SyncConfig, email: string): Promise<void> {
  await call(cfg, '/auth/v1/otp', { method: 'POST', body: { email: email.trim().toLowerCase(), create_user: true } });
}

function toSession(json: unknown): Session {
  const j = json as { access_token?: string; refresh_token?: string; expires_in?: number; user?: { id?: string; email?: string } };
  if (!j?.access_token || !j.refresh_token || !j.user?.id) throw new SyncError('server', friendly('server'));
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token,
    expiresAt: Date.now() + (j.expires_in ?? 3600) * 1000,
    userId: j.user.id,
    email: j.user.email ?? '',
  };
}

/** 2) 받은 코드 확인 → 로그인 */
export async function verifyEmailCode(cfg: SyncConfig, email: string, code: string): Promise<Session> {
  const token = code.replace(/\s/g, '');
  if (!/^\d{6,10}$/.test(token)) throw new SyncError('invalid_code', friendly('invalid_code'));
  try {
    return toSession(await call(cfg, '/auth/v1/verify', { method: 'POST', body: { type: 'email', email: email.trim().toLowerCase(), token } }));
  } catch (e) {
    if (e instanceof SyncError && (e.code === 'unauthorized' || e.code === 'server')) throw new SyncError('invalid_code', friendly('invalid_code'));
    throw e;
  }
}

export async function refreshSession(cfg: SyncConfig, s: Session): Promise<Session> {
  return toSession(await call(cfg, '/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: s.refreshToken } }));
}

export async function signOut(cfg: SyncConfig, s: Session): Promise<void> {
  await call(cfg, '/auth/v1/logout', { method: 'POST', token: s.accessToken }).catch(() => undefined);
}

export async function rpc<T>(cfg: SyncConfig, token: string, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  return (await call(cfg, `/rest/v1/rpc/${fn}`, { method: 'POST', body: args, token })) as T;
}

export interface FamilyInfo {
  id: string;
  name: string;
  members: { userId: string; name: string; role: 'owner' | 'member' }[];
}

/** 내 가족 정보 (없으면 null) */
export async function fetchFamily(cfg: SyncConfig, token: string): Promise<FamilyInfo | null> {
  const fams = (await call(cfg, '/rest/v1/families?select=id,name', { method: 'GET', token })) as { id: string; name: string }[];
  const fam = fams?.[0];
  if (!fam) return null;
  const members = (await call(cfg, `/rest/v1/family_members?select=user_id,display_name,role&family_id=eq.${encodeURIComponent(fam.id)}&order=joined_at`, {
    method: 'GET',
    token,
  })) as { user_id: string; display_name: string; role: 'owner' | 'member' }[];
  return { id: fam.id, name: fam.name, members: members.map((m) => ({ userId: m.user_id, name: m.display_name, role: m.role })) };
}

export const PAGE = 500;

/** seq 이후 변경된 기록 한 페이지 */
export async function fetchItems(cfg: SyncConfig, token: string, familyId: string, afterSeq: number): Promise<ServerRow[]> {
  const q = `select=collection,id,data,deleted,rev,seq&family_id=eq.${encodeURIComponent(familyId)}&seq=gt.${afterSeq}&order=seq.asc&limit=${PAGE}`;
  return (await call(cfg, `/rest/v1/items?${q}`, { method: 'GET', token })) as ServerRow[];
}

export interface UpsertResult {
  status: 'ok' | 'conflict';
  rev: number;
  seq: number;
  data: Record<string, unknown> | null;
  deleted: boolean;
}

export async function upsertItem(cfg: SyncConfig, token: string, op: { collection: string; id: string; data: Record<string, unknown> | null; baseRev: number }): Promise<UpsertResult> {
  const rows = await rpc<UpsertResult[]>(cfg, token, 'upsert_item', {
    p_collection: op.collection,
    p_id: op.id,
    p_data: op.data,
    p_deleted: op.data === null,
    p_base_rev: op.baseRev,
  });
  const r = rows?.[0];
  if (!r) throw new SyncError('server', friendly('server'));
  return r;
}
