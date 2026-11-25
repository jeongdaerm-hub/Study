// @ts-check
const { createAppConfig } = require('@daro/app-config');

module.exports = createAppConfig({
  name: '__APP_NAME__',
  slug: '__SLUG__',
  version: '1.0.0',
  bundleId: '__BUNDLE_ID__',
  brandColor: '__BRAND_COLOR__',
  easProjectId: process.env.EAS_PROJECT_ID___SLUG_ENV__, // `eas init` 후 값 입력 또는 환경변수
  // 사용하는 기능만 켜기: 'notifications' | 'photos' | 'camera'
  features: ['notifications'],
});
