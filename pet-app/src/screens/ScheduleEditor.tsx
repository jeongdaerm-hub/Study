import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Repeat, Schedule, ScheduleType } from '../types.ts';
import { REMIND_OPTIONS, REPEAT_LABEL } from '../logic/schedule.ts';
import { newId } from '../logic/date.ts';
import { Chip, ChipRow, Label, PetSelector, PrimaryButton, color } from '../components/ui.tsx';
import { DateTimeField } from '../components/DateTimeField.tsx';

const TYPES: ScheduleType[] = ['병원', '예방접종', '구충제', '미용', '산책', '기타'];
const REPEATS: Repeat[] = ['none', 'daily', 'weekly', 'monthly'];

interface Props {
  initial?: Schedule;
  defaultPetId: string;
  onClose: () => void;
  onSave: (s: Schedule) => Promise<void>;
}

function defaultTime(): Date {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return d;
}

export function ScheduleEditor({ initial, defaultPetId, onClose, onSave }: Props) {
  const [petId, setPetId] = useState(initial?.petId ?? defaultPetId);
  const [type, setType] = useState<ScheduleType>(initial?.type ?? '병원');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [when, setWhen] = useState(initial ? new Date(initial.dateTime) : defaultTime());
  const [remind, setRemind] = useState(initial?.remindBefore ?? 60);
  const [repeat, setRepeat] = useState<Repeat>(initial?.repeat ?? 'none');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (repeat === 'none' && when.getTime() < Date.now()) {
      Alert.alert('일정', '지난 시간에는 알림을 드릴 수 없어요. 시간을 확인해 주세요.');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        id: initial?.id ?? newId(),
        petId,
        type,
        title: title.trim() || type,
        dateTime: when.toISOString(),
        remindBefore: remind,
        repeat,
        done: false,
        notificationId: initial?.notificationId,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={s.header}>
        <Pressable onPress={onClose}><Text style={s.headerBtn}>취소</Text></Pressable>
        <Text style={s.headerTitle}>{initial ? '일정 수정' : '새 일정'}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <Label>반려동물</Label>
        <PetSelector value={petId} onChange={setPetId} />

        <Label>종류</Label>
        <ChipRow>
          {TYPES.map((t) => <Chip key={t} label={t} selected={type === t} onPress={() => setType(t)} />)}
        </ChipRow>

        <Label>내용</Label>
        <TextInput style={s.input} placeholder={`예) ${type === '병원' ? '다로동물병원 정기검진' : type}`} value={title} onChangeText={setTitle} maxLength={60} />

        <Label>날짜와 시간</Label>
        <DateTimeField value={when} onChange={setWhen} />

        <Label>알림</Label>
        <ChipRow>
          {REMIND_OPTIONS.map((o) => (
            <Chip key={o.minutes} label={o.label} selected={remind === o.minutes} onPress={() => setRemind(o.minutes)} />
          ))}
        </ChipRow>

        <Label>반복</Label>
        <ChipRow>
          {REPEATS.map((r) => <Chip key={r} label={REPEAT_LABEL[r]} selected={repeat === r} onPress={() => setRepeat(r)} />)}
        </ChipRow>

        <View style={{ height: 24 }} />
        <PrimaryButton label={saving ? '저장 중…' : '저장하고 알림 받기'} onPress={save} disabled={saving} />
      </ScrollView>
    </Modal>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 48, borderBottomWidth: 1, borderColor: color.line },
  headerBtn: { color: color.sub, fontSize: 15, width: 40 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  body: { padding: 16, paddingBottom: 48 },
  input: { borderWidth: 1, borderColor: color.line, borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: '#fff' },
});
