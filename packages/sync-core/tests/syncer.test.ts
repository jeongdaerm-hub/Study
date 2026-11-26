import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Syncer, type KeyValue } from '../src/syncer.ts';
import { diffList, initialUpload, mergeLocal, type RemoteChange, type Row } from '../src/engine.ts';

/** 실제 SQL(upsert_item, join_family …)과 같은 규칙의 가짜 Supabase */
function fakeServer() {
  const users = new Map<string, string>(); // token → userId
  const members = new Map<string, { family: string; name: string; role: string }>();
  const families = new Map<string, string>();
  const invites = new Map<string, { family: string; used: boolean }>();
  const items = new Map<string, { family_id: string; collection: string; id: string; data: unknown; deleted: boolean; rev: number; seq: number }>();
  let seq = 0;
  let n = 0;
  let offline = false;
  const fetch = async (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => {
    if (offline) throw new TypeError('Network request failed');
    const u = new URL(url);
    const body = init.body ? JSON.parse(init.body) : {};
    const uid = users.get(init.headers.Authorization.replace('Bearer ', ''));
    const ok = (j: unknown) => new Response(JSON.stringify(j), { status: 200 });
    const err = (status: number, message: string) => new Response(JSON.stringify({ message }), { status });
    const p = u.pathname;
    if (p === '/auth/v1/otp') return ok({});
    if (p === '/auth/v1/verify') {
      if (body.token !== '123456') return err(403, 'Token has expired or is invalid');
      const token = `t${++n}`;
      users.set(token, `user-${body.email}`);
      return ok({ access_token: token, refresh_token: 'r', expires_in: 3600, user: { id: `user-${body.email}`, email: body.email } });
    }
    if (!uid) return err(401, 'JWT expired');
    const me = members.get(uid);
    if (p === '/rest/v1/rpc/create_family') {
      if (me) return err(400, 'already_in_family');
      const id = `fam${++n}`;
      families.set(id, body.family_name);
      members.set(uid, { family: id, name: body.my_name, role: 'owner' });
      return ok(id);
    }
    if (p === '/rest/v1/rpc/create_invite') {
      if (!me) return err(400, 'not_in_family');
      const code = `CODE${++n}XYZ`.slice(0, 8);
      invites.set(code, { family: me.family, used: false });
      return ok(code);
    }
    if (p === '/rest/v1/rpc/join_family') {
      const inv = invites.get(String(body.invite_code).toUpperCase());
      if (!inv || inv.used) return err(400, 'invalid_invite');
      inv.used = true;
      members.set(uid, { family: inv.family, name: body.my_name, role: 'member' });
      return ok(inv.family);
    }
    if (p === '/rest/v1/rpc/upsert_item') {
      if (!me) return err(400, 'not_in_family');
      const k = `${me.family}|${body.p_collection}|${body.p_id}`;
      const cur = items.get(k);
      if (!cur) {
        if (body.p_deleted) return ok([{ status: 'ok', rev: 0, seq: 0, data: null, deleted: true }]);
        const row = { family_id: me.family, collection: body.p_collection, id: body.p_id, data: body.p_data, deleted: false, rev: 1, seq: ++seq };
        items.set(k, row);
        return ok([{ status: 'ok', ...row }]);
      }
      if (cur.rev !== body.p_base_rev) return ok([{ status: 'conflict', ...cur }]);
      Object.assign(cur, { data: body.p_data ?? cur.data, deleted: body.p_deleted, rev: cur.rev + 1, seq: ++seq });
      return ok([{ status: 'ok', ...cur }]);
    }
    if (p === '/rest/v1/families') return ok(me ? [{ id: me.family, name: families.get(me.family) }] : []);
    if (p === '/rest/v1/family_members') return ok([...members].filter(([, m]) => m.family === me?.family).map(([id, m]) => ({ user_id: id, display_name: m.name, role: m.role })));
    if (p === '/rest/v1/items') {
      const after = Number(u.searchParams.get('seq')!.replace('gt.', ''));
      return ok([...items.values()].filter((r) => me && r.family_id === me.family && r.seq > after).sort((a, b) => a.seq - b.seq));
    }
    return err(404, 'not found');
  };
  return { fetch, setOffline: (v: boolean) => (offline = v), items };
}

/** 폰 한 대: 기기 저장소 + 앱 데이터(logs, pets) + Syncer */
function phone(server: ReturnType<typeof fakeServer>, data: Record<string, Row[]>) {
  const store = new Map<string, string>();
  const kv: KeyValue = { get: async (k) => store.get(k) ?? null, set: async (k, v) => void store.set(k, v), remove: async (k) => void store.delete(k) };
  const db: Record<string, Row[]> = { pets: [], logs: [], ...data };
  const syncer = new Syncer({
    config: { url: 'https://abcdefghijklmnopqrst.supabase.co', anonKey: 'anon' },
    kv,
    namespace: 'pet',
    snapshot: () => initialUpload(db),
    applyRemote: async (changes: RemoteChange[]) => {
      for (const c of changes) {
        const list = db[c.collection] ?? [];
        const local = list.find((x) => x.id === c.id);
        db[c.collection] = c.data === null ? list.filter((x) => x.id !== c.id) : [mergeLocal(c.data, local, { photos: [] }) as Row, ...list.filter((x) => x.id !== c.id)];
      }
    },
  });
  /** 앱에서 저장하는 것처럼: 목록 교체 + 변경 기록 */
  const save = async (c: string, list: Row[]) => {
    const prev = db[c];
    db[c] = list;
    await syncer.record(diffList(c, prev, list));
  };
  return { db, syncer, save };
}

test('나와 다래가 같은 기록을 봄: 가족 만들기 → 초대 → 합치기 → 수정·삭제·충돌·오프라인', async () => {
  const server = fakeServer();
  (globalThis as { fetch: unknown }).fetch = server.fetch;

  const me = phone(server, { pets: [{ id: 'daro', name: '다로', photo: 'file:///me.jpg' }], logs: [{ id: 'l1', memo: '아침밥', photos: ['file:///a.jpg'] }] });
  const darae = phone(server, { logs: [{ id: 'l2', memo: '산책', photos: [] }] });

  // 나: 로그인 → 가족 만들기 (내 기록이 서버로)
  await me.syncer.init();
  await me.syncer.verifyCode('me@x.com', '123456');
  await assert.rejects(darae.syncer.verifyCode('d@x.com', '000000'), /인증 코드/);
  await me.syncer.createFamily('다로네', '나');
  assert.equal(me.syncer.status.pending, 0);
  assert.equal(server.items.size, 2);
  // 사진 경로는 서버로 가지 않음
  assert.equal([...server.items.values()].some((r) => JSON.stringify(r.data).includes('file://')), false);

  // 다래: 초대 코드로 참여 → 서로의 기록이 합쳐짐
  const code = await me.syncer.createInvite();
  await darae.syncer.init();
  await darae.syncer.verifyCode('d@x.com', '123456');
  await darae.syncer.joinFamily(code.toLowerCase(), '다래');
  // 이미 쓴 코드는 다른 사람이 못 씀
  const stranger = phone(server, {});
  await stranger.syncer.verifyCode('s@x.com', '123456');
  await assert.rejects(stranger.syncer.joinFamily(code, '남'), /초대 코드가 맞지 않거나/);
  await me.syncer.sync();
  const ids = (db: Record<string, Row[]>) => db.logs.map((x) => x.id).sort().join(',');
  assert.equal(ids(me.db), 'l1,l2');
  assert.equal(ids(darae.db), 'l1,l2');
  assert.equal(darae.db.pets[0].name, '다로');
  assert.deepEqual(darae.db.pets[0].photo, undefined, '내 사진 경로는 다래 폰에 없음');
  assert.deepEqual(me.db.logs.find((x) => x.id === 'l1')!.photos, ['file:///a.jpg'], '내 사진은 그대로');
  const fam = await me.syncer.refreshFamily();
  assert.deepEqual(fam?.members.map((m) => `${m.name}:${m.role}`), ['나:owner', '다래:member']);

  // 다래가 수정 → 나에게 보임 (내 사진은 유지)
  await darae.save('logs', darae.db.logs.map((x) => (x.id === 'l1' ? { ...x, memo: '아침밥 50g' } : x)));
  await darae.syncer.sync();
  await me.syncer.sync();
  assert.equal(me.db.logs.find((x) => x.id === 'l1')!.memo, '아침밥 50g');
  assert.deepEqual(me.db.logs.find((x) => x.id === 'l1')!.photos, ['file:///a.jpg']);

  // 동시에 같은 기록 수정 → 먼저 저장한 다래 값 유지, 나는 '충돌' 알림
  await darae.save('logs', darae.db.logs.map((x) => (x.id === 'l2' ? { ...x, memo: '산책 30분' } : x)));
  await me.save('logs', me.db.logs.map((x) => (x.id === 'l2' ? { ...x, memo: '산책 1시간' } : x)));
  await darae.syncer.sync();
  await me.syncer.sync();
  assert.equal(me.db.logs.find((x) => x.id === 'l2')!.memo, '산책 30분');
  assert.equal(me.syncer.status.conflicts, 1);

  // 오프라인에서 삭제 → 보낼 목록에 남음 → 연결되면 전송 → 다래 폰에서도 삭제
  server.setOffline(true);
  await me.save('logs', me.db.logs.filter((x) => x.id !== 'l1'));
  await me.syncer.sync();
  assert.match(me.syncer.status.error ?? '', /인터넷/);
  assert.equal(me.syncer.status.pending, 1);
  server.setOffline(false);
  await me.syncer.sync();
  assert.equal(me.syncer.status.pending, 0);
  assert.equal(me.syncer.status.error, null);
  await darae.syncer.sync();
  assert.equal(ids(darae.db), 'l2');

  // 앱을 다시 켜도(새 Syncer) 로그인·순번 유지, 받은 것을 또 받지 않음
  const before = JSON.stringify(darae.db);
  await darae.syncer.init();
  await darae.syncer.sync();
  assert.equal(JSON.stringify(darae.db), before);
});
