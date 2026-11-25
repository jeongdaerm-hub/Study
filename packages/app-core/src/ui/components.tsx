import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useTheme } from './theme.tsx';

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[s.chip, { borderColor: t.line }, selected && { borderColor: t.primary, backgroundColor: t.primarySoft }]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[{ color: t.sub, fontSize: 14 }, selected && { color: t.primaryText, fontWeight: '700' }]}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.row, style]}>{children}</View>;
}

/** 단일 선택 칩 그룹 */
export function SelectChips<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <ChipRow>
      {options.map((o) => (
        <Chip key={String(o.value)} label={o.label} selected={value === o.value} onPress={() => onChange(o.value)} />
      ))}
    </ChipRow>
  );
}

export function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[s.primary, { backgroundColor: t.primary }, disabled && { opacity: 0.5 }]}>
      <Text style={s.primaryText}>{label}</Text>
    </Pressable>
  );
}

export function Fab({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={[s.fab, { backgroundColor: t.primary }]} accessibilityLabel={label}>
      <Text style={s.fabText}>＋ {label}</Text>
    </Pressable>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <Text style={[s.label, { color: t.text }]}>{children}</Text>;
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, backgroundColor: '#fff' },
  primary: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  fab: { position: 'absolute', right: 16, bottom: 16, borderRadius: 28, paddingVertical: 14, paddingHorizontal: 20, elevation: 4 },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  label: { fontSize: 14, fontWeight: '700', marginTop: 18, marginBottom: 8 },
});
