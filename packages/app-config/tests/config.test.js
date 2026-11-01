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
  assert.deepEqual(createAppConfig(base).plugins, ['@react-native-community/datetimepicker']);
  const c = createAppConfig({ ...base, features: ['notifications', 'photos'] });
  const names = c.plugins.map((p) => (Array.isArray(p) ? p[0] : p));
  assert.deepEqual(names, ['expo-notifications', 'expo-image-picker', '@react-native-community/datetimepicker']);
  assert.equal(c.plugins[1][1].cameraPermission, false);
  assert.ok(c.android.permissions.includes('android.permission.POST_NOTIFICATIONS'));
});

test('매니페스트 URL 커스터마이즈', () => {
  const c = createAppConfig({ ...base, manifestBaseUrl: 'https://cdn.example.com/m/' });
  assert.equal(c.extra.versionManifestUrl, 'https://cdn.example.com/m/demo.json');
});

test('불필요·위험 안드로이드 권한 차단', () => {
  const blocked = createAppConfig(base).android.blockedPermissions;
  for (const p of ['SYSTEM_ALERT_WINDOW', 'READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE', 'RECORD_AUDIO', 'ACCESS_FINE_LOCATION']) {
    assert.ok(blocked.includes(`android.permission.${p}`), p);
  }
  assert.equal(createAppConfig(base).android.allowBackup, false);
});

test('카메라 기능을 켜면 CAMERA 권한 선언', () => {
  assert.ok(createAppConfig({ ...base, features: ['camera'] }).android.permissions.includes('android.permission.CAMERA'));
  assert.ok(!createAppConfig({ ...base, features: ['photos'] }).android.permissions.includes('android.permission.CAMERA'));
});
