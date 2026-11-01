import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import {
  Chip,
  ChipRow,
  DateTimeField,
  DialogHost,
  Label,
  pickImagesForUpload,
  PrimaryButton,
  toDateKey,
  useDialog,
  type PickedImage,
} from '@daro/app-core';
import { buildImportPlan, sanitizeScan, summarize, type ImportItem, type ImportPlan } from '@daro/health-scan';
import { useAppData, useCurrentPet } from '../state/AppData.tsx';
import { detectEngine, ScanFailure, type ScanEngine } from '../scan/engines.ts';
import { cleanText, LIMITS, parseNumber } from '../logic/validate.ts';
import { dateFromKey, OptionalDate } from '../components/OptionalDate.tsx';
import { Card, s } from '../components/common.tsx';
import { Check } from './HomeScreen.tsx';
import { color } from '../theme.ts';

type Step = 'pick' | 'analyzing' | 'review' | 'done';

const KIND_LABEL: Record<ImportItem['kind'], string> = { vaccine: '💉 예방접종', visit: '🏥 진료', lab: '🧪 검사 수치', followUp: '🔔 다음 일정' };
const KIND_ORDER: ImportItem['kind'][] = ['vaccine', 'visit', 'lab', 'followUp'];
const FOLLOW_LABEL = { vaccine: '접종', medicine: '투약', hospital: '병원 방문', etc: '기타' } as const;

/**
 * 건강수첩 사진 → AI 판독 → 확인·수정 → 기록·일정 저장
 */
