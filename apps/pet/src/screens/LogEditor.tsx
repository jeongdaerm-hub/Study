import React, { useState } from 'react';
import { Label, newId, SelectChips, useDialog, DateTimeField } from '@daro/app-core';
import type { DailyLog, LogKind, PoopStatus, VomitType } from '../types.ts';
import { LOG_EMOJI, LOG_LABEL, POOP_LABEL, VOMIT_LABEL } from '../labels.ts';
import { useAppData } from '../state/AppData.tsx';
import { Field, FormModal } from '../components/common.tsx';
import { PhotoField } from '../components/PhotoField.tsx';
import { cleanText, LIMITS, parseNumber, validateAmount } from '../logic/validate.ts';
import { dateFromKey } from '../components/OptionalDate.tsx';
import { toDateKey } from '@daro/app-core';

const pad = (n: number) => String(n).padStart(2, '0');

export function LogEditor({
  petId,
  kind: initialKind = 'meal',
  date,
  initial,
  onClose,
}: {
  petId: string;
  kind?: LogKind;
  date: string;
  initial?: DailyLog;
  onClose: () => void;
}) {
  const { upsert, remove } = useAppData();
  const { notify, confirm } = useDialog();
  const now = new Date();
  const startAt = initial
    ? (() => {
        const d = dateFromKey(initial.date);
        const [h, m] = initial.time.split(':').map(Number);
        d.setHours(h, m);
        return d;
      })()
    : (() => {
        const d = dateFromKey(date);
        d.setHours(now.getHours(), now.getMinutes());
        return d;
      })();
  const [when, setWhen] = useState(startAt);
  const [kind, setKind] = useState<LogKind>(initial?.kind ?? initialKind);
  const [amount, setAmount] = useState(initial?.amount ? String(initial.amount) : '');
  const [food, setFood] = useState(initial?.food ?? '');
  const [poop, setPoop] = useState<PoopStatus>(initial?.poop ?? 'normal');
  const [vomit, setVomit] = useState<VomitType>(initial?.vomit ?? 'food');
  const [memo, setMemo] = useState(initial?.memo ?? '');
  const [photos, setPhotos] = useState<string[]>(initial?.photos ?? []);

  const save = async () => {
    const amt = amount.trim() ? parseNumber(amount) : null;
    if (amount.trim() && amt === null) return notify('입력 확인', '양은 숫자로 입력해 주세요.');
    if (kind === 'meal' || kind === 'water') {
      const err = validateAmount(kind, amt);
      if (err) return notify('입력 확인', err);
    }
    if (kind === 'note' && !memo.trim() && !photos.length) return notify('입력 확인', '메모나 사진을 입력해 주세요.');
    await upsert('logs', {
      id: initial?.id ?? newId(),
      petId,
      date: toDateKey(when),
      time: `${pad(when.getHours())}:${pad(when.getMinutes())}`,
      kind,
      amount: kind === 'meal' || kind === 'water' ? (amt ?? undefined) : undefined,
      food: kind === 'meal' ? cleanText(food, LIMITS.short) : undefined,
      poop: kind === 'poop' ? poop : undefined,
      vomit: kind === 'vomit' ? vomit : undefined,
      memo: cleanText(memo),
      photos,
    });
    onClose();
  };

  const del = initial
    ? async () => {
        if (await confirm({ title: '기록 삭제', message: '이 기록을 삭제할까요?', confirmText: '삭제', destructive: true })) {
          await remove('logs', initial.id);
          onClose();
        }
      }
    : undefined;

  return (
    <FormModal title={initial ? '기록 수정' : `${LOG_LABEL[kind]} 기록`} onClose={onClose} onSave={save} onDelete={del}>
      <Label>종류</Label>
      <SelectChips
        value={kind}
        onChange={setKind}
        options={(Object.keys(LOG_LABEL) as LogKind[]).map((k) => ({ value: k, label: `${LOG_EMOJI[k]} ${LOG_LABEL[k]}` }))}
      />
      <Label>날짜·시간</Label>
      <DateTimeField value={when} onChange={setWhen} maximumDate={new Date()} />

      {kind === 'meal' && (
        <>
          <Field label="사료·간식" value={food} onChangeText={setFood} placeholder="예) 연어 사료" maxLength={LIMITS.short} />
          <Field label="양 (g, 선택)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="예) 90" maxLength={7} />
        </>
      )}
      {kind === 'water' && <Field label="음수량 (ml, 선택)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="예) 250" maxLength={7} />}
      {kind === 'poop' && (
        <>
          <Label>배변 상태</Label>
          <SelectChips value={poop} onChange={setPoop} options={(Object.keys(POOP_LABEL) as PoopStatus[]).map((k) => ({ value: k, label: POOP_LABEL[k] }))} />
        </>
      )}
      {kind === 'vomit' && (
        <>
          <Label>구토 종류</Label>
          <SelectChips value={vomit} onChange={setVomit} options={(Object.keys(VOMIT_LABEL) as VomitType[]).map((k) => ({ value: k, label: VOMIT_LABEL[k] }))} />
        </>
      )}
      <Field label={kind === 'note' ? '메모 (일기)' : '메모 (선택)'} value={memo} onChangeText={setMemo} multiline maxLength={LIMITS.text} placeholder="특이사항을 적어 주세요" />
      <PhotoField photos={photos} onChange={setPhotos} />
    </FormModal>
  );
}
