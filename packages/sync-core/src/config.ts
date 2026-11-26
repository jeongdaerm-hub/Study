/**
 * 가족 공유 서버(Supabase) 설정 검사
 *  - 주소: https://<프로젝트>.supabase.co 만 허용 (다른 서버로 기록이 새지 않도록)
 *  - 키: 공개용(anon / publishable) 키만. 관리자(service_role) 키는 거부
 */
export interface SyncConfig {
  url: string;
  anonKey: string;
}

const URL_RE = /^https:\/\/[a-z0-9]{8,40}\.supabase\.co$/;

export function isAllowedSupabaseUrl(url: unknown): url is string {
  return typeof url === 'string' && URL_RE.test(url);
}

/** JWT 의 role 이 service_role 이면 앱에 넣으면 안 되는 관리자 키 */
function jwtRole(key: string): string | null {
  const part = key.split('.')[1];
  if (!part) return null;
  try {
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '='));
    const role = (JSON.parse(json) as { role?: unknown }).role;
    return typeof role === 'string' ? role : null;
  } catch {
    return null;
  }
}

export function isPublicAnonKey(key: unknown): key is string {
  if (typeof key !== 'string' || key.length < 20 || key.length > 1000) return false;
  if (key.startsWith('sb_secret_')) return false;
  if (key.startsWith('sb_publishable_')) return /^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)) return false;
  return jwtRole(key) === 'anon';
}

/** 앱 설정(extra)에서 꺼내기. 잘못된 값이면 null → 가족 공유 꺼짐 */
export function readSyncConfig(extra: unknown): SyncConfig | null {
  const e = extra as { supabaseUrl?: unknown; supabaseAnonKey?: unknown } | null | undefined;
  const url = typeof e?.supabaseUrl === 'string' ? e.supabaseUrl.trim().replace(/\/$/, '') : '';
  const anonKey = typeof e?.supabaseAnonKey === 'string' ? e.supabaseAnonKey.trim() : '';
  return isAllowedSupabaseUrl(url) && isPublicAnonKey(anonKey) ? { url, anonKey } : null;
}
