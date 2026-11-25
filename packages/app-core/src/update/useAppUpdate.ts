import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import * as Updates from 'expo-updates';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import {
  decideStoreUpdate,
  isSafeStoreUrl,
  isSecureManifestUrl,
  sanitizeManifest,
  type StoreUpdateLevel,
  type VersionManifest,
} from './policy.ts';

/**
 * 인앱 업데이트 2-트랙 구조 — 사용 중 끊김 없이
 *  1) OTA(JS 번들) 업데이트
 *     - 앱을 켤 때 있으면: '업데이트 중 N%' 화면 → 받으면 바로 새 버전으로 시작 (느린 망이면 45초 뒤 기존 버전으로 계속)
 *     - 사용 중에 생기면: 조용히 받아 두고 다음 실행 때 적용 (원하면 [지금 적용]. 사용 중 강제 재시작 없음)
 *  2) 스토어(네이티브) 업데이트 : version.json 비교 → optional(버튼) / force(차단 모달)
 */
export type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';

export interface UseAppUpdateOptions {
  /**
   * 앱을 켰을 때 새 업데이트가 있으면 '업데이트 중 N%' 화면을 보여주고
   * 받은 뒤 바로 새 버전으로 다시 시작 (기본 true)
   * 사용 중에 돌아온 경우(백그라운드 → 앞으로)는 화면을 막지 않고 조용히 받아 둠
   */
  installOnLaunch?: boolean;
}

export interface AppUpdateState {
  status: UpdateStatus;
  /** 새 OTA 업데이트를 내려받아 둠 → 다음 실행 때 자동 적용 */
  otaReady: boolean;
  /** 앱을 켤 때 업데이트를 받는 중 ('업데이트 중 N%' 화면) */
  installing: boolean;
  /** 스토어 업데이트 단계 */
  storeLevel: StoreUpdateLevel;
  manifest: VersionManifest | null;
  currentVersion: string;
  error: string | null;
}

const MANIFEST_URL: string =
  (Constants.expoConfig?.extra as { versionManifestUrl?: string } | undefined)?.versionManifestUrl ?? '';

const RECHECK_INTERVAL_MS = 30 * 60 * 1000; // 포그라운드 복귀 시 최소 재확인 간격
const FETCH_TIMEOUT_MS = 5000; // 버전 서버가 느려도 앱이 멈추지 않도록
// 앱을 켤 때 업데이트 화면을 최대 이만큼만 보여줌 → 느린 망이면 기존 버전으로 계속 사용하고 다음 실행 때 적용
const LAUNCH_INSTALL_TIMEOUT_MS = 45 * 1000;

export function useAppUpdate({ installOnLaunch = true }: UseAppUpdateOptions = {}) {
  // 웹 미리보기에는 네이티브 버전이 없음 → app.config 의 version 사용
  const currentVersion = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '0.0.0';
  const [state, setState] = useState<AppUpdateState>({
    status: 'idle',
    otaReady: false,
    installing: false,
    storeLevel: 'none',
    manifest: null,
    currentVersion,
    error: null,
  });
  const lastCheck = useRef(0);
  const otaReadyRef = useRef(false);
  const launched = useRef(false);

  const check = useCallback(async () => {
    lastCheck.current = Date.now();
    const atLaunch = !launched.current;
    launched.current = true;
    setState((s) => ({ ...s, status: 'checking', error: null }));
    try {
      // 웹은 스토어/OTA 개념이 없으므로 확인 생략
      const [manifest, ota] = Platform.OS === 'web' ? [null, false] : await Promise.all([fetchManifest(), checkOta()]);
      const storeLevel = manifest ? decideStoreUpdate(currentVersion, manifest) : 'none';
      setState((s) => ({ ...s, manifest, storeLevel, status: storeLevel !== 'none' ? 'available' : 'idle' }));
      if (ota && !otaReadyRef.current) {
        const markReady = (ready: boolean) => {
          if (!ready) return;
          otaReadyRef.current = true;
          setState((s) => ({ ...s, otaReady: true, status: s.storeLevel !== 'none' ? s.status : 'ready' }));
        };
        const download = downloadOta();
        if (atLaunch && installOnLaunch && storeLevel !== 'force') {
          // 앱을 막 켰을 때: '업데이트 중 N%' → 받으면 바로 새 버전으로 다시 시작
          setState((s) => ({ ...s, installing: true, status: 'downloading' }));
          const ready = await Promise.race([download, delay(LAUNCH_INSTALL_TIMEOUT_MS).then(() => 'timeout' as const)]);
          if (ready === true) {
            try {
              await Updates.reloadAsync();
              return;
            } catch {
              // 다시 시작 실패 → 다음 실행 때 자동 적용
            }
          }
          setState((s) => ({ ...s, installing: false }));
          if (ready === 'timeout') download.then(markReady); // 느린 망: 계속 받아 두고 배너로 안내
          else markReady(ready === true);
        } else {
          // 사용 중: 화면을 막지 않고 조용히 받아 둠 → 다음 실행 때 적용 (원하면 [지금 적용])
          markReady(await download);
        }
      }
    } catch (e) {
      setState((s) => ({ ...s, status: 'error', error: toMessage(e) }));
    }
  }, [currentVersion, installOnLaunch]);

  /** 업데이트 버튼 클릭 시 동작 */
  const applyUpdate = useCallback(async () => {
    // 네이티브 변경이 필요한 버전이면 스토어로 이동 (OTA보다 우선)
    if (state.storeLevel !== 'none' && state.manifest) {
      const url = Platform.OS === 'ios' ? state.manifest.storeUrl.ios : state.manifest.storeUrl.android;
      // 허용된 스토어 주소만 열기 (변조된 매니페스트 방어)
      if (isSafeStoreUrl(url)) await Linking.openURL(url);
      return;
    }
    // 이미 내려받은 업데이트를 지금 적용 (사용자가 직접 누른 경우에만)
    if (!state.otaReady) return;
    try {
      await Updates.reloadAsync();
    } catch (e) {
      setState((s) => ({ ...s, status: 'error', error: toMessage(e) }));
    }
  }, [state.storeLevel, state.manifest, state.otaReady]);

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
  if (!MANIFEST_URL || !isSecureManifestUrl(MANIFEST_URL)) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(MANIFEST_URL, { headers: { 'Cache-Control': 'no-cache' }, signal: ctrl.signal });
    if (!res.ok) return null;
    const text = await res.text();
    if (text.length > 10_000) return null; // 비정상적으로 큰 응답 거부
    return sanitizeManifest(JSON.parse(text));
  } catch {
    return null; // 버전 서버 장애가 앱 사용을 막지 않도록 fail-open
  } finally {
    clearTimeout(timer);
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

/** 백그라운드 다운로드. 적용은 다음 실행 때 expo-updates 가 자동으로 함 */
async function downloadOta(): Promise<boolean> {
  try {
    const r = await Updates.fetchUpdateAsync();
    return r.isNew;
  } catch {
    return false;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function toMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