export function ScanFlow({ onClose }: { onClose: () => void }) {
  const pet = useCurrentPet();
  const { db, importScan } = useAppData();
  const { notify, confirm } = useDialog();
  const [engine, setEngine] = useState<ScanEngine | null>(null);
  const [step, setStep] = useState<Step>('pick');
  const [images, setImages] = useState<PickedImage[]>([]);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [items, setItems] = useState<ImportItem[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [syncHistory, setSyncHistory] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string>('');
  const ctl = useRef<AbortController | null>(null);
  const today = toDateKey(new Date());

  useEffect(() => {
    void detectEngine().then(setEngine);
    return () => ctl.current?.abort();
  }, []);

  if (!pet) return null;
  const max = engine?.maxImages ?? 3;

  const add = async (source: 'library' | 'camera') => {
    try {
      const picked = await pickImagesForUpload(source, max - images.length);
      if (picked.length) setImages((p) => [...p, ...picked].slice(0, max));
    } catch (e) {
      await notify('사진', e instanceof Error ? e.message : '사진을 불러오지 못했어요.');
    }
  };

  const analyze = async () => {
    if (!engine) return;
    if (!images.length && engine.kind !== 'demo') return notify('사진', '분석할 사진을 1장 이상 골라 주세요.');
    ctl.current = new AbortController();
    setStep('analyzing');
    try {
      const raw = await engine.run(images, today, ctl.current.signal);
      const clean = sanitizeScan(raw, today); // AI 결과 재검증
      if (!clean) throw new ScanFailure('결과를 읽지 못했어요. 다시 시도해 주세요.');
      const p = buildImportPlan(
        clean.result,
        {
          visits: db.visits.filter((x) => x.petId === pet.id),
          labs: db.labs.filter((x) => x.petId === pet.id),
          vaccines: db.vaccines.filter((x) => x.petId === pet.id),
          schedules: db.schedules.filter((x) => x.petId === pet.id),
        },
        { todayKey: today, petName: pet.name },
      );
      const w = [...clean.result.warnings];
      if (clean.dropped) w.push(`형식이 맞지 않는 ${clean.dropped}건은 제외했어요.`);
      if (p.skippedPastFollowUps) w.push(`이미 지난 예정 일정 ${p.skippedPastFollowUps}건은 제외했어요.`);
      setWarnings(w);
      setPlan(p);
      setItems(p.items);
      setStep('review');
      if (!p.items.length) await notify('찾은 기록 없음', '사진에서 건강 기록을 찾지 못했어요. 문서가 잘 보이게 다시 찍어 주세요.');
    } catch (e) {
      setStep('pick');
      if (e instanceof ScanFailure && e.message === 'cancelled') return;
      await notify('분석 실패', e instanceof ScanFailure ? e.message : '분석 중 문제가 생겼어요. 다시 시도해 주세요.');
    }
  };

  const toggle = (key: string) => setItems((list) => list.map((i) => (i.key === key ? { ...i, selected: !i.selected } : i)));
  const update = (key: string, data: ImportItem['data']) =>
    setItems((list) => list.map((i) => (i.key === key ? ({ ...i, data, lowConfidence: false } as ImportItem) : i)));

  const counts = summarize(items);
  const total = counts.vaccine + counts.visit + counts.lab + counts.followUp;

  const save = async () => {
    if (!total) return notify('선택 없음', '저장할 항목을 선택해 주세요.');
    if (plan?.petNameMismatch) {
      const ok = await confirm({
        title: '이름이 달라요',
        message: `문서에는 '${plan.petNameMismatch}'(으)로 적혀 있어요. ${pet.name}의 기록으로 저장할까요?`,
        confirmText: '저장',
      });
      if (!ok) return;
    }
    setSaving(true);
    try {
      const sum = await importScan(pet.id, items, { syncHistory, photoUri: images[0]?.uri });
      setResult(
        [sum.vaccines && `예방접종 ${sum.vaccines}건`, sum.visits && `진료 ${sum.visits}건`, sum.labs && `검사 ${sum.labs}건`, sum.schedules && `일정 ${sum.schedules}건`]
          .filter(Boolean)
          .join(' · '),
      );
      setStep('done');
    } finally {
      setSaving(false);
    }
  };

  const grouped = useMemo(() => KIND_ORDER.map((k) => [k, items.filter((i) => i.kind === k)] as const).filter(([, l]) => l.length), [items]);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: color.bg }}>
        <View style={s.header}>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button">
            <Text style={s.headerBtn}>{step === 'done' ? '닫기' : '취소'}</Text>
          </Pressable>
          <Text style={s.headerTitle}>사진으로 불러오기</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          <View style={s.inner}>
            {step === 'pick' && (
              <>
                <Card>
                  <Text style={s.title}>📷 {pet.name}의 건강 서류를 찍어 주세요</Text>
                  <Text style={[s.hint, { fontSize: 13 }]}>
                    예방접종 수첩 · 진료비 영수증/세부내역서 · 혈액검사 결과지{'\n'}AI가 읽어서 기록과 일정으로 정리하고, 저장 전에 확인할 수 있어요.
                  </Text>
                  {engine && (
                    <View style={{ marginTop: 10, gap: 4 }}>
                      <View style={[s.row, { gap: 6 }]}>
                        <View style={{ backgroundColor: engine.kind === 'demo' ? '#FFF3E0' : '#E8F5E9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: engine.kind === 'demo' ? color.warn : color.ok }}>{engine.label}</Text>
                        </View>
                      </View>
                      <Text style={s.hint}>🔒 {engine.privacy}</Text>
                    </View>
                  )}
                </Card>

                <Label>
                  사진 ({images.length}/{max})
                </Label>
                <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
                  {images.map((img, i) => (
                    <View key={img.uri}>
                      <Image source={{ uri: img.uri }} style={{ width: 96, height: 128, borderRadius: 10 }} />
                      <Pressable
                        onPress={() => setImages((p) => p.filter((_, j) => j !== i))}
                        style={{ position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}
                        accessibilityLabel="사진 빼기"
                      >
                        <Text style={{ color: '#fff', fontSize: 12 }}>✕</Text>
                      </Pressable>
                    </View>
                  ))}
                  {images.length < max && (
                    <>
                      {Platform.OS !== 'web' && <AddTile icon="📷" label="촬영" onPress={() => add('camera')} />}
                      <AddTile icon="🖼️" label="앨범" onPress={() => add('library')} />
                    </>
                  )}
                </ScrollView>
                <Text style={s.hint}>팁: 밝은 곳에서 한 페이지가 화면에 꽉 차게, 글자가 흔들리지 않게 찍어 주세요.</Text>

                <View style={{ height: 20 }} />
                <PrimaryButton
                  label={engine?.kind === 'demo' && !images.length ? '예시 결과로 체험하기' : '분석 시작'}
                  onPress={analyze}
                  disabled={!engine}
                />
              </>
            )}

            {step === 'analyzing' && (
              <Card style={{ alignItems: 'center', paddingVertical: 40, gap: 12 }}>
                <ActivityIndicator size="large" color={color.primary} />
                <Text style={s.title}>AI가 서류를 읽고 있어요</Text>
                <Text style={s.sub}>보통 20초~1분 정도 걸려요</Text>
                <Pressable onPress={() => ctl.current?.abort()} style={{ padding: 12 }} accessibilityRole="button">
                  <Text style={{ color: color.sub, fontWeight: '600' }}>중지</Text>
                </Pressable>
              </Card>
            )}

            {step === 'review' && (
              <>
                {engine?.kind === 'demo' && (
                  <Card style={{ backgroundColor: '#FFF3E0' }}>
                    <Text style={{ color: color.warn, fontWeight: '700' }}>예시 결과예요</Text>
                    <Text style={[s.hint, { color: color.warn }]}>실제 사진을 분석한 결과가 아니에요. 스캔 서버를 연결하면 실제 분석이 돼요.</Text>
                  </Card>
                )}
                {plan?.petNameMismatch && (
                  <Card style={{ backgroundColor: '#FFEBEE' }}>
                    <Text style={{ color: color.danger, fontWeight: '700' }}>
                      ⚠ 문서의 이름 '{plan.petNameMismatch}' ≠ {pet.name}
                    </Text>
                  </Card>
                )}
                {warnings.length > 0 && (
                  <Card>
                    {warnings.map((w) => (
                      <Text key={w} style={[s.sub, { color: color.warn }]}>
                        ▲ {w}
                      </Text>
                    ))}
                  </Card>
                )}
                <Text style={s.hint}>체크된 항목만 저장돼요. 항목을 누르면 수정할 수 있어요.</Text>

                {grouped.map(([kind, list]) => (
                  <View key={kind}>
                    <Text style={[s.section, { marginTop: 16, marginBottom: 8 }]}>{KIND_LABEL[kind]}</Text>
                    <Card style={{ paddingVertical: 4 }}>
                      {list.map((it) => (
                        <View key={it.key} style={{ borderBottomWidth: 1, borderColor: '#F0F0F3' }}>
                          <View style={[s.row, { paddingVertical: 12 }]}>
                            <Pressable
                              onPress={() => toggle(it.key)}
                              hitSlop={8}
                              accessibilityRole="checkbox"
                              accessibilityState={{ checked: it.selected }}
                              accessibilityLabel={`${titleOf(it)} 저장 선택`}
                            >
                              <Check on={it.selected} />
                            </Pressable>
                            <Pressable style={{ flex: 1 }} onPress={() => setEditing(editing === it.key ? null : it.key)} accessibilityRole="button">
                              <Text style={[s.title, { fontSize: 15 }, !it.selected && { color: color.sub }]}>{titleOf(it)}</Text>
                              <Text style={s.sub}>{detailOf(it)}</Text>
                              <View style={[s.row, { gap: 6, marginTop: 4, flexWrap: 'wrap' }]}>
                                {it.duplicate && <Badge text="이미 있음" tone="sub" />}
                                {it.lowConfidence && <Badge text="확인 필요" tone="warn" />}
                                {it.kind === 'vaccine' && it.nextEstimated && it.data.nextDate && <Badge text="다음 접종일 추정" tone="warn" />}
                                {it.kind === 'vaccine' && it.data.nextDate && <Badge text="🔔 일정 등록" tone="ok" />}
                              </View>
                            </Pressable>
                            <Text style={{ color: color.sub }}>{editing === it.key ? '▲' : '수정'}</Text>
                          </View>
                          {editing === it.key && <ItemEditor item={it} onChange={(d) => update(it.key, d)} />}
                        </View>
                      ))}
                    </Card>
                  </View>
                ))}

                <Card style={{ marginTop: 16 }}>
                  <Pressable style={s.row} onPress={() => setSyncHistory(!syncHistory)} accessibilityRole="checkbox" accessibilityState={{ checked: syncHistory }}>
                    <Check on={syncHistory} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.title}>과거 일정도 동기화</Text>
                      <Text style={s.sub}>지난 진료·접종을 일정 탭에 '완료'로 남겨요</Text>
                    </View>
                  </Pressable>
                </Card>

                <PrimaryButton label={saving ? '저장 중…' : `${total}건 저장`} onPress={save} disabled={saving || !total} />
              </>
            )}

            {step === 'done' && (
              <Card style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
                <Text style={{ fontSize: 44 }}>✅</Text>
                <Text style={s.title}>저장했어요</Text>
                <Text style={s.sub}>{result || '저장된 항목이 없어요'}</Text>
                <Text style={[s.hint, { textAlign: 'center' }]}>다음 접종·내원 일정은 일정 탭에서 알림으로 알려드려요.</Text>
                <View style={{ alignSelf: 'stretch', marginTop: 12 }}>
                  <PrimaryButton label="확인" onPress={onClose} />
                </View>
              </Card>
            )}
          </View>
        </ScrollView>
        <DialogHost />
      </View>
    </Modal>
  );
}

