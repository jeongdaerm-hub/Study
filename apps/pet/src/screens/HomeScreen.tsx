import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatDateTime, PrimaryButton, toDateKey } from '@daro/app-core';
import { useAppData, useCurrentPet } from '../state/AppData.tsx';
import { overallLevel, statusItems, todayTasks } from '../logic/dashboard.ts';
import { daySummary, recommendedWaterMl } from '../logic/logs.ts';
import { weightTrend } from '../logic/weight.ts';
import { ageText } from '../logic/age.ts';
import { LOG_EMOJI, LOG_LABEL, SCHEDULE_EMOJI, SEX_LABEL, SPECIES_LABEL } from '../labels.ts';
import type { LogKind } from '../types.ts';
import { Card, EmptyState, LevelBadge, levelColor, Screen, SectionTitle, s } from '../components/common.tsx';
import { PetAvatar, PetSwitcher } from '../components/PetSwitcher.tsx';
import { PetForm } from './PetForm.tsx';
import { LogEditor } from './LogEditor.tsx';
import { color } from '../theme.ts';

const QUICK: LogKind[] = ['meal', 'water', 'poop', 'vomit'];

export function HomeScreen({ goTo }: { goTo: (tab: 'schedule' | 'log' | 'weight' | 'health') => void }) {
  const { db, toggleScheduleDone, loadSample } = useAppData();
  const pet = useCurrentPet();
  const [petForm, setPetForm] = useState<'new' | 'edit' | null>(null);
  const [quick, setQuick] = useState<LogKind | null>(null);
  const now = new Date();
  const today = toDateKey(now);

  const data = useMemo(() => {
    if (!pet) return null;
    const items = statusItems(db, pet.id, now);
    return {
      items,
      level: overallLevel(items),
      tasks: todayTasks(db.schedules, pet.id, now),
      sum: daySummary(db.logs, pet.id, today),
      weight: weightTrend(db.weights.filter((w) => w.petId === pet.id)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, pet, today]);

  if (!pet || !data) {
    return (
      <Screen>
        <Card style={{ marginTop: 24, alignItems: 'center' }}>
          <Text style={{ fontSize: 48 }}>🐾</Text>
          <Text style={[s.title, { fontSize: 20, marginTop: 8 }]}>반려동물을 등록해 주세요</Text>
          <Text style={[s.hint, { textAlign: 'center' }]}>여러 마리를 등록하고 건강·체중·생활·일정을 한곳에서 관리해요.</Text>
          <View style={{ alignSelf: 'stretch', marginTop: 16, gap: 8 }}>
            <PrimaryButton label="반려동물 등록하기" onPress={() => setPetForm('new')} />
            <Pressable onPress={loadSample} style={{ padding: 12, alignItems: 'center' }} accessibilityRole="button">
              <Text style={{ color: color.primary, fontWeight: '700' }}>샘플 데이터로 둘러보기 (다로 · 나비)</Text>
            </Pressable>
          </View>
        </Card>
        {petForm && <PetForm onClose={() => setPetForm(null)} />}
      </Screen>
    );
  }

  const { items, level, tasks, sum, weight } = data;
  const water = recommendedWaterMl(weight.latest?.kg);
  const info = [SPECIES_LABEL[pet.species], pet.breed, ageText(pet.birthDate), SEX_LABEL[pet.sex] + (pet.neutered ? '(중성화)' : '')]
    .filter(Boolean)
    .join(' · ');

  return (
    <Screen>
      <PetSwitcher onAdd={() => setPetForm('new')} />

      {/* 프로필 */}
      <Card>
        <Pressable style={s.row} onPress={() => setPetForm('edit')} accessibilityRole="button" accessibilityLabel={`${pet.name} 정보 수정`}>
          <PetAvatar pet={pet} size={56} />
          <View style={{ flex: 1 }}>
            <Text style={[s.title, { fontSize: 20 }]}>{pet.name}</Text>
            <Text style={s.sub}>{info}</Text>
          </View>
          <Text style={{ color: color.sub }}>수정 ›</Text>
        </Pressable>
        <View style={[s.row, { marginTop: 14, justifyContent: 'space-between' }]}>
          <Stat label="체중" value={weight.latest ? `${weight.latest.kg}kg` : '-'} sub={weight.diff !== undefined ? `${weight.diff > 0 ? '▲' : weight.diff < 0 ? '▼' : ''}${Math.abs(weight.diff)}kg` : ''} />
          <Stat label="오늘 식사" value={`${sum.mealCount}회`} sub={sum.mealG ? `${sum.mealG}g` : ''} />
          <Stat label="오늘 음수" value={`${sum.waterMl}ml`} sub={water ? `참고 ${water}ml` : ''} />
          <Stat label="배변/구토" value={`${sum.poopCount}/${sum.vomitCount}`} sub="회" />
        </View>
      </Card>

      {/* 상태 */}
      <SectionTitle title={`${pet.name} 상태`} />
      <Card style={{ borderLeftWidth: 4, borderLeftColor: levelColor(level) }}>
        <View style={[s.row, { justifyContent: 'space-between', marginBottom: 6 }]}>
          <Text style={s.title}>종합</Text>
          <LevelBadge level={level} />
        </View>
        {items.map((i) => (
          <View key={i.key} style={[s.row, { paddingVertical: 6 }]}>
            <Text style={{ fontSize: 16 }}>{i.icon}</Text>
            <Text style={{ flex: 1, color: color.text, lineHeight: 20 }}>{i.text}</Text>
            {i.level !== 'ok' && <LevelBadge level={i.level} />}
          </View>
        ))}
        <Text style={s.hint}>※ 기록 기반 참고 정보예요. 이상이 의심되면 수의사와 상담하세요.</Text>
      </Card>

      {/* 오늘 할 일 */}
      <SectionTitle title="오늘 할 일" action={{ label: '전체 일정 ›', onPress: () => goTo('schedule') }} />
      <Card>
        {tasks.length === 0 ? (
          <Text style={s.sub}>오늘 예정된 일정이 없어요 🎉</Text>
        ) : (
          tasks.map((t) => {
            const missed = !t.done && toDateKey(new Date(t.dateTime)) < today;
            return (
              <Pressable
                key={t.id}
                style={s.rowItem}
                onPress={() => toggleScheduleDone(t.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: t.done }}
                accessibilityLabel={`${t.title} 완료 표시`}
              >
                <Check on={t.done} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.title, t.done && { textDecorationLine: 'line-through', color: color.sub }]}>
                    {SCHEDULE_EMOJI[t.type]} {t.title}
                  </Text>
                  <Text style={[s.sub, missed && { color: color.danger }]}>
                    {missed ? '놓친 일정 · ' : ''}
                    {formatDateTime(t.dateTime)}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
      </Card>

      {/* 빠른 기록 */}
      <SectionTitle title="빠른 기록" action={{ label: '생활일지 ›', onPress: () => goTo('log') }} />
      <View style={[s.row, { gap: 8 }]}>
        {QUICK.map((k) => (
          <Pressable key={k} onPress={() => setQuick(k)} style={quickStyle} accessibilityRole="button" accessibilityLabel={`${LOG_LABEL[k]} 기록`}>
            <Text style={{ fontSize: 24 }}>{LOG_EMOJI[k]}</Text>
            <Text style={{ color: color.text, fontWeight: '600', marginTop: 4 }}>{LOG_LABEL[k]}</Text>
          </Pressable>
        ))}
      </View>

      {petForm && <PetForm initial={petForm === 'edit' ? pet : undefined} onClose={() => setPetForm(null)} />}
      {quick && <LogEditor petId={pet.id} kind={quick} date={today} onClose={() => setQuick(null)} />}
    </Screen>
  );
}

const quickStyle = { flex: 1, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14, alignItems: 'center' as const };

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ fontSize: 12, color: color.sub }}>{label}</Text>
      <Text style={{ fontSize: 16, fontWeight: '800', color: color.text, marginTop: 2 }}>{value}</Text>
      {!!sub && <Text style={{ fontSize: 11, color: color.sub }}>{sub}</Text>}
    </View>
  );
}

export function Check({ on }: { on: boolean }) {
  return (
    <View
      style={{
        width: 26,
        height: 26,
        borderRadius: 13,
        borderWidth: 2,
        borderColor: on ? color.primary : color.line,
        backgroundColor: on ? color.primary : '#fff',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {on && <Text style={{ color: '#fff', fontWeight: '800' }}>✓</Text>}
    </View>
  );
}

export { EmptyState };
