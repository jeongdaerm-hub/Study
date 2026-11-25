import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { sha256Hex } from '../src/admin/sha256.ts';
import {
  ADMIN_SALT,
  EMPTY_LOCK,
  hashAdminCode,
  isLocked,
  isValidHash,
  recordAttempt,
  sanitizeLock,
  verifyAdminCode,
} from '../src/admin/adminCode.ts';

const node = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

test('sha256Hex matches Node crypto (empty, ascii, korean, block edges)', () => {
  const cases = ['', 'abc', '다로펫 관리자', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'x'.repeat(1000), '🐾🐶'];
  for (const c of cases) assert.equal(sha256Hex(c), node(c), JSON.stringify(c.slice(0, 10)));
});

test('hashAdminCode uses the salt and trims/normalizes', () => {
  assert.equal(hashAdminCode('  longcode123 '), node(ADMIN_SALT + 'longcode123'));
  assert.equal(hashAdminCode('ＡＢＣＤＥＦＧＨ'), hashAdminCode('ABCDEFGH')); // 전각 → 반각
});

test('verifyAdminCode', () => {
  const h = hashAdminCode('correct-horse-battery');
  assert.ok(isValidHash(h));
  assert.equal(verifyAdminCode('correct-horse-battery', h), true);
  assert.equal(verifyAdminCode('wrong-horse-battery', h), false);
  assert.equal(verifyAdminCode('short', hashAdminCode('short')), false, '8자 미만 거부');
  assert.equal(verifyAdminCode('correct-horse-battery', 'not-a-hash'), false);
  assert.equal(verifyAdminCode('correct-horse-battery', h.toUpperCase()), false);
});

test('lockout after 5 fails, grows, resets on success', () => {
  const now = 1_000_000;
  let st = EMPTY_LOCK;
  for (let i = 0; i < 4; i++) st = recordAttempt(st, false, now);
  assert.equal(isLocked(st, now), false);
  st = recordAttempt(st, false, now);
  assert.equal(isLocked(st, now), true);
  assert.equal(st.lockedUntil, now + 5 * 60_000);
  assert.equal(isLocked(st, now + 5 * 60_000 + 1), false);
  for (let i = 0; i < 5; i++) st = recordAttempt(st, false, now);
  assert.equal(st.lockedUntil, now + 10 * 60_000);
  for (let i = 0; i < 50; i++) st = recordAttempt(st, false, now);
  assert.ok(st.lockedUntil <= now + 60 * 60_000, '최대 1시간');
  assert.deepEqual(recordAttempt(st, true, now), EMPTY_LOCK);
});

test('sanitizeLock rejects tampered values', () => {
  assert.deepEqual(sanitizeLock(null), EMPTY_LOCK);
  assert.deepEqual(sanitizeLock({ fails: -3, lockedUntil: 'x' }), EMPTY_LOCK);
  assert.deepEqual(sanitizeLock({ fails: 2.5, lockedUntil: Infinity }), EMPTY_LOCK);
  assert.deepEqual(sanitizeLock({ fails: 3, lockedUntil: 10 }), { fails: 3, lockedUntil: 10 });
});
