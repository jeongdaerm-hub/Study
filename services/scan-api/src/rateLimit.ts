/**
 * 단순 고정창 요청 제한 (인스턴스 메모리 기준)
 * 여러 서버로 확장하면 Cloudflare Rate Limiting / Redis 등 공용 저장소로 교체
 */
export class RateLimiter {
  private hits = new Map<string, { windowStart: number; count: number }>();
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly now: () => number;
  constructor(limit: number, windowMs: number, now: () => number = Date.now) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
  }

  /** 허용되면 0, 막히면 다시 시도 가능한 초 */
  take(key: string): number {
    const t = this.now();
    const cur = this.hits.get(key);
    if (!cur || t - cur.windowStart >= this.windowMs) {
      this.hits.set(key, { windowStart: t, count: 1 });
      this.prune(t);
      return 0;
    }
    if (cur.count >= this.limit) return Math.ceil((cur.windowStart + this.windowMs - t) / 1000);
    cur.count++;
    return 0;
  }

  private prune(t: number) {
    if (this.hits.size < 10_000) return;
    for (const [k, v] of this.hits) if (t - v.windowStart >= this.windowMs) this.hits.delete(k);
  }
}
