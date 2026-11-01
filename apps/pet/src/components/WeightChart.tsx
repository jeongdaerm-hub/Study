import React, { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { chartPoints } from '../logic/weight.ts';
import type { WeightEntry } from '../types.ts';
import { color } from '../theme.ts';

const H = 200;
const GRID = '#ECECF0';
const AXIS_TEXT = '#8A8A93';

/**
 * 체중 변화 선 그래프 (단일 시리즈)
 * - 2px 선 + 8px 점, 연한 격자, 점을 누르면 값 표시
 * - 아래 기록 목록이 표 보기 역할
 */
export function WeightChart({ entries }: { entries: WeightEntry[] }) {
  const [w, setW] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const onLayout = (e: LayoutChangeEvent) => setW(Math.round(e.nativeEvent.layout.width));
  const { points, ticks, yOf } = chartPoints(entries, w || 300, H);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const picked = sel !== null ? points[sel] : points[points.length - 1];
  const fmt = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

  return (
    <View onLayout={onLayout} accessibilityLabel={`체중 그래프, 기록 ${entries.length}개`}>
      {picked && (
        <Text style={st.readout}>
          {picked.entry.date} · <Text style={{ fontWeight: '800', color: color.text }}>{picked.entry.kg}kg</Text>
        </Text>
      )}
      {w > 0 && (
        <Svg width={w} height={H}>
          {ticks.map((t) => (
            <G key={t}>
              <Line x1={40} x2={w - 16} y1={yOf(t)} y2={yOf(t)} stroke={GRID} strokeWidth={1} />
              <SvgText x={34} y={yOf(t) + 4} fontSize={11} fill={AXIS_TEXT} textAnchor="end">
                {t}
              </SvgText>
            </G>
          ))}
          {points.length > 0 && (
            <>
              <SvgText x={points[0].x} y={H - 8} fontSize={11} fill={AXIS_TEXT} textAnchor="start">
                {fmt(points[0].entry.date)}
              </SvgText>
              {points.length > 1 && (
                <SvgText x={points[points.length - 1].x} y={H - 8} fontSize={11} fill={AXIS_TEXT} textAnchor="end">
                  {fmt(points[points.length - 1].entry.date)}
                </SvgText>
              )}
            </>
          )}
          {picked && <Line x1={picked.x} x2={picked.x} y1={16} y2={H - 28} stroke={GRID} strokeWidth={1} strokeDasharray="3 3" />}
          <Path d={path} stroke={color.primary} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p, i) => (
            <G key={p.entry.id}>
              <Circle cx={p.x} cy={p.y} r={picked === p ? 6 : 4} fill={color.primary} stroke="#fff" strokeWidth={2} />
              {/* 손가락으로 누르기 쉬운 넓은 터치 영역 */}
              <Rect x={p.x - 16} y={p.y - 16} width={32} height={32} fill="transparent" onPress={() => setSel(i)} />
            </G>
          ))}
        </Svg>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  readout: { color: color.sub, fontSize: 13, marginBottom: 4 },
});
