import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useTheme } from './theme.tsx';

interface Props {
  value: Date;
  onChange: (d: Date) => void;
  /** 'date' 만 쓰면 날짜만 선택 */
  modes?: ('date' | 'time')[];
}

const pad = (n: number) => String(n).padStart(2, '0');

export function DateTimeField({ value, onChange, modes = ['date', 'time'] }: Props) {
  const t = useTheme();
  const [mode, setMode] = useState<'date' | 'time' | null>(null);

  const handle = (e: DateTimePickerEvent, d?: Date) => {
    if (Platform.OS === 'android') setMode(null); // 안드로이드는 다이얼로그가 자동 닫힘
    if (e.type === 'set' && d) onChange(d);
  };

  return (
    <View>
      <View style={s.row}>
        {modes.includes('date') && (
          <Pressable style={[s.box, { borderColor: t.line }]} onPress={() => setMode('date')}>
            <Text style={[s.text, { color: t.text }]}>📅 {value.getFullYear()}.{pad(value.getMonth() + 1)}.{pad(value.getDate())}</Text>
          </Pressable>
        )}
        {modes.includes('time') && (
          <Pressable style={[s.box, { borderColor: t.line }]} onPress={() => setMode('time')}>
            <Text style={[s.text, { color: t.text }]}>⏰ {pad(value.getHours())}:{pad(value.getMinutes())}</Text>
          </Pressable>
        )}
      </View>
      {mode && (
        <View>
          <DateTimePicker
            value={value}
            mode={mode}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handle}
            locale="ko-KR"
          />
          {Platform.OS === 'ios' && (
            <Pressable onPress={() => setMode(null)} style={s.done}>
              <Text style={{ color: t.primary, fontWeight: '700' }}>완료</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  box: { flex: 1, borderWidth: 1, borderRadius: 10, padding: 12, backgroundColor: '#fff' },
  text: { fontSize: 15 },
  done: { alignSelf: 'flex-end', padding: 8 },
});
