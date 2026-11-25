import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { scanInstructions } from '@daro/health-scan';
import { ScanSchema } from './schema.ts';

export type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp';
export interface ImageInput {
  mediaType: ImageMediaType;
  /** base64 (data: 접두사 없음) */
  data: string;
}

/** 서버 밖으로 알릴 오류 코드 (내부 메시지는 노출하지 않음) */
export type ScanErrorCode = 'refused' | 'unreadable' | 'too_long' | 'upstream_busy' | 'upstream_error';
export class ScanError extends Error {
  readonly code: ScanErrorCode;
  constructor(code: ScanErrorCode) {
    super(code);
    this.code = code;
  }
}

export type Extractor = (images: ImageInput[], ctx: { todayKey: string; signal?: AbortSignal }) => Promise<unknown>;

export const DEFAULT_MODEL = 'claude-opus-5-5';

/**
 * Claude 로 사진 판독
 * - 구조화 출력(JSON 스키마)으로 형식 강제
 * - fallbacks: 'default' → 안전 분류기가 거절하면 서버가 대체 모델로 자동 재시도
 */
export function claudeExtractor(client: Anthropic, model = DEFAULT_MODEL): Extractor {
  return async (images, { todayKey, signal }) => {
    let msg;
    try {
      msg = await client.beta.messages.parse(
        {
          model,
          max_tokens: 16000,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          output_config: { effort: 'medium', format: betaZodOutputFormat(ScanSchema) },
          system: scanInstructions(todayKey),
          messages: [
            {
              role: 'user',
              content: [
                ...images.map((img) => ({
                  type: 'image' as const,
                  source: { type: 'base64' as const, media_type: img.mediaType, data: img.data },
                })),
                { type: 'text' as const, text: '첨부한 반려동물 건강 서류 사진을 규칙에 따라 기록으로 변환해 주세요.' },
              ],
            },
          ],
        },
        { signal, timeout: 120_000 },
      );
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) throw new ScanError('upstream_busy');
      if (e instanceof Anthropic.APIError) throw new ScanError('upstream_error');
      throw e;
    }
    if (msg.stop_reason === 'refusal') throw new ScanError('refused');
    if (msg.stop_reason === 'max_tokens') throw new ScanError('too_long');
    if (!msg.parsed_output) throw new ScanError('unreadable');
    return msg.parsed_output;
  };
}
