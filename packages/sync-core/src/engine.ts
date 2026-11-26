/**
 * 동기화 핵심 규칙 (순수 함수 — 단위 테스트 대상)
 *
 *  - 기기에만 있는 값(사진 파일 경로, 알림 번호)은 서버로 보내지 않고, 받을 때도 내 기기 값을 유지
 *  - 내 변경은 outbox(보낼 목록)에 쌓았다가 순서대로 전송 (인터넷이 끊겨도 잃지 않음)
 *  - 서버 버전(rev)이 내가 알던 것과 다르면 '충돌' → 서버(먼저 저장한 사람) 값을 따르고 알려줌
 *    (마지막 저장이 말없이 덮어쓰지 않음)
 */
export type Row = Record<string, unknown> & { id: string };

/** 기기마다 다른 값: 공유하지 않음 */
export const LOCAL_ONLY_KEYS = ['photo', 'photos', 'notificationId'] as const;

export interface OutboxOp {
  collection: string;
  id: string;
  /** null = 삭제 */
  data: Record<string, unknown> | null;
}

export interface SyncState {
  familyId: string | null;
  /** 마지막으로 받은 서버 순번 */
  cursor: number;
  /** 'collection:id' → 내가 아는 서버 버전 */
  revs: Record<string, number>;
  outbox: OutboxOp[];
}

export const EMPTY_STATE: SyncState = { familyId: null, cursor: 0, revs: {}, outbox: [] };

export const keyOf = (collection: string, id: string) => `${collection}:${id}`;

export function stripLocal(item: Row): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(item)) if (!(LOCAL_ONLY_KEYS as readonly string[]).includes(k)) out[k] = v;
  return out;
}

/** 받은 값 + 내 기기 전용 값 (없으면 기본값) */
export function mergeLocal(remote: Record<string, unknown>, local: Row | undefined, defaults: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...defaults, ...stripLocal(remote as Row) };
  if (local) for (const k of LOCAL_ONLY_KEYS) if (k in local) merged[k] = local[k];
  return merged;
}

const stable = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));

/** 저장 전후 목록 비교 → 보낼 변경 (공유 값이 바뀐 것만) */
export function diffList(collection: string, prev: readonly Row[], next: readonly Row[]): OutboxOp[] {
  const before = new Map(prev.map((x) => [x.id, x]));
  const ops: OutboxOp[] = [];
  const seen = new Set<string>();
  for (const item of next) {
    seen.add(item.id);
    const old = before.get(item.id);
    const shared = stripLocal(item);
    if (!old || stable(stripLocal(old)) !== stable(shared)) ops.push({ collection, id: item.id, data: shared });
  }
  for (const old of prev) if (!seen.has(old.id)) ops.push({ collection, id: old.id, data: null });
  return ops;
}

/** 같은 항목의 변경은 마지막 것만 남김 (순서는 처음 등장 순서 유지) */
export function enqueue(outbox: readonly OutboxOp[], ops: readonly OutboxOp[], limit = 5000): OutboxOp[] {
  const latest = new Map<string, OutboxOp>();
  for (const op of [...outbox, ...ops]) {
    const k = keyOf(op.collection, op.id);
    latest.delete(k);
    latest.set(k, op);
  }
  const list = [...latest.values()];
  return list.length > limit ? list.slice(list.length - limit) : list;
}

/** 처음 가족에 들어갈 때: 이 폰의 기록 전체를 보낼 목록으로 */
export function initialUpload(collections: Record<string, readonly Row[]>): OutboxOp[] {
  return Object.entries(collections).flatMap(([c, list]) => list.map((x) => ({ collection: c, id: x.id, data: stripLocal(x) })));
}

export interface ServerRow {
  collection: string;
  id: string;
  data: Record<string, unknown> | null;
  deleted: boolean;
  rev: number;
  seq: number;
}

export interface RemoteChange {
  collection: string;
  id: string;
  /** null = 삭제 */
  data: Record<string, unknown> | null;
}

/**
 * 받은 행 정리: 아직 보내지 않은 내 변경이 있는 항목은 건너뜀(보낼 때 버전 검사로 판단),
 * 이미 아는 버전 이하도 건너뜀
 */
export function planPull(state: SyncState, rows: readonly ServerRow[]): { changes: RemoteChange[]; state: SyncState } {
  const pending = new Set(state.outbox.map((o) => keyOf(o.collection, o.id)));
  const revs = { ...state.revs };
  let cursor = state.cursor;
  const changes: RemoteChange[] = [];
  for (const r of rows) {
    cursor = Math.max(cursor, r.seq);
    const k = keyOf(r.collection, r.id);
    if (pending.has(k)) continue;
    if ((revs[k] ?? 0) >= r.rev) continue;
    revs[k] = r.rev;
    changes.push({ collection: r.collection, id: r.id, data: r.deleted ? null : (r.data ?? {}) });
  }
  return { changes, state: { ...state, revs, cursor } };
}

/** 다시 받을 때 시작 순번: 동시에 저장된 행을 놓치지 않도록 조금 겹쳐서 */
export const PULL_OVERLAP = 50;
export const pullFrom = (cursor: number) => Math.max(0, cursor - PULL_OVERLAP);

export function sanitizeState(x: unknown): SyncState {
  const o = x as Partial<SyncState> | null;
  if (!o || typeof o !== 'object') return EMPTY_STATE;
  const revs: Record<string, number> = {};
  if (o.revs && typeof o.revs === 'object') for (const [k, v] of Object.entries(o.revs)) if (Number.isInteger(v) && (v as number) > 0) revs[k] = v as number;
  const outbox = Array.isArray(o.outbox)
    ? o.outbox.filter((op): op is OutboxOp => !!op && typeof op.collection === 'string' && typeof op.id === 'string' && (op.data === null || typeof op.data === 'object'))
    : [];
  return {
    familyId: typeof o.familyId === 'string' ? o.familyId : null,
    cursor: Number.isInteger(o.cursor) && (o.cursor as number) >= 0 ? (o.cursor as number) : 0,
    revs,
    outbox,
  };
}
