/**
 * @daro/sync-core — 가족 공유 동기화 (모든 다로 앱 공용)
 *  config  서버 주소·공개 키 검사 (관리자 키 거부)
 *  client  Supabase REST: 이메일 코드 로그인, 가족 RPC, 기록 읽기/쓰기
 *  engine  변경 비교·보낼 목록·충돌 규칙 (순수 함수)
 *  syncer  보내기 → 받기 순서로 동기화하는 관리자
 */
export * from './config.ts';
export * from './client.ts';
export * from './engine.ts';
export * from './syncer.ts';
