import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAppData } from '../state/AppData.tsx';
import { SPECIES_EMOJI } from '../labels.ts';
import { color } from '../theme.ts';
import type { Pet } from '../types.ts';

export function PetAvatar({ pet, size = 44 }: { pet: Pet; size?: number }) {
  if (pet.photo) return <Image source={{ uri: pet.photo }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View style={[st.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={{ fontSize: size * 0.5 }}>{SPECIES_EMOJI[pet.species]}</Text>
    </View>
  );
}

/** 여러 반려동물 전환 + 추가 */
export function PetSwitcher({ onAdd }: { onAdd: () => void }) {
  const { db, currentPetId, setCurrentPetId } = useAppData();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.row}>
      {db.pets.map((p) => {
        const on = p.id === currentPetId;
        return (
          <Pressable
            key={p.id}
            onPress={() => setCurrentPetId(p.id)}
            style={[st.chip, on && st.chipOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${p.name} 선택`}
          >
            <PetAvatar pet={p} size={28} />
            <Text style={[st.name, on && { color: color.primaryText }]}>{p.name}</Text>
          </Pressable>
        );
      })}
      <Pressable onPress={onAdd} style={[st.chip, st.add]} accessibilityRole="button" accessibilityLabel="반려동물 추가">
        <Text style={{ color: color.sub, fontWeight: '700' }}>＋ 추가</Text>
      </Pressable>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  row: { gap: 8, paddingBottom: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingLeft: 6, paddingRight: 12, borderRadius: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: color.line },
  chipOn: { borderColor: color.primary, backgroundColor: color.primarySoft },
  name: { fontWeight: '700', color: color.text },
  add: { paddingLeft: 12, borderStyle: 'dashed' },
  avatar: { backgroundColor: color.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
