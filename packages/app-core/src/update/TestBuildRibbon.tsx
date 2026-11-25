import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import * as Application from 'expo-application';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import { describeBuild, isPreviewAppId, type BuildInfo } from './buildInfo.ts';
import { currentChannel, type Channel } from './channelSwitch.ts';

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
 * 배포 전(테스트) 버전을 보고 있을 때만 보이는 보라 띠
 *  - 테스트 앱, 또는 관리자 화면에서 '배포 전 버전'으로 바꾼 실제 앱
 *  - 일반 사용자 화면에서는 아무것도 그리지 않음
 */
export function TestBuildRibbon() {
  const info = getBuildInfo();
  const [channel, setChannel] = useState<Channel | null>(null);
  useEffect(() => {
    currentChannel().then(setChannel);
  }, []);
  if (channel === null) return null;
  if (channel === 'production') {
    // 테스트 앱에서 공식 버전을 보는 중이면 회색 띠로 알려줌
    if (!info.preview) return null;
    return (
      <View style={[s.wrap, { backgroundColor: '#55555F' }]} accessibilityRole="text">
        <Text style={s.text} numberOfLines={1}>
          테스트 앱 · 공식 버전 보는 중 · {describeBuild(info)}
        </Text>
      </View>
    );
  }
  return (
    <View style={s.wrap} accessibilityRole="text" accessibilityLabel={`배포 전 버전 ${describeBuild(info)}`}>
      <Text style={s.text} numberOfLines={1}>
        🧪 배포 전 버전 · {describeBuild(info)}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: '#5B3CC4', paddingVertical: 4, paddingHorizontal: 12, alignItems: 'center' },
  text: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
