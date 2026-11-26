const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createAppConfig } = require('../index.js');

// CI 의 APK 빌드는 APP_VARIANT=preview 로 실행되므로 테스트는 환경변수 영향 없이 시작
delete process.env.APP_VARIANT;
delete process.env.DARO_ADMIN_CODE_HASH;
delete process.env.DARO_SUPABASE_URL;
delete process.env.DARO_SUPABASE_ANON_KEY;

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

test('테스트 앱(preview): 이름·앱 ID·채널 분리, 실제 앱은 그대로', () => {
  const prod = createAppConfig(base);
  assert.equal(prod.name, '테스트');
  assert.equal(prod.android.package, 'com.daro.demo');
  assert.equal(prod.updates.requestHeaders['expo-channel-name'], 'production');
  assert.equal(prod.extra.variant, 'production');

  const pre = createAppConfig({ ...base, variant: 'preview' });
  assert.equal(pre.name, '테스트 테스트');
  assert.equal(pre.android.package, 'com.daro.demo.preview');
  assert.equal(pre.ios.bundleIdentifier, 'com.daro.demo.preview');
  assert.equal(pre.updates.requestHeaders['expo-channel-name'], 'preview');
  assert.equal(pre.extra.variant, 'preview');
  // 버전 정책은 같아야 같은 업데이트를 두 채널에 그대로 쓸 수 있음
  assert.deepEqual(pre.runtimeVersion, prod.runtimeVersion);
});

test('APP_VARIANT 환경변수로 선택, 알 수 없는 값은 production', () => {
  const old = process.env.APP_VARIANT;
  try {
    process.env.APP_VARIANT = 'preview';
    assert.equal(createAppConfig(base).android.package, 'com.daro.demo.preview');
    process.env.APP_VARIANT = 'hacker';
    assert.equal(createAppConfig(base).android.package, 'com.daro.demo');
  } finally {
    if (old === undefined) delete process.env.APP_VARIANT;
    else process.env.APP_VARIANT = old;
  }
});

test('관리자 코드 해시: 올바른 64자리 해시만 들어감', () => {
  const h = 'a'.repeat(64);
  assert.equal(createAppConfig({ ...base, adminCodeHash: h }).extra.adminCodeHash, h);
  assert.equal(createAppConfig({ ...base, adminCodeHash: ' ' + h.toUpperCase() }).extra.adminCodeHash, h);
  assert.equal(createAppConfig({ ...base, adminCodeHash: 'my-plain-password' }).extra.adminCodeHash, undefined);
  assert.equal(createAppConfig(base).extra.adminCodeHash, undefined);
});

test('가족 공유 서버: 공개 키만, 관리자 키면 빌드 중단', () => {
  const jwt = (role) => ['e30', Buffer.from(JSON.stringify({ role })).toString('base64url'), 'sig'].join('.');
  const url = 'https://abcdefghijklmnopqrst.supabase.co/';
  const c = createAppConfig({ ...base, supabaseUrl: url, supabaseAnonKey: jwt('anon') });
  assert.equal(c.extra.supabaseUrl, 'https://abcdefghijklmnopqrst.supabase.co');
  assert.equal(c.extra.supabaseAnonKey, jwt('anon'));
  assert.throws(() => createAppConfig({ ...base, supabaseUrl: url, supabaseAnonKey: jwt('service_role') }), /service_role/);
  assert.throws(() => createAppConfig({ ...base, supabaseUrl: url, supabaseAnonKey: 'sb_secret_abc123' }), /secret/);
  assert.equal(createAppConfig(base).extra.supabaseUrl, undefined);
});