function AddTile({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ width: 96, height: 128, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: color.line, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}
      accessibilityRole="button"
      accessibilityLabel={`${label}으로 사진 추가`}
    >
      <Text style={{ fontSize: 24 }}>{icon}</Text>
      <Text style={{ color: color.sub, marginTop: 4 }}>{label}</Text>
    </Pressable>
  );
}

function Badge({ text, tone }: { text: string; tone: 'ok' | 'warn' | 'sub' }) {
  const map = { ok: [color.ok, '#E8F5E9'], warn: [color.warn, '#FFF3E0'], sub: [color.sub, '#F0F0F3'] } as const;
  const [fg, bg] = map[tone];
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
      <Text style={{ color: fg, fontSize: 11, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}

function titleOf(it: ImportItem): string {
  switch (it.kind) {
    case 'vaccine':
      return it.data.name;
    case 'visit':
      return it.data.reason;
    case 'lab':
      return `${it.data.title} (${it.data.items.length}항목)`;
    case 'followUp':
      return it.data.title;
  }
}

function detailOf(it: ImportItem): string {
  switch (it.kind) {
    case 'vaccine':
      return [it.data.date, it.data.nextDate ? `다음 ${it.data.nextDate}` : '', it.data.hospital].filter(Boolean).join(' · ');
    case 'visit':
      return [it.data.date, it.data.hospital, it.data.diagnosis, it.data.cost ? `${it.data.cost.toLocaleString('ko-KR')}원` : ''].filter(Boolean).join(' · ');
    case 'lab':
      return `${it.data.date} · ${it.data.items.map((i) => `${i.name} ${i.value}`).join(', ')}`;
    case 'followUp':
      return `${it.data.date} · ${FOLLOW_LABEL[it.data.type]}`;
  }
}

/** 입력 중에는 자체 상태 유지, 글자는 즉시·숫자는 입력을 마치면 반영 */
function EditField({ label, value, onCommit, numeric, max }: { label: string; value: string; onCommit: (v: string) => void; numeric?: boolean; max?: number }) {
  const [text, setText] = useState(value);
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={[s.sub, { marginBottom: 4 }]}>{label}</Text>
      <TextInput
        value={text}
        onChangeText={(t) => {
          setText(t);
          if (!numeric) onCommit(t);
        }}
        onBlur={() => numeric && onCommit(text)}
        onSubmitEditing={() => numeric && onCommit(text)}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        maxLength={max ?? LIMITS.short}
        style={s.input}
        accessibilityLabel={label}
      />
    </View>
  );
}

/** 항목 바로 아래 펼쳐지는 수정 영역 */
function ItemEditor({ item, onChange }: { item: ImportItem; onChange: (d: ImportItem['data']) => void }) {
  const field = (label: string, value: string, set: (v: string) => void, opts: { numeric?: boolean; max?: number } = {}) => (
    <EditField label={label} value={value} onCommit={set} numeric={opts.numeric} max={opts.max} />
  );
  const date = (label: string, key: string, set: (k: string) => void) => (
    <View style={{ marginBottom: 8 }}>
      <Text style={[s.sub, { marginBottom: 4 }]}>{label}</Text>
      <DateTimeField value={dateFromKey(key)} onChange={(d) => set(toDateKey(d))} modes={['date']} maximumDate={label.includes('다음') ? undefined : new Date()} />
    </View>
  );
  const box = { paddingBottom: 12, paddingLeft: 38 };

  if (item.kind === 'vaccine') {
    const d = item.data;
    return (
      <View style={box}>
        {field('접종명', d.name, (v) => onChange({ ...d, name: cleanText(v, LIMITS.short) || d.name }))}
        {date('접종일', d.date, (k) => onChange({ ...d, date: k }))}
        <Text style={[s.sub, { marginBottom: 4 }]}>다음 접종일</Text>
        <OptionalDate value={d.nextDate ?? ''} onChange={(k) => onChange({ ...d, nextDate: k || null })} emptyLabel="없음" />
      </View>
    );
  }
  if (item.kind === 'visit') {
    const d = item.data;
    return (
      <View style={box}>
        {date('진료일', d.date, (k) => onChange({ ...d, date: k }))}
        {field('병원', d.hospital, (v) => onChange({ ...d, hospital: cleanText(v, LIMITS.short) }))}
        {field('진료 사유', d.reason, (v) => onChange({ ...d, reason: cleanText(v, LIMITS.short) || d.reason }))}
        {field('진단', d.diagnosis, (v) => onChange({ ...d, diagnosis: cleanText(v) }), { max: LIMITS.text })}
        {field('처치·처방', d.treatment, (v) => onChange({ ...d, treatment: cleanText(v) }), { max: LIMITS.text })}
        {field('진료비 (원)', d.cost ? String(d.cost) : '', (v) => onChange({ ...d, cost: v.trim() ? parseNumber(v) : null }), { numeric: true, max: 11 })}
      </View>
    );
  }
  if (item.kind === 'lab') {
    const d = item.data;
    return (
      <View style={box}>
        {date('검사일', d.date, (k) => onChange({ ...d, date: k }))}
        {d.items.map((i, idx) => (
          <View key={i.name}>
            {field(`${i.name} (${i.unit || '단위 없음'})`, String(i.value), (v) => {
              const n = parseNumber(v);
              if (n === null) return;
              onChange({ ...d, items: d.items.map((x, j) => (j === idx ? { ...x, value: n } : x)) });
            }, { numeric: true, max: 9 })}
          </View>
        ))}
      </View>
    );
  }
  const d = item.data;
  return (
    <View style={box}>
      {field('제목', d.title, (v) => onChange({ ...d, title: cleanText(v, LIMITS.short) || d.title }))}
      {date('날짜', d.date, (k) => onChange({ ...d, date: k }))}
      <ChipRow>
        {(Object.keys(FOLLOW_LABEL) as (keyof typeof FOLLOW_LABEL)[]).map((t) => (
          <Chip key={t} label={FOLLOW_LABEL[t]} selected={d.type === t} onPress={() => onChange({ ...d, type: t })} />
        ))}
      </ChipRow>
    </View>
  );
}
