import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../src/handler.ts';
import { ScanError, type Extractor } from '../src/extract.ts';
import { ScanSchema } from '../src/schema.ts';
import { demoScanResult } from '@daro/health-scan';

const NOW = new Date(2026, 10, 1, 12, 0);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...new Array(40).fill(1)]).toString('base64');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(40).fill(1)]).toString('base64');
const GIF = Buffer.from('GIF89a' + 'x'.repeat(40)).toString('base64');

let calls = 0;
const fake: Extractor = async (images, { todayKey }) => {
  calls++;
  assert.equal(todayKey, '2026-11-01');
  assert.ok(images.length >= 1);
  return {
    ...demoScanResult(todayKey),
    vaccines: [
      { name: 'DHPPL', date: '2025.10.05', nextDate: null, hospital: 'A', confidence: 'high' },
      { name: '광견병', date: '2030-01-01', nextDate: null, hospital: 'A', confidence: 'high' }, // 미래 → 제거
    ],
  };
};

function make(extractor: Extractor = fake, extra = {}) {
  return createHandler({ extractor, allowedOrigins: ['https://daro.example'], now: () => NOW, perMinute: 3, perDay: 10, ...extra });
}
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('http://x/v1/scan', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
const ok = { installId: 'install_12345', todayKey: '2026-11-01', images: [{ mediaType: 'image/jpeg', data: JPEG }] };

test('정상 요청 → 검증된 결과만 반환', async () => {
  const h = make();
  const res = await h(post(ok), '1.1.1.1');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.deepEqual(body.result.vaccines.map((v: { name: string }) => v.name), ['종합백신(DHPPL)']);
  assert.equal(body.dropped, 1);
});

test('잘못된 요청 차단', async () => {
  const h = make();
  const cases: [Request, number, string][] = [
    [post('{not json'), 400, 'bad_request'],
    [post({ ...ok, installId: '../../etc' }), 400, 'bad_request'],
    [post({ ...ok, images: [] }), 400, 'bad_request'],
    [post({ ...ok, images: Array(4).fill(ok.images[0]) }), 400, 'bad_request'],
    [post({ ...ok, images: [{ mediaType: 'image/jpeg', data: 'not base64!!' }] }), 400, 'bad_request'],
    [post({ ...ok, images: [{ mediaType: 'image/png', data: JPEG }] }), 415, 'unsupported_image'], // 형식 위장
    [post({ ...ok, images: [{ mediaType: 'image/gif', data: GIF }] }), 415, 'unsupported_image'],
    [post(ok, { 'content-type': 'text/plain' }), 415, 'bad_request'],
    [new Request('http://x/v1/scan', { method: 'GET' }), 405, 'method_not_allowed'],
    [new Request('http://x/admin', { method: 'GET' }), 404, 'not_found'],
  ];
  for (const [req, status, error] of cases) {
    const res = await h(req, `ip-${status}-${error}`);
    assert.equal(res.status, status, error);
    assert.equal((await res.json()).error, error);
  }
});

test('크기 제한', async () => {
  const h = make(fake, { maxImageBytes: 30 });
  const res = await h(post(ok), '2.2.2.2');
  assert.equal(res.status, 413);
  const big = make(fake, { maxImages: 1, maxImageBytes: 100 });
  const huge = await big(post({ ...ok, images: [{ mediaType: 'image/jpeg', data: 'A'.repeat(5000) }] }), '2.2.2.3');
  assert.equal(huge.status, 413);
});

test('CORS: 허용된 출처만', async () => {
  const h = make();
  const bad = await h(post(ok, { origin: 'https://evil.example' }), '3.3.3.3');
  assert.equal(bad.status, 403);
  const good = await h(post(ok, { origin: 'https://daro.example' }), '3.3.3.4');
  assert.equal(good.status, 200);
  assert.equal(good.headers.get('access-control-allow-origin'), 'https://daro.example');
  const pre = await h(new Request('http://x/v1/scan', { method: 'OPTIONS', headers: { origin: 'https://daro.example' } }), '3.3.3.5');
  assert.equal(pre.status, 204);
});

test('요청 제한: 분당 3회 + Retry-After', async () => {
  const h = make();
  for (let i = 0; i < 3; i++) assert.equal((await h(post({ ...ok, installId: 'rate_limit_1' }), '4.4.4.4')).status, 200);
  const blocked = await h(post({ ...ok, installId: 'rate_limit_1' }), '4.4.4.4');
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('retry-after')) > 0);
});

test('날짜 조작 방지: 서버 날짜 ±1일 밖이면 서버 날짜 사용', async () => {
  let seen = '';
  const h = make(async (_i, { todayKey }) => {
    seen = todayKey;
    return demoScanResult(todayKey);
  });
  await h(post({ ...ok, todayKey: '2099-01-01' }), '5.5.5.5');
  assert.equal(seen, '2026-11-01');
});

test('AI 오류 코드 매핑, 내부 메시지 미노출', async () => {
  for (const [code, status] of [['refused', 422], ['unreadable', 422], ['upstream_busy', 503], ['upstream_error', 502]] as const) {
    const h = make(async () => {
      throw new ScanError(code);
    });
    const res = await h(post(ok), `6.6.6.${status}`);
    assert.equal(res.status, status);
    assert.deepEqual(await res.json(), { ok: false, error: code });
  }
  const h = make(async () => {
    throw new Error('secret internal detail sk-ant-xxx');
  });
  const res = await h(post(ok), '6.6.6.7');
  const text = await res.text();
  assert.equal(res.status, 502);
  assert.ok(!text.includes('secret'));
  const garbage = make(async () => 'not an object');
  assert.equal((await garbage(post(ok), '6.6.6.8')).status, 422);
});

test('로그에 사진·결과 내용이 남지 않음', async () => {
  const logs: string[] = [];
  const h = make(fake, { log: (e: Record<string, unknown>) => logs.push(JSON.stringify(e)) });
  await h(post(ok), '7.7.7.7');
  assert.equal(logs.length, 1);
  assert.ok(!logs[0].includes(JPEG.slice(0, 10)));
  assert.ok(!logs[0].includes('다로동물병원'));
});

test('스키마가 데모 결과를 표현 가능 (앱·서버 형식 일치)', () => {
  assert.equal(ScanSchema.safeParse(demoScanResult('2026-11-01')).success, true);
  assert.ok(calls > 0);
});
