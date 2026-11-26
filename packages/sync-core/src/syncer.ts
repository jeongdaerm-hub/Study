import type { SyncConfig } from './config.ts';
import {
  fetchFamily,
  fetchItems,
  friendly,
  PAGE,
  refreshSession,
  rpc,
  sendEmailCode,
  signOut,
  SyncError,
  upsertItem,
  verifyEmailCode,
  type FamilyInfo,
  type Session,
} from './client.ts';
import { EMPTY_STATE, enqueue, keyOf, planPull, pullFrom, sanitizeState, type OutboxOp, type RemoteChange, type SyncState } from './engine.ts';

/** 앱이 주는 저장소 (AsyncStorage 등) */
export interface KeyValue {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface SyncStatus {
  configured: boolean;
  session: { email: string; userId: string } | null;
  family: FamilyInfo | null;
  syncing: boolean;
  pending: number;
  lastSyncedAt: number | null;
  error: string | null;
  /** 다른 가족이 먼저 바꿔서 그쪽 값으로 맞춘 횟수 (이번 실행) */
  conflicts: number;
}

export interface SyncerOptions {
  config: SyncConfig | null;
  kv: KeyValue;
  /** 저장 키 앞부분 (앱별) */
  namespace: string;
  /** 받은 변경을 앱에 반영 (이때는 다시 보내지 않음) */
  applyRemote: (changes: RemoteChange[]) => Promise<void>;
  /** 처음 가족에 들어갈 때 이 폰의 기록 전체 */
  snapshot: () => OutboxOp[];
  onStatus?: (s: SyncStatus) => void;
}

/**
 * 가족 공유 동기화 관리자
 *  sync() = ① 보낼 목록 전송(버전 검사) → ② 새 기록 받기
 */
export class Syncer {
  private opts: SyncerOptions;
  private state: SyncState = EMPTY_STATE;
  private session: Session | null = null;
  private running: Promise<void> | null = null;
  private again = false;
  status: SyncStatus;

  constructor(opts: SyncerOptions) {
    this.opts = opts;
    this.status = { configured: !!opts.config, session: null, family: null, syncing: false, pending: 0, lastSyncedAt: null, error: null, conflicts: 0 };
  }

  private get kState() {
    return `${this.opts.namespace}:sync-state:v1`;
  }
  private get kSession() {
    return `${this.opts.namespace}:sync-session:v1`;
  }

  private emit(patch: Partial<SyncStatus>) {
    this.status = { ...this.status, ...patch, pending: this.state.outbox.length };
    this.opts.onStatus?.(this.status);
  }

  private async saveState() {
    await this.opts.kv.set(this.kState, JSON.stringify(this.state)).catch(() => undefined);
  }

  private async saveSession() {
    if (this.session) await this.opts.kv.set(this.kSession, JSON.stringify(this.session)).catch(() => undefined);
    else await this.opts.kv.remove(this.kSession).catch(() => undefined);
  }

  /** 앱 시작 시: 저장된 로그인·동기화 상태 불러오기 */
  async init(): Promise<void> {
    try {
      this.state = sanitizeState(JSON.parse((await this.opts.kv.get(this.kState)) ?? 'null'));
      const s = JSON.parse((await this.opts.kv.get(this.kSession)) ?? 'null') as Session | null;
      if (s && typeof s.refreshToken === 'string' && typeof s.userId === 'string') this.session = s;
    } catch {
      this.state = EMPTY_STATE;
    }
    this.emit({ session: this.session ? { email: this.session.email, userId: this.session.userId } : null });
  }

  private cfg(): SyncConfig {
    if (!this.opts.config) throw new SyncError('server', '가족 공유 서버가 아직 연결되지 않았어요.');
    return this.opts.config;
  }

  /** 만료 1분 전이면 새로 고침 */
  private async token(): Promise<string> {
    if (!this.session) throw new SyncError('unauthorized', friendly('unauthorized'));
    if (Date.now() > this.session.expiresAt - 60_000) {
      try {
        this.session = await refreshSession(this.cfg(), this.session);
        await this.saveSession();
      } catch (e) {
        if (e instanceof SyncError && e.code === 'unauthorized') await this.forgetSession();
        throw e;
      }
    }
    return this.session.accessToken;
  }

  private async forgetSession() {
    this.session = null;
    await this.saveSession();
    this.emit({ session: null, family: null });
  }

  // ── 로그인 ──
  async sendCode(email: string) {
    await sendEmailCode(this.cfg(), email);
  }

