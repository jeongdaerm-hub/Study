import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../ui/theme.tsx';
import { useDialog } from '../ui/Dialog.tsx';
import { getBuildInfo } from '../update/TestBuildRibbon.tsx';
import { describeBuild } from '../update/buildInfo.ts';
import { canSwitchChannel, channelName, currentChannel, switchChannel, type Channel } from '../update/channelSwitch.ts';
import { getInstallId } from '../storage/installId.ts';
import { MIN_CODE_LENGTH } from './adminCode.ts';
import { useAdmin } from './useAdmin.ts';

const TAPS_TO_UNLOCK = 7;

/**
 * 설정 화면의 '앱 정보' + '나(관리자)' 영역 — 모든 다로 앱 공통
 *  - 일반 사용자: 앱 버전만 보임
 *  - 관리자: 버전을 7번 누르고 코드 입력 → 맨 아래 '나(관리자)' 영역이 나타남
 *    → [배포 전 버전 확인하기] 로 앱 재설치 없이 테스트 버전을 받아 바로 확인
 */
export function AppInfoAndAdmin() {
  const t = useTheme();
  const dialog = useDialog();
  const admin = useAdmin();
  const info = getBuildInfo();
  const [taps, setTaps] = useState(0);
  const [askCode, setAskCode] = useState(false);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [busy, setBusy] = useState(false);
  const [installId, setInstallId] = useState('');

  useEffect(() => {
    currentChannel().then(setChannel);
    getInstallId().then(setInstallId);
  }, []);

  const onVersionTap = () => {
    if (admin.unlocked) return;
    const n = taps + 1;
    setTaps(n);
    if (n < TAPS_TO_UNLOCK) return;
    setTaps(0);
    if (admin.mode === 'code') setAskCode(true);
    else dialog.notify('관리자 기능 없음', '이 빌드에는 관리자 코드가 설정되어 있지 않아요.');
  };

  const run = async (target: Channel) => {
    const go = await dialog.confirm({
      title: target === 'preview' ? '배포 전 버전으로 바꿀까요?' : '공식 버전으로 돌아갈까요?',
      message:
        target === 'preview'
          ? '아직 사용자에게 배포하지 않은 최신 버전을 받아서 앱을 다시 시작해요. 기록한 데이터는 그대로예요.'
          : '모든 사용자가 쓰는 공식 버전으로 돌아가요. 기록한 데이터는 그대로예요.',
      confirmText: '바꾸기',
    });
    if (!go) return;
    setBusy(true);
    const r = await switchChannel(target);
    setBusy(false);
    setChannel(await currentChannel());
    if (!r.ok || !r.reloading) await dialog.notify(r.ok ? '완료' : '확인해 주세요', r.message);
  };

  const onTest = channel === 'preview';

  return (
    <View>
      <Text style={[s.section, { color: t.text }]}>앱 정보</Text>
      <View style={s.card}>
        <Pressable onPress={onVersionTap} style={s.row} accessibilityRole="text" accessibilityLabel={`앱 버전 ${info.version}`}>
          <Text style={[s.key, { color: t.sub }]}>버전</Text>
          <Text style={[s.val, { color: t.text }]}>{info.version}</Text>
        </Pressable>
        <View style={s.row}>
          <Text style={[s.key, { color: t.sub }]}>지금 실행 중</Text>
          <Text style={[s.val, { color: t.text }]} numberOfLines={1}>
            {onTest ? '🧪 배포 전 버전' : '공식 버전'}
          </Text>
        </View>
      </View>

      {admin.unlocked && (
        <>
          <Text style={[s.section, { color: t.text }]}>나(관리자)</Text>
          <View style={[s.card, { borderWidth: 1, borderColor: '#5B3CC4' }]}>
            <Text style={[s.hint, { color: t.sub }]}>나에게만 보이는 영역이에요. 사용자에게 배포하기 전에 새 버전을 이 폰에서 먼저 확인해요.</Text>
            <View style={s.row}>
              <Text style={[s.key, { color: t.sub }]}>받는 채널</Text>
              <Text style={[s.val, { color: t.text }]}>{channel ? channelName(channel) : '…'}</Text>
            </View>
            <View style={s.row}>
              <Text style={[s.key, { color: t.sub }]}>실행 중인 업데이트</Text>
              <Text style={[s.val, { color: t.text }]} numberOfLines={1}>
                {describeBuild(info)}
              </Text>
            </View>
            <View style={s.row}>
              <Text style={[s.key, { color: t.sub }]}>설치 ID</Text>
              <Text style={[s.val, { color: t.sub, fontSize: 12 }]} numberOfLines={1} selectable>
                {installId}
              </Text>
            </View>

            {!canSwitchChannel() && (
              <Text style={[s.hint, { color: t.warn }]}>웹 미리보기·개발 모드에서는 버전 전환이 안 돼요. 폰에 설치한 앱에서 눌러 주세요.</Text>
            )}
            {busy ? (
              <View style={s.busy}>
                <ActivityIndicator color="#5B3CC4" />
                <Text style={{ color: t.sub }}>새 버전을 받는 중…</Text>
              </View>
            ) : (
              <View style={{ gap: 8, marginTop: 12 }}>
                <Pressable style={[s.btn, { backgroundColor: '#5B3CC4' }]} onPress={() => run('preview')} accessibilityRole="button">
                  <Text style={s.btnText}>{onTest ? '🔄 최신 배포 전 버전 다시 받기' : '🧪 배포 전 버전 확인하기'}</Text>
                </Pressable>
                {onTest && (
                  <Pressable style={[s.btn, { backgroundColor: '#fff', borderWidth: 1, borderColor: t.line }]} onPress={() => run('production')} accessibilityRole="button">
                    <Text style={[s.btnText, { color: t.text }]}>✅ 공식 버전으로 돌아가기</Text>
                  </Pressable>
                )}
              </View>
            )}
            {admin.mode === 'code' && (
              <Pressable onPress={admin.lock} style={{ padding: 12, alignItems: 'center' }} accessibilityRole="button">
                <Text style={{ color: t.sub }}>관리자 모드 끄기</Text>
              </Pressable>
            )}
          </View>
        </>
      )}

      <CodeModal visible={askCode} onClose={() => setAskCode(false)} onSubmit={admin.unlock} />
    </View>
  );
}

