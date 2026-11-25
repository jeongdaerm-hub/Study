import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppInfoAndAdmin } from '@daro/app-core';
import { color } from '../theme.ts';

export function HomeScreen() {
  return (
    <ScrollView contentContainerStyle={s.wrap}>
      <View style={s.hero}>
        <Text style={s.title}>__APP_NAME__</Text>
      </View>
      {/* 앱 정보 + 나(관리자): 버전을 7번 누르면 '배포 전 버전 확인하기' (설정 화면으로 옮겨 쓰기) */}
      <AppInfoAndAdmin />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 16, flexGrow: 1 },
  hero: { alignItems: 'center', paddingVertical: 48 },
  title: { fontSize: 24, fontWeight: '800', color: color.text },
});
