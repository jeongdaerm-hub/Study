import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import * as Application from 'expo-application';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import { describeBuild, isPreviewAppId, type BuildInfo } from './buildInfo.ts';

export function getBuildInfo(): BuildInfo {
  const web = Platform.OS === 'web';
  return {
    preview: web ? false : isPreviewAppId(Application.applicationId),
    version: Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '0.0.0',
    channel: web ? null : (Updates.channel ?? null),
    updateId: web || Updates.isEmbeddedLaunch ? null : (Updates.updateId ?? null),
    updateCreatedAt: web || Updates.isEmbeddedLaunch ? null : (Updates.createdAt ?? null),
  };
}

/**
 * 테스트 앱에서만 보이는 띠: 지금 어떤 업데이트를 확인 중인지 표시
 * (실제 사용자 앱에서는 아무것도 그리지 않음)
 */
export function TestBuildRibbon() {
  const info = getBuildInfo();
  if (!info.preview) return null;
  return (
    <View style={s.wrap} accessibilityRole="text" accessibilityLabel={`테스트 버전 ${describeBuild(info)}`}>
      <Text style={s.text} numberOfLines={1}>
        🧪 테스트 버전 · {describeBuild(info)}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: '#5B3CC4', paddingVertical: 4, paddingHorizontal: 12, alignItems: 'center' },
  text: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
