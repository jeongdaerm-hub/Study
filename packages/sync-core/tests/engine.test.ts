import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffList, enqueue, EMPTY_STATE, initialUpload, mergeLocal, planPull, pullFrom, sanitizeState, stripLocal } from '../src/engine.ts';

test('기기 전용 값(사진 경로·알림 번호)은 보내지 않음', () => {
  assert.deepEqual(stripLocal({ id: 'a', name: '다로', photo: 'file:///x.jpg', photos: ['file:///y'], notificationId: 'n1' }), { id: 'a', name: '다로' });
});

test('받을 때 내 기기의 사진·알림은 유지, 없으면 기본값', () => {
  assert.deepEqual(mergeLocal({ id: 'l', memo: '새 메모', photos: ['남의 경로'] }, { id: 'l', memo: '옛 메모', photos: ['내 사진'] }, { photos: [] }), {
    id: 'l',
    memo: '새 메모',
    photos: ['내 사진'],
  });
  assert.deepEqual(mergeLocal({ id: 'l', memo: 'm' }, undefined, { photos: [] }), { id: 'l', memo: 'm', photos: [] });
});

test('목록 비교: 추가·수정·삭제만, 사진만 바뀐 건 무시', () => {
  const prev = [{ id: 'a', v: 1, photos: [] }, { id: 'b', v: 1 }, { id: 'c', v: 1 }];
  const next = [{ id: 'a', v: 1, photos: ['p'] }, { id: 'b', v: 2 }, { id: 'd', v: 1 }];
  assert.deepEqual(diffList('logs', prev, next), [
    { collection: 'logs', id: 'b', data: { id: 'b', v: 2 } },
    { collection: 'logs', id: 'd', data: { id: 'd', v: 1 } },
    { collection: 'logs', id: 'c', data: null },
  ]);
  // 키 순서만 다른 것은 같은 값
  assert.deepEqual(diffList('logs', [{ id: 'a', x: 1, y: { p: 1, q: 2 } }], [{ y: { q: 2, p: 1 }, x: 1, id: 'a' }]), []);
});

test('보낼 목록: 같은 항목은 마지막 변경만', () => {
  const q = enqueue([{ collection: 'pets', id: 'a', data: { n: 1 } }, { collection: 'logs', id: 'x', data: {} }], [{ collection: 'pets', id: 'a', data: null }]);
  assert.deepEqual(q, [
    { collection: 'logs', id: 'x', data: {} },
    { collection: 'pets', id: 'a', data: null },
  ]);
  assert.equal(enqueue([], Array.from({ length: 10 }, (_, i) => ({ collection: 'logs', id: String(i), data: {} })), 3).length, 3);
});

test('처음 가족 참여: 내 기록 전체를 보낼 목록으로', () => {
  const ops = initialUpload({ pets: [{ id: 'p', name: '다로', photo: 'f' }], logs: [{ id: 'l', photos: [] }] });
  assert.deepEqual(ops, [
    { collection: 'pets', id: 'p', data: { id: 'p', name: '다로' } },
    { collection: 'logs', id: 'l', data: { id: 'l' } },
  ]);
});

test('받기: 아는 버전·보내기 전 항목은 건너뛰고, 순번 전진', () => {
  const state = { ...EMPTY_STATE, familyId: 'f', cursor: 10, revs: { 'pets:a': 2 }, outbox: [{ collection: 'logs', id: 'mine', data: {} }] };
  const { changes, state: next } = planPull(state, [
    { collection: 'pets', id: 'a', data: { n: 'old' }, deleted: false, rev: 2, seq: 11 },
    { collection: 'pets', id: 'a', data: { n: 'new' }, deleted: false, rev: 3, seq: 12 },
    { collection: 'logs', id: 'mine', data: { n: 'server' }, deleted: false, rev: 5, seq: 13 },
    { collection: 'logs', id: 'gone', data: null, deleted: true, rev: 2, seq: 14 },
  ]);
  assert.deepEqual(changes, [
    { collection: 'pets', id: 'a', data: { n: 'new' } },
    { collection: 'logs', id: 'gone', data: null },
  ]);
  assert.equal(next.cursor, 14);
  assert.equal(next.revs['pets:a'], 3);
  assert.equal(next.revs['logs:mine'], undefined);
  assert.equal(pullFrom(14), 0);
  assert.equal(pullFrom(500), 450);
});

test('저장된 상태 복원: 깨진 값은 버림', () => {
  assert.deepEqual(sanitizeState(null), EMPTY_STATE);
  const s = sanitizeState({ familyId: 'f', cursor: -1, revs: { a: 2, b: 'x', c: 0 }, outbox: [{ collection: 'pets', id: 'a', data: null }, { bad: true }] });
  assert.deepEqual(s, { familyId: 'f', cursor: 0, revs: { a: 2 }, outbox: [{ collection: 'pets', id: 'a', data: null }] });
});
