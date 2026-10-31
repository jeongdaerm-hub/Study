import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import * as Updates from 'expo-updates';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import {
  decideStoreUpdate,
  isValidManifest,
  type StoreUpdateLevel,
  type VersionManifest,
} from './policy.ts';

/**
 * 인앱 업데이트 2-트랙 구조
 *  1) OTA(JS 번들) 업데이트 : expo-updates → 스토어 심사 없이 앱 안에서 즉시 다운로드 + 재시작
 *  2) 스토어(네이티브) 업데이트 : version.json 비교 → optional(버튼) / force(차단 모달)
 */
export type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';

export interface AppUpdateState {
  status: UpdateStatus;
  /** OTA 업데이트 존재 여부 */
  otaAvailable: boolean;
  /** 스토어 업데이트 단계 */
  storeLevel: StoreUpdateLevel;
  manifest: VersionManifest | null;
  currentVersion: string;
  error: string | null;
}

const MANIFEST_URL: string =
  (Constants.expoConfig?.extra as { versionManifestUrl?: string } | undefined)?.versionManifestUrl ?? '';

const RECHECK_INTERVAL_MS = 30 * 60 * 1000; // 포그라운드 복귀 시 최소 재확인 간격

export function useAppUpdate() {
  const currentVersion = Application.nativeApplicationVersion ?? '0.0.0';
  const [state, setState] = useState<AppUpdateState>({
    status: 'idle',
    otaAvailable: false,
    storeLevel: 'none',
    manifest: null,
    currentVersion,
    error: null,
  });
  const lastCheck = useRef(0);

  const check = useCallback(async () => {
    lastCheck.current = Date.now();
    setState((s) => ({ ...s, status: 'checking', error: null }));
    try {
      const [manifest, ota] = await Promise.all([fetchManifest(), checkOta()]);
      const storeLevel = manifest ? decideStoreUpdate(currentVersion, manifest) : 'none';
      setState((s) => ({
        ...s,
        manifest,
        storeLevel,
        otaAvailable: ota,
        status: ota || storeLevel !== 'none' ? 'available' : 'idle',
      }));
    } catch (e) {
      setState((s) => ({ ...s, status: 'error', error: toMessage(e) }));
    }
  }, [currentVersion]);

  /** 업데이트 버튼 클릭 시 동작 */
  const applyUpdate = useCallback(async () => {
    // 네이티브 변경이 필요한 버전이면 스토어로 이동 (OTA보다 우선)
    if (state.storeLevel !== 'none' && state.manifest) {
      const url = Platform.OS === 'ios' ? state.manifest.storeUrl.ios : state.manifest.storeUrl.android;
      if (url) await Linking.openURL(url);
      return;
    }
    if (!state.otaAvailable) return;
    try {
      setState((s) => ({ ...s, status: 'downloading' }));
      const result = await Updates.fetchUpdateAsync();
      if (result.isNew) {
        setState((s) => ({ ...s, status: 'ready' }));
        await Updates.reloadAsync(); // 새 번들로 앱 재시작
      } else {
        setState((s) => ({ ...s, status: 'idle', otaAvailable: false }));
      }
    } catch (e) {
      setState((s) => ({ ...s, status: 'error', error: toMessage(e) }));
    }
  }, [state.storeLevel, state.manifest, state.otaAvailable]);

  // 앱 시작 시 + 백그라운드→포그라운드 복귀 시 자동 확인
  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && Date.now() - lastCheck.current > RECHECK_INTERVAL_MS) check();
    });
    return () => sub.remove();
  }, [check]);

  return { ...state, check, applyUpdate };
}

async function fetchManifest(): Promise<VersionManifest | null> {
  if (!MANIFEST_URL) return null;
  try {
    const res = await fetch(MANIFEST_URL, { headers: { 'Cache-Control': 'no-cache' } });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    return isValidManifest(data) ? data : null;
  } catch {
    return null; // 버전 서버 장애가 앱 사용을 막지 않도록 fail-open
  }
}

async function checkOta(): Promise<boolean> {
  if (__DEV__ || !Updates.isEnabled) return false; // 개발 모드/Expo Go 에서는 OTA 비활성
  try {
    const r = await Updates.checkForUpdateAsync();
    return r.isAvailable;
  } catch {
    return false;
  }
}

function toMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
