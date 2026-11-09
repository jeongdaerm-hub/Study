/**
 * 사진 인식 API (웹 표준 Request/Response → Node·Cloudflare Workers 공용)
 *
 * POST /v1/scan   { installId, todayKey?, images: [{ mediaType, data(base64) }] }
 * GET  /health
 *
 * 보안
 *  - API 키는 서버 환경변수에만 (앱에 없음)
 *  - 요청 크기·이미지 개수·형식(매직 바이트) 검사
 *  - 설치 ID + IP 기준 분당/일간 요청 제한
 *  - 허용된 웹 출처만 CORS 허용 (네이티브 앱은 Origin 없음)
 *  - 사진·결과를 저장하거나 로그로 남기지 않음
 *  - AI 결과는 sanitizeScan 으로 재검증 후 반환
 */
import { sanitizeScan, toKey } from '@daro/health-scan';
import { RateLimiter } from './rateLimit.ts';
import { ScanError, type Extractor, type ImageInput, type ImageMediaType } from './extract.ts';

export interface HandlerConfig {
  extractor: Extractor;
  /** 브라우저에서 호출을 허용할 출처 (네이티브 앱은 Origin 헤더가 없어 해당 없음) */
  allowedOrigins: string[];
  perMinute?: number;
  perDay?: number;
  maxImages?: number;
  /** 이미지 1장 최대 바이트 (디코딩 후) */
  maxImageBytes?: number;
  now?: () => Date;
  /** 운영 지표 로그 (본문·사진 내용은 절대 포함하지 않음) */
  log?: (event: Record<string, string | number>) => void;
}

const SECURITY_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

const INSTALL_ID = /^[A-Za-z0-9_-]{8,64}$/;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

function detectType(bytes: Uint8Array): ImageMediaType | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  const ascii = (a: number, b: number) => String.fromCharCode(...bytes.slice(a, b));
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  return null;
}

const decodedLength = (b64: string) => Math.floor((b64.length * 3) / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);

function head(b64: string): Uint8Array {
  const bin = atob(b64.slice(0, 24));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function readLimited(req: Request, max: number): Promise<string | null> {
  const len = Number(req.headers.get('content-length') ?? '0');
  if (len > max) return null;
  if (!req.body) return '';
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    buf.set(c, off);
    off += c.byteLength;
  }
  return new TextDecoder().decode(buf);
}

export function createHandler(cfg: HandlerConfig) {
  const maxImages = cfg.maxImages ?? 3;
  const maxImageBytes = cfg.maxImageBytes ?? 4_000_000;
  const maxBody = Math.ceil(maxImages * maxImageBytes * 1.4) + 4096;
  const now = cfg.now ?? (() => new Date());
  const minute = new RateLimiter(cfg.perMinute ?? 5, 60_000, () => now().getTime());
  const day = new RateLimiter(cfg.perDay ?? 50, 86_400_000, () => now().getTime());
  const ipMinute = new RateLimiter((cfg.perMinute ?? 5) * 4, 60_000, () => now().getTime());
  const log = cfg.log ?? (() => {});

  return async function handle(req: Request, clientIp: string): Promise<Response> {
    const url = new URL(req.url);
    const origin = req.headers.get('origin');
    const cors: Record<string, string> = {};
    if (origin) {
      if (!cfg.allowedOrigins.includes(origin)) return json(403, { ok: false, error: 'origin_not_allowed' });
      cors['Access-Control-Allow-Origin'] = origin;
      cors['Vary'] = 'Origin';
    }
    const reply = (status: number, body: unknown, extra: Record<string, string> = {}) => json(status, body, { ...cors, ...extra });

    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: { ...cors, 'Access-Control-Allow-Methods': 'POST, GET', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' },
      });
    }
    if (url.pathname === '/health' && req.method === 'GET') return reply(200, { ok: true });
    if (url.pathname !== '/v1/scan') return reply(404, { ok: false, error: 'not_found' });
    if (req.method !== 'POST') return reply(405, { ok: false, error: 'method_not_allowed' });
    if (!(req.headers.get('content-type') ?? '').startsWith('application/json')) return reply(415, { ok: false, error: 'bad_request' });

    const started = Date.now();
    const text = await readLimited(req, maxBody);
    if (text === null) return reply(413, { ok: false, error: 'too_large' });
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return reply(400, { ok: false, error: 'bad_request' });
    }
    if (!body || typeof body !== 'object') return reply(400, { ok: false, error: 'bad_request' });
    const { installId, images, todayKey } = body as { installId?: unknown; images?: unknown; todayKey?: unknown };
    if (typeof installId !== 'string' || !INSTALL_ID.test(installId)) return reply(400, { ok: false, error: 'bad_request' });
    if (!Array.isArray(images) || images.length === 0 || images.length > maxImages) return reply(400, { ok: false, error: 'bad_request' });

    // 요청 제한: 설치 ID 기준 + IP 기준
    const wait = Math.max(minute.take(installId), day.take(installId), ipMinute.take(clientIp));
    if (wait > 0) return reply(429, { ok: false, error: 'rate_limited' }, { 'Retry-After': String(wait) });

    const inputs: ImageInput[] = [];
    for (const img of images) {
      const { mediaType, data } = (img ?? {}) as { mediaType?: unknown; data?: unknown };
      if (typeof data !== 'string' || !BASE64.test(data)) return reply(400, { ok: false, error: 'bad_request' });
      if (decodedLength(data) > maxImageBytes) return reply(413, { ok: false, error: 'too_large' });
      const detected = detectType(head(data));
      if (!detected || detected !== mediaType) return reply(415, { ok: false, error: 'unsupported_image' });
      inputs.push({ mediaType: detected, data });
    }

    // 날짜 기준: 기기 날짜를 쓰되 서버 날짜와 ±1일 이내일 때만 (조작 방지)
    const serverToday = now();
    const okKeys = [-1, 0, 1].map((d) => toKey(new Date(serverToday.getTime() + d * 86_400_000)));
    const today = typeof todayKey === 'string' && okKeys.includes(todayKey) ? todayKey : okKeys[1];

    try {
      const raw = await cfg.extractor(inputs, { todayKey: today, signal: req.signal });
      const clean = sanitizeScan(raw, today);
      if (!clean) throw new ScanError('unreadable');
      log({ event: 'scan_ok', ms: Date.now() - started, images: inputs.length, dropped: clean.dropped });
      return reply(200, { ok: true, result: clean.result, dropped: clean.dropped });
    } catch (e) {
      const code = e instanceof ScanError ? e.code : 'upstream_error';
      log({ event: 'scan_fail', code, ms: Date.now() - started });
      const status = code === 'refused' || code === 'unreadable' || code === 'too_long' ? 422 : code === 'upstream_busy' ? 503 : 502;
      return reply(status, { ok: false, error: code });
    }
  };
}

function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...SECURITY_HEADERS, ...extra } });
}
