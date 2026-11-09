import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useTheme } from './theme.tsx';

interface Props {
  value: Date;
  onChange: (d: Date) => void;
  /** 'date' 만 쓰면 날짜만 선택 */
  modes?: ('date' | 'time')[];
  maximumDate?: Date;
}

const pad = (n: number) => String(n).padStart(2, '0');
const dateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeStr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function DateTimeField(props: Props) {
  return Platform.OS === 'web' ? <WebDateTimeField {...props} /> : <NativeDateTimeField {...props} />;
}

/** 웹: 브라우저 기본 날짜/시간 입력 */
function WebDateTimeField({ value, onChange, modes = ['date', 'time'], maximumDate }: Props) {
  const t = useTheme();
  const style = {
    flex: 1,
    font: 'inherit',
    fontSize: 15,
    padding: 10,
    borderRadius: 10,
    border: `1px solid ${t.line}`,
    color: t.text,
    background: '#fff',
    minWidth: 0,
  };
  const set = (kind: 'date' | 'time', v: string) => {
    const next = new Date(value);
    if (kind === 'date') {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
      if (!m) return;
      next.setFullYear(+m[1], +m[2] - 1, +m[3]);
    } else {
      const m = /^(\d{2}):(\d{2})$/.exec(v);
      if (!m) return;
      next.setHours(+m[1], +m[2], 0, 0);
    }
    onChange(next);
  };
  return (
    <View style={s.row}>
      {modes.includes('date') &&
        React.createElement('input', {
          type: 'date',
          value: dateStr(value),
          max: maximumDate ? dateStr(maximumDate) : undefined,
          onChange: (e: { target: { value: string } }) => set('date', e.target.value),
          style,
          'aria-label': '날짜',
        })}
      {modes.includes('time') &&
        React.createElement('input', {
          type: 'time',
          value: timeStr(value),
          onChange: (e: { target: { value: string } }) => set('time', e.target.value),
          style,
          'aria-label': '시간',
        })}
    </View>
  );
}

function NativeDateTimeField({ value, onChange, modes = ['date', 'time'], maximumDate }: Props) {
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
            <Text style={[s.text, { color: t.text }]}>📅 {dateStr(value).replace(/-/g, '.')}</Text>
          </Pressable>
        )}
        {modes.includes('time') && (
          <Pressable style={[s.box, { borderColor: t.line }]} onPress={() => setMode('time')}>
            <Text style={[s.text, { color: t.text }]}>⏰ {timeStr(value)}</Text>
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
            maximumDate={mode === 'date' ? maximumDate : undefined}
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
