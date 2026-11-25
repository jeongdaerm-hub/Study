import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanText, isDateKey, isLog, isPet, isSchedule, isWeight, parseNumber, validateAmount, validateRequired, validateWeight,
} from '../src/logic/validate.ts';

test('parseNumber: 안전한 숫자만', () => {
  assert.equal(parseNumber('5.25'), 5.25);
  assert.equal(parseNumber('1,200'), 1200);
  assert.equal(parseNumber(' 3 '), 3);
  for (const bad of ['', '-1', 'abc', '1e9', 'Infinity', 'NaN', '1.2.3', '0x10', '9999999999']) {
    assert.equal(parseNumber(bad), null, bad);
  }
});

test('validateWeight / validateAmount / validateRequired', () => {
  assert.equal(validateWeight(5.2), null);
  assert.ok(validateWeight(null));
  assert.ok(validateWeight(0));
  assert.ok(validateWeight(500));
  assert.equal(validateAmount('water', null), null);
  assert.ok(validateAmount('water', 20000));
  assert.ok(validateRequired('이름', '   ', 20));
  assert.ok(validateRequired('이름', 'a'.repeat(21), 20));
  assert.equal(validateRequired('이름', '다로', 20), null);
});

test('cleanText: 제어문자 제거 + 길이 제한', () => {
  assert.equal(cleanText('  안녕\u0000\u0007하세요  '), '안녕하세요');
  assert.equal(cleanText('줄\n바꿈'), '줄\n바꿈');
  assert.equal(cleanText('a'.repeat(2000)).length, 1000);
});

test('isDateKey', () => {
  assert.equal(isDateKey('2026-11-01'), true);
  assert.equal(isDateKey('2026-02-30'), false);
  assert.equal(isDateKey('2026-1-1'), false);
  assert.equal(isDateKey(20261101), false);
});

test('저장 데이터 형식 검사: 깨진 데이터 거부', () => {
  assert.equal(isPet({ id: 'a', name: '다로', species: 'dog', sex: 'M', neutered: true, birthDate: '', createdAt: 1 }), true);
  assert.equal(isPet({ id: 'a', name: '다로', species: 'dragon', sex: 'M', neutered: true, birthDate: '', createdAt: 1 }), false);
  assert.equal(isPet(null), false);
  assert.equal(isPet([]), false);
  assert.equal(isWeight({ id: 'w', petId: 'p', date: '2026-11-01', kg: -3 }), false);
  assert.equal(isWeight({ id: 'w', petId: 'p', date: '2026-11-01', kg: 5 }), true);
  assert.equal(isLog({ id: 'l', petId: 'p', date: '2026-11-01', time: '9:00', kind: 'meal', memo: '', photos: [] }), false);
  assert.equal(isLog({ id: 'l', petId: 'p', date: '2026-11-01', time: '09:00', kind: 'meal', memo: '', photos: [] }), true);
  assert.equal(isSchedule({ id: 's', petId: 'p', title: 't', type: 'medicine', dateTime: 'nope', repeat: 'none', remindBefore: 0, done: false }), false);
});
