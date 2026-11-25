import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions } from '@daro/app-core/logic.ts';

// 앱 전용 순수 로직 테스트를 이 폴더에 추가하세요 (React Native 의존 없는 코드)
test('공통 로직 import 확인', () => {
  assert.equal(compareVersions('1.0.1', '1.0.0'), 1);
});
