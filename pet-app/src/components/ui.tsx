import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { PETS, petEmoji } from '../data/pets.ts';

export const color = {
  primary: '#FF8A00',
  primarySoft: '#FFF4E5',
  text: '#222',
  sub: '#666',
  line: '#E6E6EA',
  bg: '#F7F7F9',
  danger: '#C62828',
  ok: '#2E7D32',
  warn: '#B26A00',
};

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[s.chip, selected && s.chipOn]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[s.chipText, selected && s.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.row, style]}>{children}</View>;
}

export function PetSelector({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <ChipRow>
      {PETS.map((p) => (
        <Chip key={p.id} label={`${petEmoji(p)} ${p.name}`} selected={value === p.id} onPress={() => onChange(p.id)} />
      ))}
    </ChipRow>
  );
}

export function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[s.primary, disabled && { opacity: 0.5 }]}>
      <Text style={s.primaryText}>{label}</Text>
    </Pressable>
  );
}

export function Fab({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={s.fab} accessibilityLabel={label}>
      <Text style={s.fabText}>＋ {label}</Text>
    </Pressable>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={s.label}>{children}</Text>;
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: color.line, backgroundColor: '#fff' },
  chipOn: { borderColor: color.primary, backgroundColor: color.primarySoft },
  chipText: { color: color.sub, fontSize: 14 },
  chipTextOn: { color: '#7A4100', fontWeight: '700' },
  primary: { backgroundColor: color.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  fab: { position: 'absolute', right: 16, bottom: 16, backgroundColor: color.primary, borderRadius: 28, paddingVertical: 14, paddingHorizontal: 20, elevation: 4 },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  label: { fontSize: 14, fontWeight: '700', color: color.text, marginTop: 18, marginBottom: 8 },
});