function CodeModal({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (code: string) => Promise<{ ok: boolean; message: string }>;
}) {
  const t = useTheme();
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const close = () => {
    setCode('');
    setMsg('');
    onClose();
  };
  const submit = async () => {
    setBusy(true);
    const r = await onSubmit(code);
    setBusy(false);
    setCode('');
    if (r.ok) close();
    else setMsg(r.message);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={s.backdrop}>
        <View style={s.dialog}>
          <Text style={[s.dialogTitle, { color: t.text }]}>관리자 코드</Text>
          <TextInput
            autoFocus
            value={code}
            onChangeText={setCode}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={`${MIN_CODE_LENGTH}자 이상`}
            style={[s.input, { borderColor: t.line, color: t.text }]}
            onSubmitEditing={submit}
            accessibilityLabel="관리자 코드"
          />
          {!!msg && <Text style={{ color: t.danger, marginTop: 8 }}>{msg}</Text>}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            <Pressable style={[s.btn, { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: t.line }]} onPress={close}>
              <Text style={[s.btnText, { color: t.text }]}>취소</Text>
            </Pressable>
            <Pressable style={[s.btn, { flex: 1, backgroundColor: t.primary }, busy && { opacity: 0.5 }]} onPress={submit} disabled={busy}>
              <Text style={s.btnText}>확인</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  section: { fontSize: 17, fontWeight: '800', marginTop: 8, marginBottom: 8 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, gap: 12 },
  key: { fontSize: 14 },
  val: { fontSize: 14, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  hint: { fontSize: 13, lineHeight: 19, marginBottom: 4 },
  busy: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 16, justifyContent: 'center' },
  btn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  dialogTitle: { fontSize: 17, fontWeight: '800', marginBottom: 12 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
});
