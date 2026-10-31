import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { UpdateStatus } from './useAppUpdate.ts';
import { useTheme } from '../ui/theme.tsx';

interface Props {
  status: UpdateStatus;
  title: string;
  notes?: string[];
  onUpdate: () => void;
  onLater: () => void;
}

/** 새 버전이 있을 때만 노출되는 상단 배너 + [업데이트] 버튼 */
export function UpdateBanner({ status, title, notes, onUpdate, onLater }: Props) {
  const t = useTheme();
  const busy = status === 'downloading' || status === 'ready';
  return (
    <View style={[styles.wrap, { backgroundColor: t.primarySoft, borderColor: t.primary }]} accessibilityRole="alert">
      <Text style={[styles.title, { color: t.primaryText }]}>{title}</Text>
      {notes?.slice(0, 3).map((n) => (
        <Text key={n} style={[styles.note, { color: t.primaryText }]}>• {n}</Text>
      ))}
      <View style={styles.row}>
        <Pressable onPress={onLater} disabled={busy} style={[styles.btn, styles.later]}>
          <Text style={[styles.laterText, { color: t.primaryText }]}>나중에</Text>
        </Pressable>
        <Pressable
          onPress={onUpdate}
          disabled={busy}
          style={[styles.btn, { backgroundColor: t.primary }, busy && styles.disabled]}
          accessibilityLabel="업데이트"
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.updateText}>업데이트</Text>}
        </Pressable>
      </View>
      {status === 'error' && <Text style={[styles.error, { color: t.danger }]}>업데이트에 실패했어요. 다시 시도해 주세요.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { margin: 16, padding: 16, borderRadius: 14, borderWidth: 1 },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  note: { fontSize: 13, marginTop: 2 },
  row: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, gap: 8 },
  btn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, minWidth: 88, alignItems: 'center' },
  later: { backgroundColor: 'transparent' },
  laterText: { fontWeight: '600' },
  updateText: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.6 },
  error: { marginTop: 8, fontSize: 12 },
});
