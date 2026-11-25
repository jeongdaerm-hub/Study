import React, { useState } from 'react';
import { Text } from 'react-native';
import { DateTimeField, Label, newId, notificationsSupported, REMIND_OPTIONS, REPEAT_LABEL, SelectChips, useDialog, type Repeat } from '@daro/app-core';
import type { Schedule, ScheduleType } from '../types.ts';
import { SCHEDULE_EMOJI, SCHEDULE_LABEL } from '../labels.ts';
import { useAppData } from '../state/AppData.tsx';
import { cleanText, LIMITS } from '../logic/validate.ts';
import { Field, FormModal, s } from '../components/common.tsx';
import { color } from '../theme.ts';

const REPEATS: Repeat[] = ['none', 'daily', 'weekly', 'monthly'];
const PLACEHOLDER: Record<ScheduleType, string> = {
  vaccine: '예) 광견병 접종',
  medicine: '예) 심장사상충 예방약',
  hospital: '예) 신장 수치 재검',
  grooming: '예) 미용 예약',
  etc: '예) 사료 주문',
};

function defaultTime(): Date {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return d;
}

export function ScheduleEditor({ petId, initial, onClose }: { petId: string; initial?: Schedule; onClose: () => void }) {
  const { saveSchedule, remove } = useAppData();
  const { notify, confirm } = useDialog();
  const [type, setType] = useState<ScheduleType>(initial?.type ?? 'medicine');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [when, setWhen] = useState(initial ? new Date(initial.dateTime) : defaultTime());
  const [remind, setRemind] = useState(initial?.remindBefore ?? 0);
  const [repeat, setRepeat] = useState<Repeat>(initial?.repeat ?? (type === 'medicine' ? 'daily' : 'none'));
  const [memo, setMemo] = useState(initial?.memo ?? '');

  const save = async () => {
    if (repeat === 'none' && when.getTime() < Date.now() && !initial) {
      const ok = await confirm({ title: '지난 시간', message: '이미 지난 시간이라 알림은 울리지 않아요. 그래도 저장할까요?', confirmText: '저장' });
      if (!ok) return;
    }
    const t = cleanText(title, LIMITS.short) || SCHEDULE_LABEL[type];
    if (t.length > LIMITS.short) return notify('입력 확인', '제목이 너무 길어요.');
    await saveSchedule({
      id: initial?.id ?? newId(),
      petId,
      type,
      title: t,
      memo: cleanText(memo),
      dateTime: when.toISOString(),
      remindBefore: remind,
      repeat,
      done: false,
      notificationId: initial?.notificationId,
    });
    onClose();
  };
  const del = initial
    ? async () => {
        if (await confirm({ title: '일정 삭제', message: `'${initial.title}' 일정과 알림을 삭제할까요?`, confirmText: '삭제', destructive: true })) {
          await remove('schedules', initial.id);
          onClose();
        }
      }
    : undefined;

  return (
    <FormModal title={initial ? '일정 수정' : '새 일정'} onClose={onClose} onSave={save} onDelete={del}>
      <Label>종류</Label>
      <SelectChips
        value={type}
        onChange={(t) => {
          setType(t);
          if (!initial && t === 'medicine') setRepeat('daily');
        }}
        options={(Object.keys(SCHEDULE_LABEL) as ScheduleType[]).map((k) => ({ value: k, label: `${SCHEDULE_EMOJI[k]} ${SCHEDULE_LABEL[k]}` }))}
      />
      <Field label="제목" value={title} onChangeText={setTitle} placeholder={PLACEHOLDER[type]} maxLength={LIMITS.short} />
      <Label>날짜와 시간</Label>
      <DateTimeField value={when} onChange={setWhen} />
      <Label>알림</Label>
      <SelectChips value={remind} onChange={setRemind} options={REMIND_OPTIONS.map((o) => ({ value: o.minutes, label: o.label }))} />
      <Label>반복</Label>
      <SelectChips value={repeat} onChange={setRepeat} options={REPEATS.map((r) => ({ value: r, label: REPEAT_LABEL[r] }))} />
      <Field label="메모" value={memo} onChangeText={setMemo} multiline maxLength={LIMITS.text} placeholder="예) 공복 8시간 유지, 용량 1정" />
      {!notificationsSupported && <Text style={[s.hint, { color: color.warn }]}>※ 웹 미리보기에서는 알림이 울리지 않아요. 앱에서는 설정한 시간에 알려드려요.</Text>}
    </FormModal>
  );
}
