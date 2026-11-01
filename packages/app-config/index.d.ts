export type DaroFeature = 'notifications' | 'photos' | 'camera';

export interface DaroAppOptions {
  /** 홈 화면 앱 이름 */
  name: string;
  /** 영문 소문자 식별자 (manifests/<slug>.json 과 일치) */
  slug: string;
  /** 스토어 버전 (네이티브 변경 시 올림) */
  version: string;
  /** com.daro.pet 형식 */
  bundleId: string;
  brandColor?: string;
  /** `eas init` 으로 발급된 프로젝트 ID */
  easProjectId?: string;
  features?: DaroFeature[];
  permissionText?: { photos?: string; camera?: string };
  manifestBaseUrl?: string;
  /** 앱 전용 API 서버 주소 (https). API 키는 넣지 말 것 */
  apiUrl?: string;
  versionManifestUrl?: string;
  plugins?: unknown[];
  extra?: Record<string, unknown>;
}

export type ExpoConfig = Record<string, any>;

export function createAppConfig(o: DaroAppOptions): ExpoConfig;
export function createMetroConfig(projectRoot: string): any;
export const DEFAULT_MANIFEST_BASE_URL: string;
