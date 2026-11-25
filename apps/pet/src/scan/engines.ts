/**
 * 사진 인식 엔진 선택
 *  1) api     : 앱 → 우리 스캔 서버(services/scan-api) → Claude   (실제 앱)
 *  2) preview : claude.ai 웹 미리보기 안에서 보는 사람의 Claude 로 판독
 *  3) demo    : 둘 다 없으면 예시 결과로 흐름만 체험
 * 어떤 엔진이든 결과는 sanitizeScan 으로 다시 검증 (AI 출력은 믿지 않음)
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getInstallId, postJson, type PickedImage } from '@daro/app-core';
import { demoScanResult, SCAN_JSON_SHAPE, scanInstructions } from '@daro/health-scan';

export type EngineKind = 'api' | 'preview' | 'demo';

export interface ScanEngine {
  kind: EngineKind;
  /** 화면 표시용 */
  label: string;
  /** 사진이 어디로 가는지 (개인정보 안내) */
  privacy: string;
  maxImages: number;
  run: (images: PickedImage[], todayKey: string, signal: AbortSignal) => Promise<unknown>;
}

/** 사용자에게 보여줄 오류 */
export class ScanFailure extends Error {}

const API_URL = ((Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ?? '').replace(/\/$/, '');

const API_ERRORS: Record<string, string> = {
  rate_limited: '잠시 후 다시 시도해 주세요. (요청이 많아요)',
  too_large: '사진 용량이 너무 커요. 장수를 줄여 주세요.',
  unsupported_image: '지원하지 않는 사진 형식이에요.',
  refused: '이 사진은 분석할 수 없어요. 다른 사진으로 시도해 주세요.',
  unreadable: '글자를 읽지 못했어요. 밝은 곳에서 문서가 꽉 차게 다시 찍어 주세요.',
  too_long: '내용이 너무 많아요. 한 페이지씩 나눠서 찍어 주세요.',
  upstream_busy: 'AI 서버가 혼잡해요. 잠시 후 다시 시도해 주세요.',
  upstream_error: 'AI 서버에 문제가 있어요. 잠시 후 다시 시도해 주세요.',
  timeout: '응답이 너무 오래 걸려요. 사진 장수를 줄여 다시 시도해 주세요.',
  network: '인터넷 연결을 확인해 주세요.',
};

function apiEngine(): ScanEngine {
  return {
    kind: 'api',
    label: 'AI 분석',
    privacy: '사진은 분석에만 쓰이고 서버에 저장되지 않아요.',
    maxImages: 3,
    run: async (images, todayKey, signal) => {
      const res = await postJson<{ ok: boolean; result?: unknown; error?: string }>(
        `${API_URL}/v1/scan`,
        {
          installId: await getInstallId(),
          todayKey,
          images: images.map((i) => ({ mediaType: i.mediaType, data: i.base64 })),
        },
        { signal, timeoutMs: 150_000, allowLocalhost: __DEV__ },
      );
      if (res.failure === 'cancelled') throw new ScanFailure('cancelled');
      if (!res.ok || !res.data?.ok) {
        const code = res.data?.error ?? res.failure ?? 'upstream_error';
        throw new ScanFailure(API_ERRORS[code] ?? API_ERRORS.upstream_error);
      }
      return res.data.result;
    },
  };
}

/* ── claude.ai 미리보기 런타임 (window.claude.use('sample')) ── */
interface SampleFn {
  json: (input: string, opts: { images: Blob[]; signal: AbortSignal; cache: false; modelTier: 'default' }) => Promise<unknown>;
  limits: () => Promise<{ images?: { maxCount: number } }>;
}
const PREVIEW_ERRORS: Record<string, string> = {
  not_granted: 'Claude 사용을 허용해야 분석할 수 있어요.',
  rate_limited: '잠시 후 다시 시도해 주세요.',
  image_rejected: '이 사진은 사용할 수 없어요. 다른 사진을 골라 주세요.',
  refused: '이 사진은 분석할 수 없어요.',
  invalid_json: '결과를 읽지 못했어요. 다시 시도해 주세요.',
};

function base64ToBlob(b64: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: 'image/jpeg' });
}

async function previewEngine(): Promise<ScanEngine | null> {
  const c = (globalThis as { claude?: { use?: (n: string) => Promise<unknown> } }).claude;
  if (Platform.OS !== 'web' || typeof c?.use !== 'function') return null;
  try {
    const sample = (await c.use('sample')) as SampleFn | null;
    if (!sample) return null;
    const limits = await sample.limits().catch(() => null);
    if (!limits?.images) return null;
    return {
      kind: 'preview',
      label: 'AI 분석 (미리보기)',
      privacy: '미리보기에서는 내 Claude 계정으로 분석돼요. 처음 한 번 허용을 물어봐요.',
      maxImages: Math.min(3, limits.images.maxCount),
      run: async (images, todayKey, signal) => {
        try {
          return await sample.json(`${scanInstructions(todayKey)}\n\n${SCAN_JSON_SHAPE}`, {
            images: images.map((i) => base64ToBlob(i.base64)),
            signal,
            cache: false,
            modelTier: 'default',
          });
        } catch (e) {
          const code = (e as { code?: string })?.code ?? '';
          if (code === 'cancelled') throw new ScanFailure('cancelled');
          throw new ScanFailure(PREVIEW_ERRORS[code] ?? '분석 중 문제가 생겼어요. 다시 시도해 주세요.');
        }
      },
    };
  } catch {
    return null;
  }
}

function demoEngine(): ScanEngine {
  return {
    kind: 'demo',
    label: '예시 모드',
    privacy: '스캔 서버가 아직 연결되지 않아 사진을 분석하지 않고 예시 결과를 보여줘요.',
    maxImages: 3,
    run: (_images, todayKey, signal) =>
      new Promise((resolve, reject) => {
        const t = setTimeout(() => resolve(demoScanResult(todayKey)), 1200);
        signal.addEventListener('abort', () => {
          clearTimeout(t);
          reject(new ScanFailure('cancelled'));
        });
      }),
  };
}

export async function detectEngine(): Promise<ScanEngine> {
  if (API_URL) return apiEngine();
  return (await previewEngine()) ?? demoEngine();
}
