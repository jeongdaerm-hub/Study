import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import * as Updates from 'expo-updates';
import { useTheme } from '../ui/theme.tsx';
import { toPercent } from './buildInfo.ts';

export { toPercent };

/**
 * 앱을 켰을 때 새 업데이트를 받는 동안 보여주는 화면
 * '업데이트 중 42%' → 다 받으면 새 버전으로 자동 다시 시작
 */
export function InstallingScreen({ icon = '✨' }: { icon?: string }) {
  const t = useTheme();
  const { downloadProgress } = Updates.useUpdates();
  const pct = toPercent(downloadProgress);
  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={() => {}} statusBarTranslucent>
      <View style={[s.wrap, { backgroundColor: t.bg }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct ?? 0 }}>
        <Text style={s.icon}>{icon}</Text>
        <Text style={[s.title, { color: t.text }]}>새 버전으로 업데이트 중</Text>
        <Text style={[s.pct, { color: t.primary }]}>{pct === null ? '준비 중…' : `${pct}%`}</Text>
        <View style={[s.track, { backgroundColor: t.line }]}>
          <View style={[s.bar, { backgroundColor: t.primary, width: `${pct ?? 3}%` }]} />
        </View>
        <Text style={[s.hint, { color: t.sub }]}>잠시만 기다려 주세요. 다 받으면 자동으로 다시 시작해요.{'\n'}기록한 내용은 그대로 있어요.</Text>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  icon: { fontSize: 48 },
  title: { fontSize: 18, fontWeight: '800' },
  pct: { fontSize: 32, fontWeight: '800', fontVariant: ['tabular-nums'] },
  track: { width: '100%', maxWidth: 320, height: 10, borderRadius: 5, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 5 },
  hint: { fontSize: 13, textAlign: 'center', lineHeight: 20, marginTop: 8 },
});
