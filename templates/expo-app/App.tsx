import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { DialogProvider, ThemeProvider, UpdateGate } from '@daro/app-core';
import { HomeScreen } from './src/screens/HomeScreen.tsx';
import { color } from './src/theme.ts';

export default function App() {
  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="dark-content" />
      <ThemeProvider theme={color}>
        {/* 공통 확인 창: useDialog().confirm / notify (iOS·안드로이드·웹 동일) */}
        <DialogProvider>
          {/* 공통 인앱 업데이트: 새 버전이 있을 때만 [업데이트] 버튼 노출 */}
          <UpdateGate />
          <HomeScreen />
        </DialogProvider>
      </ThemeProvider>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
});
