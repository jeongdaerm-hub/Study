import React from 'react';
import { StatusBar, StyleSheet } from 'react-native';
// 안드로이드도 시계·배터리·아래 버튼 영역을 비워 줌 (react-native 기본 SafeAreaView 는 iOS 전용)
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { DialogProvider, TestBuildRibbon, ThemeProvider, UpdateGate } from '@daro/app-core';
import { HomeScreen } from './src/screens/HomeScreen.tsx';
import { color } from './src/theme.ts';

export default function App() {
  return (
    <SafeAreaProvider>
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="dark-content" />
      <ThemeProvider theme={color}>
        {/* 공통 확인 창: useDialog().confirm / notify (iOS·안드로이드·웹 동일) */}
        <DialogProvider>
          {/* 테스트 앱에서만 보임: 지금 확인 중인 업데이트 */}
          <TestBuildRibbon />
          {/* 공통 인앱 업데이트: 새 버전이 있을 때만 [업데이트] 버튼 노출 */}
          <UpdateGate />
          <HomeScreen />
        </DialogProvider>
      </ThemeProvider>
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
});
