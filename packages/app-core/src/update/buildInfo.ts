/**
 * 지금 실행 중인 앱이 어떤 빌드·업데이트인지 (테스트 확인용)
 * 테스트 앱 판별은 '설치된 앱 ID' 기준 → OTA 업데이트 내용과 무관하게 정확
 */
export const PREVIEW_SUFFIX = '.preview';

export function isPreviewAppId(applicationId: string | null | undefined): boolean {
  return !!applicationId && applicationId.endsWith(PREVIEW_SUFFIX);
}

export interface BuildInfo {
  preview: boolean;
  version: string;
  /** 'production' | 'preview' | null(개발 모드) */
  channel: string | null;
  /** 지금 실행 중인 OTA 업데이트 (앱에 들어있던 기본 번들이면 null) */
  updateId: string | null;
  updateCreatedAt: Date | null;
}

/** '1.0.0 · 업데이트 #3f2a1c (11/25 14:02)' */
export function describeBuild(b: BuildInfo): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const parts = [`v${b.version}`];
  if (b.updateId) {
    const d = b.updateCreatedAt;
    const when = d ? ` (${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())})` : '';
    parts.push(`업데이트 #${b.updateId.replace(/-/g, '').slice(0, 6)}${when}`);
  } else {
    parts.push('기본 버전');
  }
  return parts.join(' · ');
}
