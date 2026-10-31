import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PETS, petEmoji } from '../data/pets.ts';
import { useAppData } from '../state/AppData.tsx';
import { analyzePoop } from '../logic/poop.ts';
import { sortSchedules } from '../logic/schedule.ts';
import { formatDateTime, toDateKey } from '../logic/date.ts';
import { color } from '../components/ui.tsx';

const ALERT_COLOR = { ok: color.ok, watch: color.warn, vet: color.danger } as const;

/** 홈: 펫별 오늘 일기 여부 + 배변 건강 신호 + 다음 일정 */
export function HomeScreen() {
  const { diaries, schedules } = useAppData();
  const today = toDateKey(new Date());

  return (
    <ScrollView contentContainerStyle={s.list}>
      <Text style={s.header}>우리 아이들</Text>
      {PETS.map((pet) => {
        const poop = analyzePoop(diaries, pet.id);
        const wroteToday = diaries.some((d) => d.petId === pet.id && d.date === today);
        const next = sortSchedules(schedules.filter((x) => x.petId === pet.id && !x.done))[0];
        return (
          <View key={pet.id} style={s.card}>
            <Text style={s.name}>{petEmoji(pet)} {pet.name}</Text>
            <Text style={s.row}>✍️ 오늘 일기 {wroteToday ? '작성 완료' : '아직 안 썼어요'}</Text>
            <Text style={[s.row, { color: ALERT_COLOR[poop.level] }]}>💩 {poop.message}</Text>
            <Text style={s.row}>🔔 {next ? `${formatDateTime(next.dateTime)} ${next.title}` : '예정된 일정 없음'}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  list: { padding: 16 },
  header: { fontSize: 22, fontWeight: '800', marginBottom: 12 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12 },
  name: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  row: { fontSize: 14, color: color.sub, marginTop: 4 },
});
