import React, { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Schedule } from '../types.ts';
import { useAppData } from '../state/AppData.tsx';
import { ScheduleEditor } from './ScheduleEditor.tsx';
import { Fab, REPEAT_LABEL, formatDateTime, sortByUpcoming } from '@daro/app-core';
import { PetSelector } from '../components/PetSelector.tsx';
import { color } from '../theme.ts';

const ICON: Record<Schedule['type'], string> = { 병원: '🏥', 예방접종: '💉', 구충제: '💊', 미용: '✂️', 산책: '🦮', 기타: '📌' };

export function ScheduleScreen({ petId, onPetChange }: { petId: string; onPetChange: (id: string) => void }) {
  const { schedules, saveSchedule, toggleScheduleDone, removeSchedule } = useAppData();
  const [editing, setEditing] = useState<Schedule | 'new' | null>(null);
  const list = sortByUpcoming(schedules.filter((x) => x.petId === petId));

  const confirmDelete = (x: Schedule) =>
    Alert.alert('일정 삭제', `'${x.title}' 일정과 알림을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => removeSchedule(x.id) },
    ]);

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={list}
        keyExtractor={(x) => x.id}
        contentContainerStyle={s.list}
        ListHeaderComponent={
          <View style={{ marginBottom: 12 }}>
            <Text style={s.title}>일정 · 알림</Text>
            <PetSelector value={petId} onChange={onPetChange} />
          </View>
        }
        ListEmptyComponent={<Text style={s.empty}>등록된 일정이 없어요.{'\n'}병원·접종 일정을 등록하면 알림으로 알려드려요 🔔</Text>}
        renderItem={({ item }) => (
          <Pressable style={[s.card, item.done && { opacity: 0.5 }]} onPress={() => setEditing(item)} onLongPress={() => confirmDelete(item)}>
            <Pressable
              onPress={() => toggleScheduleDone(item.id)}
              style={[s.check, item.done && s.checkOn]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: item.done }}
            >
              {item.done && <Text style={{ color: '#fff' }}>✓</Text>}
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={[s.name, item.done && { textDecorationLine: 'line-through' }]}>{ICON[item.type]} {item.title}</Text>
              <Text style={s.sub}>
                {formatDateTime(item.dateTime)}
                {item.repeat !== 'none' ? ` · ${REPEAT_LABEL[item.repeat]}` : ''}
                {item.notificationId ? ' · 🔔' : ''}
              </Text>
            </View>
          </Pressable>
        )}
      />
      <Fab label="일정 추가" onPress={() => setEditing('new')} />
      {editing && (
        <ScheduleEditor
          initial={editing === 'new' ? undefined : editing}
          defaultPetId={petId}
          onClose={() => setEditing(null)}
          onSave={saveSchedule}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  list: { padding: 16, paddingBottom: 96 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 12 },
  empty: { textAlign: 'center', color: color.sub, marginTop: 48, lineHeight: 22 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10 },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: color.line, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: color.primary, borderColor: color.primary },
  name: { fontSize: 16, fontWeight: '700', color: color.text },
  sub: { fontSize: 13, color: color.sub, marginTop: 4 },
});
