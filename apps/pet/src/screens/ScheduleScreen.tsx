import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Fab, formatDateTime, REPEAT_LABEL, sortByUpcoming, toDateKey } from '@daro/app-core';
import { useAppData, useCurrentPet } from '../state/AppData.tsx';
import { SCHEDULE_EMOJI, SCHEDULE_LABEL } from '../labels.ts';
import type { Schedule } from '../types.ts';
import { Card, EmptyState, Screen, Segmented, s } from '../components/common.tsx';
import { PetSwitcher } from '../components/PetSwitcher.tsx';
import { Check } from './HomeScreen.tsx';
import { ScheduleEditor } from './ScheduleEditor.tsx';
import { color } from '../theme.ts';

type Filter = 'todo' | 'done';

export function ScheduleScreen({ onAddPet }: { onAddPet: () => void }) {
  const { db, toggleScheduleDone } = useAppData();
  const pet = useCurrentPet();
  const [filter, setFilter] = useState<Filter>('todo');
  const [editing, setEditing] = useState<Schedule | 'new' | null>(null);
  if (!pet) return null;

  const mine = db.schedules.filter((x) => x.petId === pet.id);
  const list = sortByUpcoming(mine.filter((x) => (filter === 'todo' ? !x.done : x.done)));
  if (filter === 'done') list.reverse();
  const today = toDateKey(new Date());

  // 날짜별 묶음
  const groups = new Map<string, Schedule[]>();
  for (const x of list) {
    const k = toDateKey(new Date(x.dateTime));
    groups.set(k, [...(groups.get(k) ?? []), x]);
  }

  return (
    <Screen footer={<Fab label="일정 추가" onPress={() => setEditing('new')} />}>
      <PetSwitcher onAdd={onAddPet} />
      <Text style={[s.title, { fontSize: 22, marginBottom: 8 }]}>일정·알림</Text>
      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'todo', label: `예정 ${mine.filter((x) => !x.done).length}` },
          { value: 'done', label: `완료 ${mine.filter((x) => x.done).length}` },
        ]}
      />
      {list.length === 0 && (
        <Card>
          <EmptyState icon="🔔" text={filter === 'todo' ? '예정된 일정이 없어요.\n투약·접종·병원 방문을 등록하면 알림으로 알려드려요.' : '완료한 일정이 없어요.'} />
        </Card>
      )}
      {[...groups.entries()].map(([date, items]) => (
        <View key={date}>
          <Text style={[s.sub, { marginTop: 8, marginBottom: 6, fontWeight: '700', color: date < today && filter === 'todo' ? color.danger : color.sub }]}>
            {date === today ? '오늘' : date}
            {date < today && filter === 'todo' ? ' · 놓친 일정' : ''}
          </Text>
          <Card style={{ paddingVertical: 4 }}>
            {items.map((x) => (
              <View key={x.id} style={s.rowItem}>
                <Pressable
                  onPress={() => toggleScheduleDone(x.id)}
                  hitSlop={10}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: x.done }}
                  accessibilityLabel={`${x.title} 완료`}
                >
                  <Check on={x.done} />
                </Pressable>
                <Pressable style={{ flex: 1 }} onPress={() => setEditing(x)} accessibilityRole="button" accessibilityLabel={`${x.title} 수정`}>
                  <Text style={[s.title, x.done && { textDecorationLine: 'line-through', color: color.sub }]}>
                    {SCHEDULE_EMOJI[x.type]} {x.title}
                  </Text>
                  <Text style={s.sub}>
                    {SCHEDULE_LABEL[x.type]} · {formatDateTime(x.dateTime)}
                    {x.repeat !== 'none' ? ` · ${REPEAT_LABEL[x.repeat]}` : ''}
                    {x.notificationId ? ' · 🔔' : ''}
                  </Text>
                  {!!x.memo && <Text style={s.sub} numberOfLines={1}>{x.memo}</Text>}
                </Pressable>
              </View>
            ))}
          </Card>
        </View>
      ))}
      {editing && <ScheduleEditor petId={pet.id} initial={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </Screen>
  );
}
