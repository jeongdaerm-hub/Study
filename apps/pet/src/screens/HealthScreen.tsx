import React, { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Fab } from '@daro/app-core';
import { useAppData, useCurrentPet } from '../state/AppData.tsx';
import { abnormalItems, daysUntil, labFlag, latestVaccines, vaccineStatus } from '../logic/health.ts';
import type { LabResult, Vaccination, VisitRecord } from '../types.ts';
import { Card, EmptyState, LevelBadge, Screen, Segmented, s } from '../components/common.tsx';
import { PetSwitcher } from '../components/PetSwitcher.tsx';
import { LabEditor, VaccineEditor, VisitEditor } from './HealthEditors.tsx';
import { color } from '../theme.ts';

type Tab = 'visit' | 'lab' | 'vaccine';
type Editing = { tab: 'visit'; item?: VisitRecord } | { tab: 'lab'; item?: LabResult } | { tab: 'vaccine'; item?: Vaccination } | null;

const byDateDesc = <T extends { date: string }>(a: T, b: T) => (a.date < b.date ? 1 : -1);
const won = (n?: number) => (n ? `${n.toLocaleString('ko-KR')}원` : '');

export function HealthScreen({ onAddPet }: { onAddPet: () => void }) {
  const { db } = useAppData();
  const pet = useCurrentPet();
  const [tab, setTab] = useState<Tab>('visit');
  const [editing, setEditing] = useState<Editing>(null);
  if (!pet) return null;

  const visits = db.visits.filter((x) => x.petId === pet.id).sort(byDateDesc);
  const labs = db.labs.filter((x) => x.petId === pet.id).sort(byDateDesc);
  const vaccines = db.vaccines.filter((x) => x.petId === pet.id).sort(byDateDesc);
  const latest = new Set(latestVaccines(vaccines).map((v) => v.id));
  const addLabel = { visit: '진료 기록', lab: '검사 결과', vaccine: '접종 기록' }[tab];

  return (
    <Screen footer={<Fab label={addLabel} onPress={() => setEditing({ tab } as Editing)} />}>
      <PetSwitcher onAdd={onAddPet} />
      <Text style={[s.title, { fontSize: 22, marginBottom: 8 }]}>건강수첩</Text>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'visit', label: `진료 ${visits.length}` },
          { value: 'lab', label: `검사 수치 ${labs.length}` },
          { value: 'vaccine', label: `예방접종 ${vaccines.length}` },
        ]}
      />

      {tab === 'visit' && (
        <Card>
          {visits.length === 0 && <EmptyState icon="🏥" text="진료 기록이 없어요." />}
          {visits.map((v) => (
            <Pressable key={v.id} style={s.rowItem} onPress={() => setEditing({ tab: 'visit', item: v })} accessibilityRole="button">
              <View style={{ flex: 1 }}>
                <Text style={s.sub}>{v.date} · {v.hospital || '병원 미입력'}</Text>
                <Text style={s.title}>{v.reason}</Text>
                {!!v.diagnosis && <Text style={[s.sub, { color: color.text }]}>진단: {v.diagnosis}</Text>}
                {!!v.treatment && <Text style={s.sub}>처치: {v.treatment}</Text>}
                {!!v.cost && <Text style={s.sub}>{won(v.cost)}</Text>}
              </View>
              {v.photos[0] && <Image source={{ uri: v.photos[0] }} style={{ width: 48, height: 48, borderRadius: 8 }} />}
            </Pressable>
          ))}
        </Card>
      )}

      {tab === 'lab' && (
        <>
          {labs.length === 0 && <Card><EmptyState icon="🧪" text={'검사 결과가 없어요.\n검사지의 수치와 참고 범위를 입력하면 높음/낮음을 표시해요.'} /></Card>}
          {labs.map((l) => {
            const bad = abnormalItems(l).length;
            return (
              <Card key={l.id}>
                <Pressable onPress={() => setEditing({ tab: 'lab', item: l })} accessibilityRole="button">
                  <View style={[s.row, { justifyContent: 'space-between', marginBottom: 8 }]}>
                    <View>
                      <Text style={s.sub}>{l.date}</Text>
                      <Text style={s.title}>{l.title || '검사'}</Text>
                    </View>
                    <LevelBadge level={bad ? 'watch' : 'ok'} />
                  </View>
                  {l.items.map((i) => {
                    const f = labFlag(i);
                    const flagText = f === 'high' ? '▲ 높음' : f === 'low' ? '▼ 낮음' : f === 'normal' ? '정상' : '';
                    const range = i.refMin !== undefined || i.refMax !== undefined ? `${i.refMin ?? ''}~${i.refMax ?? ''}` : '';
                    return (
                      <View key={i.name} style={[s.row, { paddingVertical: 5, borderTopWidth: 1, borderColor: '#F3F3F6' }]}>
                        <Text style={{ width: 64, fontWeight: '700', color: color.text }}>{i.name}</Text>
                        <Text style={{ flex: 1, color: color.text }}>
                          {i.value} <Text style={{ color: color.sub, fontSize: 12 }}>{i.unit}</Text>
                        </Text>
                        <Text style={{ width: 84, color: color.sub, fontSize: 12, textAlign: 'right' }}>{range}</Text>
                        <Text style={{ width: 56, textAlign: 'right', fontSize: 12, fontWeight: '700', color: f === 'high' || f === 'low' ? color.danger : color.ok }}>
                          {flagText}
                        </Text>
                      </View>
                    );
                  })}
                  {!!l.memo && <Text style={s.hint}>메모: {l.memo}</Text>}
                </Pressable>
              </Card>
            );
          })}
        </>
      )}

      {tab === 'vaccine' && (
        <Card>
          {vaccines.length === 0 && <EmptyState icon="💉" text={'접종 기록이 없어요.\n다음 접종일을 입력하면 일정과 알림이 자동 등록돼요.'} />}
          {vaccines.map((v) => {
            const st = latest.has(v.id) ? vaccineStatus(v) : 'none';
            const d = v.nextDate ? daysUntil(v.nextDate) : 0;
            return (
              <Pressable key={v.id} style={s.rowItem} onPress={() => setEditing({ tab: 'vaccine', item: v })} accessibilityRole="button">
                <View style={{ flex: 1 }}>
                  <Text style={s.title}>{v.name}</Text>
                  <Text style={s.sub}>접종 {v.date}{v.hospital ? ` · ${v.hospital}` : ''}</Text>
                  {latest.has(v.id) && v.nextDate && (
                    <Text style={[s.sub, { color: st === 'overdue' ? color.danger : st === 'soon' ? color.warn : color.sub }]}>
                      다음 {v.nextDate} ({d < 0 ? `${-d}일 지남` : d === 0 ? '오늘' : `D-${d}`}) 🔔
                    </Text>
                  )}
                </View>
                {st === 'overdue' && <LevelBadge level="vet" />}
                {st === 'soon' && <LevelBadge level="watch" />}
              </Pressable>
            );
          })}
        </Card>
      )}

      {editing?.tab === 'visit' && <VisitEditor petId={pet.id} initial={editing.item} onClose={() => setEditing(null)} />}
      {editing?.tab === 'lab' && <LabEditor petId={pet.id} initial={editing.item} onClose={() => setEditing(null)} />}
      {editing?.tab === 'vaccine' && <VaccineEditor petId={pet.id} initial={editing.item} onClose={() => setEditing(null)} />}
    </Screen>
  );
}
