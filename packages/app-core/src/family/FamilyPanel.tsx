import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { isEmail } from '@daro/sync-core';
import { useTheme } from '../ui/theme.tsx';
import { useDialog } from '../ui/Dialog.tsx';
import { useFamily } from './FamilySync.tsx';

/**
 * 설정 화면의 '가족 공유' 영역
 *  ① 로그인(이메일로 받은 코드) → ② 가족 만들기 / 초대 코드로 참여 → ③ 함께 보기
 */
export function FamilyPanel({ examplePet = '다로' }: { examplePet?: string }) {
  const t = useTheme();
  const f = useFamily();
  const st = f.status;

  return (
    <View>
      <Text style={[s.section, { color: t.text }]}>가족 공유</Text>
      <View style={s.card}>
        {!st.configured ? (
          <Text style={[s.hint, { color: t.sub }]}>가족 공유 서버가 아직 연결되지 않았어요. 준비되면 여기서 가족과 기록을 함께 볼 수 있어요.</Text>
        ) : !st.session ? (
          <Login />
        ) : !st.family ? (
          <NoFamily examplePet={examplePet} />
        ) : (
          <InFamily />
        )}
      </View>
    </View>
  );
}

function useRun() {
  const dialog = useDialog();
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      await dialog.notify('확인해 주세요', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return { busy, run, dialog };
}

function Login() {
  const t = useTheme();
  const f = useFamily();
  const { busy, run } = useRun();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  return (
    <View style={{ gap: 10 }}>
      <Text style={[s.hint, { color: t.sub }]}>로그인하면 가족과 같은 기록을 함께 보고 함께 적을 수 있어요. 비밀번호 없이 이메일로 받은 코드로 로그인해요.</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="이메일"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!sent}
        style={[s.input, { borderColor: t.line, color: t.text }]}
        accessibilityLabel="이메일"
      />
      {sent && (
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="메일로 받은 인증 코드"
          keyboardType="number-pad"
          maxLength={10}
          style={[s.input, { borderColor: t.line, color: t.text }]}
          accessibilityLabel="인증 코드"
        />
      )}
      {busy ? (
        <ActivityIndicator color={t.primary} />
      ) : !sent ? (
        <Btn label="인증 코드 받기" disabled={!isEmail(email)} onPress={() => run(async () => { await f.sendCode(email); setSent(true); })} />
      ) : (
        <>
          <Btn label="로그인" disabled={code.trim().length < 6} onPress={() => run(() => f.verifyCode(email, code))} />
          <Pressable onPress={() => { setSent(false); setCode(''); }} style={s.link} accessibilityRole="button">
            <Text style={{ color: t.sub }}>이메일 다시 입력</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

function NoFamily({ examplePet }: { examplePet: string }) {
  const t = useTheme();
  const f = useFamily();
  const { busy, run, dialog } = useRun();
  const [mode, setMode] = useState<'create' | 'join' | null>(null);
  const [name, setName] = useState('');
  const [myName, setMyName] = useState('');
  const [code, setCode] = useState('');

  const confirmMerge = () =>
    dialog.confirm({
      title: '이 폰의 기록을 가족과 합칠까요?',
      message: '이 폰에 있는 반려동물과 기록이 가족 기록에 더해져요. 사진은 각자 폰에만 남아요.',
      confirmText: '합치기',
    });

  return (
    <View style={{ gap: 10 }}>
      <Text style={[s.hint, { color: t.sub }]}>{f.status.session?.email} 로 로그인했어요. 가족을 만들거나, 받은 초대 코드로 들어가세요.</Text>
      {mode === null && (
        <>
          <Btn label="👨‍👩‍👧 새 가족 만들기" onPress={() => setMode('create')} />
          <Btn label="🔑 초대 코드로 참여하기" outline onPress={() => setMode('join')} />
        </>
      )}
      {mode === 'create' && (
        <>
          <TextInput value={name} onChangeText={setName} maxLength={40} placeholder={`가족 이름 (예: ${examplePet}네)`} style={[s.input, { borderColor: t.line, color: t.text }]} accessibilityLabel="가족 이름" />
          <TextInput value={myName} onChangeText={setMyName} maxLength={20} placeholder="가족에게 보일 내 이름" style={[s.input, { borderColor: t.line, color: t.text }]} accessibilityLabel="내 이름" />
          {busy ? <ActivityIndicator color={t.primary} /> : (
            <Btn label="가족 만들기" disabled={!name.trim() || !myName.trim()} onPress={() => run(async () => { if (await confirmMerge()) await f.createFamily(name, myName); })} />
          )}
        </>
      )}
      {mode === 'join' && (
        <>
          <TextInput value={code} onChangeText={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" maxLength={8} placeholder="초대 코드 8자리" style={[s.input, { borderColor: t.line, color: t.text, letterSpacing: 2 }]} accessibilityLabel="초대 코드" />
          <TextInput value={myName} onChangeText={setMyName} maxLength={20} placeholder="가족에게 보일 내 이름" style={[s.input, { borderColor: t.line, color: t.text }]} accessibilityLabel="내 이름" />
          {busy ? <ActivityIndicator color={t.primary} /> : (
            <Btn label="참여하기" disabled={code.trim().length !== 8 || !myName.trim()} onPress={() => run(async () => { if (await confirmMerge()) await f.joinFamily(code, myName); })} />
          )}
        </>
      )}
      {mode !== null && !busy && (
        <Pressable onPress={() => setMode(null)} style={s.link} accessibilityRole="button">
          <Text style={{ color: t.sub }}>뒤로</Text>
        </Pressable>
      )}
      {mode === null && <Logout />}
    </View>
  );
}

function when(ms: number | null) {
  if (!ms) return '아직 안 함';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function InFamily() {
  const t = useTheme();
  const f = useFamily();
  const { busy, run, dialog } = useRun();
  const [invite, setInvite] = useState<string | null>(null);
  const st = f.status;
  const fam = st.family!;
  const meId = st.session?.userId;
  return (
    <View style={{ gap: 8 }}>
      <Text style={[s.title, { color: t.text }]}>🏠 {fam.name}</Text>
      {fam.members.map((m) => (
        <Text key={m.userId} style={{ color: t.text }}>
          {m.role === 'owner' ? '👑' : '🙂'} {m.name}
          {m.userId === meId ? ' (나)' : ''}
        </Text>
      ))}
      <View style={[s.row, { marginTop: 6 }]}>
        <Text style={{ color: t.sub }}>동기화</Text>
        <Text style={{ color: st.error ? t.danger : t.text, flexShrink: 1, textAlign: 'right' }}>
          {st.syncing ? '주고받는 중…' : st.error ? st.error : `마지막 ${when(st.lastSyncedAt)}${st.pending ? ` · 보낼 기록 ${st.pending}건` : ''}`}
        </Text>
      </View>
      {st.conflicts > 0 && (
        <Text style={[s.hint, { color: t.warn }]}>같은 기록을 가족이 먼저 고쳐서, 가족이 저장한 내용으로 맞췄어요 ({st.conflicts}건).</Text>
      )}
      {invite && (
        <View style={[s.invite, { borderColor: t.primary }]}>
          <Text style={{ color: t.sub, fontSize: 13 }}>초대 코드 (24시간 · 한 번만 사용)</Text>
          <Text selectable style={[s.code, { color: t.text }]}>{invite}</Text>
          <Text style={{ color: t.sub, fontSize: 12 }}>가족의 폰: 설정 → 가족 공유 → 로그인 → 초대 코드로 참여하기</Text>
        </View>
      )}
      {busy ? (
        <ActivityIndicator color={t.primary} />
      ) : (
        <View style={{ gap: 8, marginTop: 6 }}>
          <Btn label="✉️ 가족 초대 코드 만들기" onPress={() => run(async () => setInvite(await f.createInvite()))} />
          <Btn label="🔄 지금 동기화" outline onPress={() => run(f.syncNow)} />
          <Pressable
            style={s.link}
            accessibilityRole="button"
            onPress={() =>
              run(async () => {
                const ok = await dialog.confirm({
                  title: '가족에서 나갈까요?',
                  message: '이 폰의 기록은 그대로 남지만, 앞으로 가족과 주고받지 않아요. 마지막 한 사람이 나가면 서버의 가족 기록은 지워져요.',
                  confirmText: '나가기',
                  destructive: true,
                });
                if (ok) await f.leaveFamily();
              })
            }
          >
            <Text style={{ color: t.danger }}>가족 나가기</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function Logout() {
  const t = useTheme();
  const f = useFamily();
  return (
    <Pressable onPress={() => void f.logout()} style={s.link} accessibilityRole="button">
      <Text style={{ color: t.sub }}>로그아웃</Text>
    </Pressable>
  );
}

function Btn({ label, onPress, disabled, outline }: { label: string; onPress: () => void; disabled?: boolean; outline?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={[s.btn, outline ? { backgroundColor: '#fff', borderWidth: 1, borderColor: t.line } : { backgroundColor: t.primary }, disabled && { opacity: 0.45 }]}
    >
      <Text style={[s.btnText, outline && { color: t.text }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  section: { fontSize: 17, fontWeight: '800', marginTop: 8, marginBottom: 8 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '800' },
  hint: { fontSize: 13, lineHeight: 19 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, backgroundColor: '#fff' },
  btn: { borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  link: { padding: 10, alignItems: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  invite: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, padding: 12, alignItems: 'center', gap: 4 },
  code: { fontSize: 28, fontWeight: '800', letterSpacing: 4, fontVariant: ['tabular-nums'] },
});
