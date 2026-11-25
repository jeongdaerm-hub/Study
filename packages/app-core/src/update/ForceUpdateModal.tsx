import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../ui/theme.tsx';

interface Props {
  visible: boolean;
  /** 앱별 안내 문구 */
  message?: string;
  notes?: string[];
  onUpdate: () => void;
}

/** 지원 종료 버전: 닫기 버튼 없이 업데이트만 가능 */
export function ForceUpdateModal({ visible, message, notes, onUpdate }: Props) {
  const t = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.dim}>
        <View style={styles.card}>
          <Text style={styles.title}>필수 업데이트 안내</Text>
          <Text style={styles.body}>
            {message ?? '안정적인 서비스 이용을 위해 최신 버전으로 업데이트가 필요해요.'}
          </Text>
          {notes?.map((n) => (
            <Text key={n} style={styles.note}>• {n}</Text>
          ))}
          <Pressable style={[styles.btn, { backgroundColor: t.primary }]} onPress={onUpdate} accessibilityLabel="지금 업데이트">
            <Text style={styles.btnText}>지금 업데이트</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 24 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  body: { fontSize: 14, color: '#444', marginBottom: 12 },
  note: { fontSize: 13, color: '#555', marginTop: 2 },
  btn: { marginTop: 20, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
