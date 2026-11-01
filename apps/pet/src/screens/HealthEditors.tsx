import React, { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Chip, DateTimeField, Label, newId, toDateKey, useDialog } from '@daro/app-core';
import { useAppData } from '../state/AppData.tsx';
import type { LabResult, Vaccination, VisitRecord } from '../types.ts';
import { cleanText, LIMITS, parseNumber, validateRequired } from '../logic/validate.ts';
import { LAB_PRESETS } from '../logic/health.ts';
import { Field, FormModal, s } from '../components/common.tsx';
import { PhotoField } from '../components/PhotoField.tsx';
import { dateFromKey, OptionalDate } from '../components/OptionalDate.tsx';
import { color } from '../theme.ts';

function useDelete(collection: 'visits' | 'labs', id: string | undefined, onClose: () => void) {
  const { remove } = useAppData();
  const { confirm } = useDialog();
  if (!id) return undefined;
  return async () => {
    if (await confirm({ title: '기록 삭제', message: '이 기록을 삭제할까요?', confirmText: '삭제', destructive: true })) {
      await remove(collection, id);
      onClose();
    }
  };
}

/* ───────── 진료 ───────── */
export function VisitEditor({ petId, initial, onClose }: { petId: string; initial?: VisitRecord; onClose: () => void }) {
  const { upsert } = useAppData();
  const { notify } = useDialog();
  const [date, setDate] = useState(initial ? dateFromKey(initial.date) : new Date());
  const [hospital, setHospital] = useState(initial?.hospital ?? '');
  const [reason, setReason] = useState(initial?.reason ?? '');
  const [diagnosis, setDiagnosis] = useState(initial?.diagnosis ?? '');
  const [treatment, setTreatment] = useState(initial?.treatment ?? '');
  const [cost, setCost] = useState(initial?.cost ? String(initial.cost) : '');
  const [photos, setPhotos] = useState(initial?.photos ?? []);
  const del = useDelete('visits', initial?.id, onClose);

  const save = async () => {
    const err = validateRequired('진료 사유', reason, LIMITS.short);
    if (err) return notify('입력 확인', err);
    const c = cost.trim() ? parseNumber(cost) : null;
    if (cost.trim() && (c === null || c > LIMITS.cost)) return notify('입력 확인', '진료비는 숫자로 입력해 주세요.');
    await upsert('visits', {
      id: initial?.id ?? newId(),
      petId,
      date: toDateKey(date),
      hospital: cleanText(hospital, LIMITS.short),
      reason: cleanText(reason, LIMITS.short),
      diagnosis: cleanText(diagnosis),
      treatment: cleanText(treatment),
      cost: c ?? undefined,
      photos,
    });
    onClose();
  };

  return (
    <FormModal title={initial ? '진료 기록 수정' : '진료 기록'} onClose={onClose} onSave={save} onDelete={del}>
      <Label>진료일</Label>
      <DateTimeField value={date} onChange={setDate} modes={['date']} maximumDate={new Date()} />
      <Field label="병원" value={hospital} onChangeText={setHospital} placeholder="예) 다로동물병원" maxLength={LIMITS.short} />
      <Field label="진료 사유 *" value={reason} onChangeText={setReason} placeholder="예) 귀 가려움" maxLength={LIMITS.short} />
      <Field label="진단" value={diagnosis} onChangeText={setDiagnosis} placeholder="예) 외이염" multiline maxLength={LIMITS.text} />
      <Field label="처치·처방" value={treatment} onChangeText={setTreatment} placeholder="예) 귀 세정, 연고 7일" multiline maxLength={LIMITS.text} />
      <Field label="진료비 (원)" value={cost} onChangeText={setCost} keyboardType="number-pad" placeholder="예) 45000" maxLength={11} />
      <PhotoField label="영수증·처방전 사진" photos={photos} onChange={setPhotos} />
    </FormModal>
  );
}

/* ───────── 검사 수치 ───────── */
interface Row {
  name: string;
  value: string;
  unit: string;
  refMin: string;
  refMax: string;
}
const toRow = (i: LabResult['items'][number]): Row => ({
  name: i.name,
  value: String(i.value),
  unit: i.unit,
  refMin: i.refMin === undefined ? '' : String(i.refMin),
  refMax: i.refMax === undefined ? '' : String(i.refMax),
});

