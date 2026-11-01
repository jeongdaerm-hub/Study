/**
 * 안전한 JSON POST (앱 공통)
 *  - HTTPS 만 허용 (개발 중 localhost 예외)
 *  - 시간 제한 + 응답 크기 제한
 *  - 실패해도 예외 대신 결과 객체로 반환
 */
export interface PostResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  /** network | timeout | too_large | bad_json | insecure_url | cancelled */
  failure?: string;
}

export function isAllowedApiUrl(url: string, allowLocalhost = false): boolean {
  if (/^https:\/\/[^\s/]+(\/\S*)?$/.test(url)) return true;
  return allowLocalhost && /^http:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?(\/\S*)?$/.test(url);
}

export async function postJson<T>(
  url: string,
  body: unknown,
  opts: { timeoutMs?: number; signal?: AbortSignal; maxResponseBytes?: number; allowLocalhost?: boolean } = {},
): Promise<PostResult<T>> {
  if (!isAllowedApiUrl(url, opts.allowLocalhost)) return { ok: false, status: 0, data: null, failure: 'insecure_url' };
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  opts.signal?.addEventListener('abort', onAbort);
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, opts.timeoutMs ?? 90_000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (text.length > (opts.maxResponseBytes ?? 512_000)) return { ok: false, status: res.status, data: null, failure: 'too_large' };
    let data: T | null = null;
    try {
      data = text ? (JSON.parse(text) as T) : null;
    } catch {
      return { ok: false, status: res.status, data: null, failure: 'bad_json' };
    }
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null, failure: opts.signal?.aborted ? 'cancelled' : timedOut ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onAbort);
  }
}
