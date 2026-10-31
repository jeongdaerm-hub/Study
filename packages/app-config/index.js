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
function createAppConfig(o) {
  const features = new Set(o.features || []);
  /** @type {any[]} */
  const plugins = [];
  /** @type {string[]} */
  const androidPermissions = [];

  if (features.has('notifications')) {
    plugins.push(['expo-notifications', { color: o.brandColor }]);
    androidPermissions.push('android.permission.POST_NOTIFICATIONS', 'android.permission.SCHEDULE_EXACT_ALARM');
  }
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
  plugins.push(...(o.plugins || []));

  const manifestBase = (o.manifestBaseUrl || DEFAULT_MANIFEST_BASE_URL).replace(/\/$/, '');

  return {
    name: o.name,
    slug: o.slug,
    version: o.version,
    orientation: 'portrait',
    // 앱 버전이 같으면 같은 네이티브 → OTA 호환. 네이티브 변경 시 version 을 올리면 자동 분리
    runtimeVersion: { policy: 'appVersion' },
    updates: {
      enabled: true,
      checkAutomatically: 'NEVER', // 확인은 @daro/app-core UpdateGate 가 담당
      fallbackToCacheTimeout: 0,
      ...(o.easProjectId ? { url: `https://u.expo.dev/${o.easProjectId}` } : {}),
    },
    ios: { bundleIdentifier: o.bundleId, supportsTablet: false },
    android: { package: o.bundleId, permissions: androidPermissions },
    plugins,
    extra: {
      ...(o.extra || {}),
      versionManifestUrl: o.versionManifestUrl || `${manifestBase}/${o.slug}.json`,
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

module.exports = { createAppConfig, createMetroConfig, DEFAULT_MANIFEST_BASE_URL };
