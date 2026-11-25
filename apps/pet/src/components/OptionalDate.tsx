import React from 'react';
import { View } from 'react-native';
import { Chip, ChipRow, DateTimeField, toDateKey } from '@daro/app-core';

const parse = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** 선택 입력 날짜 (생일, 다음 접종일 등) */
export function OptionalDate({
  value,
  onChange,
  emptyLabel = '모름',
  defaultDate = new Date(),
  maximumDate,
}: {
  value: string;
  onChange: (v: string) => void;
  emptyLabel?: string;
  defaultDate?: Date;
  maximumDate?: Date;
}) {
  return (
    <View style={{ gap: 8 }}>
      <ChipRow>
        <Chip label={emptyLabel} selected={!value} onPress={() => onChange('')} />
        <Chip label="날짜 입력" selected={!!value} onPress={() => onChange(value || toDateKey(defaultDate))} />
      </ChipRow>
      {!!value && <DateTimeField value={parse(value)} onChange={(d) => onChange(toDateKey(d))} modes={['date']} maximumDate={maximumDate} />}
    </View>
  );
}

export const dateFromKey = parse;
