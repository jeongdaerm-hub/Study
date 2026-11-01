import React, { useState } from 'react';
import { View } from 'react-native';
import { Chip, ChipRow, Label, newId, SelectChips, useDialog } from '@daro/app-core';
import type { Pet, Sex, Species } from '../types.ts';
import { SEX_LABEL, SPECIES_EMOJI, SPECIES_LABEL } from '../labels.ts';
import { useAppData } from '../state/AppData.tsx';
import { Field, FormModal } from '../components/common.tsx';
import { OptionalDate } from '../components/OptionalDate.tsx';
import { PhotoField } from '../components/PhotoField.tsx';
import { cleanText, LIMITS, validateRequired } from '../logic/validate.ts';

export function PetForm({ initial, onClose }: { initial?: Pet; onClose: () => void }) {
  const { upsert, removePet, setCurrentPetId } = useAppData();
  const { confirm, notify } = useDialog();
  const [name, setName] = useState(initial?.name ?? '');
  const [species, setSpecies] = useState<Species>(initial?.species ?? 'dog');
  const [breed, setBreed] = useState(initial?.breed ?? '');
  const [sex, setSex] = useState<Sex>(initial?.sex ?? 'U');
  const [neutered, setNeutered] = useState(initial?.neutered ?? false);
  const [birthDate, setBirthDate] = useState(initial?.birthDate ?? '');
  const [photos, setPhotos] = useState<string[]>(initial?.photo ? [initial.photo] : []);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const err = validateRequired('이름', name, LIMITS.name);
    if (err) return notify('입력 확인', err);
    setSaving(true);
    const pet: Pet = {
      id: initial?.id ?? newId(),
      name: cleanText(name, LIMITS.name),
      species,
      breed: cleanText(breed, LIMITS.short),
      sex,
      neutered,
      birthDate,
      photo: photos[0],
      createdAt: initial?.createdAt ?? Date.now(),
    };
    await upsert('pets', pet);
    if (!initial) setCurrentPetId(pet.id);
    setSaving(false);
    onClose();
  };

  const del = async () => {
    if (!initial) return;
    const ok = await confirm({
      title: `${initial.name} 삭제`,
      message: '건강수첩, 체중, 생활일지, 일정, 사진이 모두 삭제되고 되돌릴 수 없어요.',
      confirmText: '모두 삭제',
      destructive: true,
    });
    if (!ok) return;
    await removePet(initial.id);
    onClose();
  };

  return (
    <FormModal title={initial ? '반려동물 정보' : '반려동물 등록'} onClose={onClose} onSave={save} onDelete={initial ? del : undefined} saving={saving}>
      <PhotoField label="프로필 사진" photos={photos} onChange={(p) => setPhotos(p.slice(-1))} max={1} />
      <Field label="이름 *" value={name} onChangeText={setName} placeholder="예) 다로" maxLength={LIMITS.name} />
      <Label>종류</Label>
      <SelectChips
        value={species}
        onChange={setSpecies}
        options={(Object.keys(SPECIES_LABEL) as Species[]).map((k) => ({ value: k, label: `${SPECIES_EMOJI[k]} ${SPECIES_LABEL[k]}` }))}
      />
      <Field label="품종" value={breed} onChangeText={setBreed} placeholder="예) 푸들" maxLength={LIMITS.short} />
      <Label>성별</Label>
      <View style={{ gap: 8 }}>
        <SelectChips value={sex} onChange={setSex} options={(Object.keys(SEX_LABEL) as Sex[]).map((k) => ({ value: k, label: SEX_LABEL[k] }))} />
        <ChipRow>
          <Chip label={neutered ? '✅ 중성화 완료' : '중성화 안 함'} selected={neutered} onPress={() => setNeutered(!neutered)} />
        </ChipRow>
      </View>
      <Label>생일</Label>
      <OptionalDate value={birthDate} onChange={setBirthDate} maximumDate={new Date()} />
    </FormModal>
  );
}
