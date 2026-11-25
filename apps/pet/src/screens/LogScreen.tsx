import React, { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { addDays, Fab, toDateKey } from '@daro/app-core';
import { useAppData, useCurrentPet } from '../state/AppData.tsx';
import { daySummary, poopSignal, vomitSignal } from '../logic/logs.ts';
import { LOG_EMOJI, LOG_LABEL, POOP_LABEL, VOMIT_LABEL } from '../labels.ts';
import type { DailyLog } from '../types.ts';
import { Card, EmptyState, LevelBadge, Screen, s } from '../components/common.tsx';
import { PetSwitcher } from '../components/PetSwitcher.tsx';
import { dateFromKey } from '../components/OptionalDate.tsx';
import { LogEditor } from './LogEditor.tsx';
import { color } from '../theme.ts';

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

function detail(l: DailyLog): string {
  if (l.kind === 'meal') return [l.food, l.amount ? `${l.amount}g` : ''].filter(Boolean).join(' · ');
  if (l.kind === 'water') return l.amount ? `${l.amount}ml` : '';
  if (l.kind === 'poop' && l.poop) return POOP_LABEL[l.poop];
  if (l.kind === 'vomit' && l.vomit) return VOMIT_LABEL[l.vomit];
  return '';
}
const isAbnormal = (l: DailyLog) => (l.kind === 'poop' && l.poop !== 'normal') || l.kind === 'vomit';

export function LogScreen({ onAddPet }: { onAddPet: () => void }) {
  const { db } = useAppData();
  const pet = useCurrentPet();
  const today = toDateKey(new Date());
  const [date, setDate] = useState(today);
  const [editing, setEditing] = useState<DailyLog | 'new' | null>(null);
  if (!pet) return null;

  const d = dateFromKey(date);
  const list = db.logs.filter((l) => l.petId === pet.id && l.date === date).sort((a, b) => (a.time < b.time ? 1 : -1));
  const sum = daySummary(db.logs, pet.id, date);
  const poop = poopSignal(db.logs, pet.id, d);
  const vomit = vomitSignal(db.logs, pet.id, d);
  const move = (n: number) => {
    const next = toDateKey(addDays(d, n));
    if (next <= today) setDate(next);
  };

  return (
    <Screen footer={<Fab label="기록하기" onPress={() => setEditing('new')} />}>
      <PetSwitcher onAdd={onAddPet} />
      <Text style={[s.title, { fontSize: 22, marginBottom: 8 }]}>생활일지</Text>

      <Card style={{ paddingVertical: 10 }}>
        <View style={[s.row, { justifyContent: 'space-between' }]}>
          <Pressable onPress={() => move(-1)} hitSlop={10} accessibilityLabel="이전 날"><Text style={{ fontSize: 20, color: color.sub }}>◀</Text></Pressable>
          <Text style={s.title}>
            {d.getMonth() + 1}월 {d.getDate()}일 ({WEEK[d.getDay()]}){date === today ? ' · 오늘' : ''}
          </Text>
          <Pressable onPress={() => move(1)} hitSlop={10} disabled={date === today} accessibilityLabel="다음 날">
            <Text style={{ fontSize: 20, color: date === today ? color.line : color.sub }}>▶</Text>
          </Pressable>
        </View>
      </Card>

      <Card>
        <View style={[s.row, { justifyContent: 'space-around' }]}>
          <Mini icon="🍚" label="식사" value={`${sum.mealCount}회`} sub={sum.mealG ? `${sum.mealG}g` : ''} />
          <Mini icon="💧" label="음수" value={`${sum.waterMl}ml`} />
          <Mini icon="💩" label="배변" value={`${sum.poopCount}회`} />
          <Mini icon="🤮" label="구토" value={`${sum.vomitCount}회`} />
        </View>
        {(poop.level !== 'ok' || vomit.level !== 'ok') && (
          <View style={{ marginTop: 12, gap: 6 }}>
            {[poop, vomit].filter((x) => x.level !== 'ok').map((x) => (
              <View key={x.message} style={s.row}>
                <LevelBadge level={x.level} />
                <Text style={{ flex: 1, color: color.text, fontSize: 13 }}>{x.message}</Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      <Card>
        {list.length === 0 ? (
          <EmptyState icon="📝" text={'이 날 기록이 없어요.\n아래 [기록하기]로 추가해 보세요.'} />
        ) : (
          list.map((l) => (
            <Pressable key={l.id} style={s.rowItem} onPress={() => setEditing(l)} accessibilityRole="button" accessibilityLabel={`${l.time} ${LOG_LABEL[l.kind]} 수정`}>
              <Text style={{ width: 44, color: color.sub }}>{l.time}</Text>
              <Text style={{ fontSize: 20 }}>{LOG_EMOJI[l.kind]}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.title, { fontSize: 15 }, isAbnormal(l) && { color: color.danger }]}>
                  {LOG_LABEL[l.kind]}
                  {detail(l) ? ` · ${detail(l)}` : ''}
                </Text>
                {!!l.memo && <Text style={s.sub} numberOfLines={2}>{l.memo}</Text>}
              </View>
              {l.photos[0] && <Image source={{ uri: l.photos[0] }} style={{ width: 40, height: 40, borderRadius: 8 }} />}
            </Pressable>
          ))
        )}
      </Card>

      {editing && (
        <LogEditor petId={pet.id} date={date} initial={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />
      )}
    </Screen>
  );
}

function Mini({ icon, label, value, sub }: { icon: string; label: string; value: string; sub?: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 18 }}>{icon}</Text>
      <Text style={{ fontSize: 12, color: color.sub }}>{label}</Text>
      <Text style={{ fontWeight: '800', color: color.text }}>{value}</Text>
      {!!sub && <Text style={{ fontSize: 11, color: color.sub }}>{sub}</Text>}
    </View>
  );
}
