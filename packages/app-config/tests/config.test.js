const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createAppConfig } = require('../index.js');

const base = { name: '테스트', slug: 'demo', version: '1.2.0', bundleId: 'com.daro.demo' };

test('공통 업데이트 구조가 항상 들어감', () => {
  const c = createAppConfig({ ...base, easProjectId: 'abc' });
  assert.deepEqual(c.runtimeVersion, { policy: 'appVersion' });
  assert.equal(c.updates.checkAutomatically, 'NEVER');
  assert.equal(c.updates.url, 'https://u.expo.dev/abc');
  assert.equal(c.extra.eas.projectId, 'abc');
  assert.match(c.extra.versionManifestUrl, /\/demo\.json$/);
});

test('기능 선택에 따라 플러그인/권한만 켜짐', () => {
  assert.equal(createAppConfig(base).plugins.length, 0);
  const c = createAppConfig({ ...base, features: ['notifications', 'photos'] });
  const names = c.plugins.map((p) => (Array.isArray(p) ? p[0] : p));
  assert.deepEqual(names, ['expo-notifications', 'expo-image-picker']);
  assert.equal(c.plugins[1][1].cameraPermission, false);
  assert.ok(c.android.permissions.includes('android.permission.POST_NOTIFICATIONS'));
});

test('매니페스트 URL 커스터마이즈', () => {
  const c = createAppConfig({ ...base, manifestBaseUrl: 'https://cdn.example.com/m/' });
  assert.equal(c.extra.versionManifestUrl, 'https://cdn.example.com/m/demo.json');
});
