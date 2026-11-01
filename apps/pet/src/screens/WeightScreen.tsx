import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { DateTimeField, Fab, newId, toDateKey, useDialog, Label } from '@daro/app-core';
import { useAppData, useCurrentPet } from '../state/AppData.tsx';
import { sortByDate, weightTrend } from '../logic/weight.ts';
import { parseNumber, round, validateWeight } from '../logic/validate.ts';
import type { WeightEntry } from '../types.ts';
import { Card, EmptyState, Field, FormModal, LevelBadge, Screen, SectionTitle, s } from '../components/common.tsx';
import { PetSwitcher } from '../components/PetSwitcher.tsx';
import { WeightChart } from '../components/WeightChart.tsx';
import { dateFromKey } from '../components/OptionalDate.tsx';
import { color } from '../theme.ts';

export function WeightScreen({ onAddPet }: { onAddPet: () => void }) {
  const { db } = useAppData();
  const pet = useCurrentPet();
  const [editing, setEditing] = useState<WeightEntry | 'new' | null>(null);
  if (!pet) return null;
  const entries = db.weights.filter((w) => w.petId === pet.id);
  const sorted = sortByDate(entries);
  const trend = weightTrend(entries);

  return (
    <Screen footer={<Fab label="체중 기록" onPress={() => setEditing('new')} />}>
      <PetSwitcher onAdd={onAddPet} />
      <Text style={[s.title, { fontSize: 22, marginBottom: 8 }]}>체중관리</Text>

      <Card>
        <View style={[s.row, { justifyContent: 'space-between' }]}>
          <View>
            <Text style={s.sub}>현재 체중</Text>
            <Text style={{ fontSize: 28, fontWeight: '800', color: color.text }}>{trend.latest ? `${trend.latest.kg}kg` : '-'}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            {trend.diff !== undefined && (
              <Text style={{ color: color.sub }}>
                직전 대비 {trend.diff > 0 ? '▲' : trend.diff < 0 ? '▼' : ''} {Math.abs(trend.diff)}kg
              </Text>
            )}
            {trend.monthPct !== undefined && <Text style={{ color: color.sub }}>한 달 {trend.monthPct > 0 ? '+' : ''}{trend.monthPct}%</Text>}
            <LevelBadge level={trend.level} />
          </View>
        </View>
        {trend.level === 'watch' && <Text style={[s.hint, { color: color.warn }]}>{trend.message}</Text>}
      </Card>

      <SectionTitle title="날짜별 변화" />
      <Card>
        {sorted.length < 2 ? (
          <EmptyState icon="📈" text="체중을 2번 이상 기록하면 그래프가 그려져요." />
        ) : (
          <WeightChart entries={sorted} />
        )}
      </Card>

      <SectionTitle title="기록" />
      <Card>
        {sorted.length === 0 && <Text style={s.sub}>아직 기록이 없어요.</Text>}
        {[...sorted].reverse().map((w, i, arr) => {
          const prev = arr[i + 1];
          const diff = prev ? round(w.kg - prev.kg) : undefined;
          return (
            <Pressable key={w.id} style={s.rowItem} onPress={() => setEditing(w)} accessibilityRole="button" accessibilityLabel={`${w.date} ${w.kg}kg 수정`}>
              <Text style={{ flex: 1, color: color.text }}>{w.date}</Text>
              <Text style={{ width: 72, textAlign: 'right', color: color.sub, fontSize: 13 }}>
                {diff === undefined ? '' : `${diff > 0 ? '▲' : diff < 0 ? '▼' : '−'} ${Math.abs(diff)}`}
              </Text>
              <Text style={[s.title, { width: 72, textAlign: 'right' }]}>{w.kg}kg</Text>
            </Pressable>
          );
        })}
      </Card>

      {editing && <WeightEditor petId={pet.id} initial={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </Screen>
  );
}

function WeightEditor({ petId, initial, onClose }: { petId: string; initial?: WeightEntry; onClose: () => void }) {
  const { db, upsert, remove } = useAppData();
  const { notify, confirm } = useDialog();
  const [date, setDate] = useState(initial ? dateFromKey(initial.date) : new Date());
  const [kg, setKg] = useState(initial ? String(initial.kg) : '');

  const save = async () => {
    const n = parseNumber(kg);
    const err = validateWeight(n);
    if (err) return notify('입력 확인', err);
    const key = toDateKey(date);
    // 같은 날 기록이 있으면 덮어쓰기 (하루 1건)
    const sameDay = db.weights.find((w) => w.petId === petId && w.date === key && w.id !== initial?.id);
    if (sameDay && !(await confirm({ title: '같은 날 기록', message: `${key}에 ${sameDay.kg}kg 기록이 있어요. 바꿀까요?`, confirmText: '바꾸기' }))) return;
    if (sameDay) await remove('weights', sameDay.id);
    await upsert('weights', { id: initial?.id ?? newId(), petId, date: key, kg: round(n!) });
    onClose();
  };
  const del = initial
    ? async () => {
        if (await confirm({ title: '체중 기록 삭제', confirmText: '삭제', destructive: true })) {
          await remove('weights', initial.id);
          onClose();
        }
      }
    : undefined;

  return (
    <FormModal title={initial ? '체중 수정' : '체중 기록'} onClose={onClose} onSave={save} onDelete={del}>
      <Label>날짜</Label>
      <DateTimeField value={date} onChange={setDate} modes={['date']} maximumDate={new Date()} />
      <Field label="체중 (kg)" value={kg} onChangeText={setKg} keyboardType="decimal-pad" placeholder="예) 5.2" maxLength={6} autoFocus />
    </FormModal>
  );
}
