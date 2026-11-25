import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { buildChannel } from '../update/channelSwitch.ts';
import {
  EMPTY_LOCK,
  isLocked,
  isValidHash,
  lockMessage,
  recordAttempt,
  sanitizeLock,
  verifyAdminCode,
  type LockState,
} from './adminCode.ts';

/**
 * 관리자(나) 모드
 *  - open : 테스트 앱 → 나만 설치한 앱이라 항상 열림
 *  - code : 실제 앱 → 관리자 코드를 맞혀야 열림 (해시는 빌드 때 주입)
 *  - off  : 관리자 코드가 설정되지 않은 빌드 → 관리자 기능 없음
 */
export type AdminMode = 'open' | 'code' | 'off';
const KEY = 'daro:admin';

const HASH = (Constants.expoConfig?.extra as { adminCodeHash?: string } | undefined)?.adminCodeHash;

export function adminMode(): AdminMode {
  if (buildChannel() === 'preview') return 'open';
  return isValidHash(HASH) ? 'code' : 'off';
}

interface Saved extends LockState {
  /** 어떤 코드로 열었는지 (코드를 바꾸면 다시 잠김) */
  unlockedFor: string | null;
}

async function load(): Promise<Saved> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const o = raw ? JSON.parse(raw) : null;
    return { ...sanitizeLock(o), unlockedFor: typeof o?.unlockedFor === 'string' ? o.unlockedFor : null };
  } catch {
    return { ...EMPTY_LOCK, unlockedFor: null };
  }
}

async function save(v: Saved) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    // 저장 실패 시 이번 실행 동안만 유지
  }
}

const fingerprint = () => (HASH ? HASH.slice(0, 16) : null);

export function useAdmin() {
  const mode = adminMode();
  const [saved, setSaved] = useState<Saved>({ ...EMPTY_LOCK, unlockedFor: null });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    load().then((v) => {
      setSaved(v);
      setReady(true);
    });
  }, []);

  const unlocked = mode === 'open' || (mode === 'code' && saved.unlockedFor !== null && saved.unlockedFor === fingerprint());

  const unlock = useCallback(
    async (code: string): Promise<{ ok: boolean; message: string }> => {
      if (mode !== 'code' || !HASH) return { ok: false, message: '이 앱에는 관리자 기능이 설정되어 있지 않아요.' };
      const now = Date.now();
      const cur = await load();
      if (isLocked(cur, now)) return { ok: false, message: lockMessage(cur, now) };
      const ok = verifyAdminCode(code, HASH);
      const next: Saved = { ...recordAttempt(cur, ok, now), unlockedFor: ok ? fingerprint() : null };
      await save(next);
      setSaved(next);
      if (ok) return { ok: true, message: '관리자 모드가 켜졌어요.' };
      return { ok: false, message: isLocked(next, now) ? lockMessage(next, now) : '코드가 맞지 않아요.' };
    },
    [mode],
  );

  const lock = useCallback(async () => {
    const next: Saved = { ...EMPTY_LOCK, unlockedFor: null };
    await save(next);
    setSaved(next);
  }, []);

  return { mode, ready, unlocked, unlock, lock };
}
