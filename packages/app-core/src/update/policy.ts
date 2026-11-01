import { compareVersions } from './version.ts';

/** 서버(server/version.json)에서 내려주는 버전 정보 */
export interface VersionManifest {
  latestVersion: string;
  minSupportedVersion: string;
  releaseNotes?: string[];
  storeUrl: { android?: string; ios?: string };
}

/**
 * none     : 최신 상태
 * optional : 새 버전 있음 → 업데이트 버튼(배너) 노출, 나중에 가능
 * force    : 지원 종료 버전 → 업데이트 전까지 앱 사용 차단
 */
export type StoreUpdateLevel = 'none' | 'optional' | 'force';

export function decideStoreUpdate(currentVersion: string, manifest: VersionManifest): StoreUpdateLevel {
  if (compareVersions(currentVersion, manifest.minSupportedVersion) < 0) return 'force';
  if (compareVersions(currentVersion, manifest.latestVersion) < 0) return 'optional';
  return 'none';
}

export function isValidManifest(data: unknown): data is VersionManifest {
  if (!data || typeof data !== 'object') return false;
  const m = data as Record<string, unknown>;
  return (
    typeof m.latestVersion === 'string' &&
    typeof m.minSupportedVersion === 'string' &&
    !!m.storeUrl &&
    typeof m.storeUrl === 'object'
  );
}

/** 사용자가 '나중에'를 누른 버전은 다시 배너를 띄우지 않음 (force는 예외) */
export function shouldShowBanner(
  level: StoreUpdateLevel,
  latestVersion: string,
  dismissedVersion: string | null,
): boolean {
  if (level === 'force') return true;
  if (level === 'none') return false;
  return dismissedVersion !== latestVersion;
}

/* ─────────────── 보안: 매니페스트는 외부 입력 → 신뢰하지 않음 ─────────────── */

/**
 * 스토어 이동 URL 허용 목록
 * 매니페스트가 변조돼도 피싱 사이트로 보내지 못하도록 스토어 주소만 허용
 */
const STORE_URL_PATTERNS: RegExp[] = [
  /^market:\/\/details\?id=[A-Za-z0-9._]+$/,
  /^https:\/\/play\.google\.com\/store\/apps\/details\?id=[A-Za-z0-9._]+$/,
  /^itms-apps:\/\/apps\.apple\.com\/[a-z/]*app\/(?:[\w-]+\/)?id\d+$/,
  /^https:\/\/apps\.apple\.com\/[a-z/]*app\/(?:[\w-]+\/)?id\d+$/,
];

export function isSafeStoreUrl(url: unknown): url is string {
  return typeof url === 'string' && url.length < 300 && STORE_URL_PATTERNS.some((p) => p.test(url));
}

const SEMVER = /^v?\d{1,4}(\.\d{1,4}){0,2}$/;
const MAX_NOTES = 5;
const MAX_NOTE_LEN = 120;

/**
 * 매니페스트 정제: 형식 검증 + 버전 형식 강제 + 문구 길이 제한 + 위험 URL 제거
 * 통과 못 하면 null → 업데이트 안내 안 함 (fail-open)
 */
export function sanitizeManifest(data: unknown): VersionManifest | null {
  if (!isValidManifest(data)) return null;
  if (!SEMVER.test(data.latestVersion) || !SEMVER.test(data.minSupportedVersion)) return null;
  const notes = Array.isArray(data.releaseNotes)
    ? data.releaseNotes
        .filter((n): n is string => typeof n === 'string')
        .slice(0, MAX_NOTES)
        .map((n) => n.slice(0, MAX_NOTE_LEN))
    : [];
  return {
    latestVersion: data.latestVersion,
    minSupportedVersion: data.minSupportedVersion,
    releaseNotes: notes,
    storeUrl: {
      android: isSafeStoreUrl(data.storeUrl.android) ? data.storeUrl.android : undefined,
      ios: isSafeStoreUrl(data.storeUrl.ios) ? data.storeUrl.ios : undefined,
    },
  };
}

/** 매니페스트 주소는 HTTPS 만 허용 (중간자 변조 방지) */
export function isSecureManifestUrl(url: string): boolean {
  return /^https:\/\/[^\s/]+\/\S+$/.test(url);
}
