import Anthropic from '@anthropic-ai/sdk';
import { claudeExtractor, DEFAULT_MODEL } from './extract.ts';
import { createHandler } from './handler.ts';

export interface Env {
  ANTHROPIC_API_KEY?: string;
  ALLOWED_ORIGINS?: string;
  RATE_PER_MINUTE?: string;
  RATE_PER_DAY?: string;
  SCAN_MODEL?: string;
}

const int = (v: string | undefined, d: number) => (v && /^\d+$/.test(v) ? Number(v) : d);

/** 환경변수 → 핸들러 (API 키가 없으면 시작하지 않음) */
export function handlerFromEnv(env: Env) {
  if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY 환경변수가 필요합니다 (서버에만 설정).');
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return createHandler({
    extractor: claudeExtractor(client, env.SCAN_MODEL || DEFAULT_MODEL),
    allowedOrigins: (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    perMinute: int(env.RATE_PER_MINUTE, 5),
    perDay: int(env.RATE_PER_DAY, 50),
    log: (e) => console.info(JSON.stringify(e)),
  });
}
