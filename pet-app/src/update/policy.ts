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
