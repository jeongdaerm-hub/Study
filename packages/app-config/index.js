// @ts-check
/**
 * @daro/app-config
 * 모든 앱의 app.config.js 가 이 함수 하나로 동일한 구조를 갖도록 표준화
 *  - OTA 업데이트(expo-updates) 설정
 *  - runtimeVersion 정책 (네이티브 호환성 보장)
 *  - 버전 매니페스트(version.json) URL → 스토어 업데이트 체크
 *  - 권한/플러그인 (사용 기능만 켜기)
 */
const path = require('path');

/** 버전 매니페스트 기본 위치: 이 저장소의 manifests/<slug>.json */
const DEFAULT_MANIFEST_BASE_URL =
  process.env.DARO_MANIFEST_BASE_URL || 'https://raw.githubusercontent.com/jeongdaerm-hub/Study/main/manifests';

/**
 * @param {import('./index').DaroAppOptions} o
 * @returns {import('./index').ExpoConfig}
 */
/** 테스트 앱 식별자 접미사 (설치된 앱 ID 로 판별 → OTA 로 바뀌지 않음) */
const PREVIEW_SUFFIX = '.preview';

/** 관리자 코드 해시: 64자리 16진수만 허용 (잘못된 값이면 관리자 기능 꺼짐) */
function adminHashEntry(v) {
  const h = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return /^[0-9a-f]{64}$/.test(h) ? { adminCodeHash: h } : {};
}

function createAppConfig(o) {
  const features = new Set(o.features || []);
  // 'preview' = 내 폰 확인용 테스트 앱 (실제 앱과 나란히 설치, 데이터 분리)
  const variant = (o.variant || process.env.APP_VARIANT || 'production') === 'preview' ? 'preview' : 'production';
  const preview = variant === 'preview';
  const appName = preview ? `${o.name} 테스트` : o.name;
  const bundleId = preview ? `${o.bundleId}${PREVIEW_SUFFIX}` : o.bundleId;
  // OTA 채널: 테스트 앱은 preview, 실제 앱은 production 업데이트만 받음
  const channel = preview ? 'preview' : 'production';
  /** @type {any[]} */
  const plugins = [];
  /** @type {string[]} */
  const androidPermissions = [];

  if (features.has('notifications')) {
    plugins.push(['expo-notifications', { color: o.brandColor }]);
    androidPermissions.push('android.permission.POST_NOTIFICATIONS', 'android.permission.SCHEDULE_EXACT_ALARM');
  }
  if (features.has('camera')) androidPermissions.push('android.permission.CAMERA');
  if (features.has('photos') || features.has('camera')) {
    plugins.push([
      'expo-image-picker',
      {
        photosPermission: o.permissionText?.photos || '사진을 첨부하려면 사진 접근 권한이 필요해요.',
        cameraPermission: features.has('camera')
          ? o.permissionText?.camera || '사진을 촬영하려면 카메라 권한이 필요해요.'
          : false,
      },
    ]);
  }
  // 공통 날짜·시간 선택(@daro/app-core DateTimeField) 네이티브 설정
  plugins.push('@react-native-community/datetimepicker');
  plugins.push(...(o.plugins || []));

  const manifestBase = (o.manifestBaseUrl || DEFAULT_MANIFEST_BASE_URL).replace(/\/$/, '');

  return {
    name: appName,
    slug: o.slug,
    version: o.version,
    orientation: 'portrait',
    // 앱 버전이 같으면 같은 네이티브 → OTA 호환. 네이티브 변경 시 version 을 올리면 자동 분리
    runtimeVersion: { policy: 'appVersion' },
    updates: {
      enabled: true,
      checkAutomatically: 'NEVER', // 확인은 @daro/app-core UpdateGate 가 담당
      // 실행을 기다리게 하지 않음: 새 업데이트는 내려받아 두었다가 다음 실행 때 적용
      fallbackToCacheTimeout: 0,
      requestHeaders: { 'expo-channel-name': channel },
      ...(o.easProjectId ? { url: `https://u.expo.dev/${o.easProjectId}` } : {}),
    },
    ios: { bundleIdentifier: bundleId, supportsTablet: false },
    // 웹 미리보기 (기획·QA 확인용 정적 빌드)
    web: { bundler: 'metro', output: 'single', name: appName, themeColor: o.brandColor },
    android: {
      package: bundleId,
      permissions: androidPermissions,
      // 보안: 불필요한 권한 차단 + 앱 데이터 클라우드 자동 백업 해제(기기 밖 유출 방지)
      blockedPermissions: [
        'android.permission.RECORD_AUDIO',
        'android.permission.ACCESS_FINE_LOCATION',
        // 다른 앱 위에 그리기: 불필요하고 피싱 화면 등에 악용될 수 있음
        'android.permission.SYSTEM_ALERT_WINDOW',
        // 전체 저장소 접근: 안드로이드 사진 선택기는 권한 없이 동작
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
      ],
      allowBackup: false,
    },
    plugins,
    extra: {
      ...(o.extra || {}),
      variant,
      versionManifestUrl: o.versionManifestUrl || `${manifestBase}/${o.slug}.json`,
      // 사진 인식 등 앱 전용 API 주소 (비밀값 아님. API 키는 서버에만)
      ...(o.apiUrl ? { apiUrl: o.apiUrl } : {}),
      // 나(관리자) 영역 잠금: 코드 '원문'이 아닌 해시만. GitHub Secret DARO_ADMIN_CODE_HASH
      ...adminHashEntry(o.adminCodeHash ?? process.env.DARO_ADMIN_CODE_HASH),
      ...(o.easProjectId ? { eas: { projectId: o.easProjectId } } : {}),
    },
  };
}

/**
 * Metro 모노레포 설정: 공통 패키지(packages/*) 변경을 앱에서 바로 반영
 * @param {string} projectRoot 앱 폴더 (__dirname)
 */
function createMetroConfig(projectRoot) {
  const { getDefaultConfig } = require(require.resolve('expo/metro-config', { paths: [projectRoot] }));
  const workspaceRoot = path.resolve(projectRoot, '../..');
  const config = getDefaultConfig(projectRoot);
  config.watchFolders = [workspaceRoot];
  config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
  ];
  config.resolver.disableHierarchicalLookup = true;
  return config;
}

module.exports = { createAppConfig, createMetroConfig, DEFAULT_MANIFEST_BASE_URL, PREVIEW_SUFFIX };
