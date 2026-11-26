import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { readSyncConfig, Syncer, type KeyValue, type OutboxOp, type RemoteChange, type SyncStatus } from '@daro/sync-core';

/**
 * 가족 공유: 같은 가족끼리 기록을 함께 봄 (모든 다로 앱 공용)
 *  - 앱 데이터는 지금처럼 폰에 저장 (인터넷이 없어도 기록 가능)
 *  - 가족에 들어가 있으면 바뀐 기록을 서버(Supabase)와 주고받음
 *  - 언제: 앱을 켤 때, 앞으로 돌아올 때, 기록을 저장한 직후, 켜져 있는 동안 1분마다
 */
export interface FamilySource {
  snapshot: () => OutboxOp[];
  applyRemote: (changes: RemoteChange[]) => Promise<void>;
  subscribe: (listener: (ops: OutboxOp[]) => void) => () => void;
}

interface FamilyApi {
  status: SyncStatus;
  sendCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
  createFamily: (familyName: string, myName: string) => Promise<void>;
  joinFamily: (code: string, myName: string) => Promise<void>;
  createInvite: () => Promise<string>;
  leaveFamily: () => Promise<void>;
  logout: () => Promise<void>;
  syncNow: () => Promise<void>;
}

const Ctx = createContext<FamilyApi | null>(null);

const kv: KeyValue = {
  get: (k) => AsyncStorage.getItem(k),
  set: (k, v) => AsyncStorage.setItem(k, v),
  remove: (k) => AsyncStorage.removeItem(k),
};

const AUTO_SYNC_MS = 60_000;
const AFTER_CHANGE_MS = 1500;

export function FamilySyncProvider({ appSlug, source, children }: { appSlug: string; source: FamilySource; children: React.ReactNode }) {
  const config = useMemo(() => readSyncConfig(Constants.expoConfig?.extra), []);
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const [status, setStatus] = useState<SyncStatus | null>(null);

  const syncer = useMemo(
    () =>
      new Syncer({
        config,
        kv,
        namespace: appSlug,
        snapshot: () => sourceRef.current.snapshot(),
        applyRemote: (ch) => sourceRef.current.applyRemote(ch),
        onStatus: setStatus,
      }),
    [appSlug, config],
  );

  // 시작: 저장된 로그인 불러오기 → 가족 확인 → 동기화
  useEffect(() => {
    let alive = true;
    (async () => {
      await syncer.init();
      if (!alive || !syncer.status.session || !config) return;
      await syncer.refreshFamily().catch(() => undefined);
      await syncer.sync();
    })();
    return () => {
      alive = false;
    };
  }, [syncer, config]);

  // 이 폰에서 기록이 바뀌면 보낼 목록에 넣고 잠시 뒤 동기화
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = source.subscribe((ops) => {
      void syncer.record(ops).then(() => {
        clearTimeout(timer);
        timer = setTimeout(() => void syncer.sync(), AFTER_CHANGE_MS);
      });
    });
    return () => {
      off();
      clearTimeout(timer);
    };
  }, [source, syncer]);

  // 앞으로 돌아올 때 + 켜져 있는 동안 1분마다
  useEffect(() => {
    const tick = setInterval(() => {
      if (AppState.currentState === 'active') void syncer.sync();
    }, AUTO_SYNC_MS);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void syncer.sync();
    });
    return () => {
      clearInterval(tick);
      sub.remove();
    };
  }, [syncer]);

  const syncNow = useCallback(async () => {
    await syncer.refreshFamily().catch(() => undefined);
    await syncer.sync();
  }, [syncer]);

  const api = useMemo<FamilyApi>(
    () => ({
      status: status ?? syncer.status,
      sendCode: (e) => syncer.sendCode(e),
      verifyCode: (e, c) => syncer.verifyCode(e, c),
      createFamily: (f, m) => syncer.createFamily(f, m),
      joinFamily: (c, m) => syncer.joinFamily(c, m),
      createInvite: () => syncer.createInvite(),
      leaveFamily: () => syncer.leaveFamily(),
      logout: () => syncer.logout(),
      syncNow,
    }),
    [status, syncer, syncNow],
  );
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useFamily(): FamilyApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('FamilySyncProvider 가 필요해요');
  return v;
}

/** 가족 공유 Provider 가 없어도 안전하게 (없으면 null) */
export function useFamilyOptional(): FamilyApi | null {
  return useContext(Ctx);
}
