import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from './theme.tsx';

/**
 * 앱 안에서 그리는 확인/알림 창 (iOS·안드로이드·웹 동일 동작)
 *  - RN Alert 는 웹에서 동작하지 않음
 *  - 모달 위에 또 모달을 띄우면 iOS 에서 표시 실패 → 별도 모달 대신
 *    '가장 위에 열린 화면' 안에 오버레이로 그림 (DialogHost)
 */
interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string | null;
  destructive?: boolean;
}

interface DialogApi {
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  notify: (title: string, message?: string) => Promise<void>;
}

interface Internal {
  opts: ConfirmOptions | null;
  close: (v: boolean) => void;
  topHost: number | null;
  register: (id: number) => () => void;
}

const ApiCtx = createContext<DialogApi | null>(null);
const InternalCtx = createContext<Internal | null>(null);
let hostSeq = 0;

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [hosts, setHosts] = useState<number[]>([]);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback(
    (o: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolver.current?.(false); // 이전 창이 열려 있으면 취소 처리
        resolver.current = resolve;
        setOpts(o);
      }),
    [],
  );
  const notify = useCallback(
    async (title: string, message?: string) => {
      await confirm({ title, message, confirmText: '확인', cancelText: null });
    },
    [confirm],
  );
  const close = useCallback((v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setOpts(null);
  }, []);
  const register = useCallback((id: number) => {
    setHosts((h) => [...h, id]);
    return () => setHosts((h) => h.filter((x) => x !== id));
  }, []);

  const api = useMemo(() => ({ confirm, notify }), [confirm, notify]);
  const internal = useMemo(
    () => ({ opts, close, topHost: hosts.length ? hosts[hosts.length - 1] : null, register }),
    [opts, close, hosts, register],
  );

  return (
    <ApiCtx.Provider value={api}>
      <InternalCtx.Provider value={internal}>
        <View style={{ flex: 1 }}>
          {children}
          <DialogHost />
        </View>
      </InternalCtx.Provider>
    </ApiCtx.Provider>
  );
}

/**
 * 확인 창을 그릴 자리. 앱 루트에 하나 있고,
 * 모달 화면(입력 폼 등) 안에도 하나 두면 그 화면이 열려 있는 동안 그 안에 그려짐
 */
export function DialogHost() {
  const ctx = useContext(InternalCtx);
  const t = useTheme();
  const id = useRef(++hostSeq).current;
  const register = ctx?.register;
  useEffect(() => register?.(id), [register, id]);
  if (!ctx || !ctx.opts || ctx.topHost !== id) return null;
  const { opts, close } = ctx;
  return (
    <View style={s.dim}>
      <View style={s.card} accessibilityRole="alert" aria-modal>
        <Text style={[s.title, { color: t.text }]}>{opts.title}</Text>
        {!!opts.message && <Text style={[s.msg, { color: t.sub }]}>{opts.message}</Text>}
        <View style={s.row}>
          {opts.cancelText !== null && (
            <Pressable style={s.btn} onPress={() => close(false)} accessibilityRole="button">
              <Text style={{ color: t.sub, fontWeight: '600' }}>{opts.cancelText ?? '취소'}</Text>
            </Pressable>
          )}
          <Pressable
            style={[s.btn, { backgroundColor: opts.destructive ? t.danger : t.primary }]}
            onPress={() => close(true)}
            accessibilityRole="button"
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>{opts.confirmText ?? '확인'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function useDialog(): DialogApi {
  const v = useContext(ApiCtx);
  if (!v) throw new Error('DialogProvider 가 필요해요');
  return v;
}

const s = StyleSheet.create({
  dim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 1000, elevation: 1000, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, maxWidth: 420, width: '100%', alignSelf: 'center' },
  title: { fontSize: 17, fontWeight: '700' },
  msg: { fontSize: 14, marginTop: 8, lineHeight: 20 },
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 20 },
  btn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10 },
});