export function LabEditor({ petId, initial, onClose }: { petId: string; initial?: LabResult; onClose: () => void }) {
  const { upsert } = useAppData();
  const { notify } = useDialog();
  const [date, setDate] = useState(initial ? dateFromKey(initial.date) : new Date());
  const [title, setTitle] = useState(initial?.title ?? '혈액검사');
  const [rows, setRows] = useState<Row[]>(initial?.items.map(toRow) ?? []);
  const [memo, setMemo] = useState(initial?.memo ?? '');
  const del = useDelete('labs', initial?.id, onClose);

  const set = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const addRow = (name = '', unit = '') => {
    if (rows.length >= LIMITS.labItems) return;
    setRows((r) => [...r, { name, unit, value: '', refMin: '', refMax: '' }]);
  };

  const save = async () => {
    const filled = rows.filter((r) => r.name.trim() || r.value.trim());
    if (!filled.length) return notify('입력 확인', '검사 항목을 1개 이상 입력해 주세요.');
    const items = [];
    for (const r of filled) {
      const v = parseNumber(r.value);
      const lo = r.refMin.trim() ? parseNumber(r.refMin) : undefined;
      const hi = r.refMax.trim() ? parseNumber(r.refMax) : undefined;
      if (!r.name.trim()) return notify('입력 확인', '항목 이름을 입력해 주세요.');
      if (v === null || v > LIMITS.labValue) return notify('입력 확인', `${r.name}: 결과값을 숫자로 입력해 주세요.`);
      if (lo === null || hi === null) return notify('입력 확인', `${r.name}: 참고 범위는 숫자로 입력해 주세요.`);
      if (lo !== undefined && hi !== undefined && lo > hi) return notify('입력 확인', `${r.name}: 참고 범위 최소값이 최대값보다 커요.`);
      items.push({ name: cleanText(r.name, 16), value: v, unit: cleanText(r.unit, 12), refMin: lo, refMax: hi });
    }
    await upsert('labs', { id: initial?.id ?? newId(), petId, date: toDateKey(date), title: cleanText(title, LIMITS.short), items, memo: cleanText(memo) });
    onClose();
  };

  const used = new Set(rows.map((r) => r.name));
  return (
    <FormModal title={initial ? '검사 결과 수정' : '검사 결과'} onClose={onClose} onSave={save} onDelete={del}>
      <Label>검사일</Label>
      <DateTimeField value={date} onChange={setDate} modes={['date']} maximumDate={new Date()} />
      <Field label="검사명" value={title} onChangeText={setTitle} maxLength={LIMITS.short} />
      <Label>자주 쓰는 항목</Label>
      <ScrollView horizontal contentContainerStyle={{ gap: 6 }}>
        {LAB_PRESETS.filter((p) => !used.has(p.name)).map((p) => (
          <Chip key={p.name} label={`＋ ${p.name}`} onPress={() => addRow(p.name, p.unit)} />
        ))}
      </ScrollView>
      <Label>결과 (참고 범위는 검사지 값 입력)</Label>
      {rows.map((r, i) => (
        <View key={i} style={{ backgroundColor: '#fff', borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: color.line }}>
          <View style={[s.row, { gap: 6 }]}>
            <Mini value={r.name} onChange={(v) => set(i, { name: v })} placeholder="항목" flex={1.2} />
            <Mini value={r.value} onChange={(v) => set(i, { value: v })} placeholder="결과" numeric flex={1} />
            <Mini value={r.unit} onChange={(v) => set(i, { unit: v })} placeholder="단위" flex={1} />
            <Pressable onPress={() => setRows((x) => x.filter((_, j) => j !== i))} hitSlop={8} accessibilityLabel="항목 삭제">
              <Text style={{ color: color.danger, fontSize: 16 }}>✕</Text>
            </Pressable>
          </View>
          <View style={[s.row, { gap: 6, marginTop: 6 }]}>
            <Text style={{ color: color.sub, fontSize: 12 }}>참고 범위</Text>
            <Mini value={r.refMin} onChange={(v) => set(i, { refMin: v })} placeholder="최소" numeric flex={1} />
            <Text style={{ color: color.sub }}>~</Text>
            <Mini value={r.refMax} onChange={(v) => set(i, { refMax: v })} placeholder="최대" numeric flex={1} />
          </View>
        </View>
      ))}
      <Pressable onPress={() => addRow()} style={{ padding: 10, alignItems: 'center' }} accessibilityRole="button">
        <Text style={{ color: color.primary, fontWeight: '700' }}>＋ 직접 항목 추가</Text>
      </Pressable>
      <Field label="메모" value={memo} onChangeText={setMemo} multiline maxLength={LIMITS.text} placeholder="예) 1개월 후 재검" />
    </FormModal>
  );
}

