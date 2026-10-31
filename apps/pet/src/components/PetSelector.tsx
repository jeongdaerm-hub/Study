import React from 'react';
import { SelectChips } from '@daro/app-core';
import { PETS, petEmoji } from '../data/pets.ts';

export function PetSelector({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <SelectChips
      value={value}
      onChange={onChange}
      options={PETS.map((p) => ({ value: p.id, label: `${petEmoji(p)} ${p.name}` }))}
    />
  );
}
