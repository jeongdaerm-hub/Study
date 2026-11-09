import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { DialogHost, Label, PrimaryButton } from '@daro/app-core';
import { color } from '../theme.ts';
import type { Level } from '../logic/logs.ts';

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function SectionTitle({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={s.sectionRow}>
      <Text style={s.section}>{title}</Text>
      {action && (
        <Pressable onPress={action.onPress} hitSlop={8} accessibilityRole="button">
          <Text style={s.sectionAction}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={s.empty}>
      <Text style={{ fontSize: 36 }}>{icon}</Text>
      <Text style={s.emptyText}>{text}</Text>
    </View>
  );
}

/** 상태 배지: 색 + 아이콘 + 글자 (색만으로 구분하지 않음) */
const LEVEL = {
  ok: { label: '양호', icon: '●', fg: color.ok, bg: '#E8F5E9' },
  watch: { label: '관찰', icon: '▲', fg: color.warn, bg: '#FFF3E0' },
  vet: { label: '병원 권장', icon: '■', fg: color.danger, bg: '#FFEBEE' },
} as const;

export function LevelBadge({ level }: { level: Level }) {
  const l = LEVEL[level];
  return (
    <View style={[s.badge, { backgroundColor: l.bg }]}>
      <Text style={[s.badgeText, { color: l.fg }]}>
        {l.icon} {l.label}
      </Text>
    </View>
  );
}
export const levelColor = (level: Level) => LEVEL[level].fg;

/** 탭 안의 구분 탭 (예: 진료 / 검사 / 접종) */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={s.seg} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[s.segItem, on && s.segOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
          >
            <Text style={[s.segText, on && s.segTextOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({ label, ...props }: TextInputProps & { label?: string }) {
  return (
    <View>
      {label && <Label>{label}</Label>}
      <TextInput placeholderTextColor="#A0A0A8" style={[s.input, props.multiline && s.multi]} {...props} />
    </View>
  );
}

/** 입력·수정 화면 공통 틀: 상단 취소 / 하단 저장 · 삭제 */
export function FormModal({
  title,
  onClose,
  onSave,
  onDelete,
  saving,
  children,
}: {
  title: string;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
  saving?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.header}>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button">
            <Text style={s.headerBtn}>취소</Text>
          </Pressable>
          <Text style={s.headerTitle}>{title}</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          <View style={s.inner}>
            {children}
            <View style={{ height: 24 }} />
            <PrimaryButton label={saving ? '저장 중…' : '저장'} onPress={onSave} disabled={saving} />
            {onDelete && (
              <Pressable onPress={onDelete} style={s.delete} accessibilityRole="button">
                <Text style={{ color: color.danger, fontWeight: '600' }}>삭제</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
        {/* 이 화면이 열려 있는 동안 확인 창은 여기 그려짐 */}
        <DialogHost />
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** 화면 공통 스크롤 틀 (웹에서는 가운데 정렬 + 최대 폭) */
export function Screen({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={s.screen}>
        <View style={s.inner}>{children}</View>
      </ScrollView>
      {footer}
    </View>
  );
}

export const s = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 8 },
  section: { fontSize: 17, fontWeight: '800', color: color.text },
  sectionAction: { color: color.primary, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyText: { color: color.sub, textAlign: 'center', lineHeight: 20 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  seg: { flexDirection: 'row', backgroundColor: '#ECECF0', borderRadius: 12, padding: 3, marginBottom: 12 },
  segItem: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  segOn: { backgroundColor: '#fff' },
  segText: { color: color.sub, fontWeight: '600' },
  segTextOn: { color: color.text, fontWeight: '800' },
  input: { borderWidth: 1, borderColor: color.line, borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: '#fff', color: color.text },
  multi: { minHeight: 96, textAlignVertical: 'top' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: Platform.OS === 'web' ? 16 : 52, borderBottomWidth: 1, borderColor: color.line, backgroundColor: '#fff' },
  headerBtn: { color: color.sub, fontSize: 15, width: 40 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: color.text },
  body: { padding: 16, paddingBottom: 48 },
  inner: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  delete: { alignItems: 'center', padding: 14, marginTop: 8 },
  screen: { padding: 16, paddingBottom: 96 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F0F0F3' },
  title: { fontSize: 16, fontWeight: '700', color: color.text },
  sub: { fontSize: 13, color: color.sub, marginTop: 2 },
  hint: { fontSize: 12, color: color.sub, marginTop: 6, lineHeight: 18 },
});
