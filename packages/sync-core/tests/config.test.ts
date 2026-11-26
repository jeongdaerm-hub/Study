import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedSupabaseUrl, isPublicAnonKey, readSyncConfig } from '../src/config.ts';

const jwt = (role: string) => ['e30', Buffer.from(JSON.stringify({ role, iss: 'supabase' })).toString('base64url'), 'sig'].join('.');

test('서버 주소: supabase.co HTTPS 만', () => {
  assert.equal(isAllowedSupabaseUrl('https://abcdefghijklmnopqrst.supabase.co'), true);
  assert.equal(isAllowedSupabaseUrl('http://abcdefghijklmnopqrst.supabase.co'), false);
  assert.equal(isAllowedSupabaseUrl('https://evil.com/abcdefgh.supabase.co'), false);
  assert.equal(isAllowedSupabaseUrl('https://abcdefghij.supabase.co.evil.com'), false);
});

test('키: 공개(anon) 키만, 관리자 키 거부', () => {
  assert.equal(isPublicAnonKey(jwt('anon')), true);
  assert.equal(isPublicAnonKey(jwt('service_role')), false);
  assert.equal(isPublicAnonKey('sb_publishable_abcDEF123_-xyz456789'), true);
  assert.equal(isPublicAnonKey('sb_secret_abcDEF123_-xyz456789abc'), false);
  assert.equal(isPublicAnonKey('short'), false);
});

test('앱 설정 읽기: 하나라도 잘못되면 꺼짐', () => {
  const url = 'https://abcdefghijklmnopqrst.supabase.co/';
  assert.deepEqual(readSyncConfig({ supabaseUrl: url, supabaseAnonKey: jwt('anon') }), { url: url.slice(0, -1), anonKey: jwt('anon') });
  assert.equal(readSyncConfig({ supabaseUrl: url, supabaseAnonKey: jwt('service_role') }), null);
  assert.equal(readSyncConfig({}), null);
  assert.equal(readSyncConfig(undefined), null);
});