  async verifyCode(email: string, code: string) {
    this.session = await verifyEmailCode(this.cfg(), email, code);
    await this.saveSession();
    this.emit({ session: { email: this.session.email, userId: this.session.userId }, error: null });
    await this.refreshFamily();
  }

  async logout() {
    if (this.session && this.opts.config) await signOut(this.opts.config, this.session);
    this.state = EMPTY_STATE;
    await this.saveState();
    await this.forgetSession();
  }

  // ── 가족 ──
  async refreshFamily(): Promise<FamilyInfo | null> {
    const family = await fetchFamily(this.cfg(), await this.token());
    if (family && this.state.familyId !== family.id) {
      // 처음 들어간 가족: 이 폰의 기록을 가족에 합치고 처음부터 받기
      this.state = { familyId: family.id, cursor: 0, revs: {}, outbox: enqueue([], this.opts.snapshot()) };
      await this.saveState();
    } else if (!family && this.state.familyId) {
      this.state = EMPTY_STATE;
      await this.saveState();
    }
    this.emit({ family });
    return family;
  }

  async createFamily(familyName: string, myName: string) {
    await rpc(this.cfg(), await this.token(), 'create_family', { family_name: familyName, my_name: myName });
    await this.refreshFamily();
    await this.sync();
  }

  async joinFamily(code: string, myName: string) {
    await rpc(this.cfg(), await this.token(), 'join_family', { invite_code: code, my_name: myName });
    await this.refreshFamily();
    await this.sync();
  }

  async createInvite(): Promise<string> {
    return rpc<string>(this.cfg(), await this.token(), 'create_invite');
  }

  /** 가족 나가기: 이 폰의 기록은 그대로 남음 (가족 기록에서만 빠짐) */
  async leaveFamily() {
    await rpc(this.cfg(), await this.token(), 'leave_family');
    this.state = EMPTY_STATE;
    await this.saveState();
    this.emit({ family: null });
  }

  // ── 동기화 ──
  /** 내 변경 기록 (AppData 저장 때마다) */
  async record(ops: OutboxOp[]) {
    if (!this.state.familyId || ops.length === 0) return;
    this.state = { ...this.state, outbox: enqueue(this.state.outbox, ops) };
    await this.saveState();
    this.emit({});
  }

  /** 동시에 여러 번 불러도 한 번씩 차례로 */
  sync(): Promise<void> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      do {
        this.again = false;
        await this.syncOnce();
      } while (this.again);
    })().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async syncOnce() {
    if (!this.opts.config || !this.session || !this.state.familyId) return;
    this.emit({ syncing: true, error: null });
    try {
      const cfg = this.cfg();
      // ① 보내기
      let conflicts = 0;
      while (this.state.outbox.length) {
        const op = this.state.outbox[0];
        const k = keyOf(op.collection, op.id);
        const r = await upsertItem(cfg, await this.token(), { ...op, baseRev: this.state.revs[k] ?? 0 });
        const revs = { ...this.state.revs };
        if (r.rev > 0) revs[k] = r.rev;
        if (r.status === 'conflict') {
          conflicts++;
          await this.opts.applyRemote([{ collection: op.collection, id: op.id, data: r.deleted ? null : (r.data ?? {}) }]);
        }
        // 보낸 그 변경만 지움 (전송 중에 같은 항목이 또 바뀌었으면 새 변경은 남겨 둠)
        this.state = { ...this.state, revs, outbox: this.state.outbox.filter((o) => o !== op) };
        await this.saveState();
        this.emit({});
      }
      // ② 받기
      for (;;) {
        const familyId = this.state.familyId;
        if (!familyId) break; // 동기화 중에 가족을 나간 경우
        const rows = await fetchItems(cfg, await this.token(), familyId, pullFrom(this.state.cursor));
        const { changes, state } = planPull(this.state, rows);
        if (changes.length) await this.opts.applyRemote(changes);
        const advanced = state.cursor > this.state.cursor;
        this.state = state;
        await this.saveState();
        if (rows.length < PAGE || !advanced) break;
      }
      this.emit({ syncing: false, lastSyncedAt: Date.now(), conflicts: this.status.conflicts + conflicts });
    } catch (e) {
      const err = e instanceof SyncError ? e : new SyncError('server', friendly('server'));
      if (err.code === 'not_in_family') {
        this.state = EMPTY_STATE;
        await this.saveState();
        this.emit({ family: null });
      }
      this.emit({ syncing: false, error: err.message });
    }
  }
}
