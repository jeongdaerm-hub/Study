import React from 'react';
import { Text } from 'react-native';
import { AppInfoAndAdmin, FamilyPanel } from '@daro/app-core';
import { useAppData } from '../state/AppData.tsx';
import { Card, Screen, SectionTitle, s } from '../components/common.tsx';

/**
 * 설정
 *  - 일반 사용자: 기록 보관 안내, 가족 공유, 앱 정보
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
          기록은 이 폰에 저장돼요. 가족 공유를 켜면 가족과 같은 기록을 함께 보고, 앱을 지워도 다시 로그인하면 돌아와요. (사진은 각 폰에만)
        </Text>
      </Card>
      <FamilyPanel examplePet={db.pets[0]?.name ?? '다로'} />
      <AppInfoAndAdmin />
    </Screen>
  );
}
