// @ts-check
const { createAppConfig } = require('@daro/app-config');

module.exports = createAppConfig({
  name: '다로펫',
  slug: 'pet',
  version: '1.0.0',
  bundleId: 'com.daro.pet',
  brandColor: '#FF8A00',
  easProjectId: process.env.EAS_PROJECT_ID_PET, // `eas init` 후 값 입력 또는 환경변수
  features: ['notifications', 'photos', 'camera'],
  permissionText: {
    photos: '반려동물 일기에 사진을 첨부하려면 사진 접근 권한이 필요해요.',
    camera: '반려동물 사진을 촬영하려면 카메라 권한이 필요해요.',
  },
});
