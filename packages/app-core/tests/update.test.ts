import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions } from '../src/update/version.ts';
import { decideStoreUpdate, isValidManifest, shouldShowBanner } from '../src/update/policy.ts';

const manifest = {
  latestVersion: '1.2.0',
  minSupportedVersion: '1.0.0',
  storeUrl: { android: 'market://details?id=com.daro.pet' },
};

test('compareVersions', () => {
  assert.equal(compareVersions('1.2.10', '1.2.9'), 1);
  assert.equal(compareVersions('1.0', '1.0.0'), 0);
  assert.equal(compareVersions('v2.0.0', '1.9.9'), 1);
  assert.equal(compareVersions('1.0.0-beta', '1.0.1'), -1);
});

test('decideStoreUpdate', () => {
  assert.equal(decideStoreUpdate('0.9.0', manifest), 'force');
  assert.equal(decideStoreUpdate('1.0.0', manifest), 'optional');
  assert.equal(decideStoreUpdate('1.2.0', manifest), 'none');
  assert.equal(decideStoreUpdate('1.3.0', manifest), 'none');
});

test('isValidManifest', () => {
  assert.equal(isValidManifest(manifest), true);
  assert.equal(isValidManifest({ latestVersion: '1.0.0' }), false);
  assert.equal(isValidManifest(null), false);
});

test('shouldShowBanner', () => {
  assert.equal(shouldShowBanner('optional', '1.2.0', null), true);
  assert.equal(shouldShowBanner('optional', '1.2.0', '1.2.0'), false);
  assert.equal(shouldShowBanner('optional', '1.3.0', '1.2.0'), true);
  assert.equal(shouldShowBanner('force', '1.2.0', '1.2.0'), true);
  assert.equal(shouldShowBanner('none', '1.2.0', null), false);
});

test('isSafeStoreUrl: 스토어 주소만 허용', async () => {
  const { isSafeStoreUrl } = await import('../src/update/policy.ts');
  assert.equal(isSafeStoreUrl('market://details?id=com.daro.pet'), true);
  assert.equal(isSafeStoreUrl('https://play.google.com/store/apps/details?id=com.daro.pet'), true);
  assert.equal(isSafeStoreUrl('itms-apps://apps.apple.com/app/id123456789'), true);
  assert.equal(isSafeStoreUrl('https://apps.apple.com/kr/app/daro/id123456789'), true);
  assert.equal(isSafeStoreUrl('https://evil.example.com/phish'), false);
  assert.equal(isSafeStoreUrl('https://play.google.com.evil.com/store/apps/details?id=x'), false);
  assert.equal(isSafeStoreUrl('javascript:alert(1)'), false);
  assert.equal(isSafeStoreUrl('market://details?id=com.daro.pet&x=<script>'), false);
  assert.equal(isSafeStoreUrl(undefined), false);
});

test('sanitizeManifest: 변조/과도한 입력 정제', async () => {
  const { sanitizeManifest } = await import('../src/update/policy.ts');
  const ok = sanitizeManifest({
    latestVersion: '1.2.0',
    minSupportedVersion: '1.0.0',
    releaseNotes: ['a'.repeat(500), 1, 'b', 'c', 'd', 'e', 'f'],
    storeUrl: { android: 'https://evil.com', ios: 'itms-apps://apps.apple.com/app/id1' },
  });
  if (!ok) throw new Error('sanitizeManifest returned null');
  assert.equal(ok.storeUrl.android, undefined);
  assert.equal(ok.storeUrl.ios, 'itms-apps://apps.apple.com/app/id1');
  assert.equal(ok.releaseNotes!.length, 5);
  assert.equal(ok.releaseNotes![0].length, 120);
  assert.equal(sanitizeManifest({ latestVersion: '1.0; drop', minSupportedVersion: '1.0.0', storeUrl: {} }), null);
  assert.equal(sanitizeManifest('{}'), null);
});

test('isSecureManifestUrl: HTTPS 만 허용', async () => {
  const { isSecureManifestUrl } = await import('../src/update/policy.ts');
  assert.equal(isSecureManifestUrl('https://cdn.example.com/pet.json'), true);
  assert.equal(isSecureManifestUrl('http://cdn.example.com/pet.json'), false);
  assert.equal(isSecureManifestUrl('file:///etc/passwd'), false);
});
