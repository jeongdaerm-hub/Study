/**
 * Cloudflare Workers 진입점
 *   wrangler secret put ANTHROPIC_API_KEY
 *   wrangler deploy
 * 요청 제한은 인스턴스 메모리 기준 → 운영 시 Cloudflare Rate Limiting 규칙을 함께 사용
 */
import { handlerFromEnv, type Env } from './config.ts';

let handler: ReturnType<typeof handlerFromEnv> | null = null;

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    handler ??= handlerFromEnv(env);
    return handler(req, req.headers.get('CF-Connecting-IP') ?? 'unknown');
  },
};
