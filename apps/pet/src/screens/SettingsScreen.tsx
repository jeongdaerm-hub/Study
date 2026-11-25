import React from 'react';
import { Text } from 'react-native';
import { AppInfoAndAdmin } from '@daro/app-core';
import { useAppData } from '../state/AppData.tsx';
import { Card, Screen, SectionTitle, s } from '../components/common.tsx';

/**
 * 설정
 *  - 일반 사용자: 기록 보관 안내, 앱 정보
 *  - 나(관리자): 앱 정보의 '버전'을 7번 누르면 맨 아래에 관리자 영역이 나타남
 *    (테스트 앱에서는 처음부터 보임)
 */
export function SettingsScreen() {
  const { db } = useAppData();
  return (
    <Screen>
      <SectionTitle title="내 기록" />
      <Card>
        <Text style={s.title}>반려동물 {db.pets.length}마리</Text>
        <Text style={[s.hint, { marginTop: 6 }]}>
          모든 기록과 사진은 이 폰에만 저장돼요. 앱을 지우면 기록도 함께 지워져요.
        </Text>
      </Card>
      <AppInfoAndAdmin />
    </Screen>
  );
}
