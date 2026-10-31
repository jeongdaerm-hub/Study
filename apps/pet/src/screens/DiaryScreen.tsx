import React, { useState } from 'react';
import { Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { DiaryEntry } from '../types.ts';
import { useAppData } from '../state/AppData.tsx';
import { POOP_LABEL } from '../logic/poop.ts';
import { DiaryEditor } from './DiaryEditor.tsx';
import { Fab } from '@daro/app-core';
import { PetSelector } from '../components/PetSelector.tsx';
import { color } from '../theme.ts';

export function DiaryScreen({ petId, onPetChange }: { petId: string; onPetChange: (id: string) => void }) {
  const { diaries, saveDiary, removeDiary } = useAppData();
  const [editing, setEditing] = useState<DiaryEntry | 'new' | null>(null);

  const list = diaries
    .filter((d) => d.petId === petId)
    .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));

  const confirmDelete = (d: DiaryEntry) =>
    Alert.alert('일기 삭제', '이 일기와 사진을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => removeDiary(d.id) },
    ]);

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={list}
        keyExtractor={(d) => d.id}
        contentContainerStyle={s.list}
        ListHeaderComponent={
          <View style={{ marginBottom: 12 }}>
            <Text style={s.title}>일기장</Text>
            <PetSelector value={petId} onChange={onPetChange} />
          </View>
        }
        ListEmptyComponent={<Text style={s.empty}>아직 일기가 없어요.{'\n'}오늘 하루를 기록해 보세요 ✍️</Text>}
        renderItem={({ item }) => (
          <Pressable style={s.card} onPress={() => setEditing(item)} onLongPress={() => confirmDelete(item)}>
            <View style={s.cardHead}>
              <Text style={s.date}>{item.date}</Text>
              <Text style={{ fontSize: 20 }}>{item.mood}</Text>
            </View>
            {!!item.text && <Text style={s.text} numberOfLines={3}>{item.text}</Text>}
            {item.photos.length > 0 && (
              <View style={s.photos}>
                {item.photos.slice(0, 4).map((u) => <Image key={u} source={{ uri: u }} style={s.photo} />)}
              </View>
            )}
            {item.poop && (
              <Text style={[s.poop, item.poop.status !== 'normal' && { color: color.danger }]}>
                💩 {POOP_LABEL[item.poop.status]}{item.poop.count > 0 ? ` · ${item.poop.count}회` : ''}
              </Text>
            )}
          </Pressable>
        )}
      />
      <Fab label="일기 쓰기" onPress={() => setEditing('new')} />
      {editing && (
        <DiaryEditor
          visible
          initial={editing === 'new' ? undefined : editing}
          defaultPetId={petId}
          onClose={() => setEditing(null)}
          onSave={saveDiary}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  list: { padding: 16, paddingBottom: 96 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 12 },
  empty: { textAlign: 'center', color: color.sub, marginTop: 48, lineHeight: 22 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { fontWeight: '700', color: color.text },
  text: { marginTop: 8, color: color.text, lineHeight: 20 },
  photos: { flexDirection: 'row', gap: 6, marginTop: 10 },
  photo: { width: 64, height: 64, borderRadius: 8 },
  poop: { marginTop: 10, fontSize: 13, color: color.ok },
});
