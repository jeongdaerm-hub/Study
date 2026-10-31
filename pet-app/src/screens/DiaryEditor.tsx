import React, { useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { DiaryEntry, Mood, PoopStatus } from '../types.ts';
import { POOP_LABEL } from '../logic/poop.ts';
import { newId, toDateKey } from '../logic/date.ts';
import { MAX_PHOTOS, deletePhotos, pickPhotos } from '../storage/photos.ts';
import { Chip, ChipRow, Label, PetSelector, PrimaryButton, color } from '../components/ui.tsx';
import { DateTimeField } from '../components/DateTimeField.tsx';

const MOODS: Mood[] = ['😆', '🙂', '😐', '😢', '🤒'];
const POOPS: PoopStatus[] = ['normal', 'hard', 'soft', 'diarrhea', 'blood', 'none'];

interface Props {
  visible: boolean;
  initial?: DiaryEntry;
  defaultPetId: string;
  onClose: () => void;
  onSave: (e: DiaryEntry) => Promise<void>;
}

export function DiaryEditor({ visible, initial, defaultPetId, onClose, onSave }: Props) {
  const [petId, setPetId] = useState(initial?.petId ?? defaultPetId);
  const [date, setDate] = useState(initial ? new Date(`${initial.date}T12:00:00`) : new Date());
  const [mood, setMood] = useState<Mood>(initial?.mood ?? '🙂');
  const [text, setText] = useState(initial?.text ?? '');
  const [photos, setPhotos] = useState<string[]>(initial?.photos ?? []);
  const [poopOn, setPoopOn] = useState(!!initial?.poop);
  const [poopStatus, setPoopStatus] = useState<PoopStatus>(initial?.poop?.status ?? 'normal');
  const [poopCount, setPoopCount] = useState(initial?.poop?.count ?? 1);
  const [saving, setSaving] = useState(false);
  // 이번 편집 중 새로 추가된 사진 (취소 시 정리)
  const [added, setAdded] = useState<string[]>([]);

  const addPhotos = async (source: 'library' | 'camera') => {
    try {
      const uris = await pickPhotos(source, MAX_PHOTOS - photos.length);
      setPhotos((p) => [...p, ...uris]);
      setAdded((a) => [...a, ...uris]);
    } catch (e) {
      Alert.alert('사진', e instanceof Error ? e.message : '사진을 불러오지 못했어요.');
    }
  };

  const cancel = async () => {
    await deletePhotos(added);
    onClose();
  };

  const save = async () => {
    if (!text.trim() && photos.length === 0 && !poopOn) {
      Alert.alert('일기', '내용, 사진, 배변 체크 중 하나는 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        id: initial?.id ?? newId(),
        petId,
        date: toDateKey(date),
        mood,
        text: text.trim(),
        photos,
        poop: poopOn ? { status: poopStatus, count: poopStatus === 'none' ? 0 : poopCount } : undefined,
        createdAt: initial?.createdAt ?? Date.now(),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={cancel}>
      <View style={s.header}>
        <Pressable onPress={cancel}><Text style={s.headerBtn}>취소</Text></Pressable>
        <Text style={s.headerTitle}>{initial ? '일기 수정' : '오늘의 일기'}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <Label>누구의 일기인가요?</Label>
        <PetSelector value={petId} onChange={setPetId} />

        <Label>날짜</Label>
        <DateTimeField value={date} onChange={setDate} modes={['date']} />

        <Label>오늘 기분</Label>
        <ChipRow>
          {MOODS.map((m) => <Chip key={m} label={m} selected={mood === m} onPress={() => setMood(m)} />)}
        </ChipRow>

        <Label>일기</Label>
        <TextInput
          style={s.input}
          multiline
          placeholder="오늘 산책은 어땠나요? 밥은 잘 먹었나요?"
          value={text}
          onChangeText={setText}
          maxLength={2000}
        />

        <Label>사진 ({photos.length}/{MAX_PHOTOS})</Label>
        <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
          {photos.map((uri) => (
            <View key={uri}>
              <Image source={{ uri }} style={s.thumb} />
              <Pressable style={s.remove} onPress={() => setPhotos((p) => p.filter((x) => x !== uri))} accessibilityLabel="사진 삭제">
                <Text style={{ color: '#fff', fontSize: 12 }}>✕</Text>
              </Pressable>
            </View>
          ))}
          {photos.length < MAX_PHOTOS && (
            <>
              <Pressable style={[s.thumb, s.add]} onPress={() => addPhotos('library')}><Text>🖼️{'\n'}앨범</Text></Pressable>
              <Pressable style={[s.thumb, s.add]} onPress={() => addPhotos('camera')}><Text>📷{'\n'}촬영</Text></Pressable>
            </>
          )}
        </ScrollView>

        <Label>배변 체크</Label>
        <ChipRow>
          <Chip label={poopOn ? '✅ 기록함' : '기록 안 함'} selected={poopOn} onPress={() => setPoopOn(!poopOn)} />
        </ChipRow>
        {poopOn && (
          <View style={{ marginTop: 10 }}>
            <ChipRow>
              {POOPS.map((p) => (
                <Chip key={p} label={POOP_LABEL[p]} selected={poopStatus === p} onPress={() => setPoopStatus(p)} />
              ))}
            </ChipRow>
            {poopStatus !== 'none' && (
              <View style={s.counter}>
                <Text style={{ color: color.sub }}>횟수</Text>
                <Pressable style={s.step} onPress={() => setPoopCount((c) => Math.max(1, c - 1))}><Text>－</Text></Pressable>
                <Text style={s.count}>{poopCount}회</Text>
                <Pressable style={s.step} onPress={() => setPoopCount((c) => Math.min(10, c + 1))}><Text>＋</Text></Pressable>
              </View>
            )}
          </View>
        )}

        <View style={{ height: 24 }} />
        <PrimaryButton label={saving ? '저장 중…' : '저장'} onPress={save} disabled={saving} />
      </ScrollView>
    </Modal>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 48, borderBottomWidth: 1, borderColor: color.line },
  headerBtn: { color: color.sub, fontSize: 15, width: 40 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  body: { padding: 16, paddingBottom: 48 },
  input: { minHeight: 120, borderWidth: 1, borderColor: color.line, borderRadius: 10, padding: 12, textAlignVertical: 'top', fontSize: 15, backgroundColor: '#fff' },
  thumb: { width: 84, height: 84, borderRadius: 10 },
  add: { borderWidth: 1, borderStyle: 'dashed', borderColor: color.line, alignItems: 'center', justifyContent: 'center' },
  remove: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  counter: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  step: { borderWidth: 1, borderColor: color.line, borderRadius: 8, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  count: { fontSize: 16, fontWeight: '700', minWidth: 40, textAlign: 'center' },
});