function Mini({ value, onChange, placeholder, numeric, flex }: { value: string; onChange: (v: string) => void; placeholder: string; numeric?: boolean; flex: number }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor="#A0A0A8"
      keyboardType={numeric ? 'decimal-pad' : 'default'}
      maxLength={numeric ? 9 : 16}
      style={{ flex, minWidth: 0, borderWidth: 1, borderColor: color.line, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 8, fontSize: 14, color: color.text }}
      accessibilityLabel={placeholder}
    />
  );
}

/* ───────── 예방접종 ───────── */
const VACCINE_PRESETS = ['종합백신(DHPPL)', '종합백신(FVRCP)', '광견병', '코로나 장염', '켄넬코프', '인플루엔자', '심장사상충 검사'];

export function VaccineEditor({ petId, initial, onClose }: { petId: string; initial?: Vaccination; onClose: () => void }) {
  const { saveVaccine, remove } = useAppData();
  const { notify, confirm } = useDialog();
  const [name, setName] = useState(initial?.name ?? '');
  const [date, setDate] = useState(initial ? dateFromKey(initial.date) : new Date());
  const [nextDate, setNextDate] = useState(initial?.nextDate ?? '');
  const [hospital, setHospital] = useState(initial?.hospital ?? '');

  const save = async () => {
    const err = validateRequired('접종명', name, LIMITS.short);
    if (err) return notify('입력 확인', err);
    if (nextDate && nextDate <= toDateKey(date)) return notify('입력 확인', '다음 접종일은 접종일 이후여야 해요.');
    await saveVaccine({
      id: initial?.id ?? newId(),
      petId,
      name: cleanText(name, LIMITS.short),
      date: toDateKey(date),
      nextDate: nextDate || undefined,
      hospital: cleanText(hospital, LIMITS.short),
      scheduleId: initial?.scheduleId,
    });
    onClose();
  };
  const del = initial
    ? async () => {
        if (await confirm({ title: '접종 기록 삭제', message: '연결된 접종 일정·알림도 함께 삭제돼요.', confirmText: '삭제', destructive: true })) {
          await remove('vaccines', initial.id);
          onClose();
        }
      }
    : undefined;

  const plusYear = new Date(date);
  plusYear.setFullYear(plusYear.getFullYear() + 1);

  return (
    <FormModal title={initial ? '접종 기록 수정' : '예방접종 기록'} onClose={onClose} onSave={save} onDelete={del}>
      <Label>접종명 *</Label>
      <ScrollView horizontal contentContainerStyle={{ gap: 6, marginBottom: 8 }}>
        {VACCINE_PRESETS.map((p) => (
          <Chip key={p} label={p} selected={name === p} onPress={() => setName(p)} />
        ))}
      </ScrollView>
      <Field value={name} onChangeText={setName} placeholder="직접 입력" maxLength={LIMITS.short} />
      <Label>접종일</Label>
      <DateTimeField value={date} onChange={setDate} modes={['date']} maximumDate={new Date()} />
      <Label>다음 접종 예정일</Label>
      <OptionalDate value={nextDate} onChange={setNextDate} emptyLabel="없음" defaultDate={plusYear} />
      {!!nextDate && <Text style={s.hint}>🔔 일정·알림 탭에 자동 등록되고 하루 전 오전 10시에 알려드려요.</Text>}
      <Field label="병원" value={hospital} onChangeText={setHospital} maxLength={LIMITS.short} />
    </FormModal>
  );
}
