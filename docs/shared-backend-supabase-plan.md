# 공통 백엔드 설계 초안 — Supabase Free / PostgreSQL

상태: **설계만 진행**. 실제 Supabase 프로젝트 생성, 계정 연동, 기존 데이터 이전 및 앱 배포는 아직 하지 않았다.

## 목표와 원칙
- Study 모노레포의 `packages/app-core`를 재사용하고, DaroCare의 안정화된 앱을 기존 데이터 손실 없이 단계적으로 통합한다.
- 비용은 **월 0원 무료 한도**를 목표로 한다. 무료 정책·용량·휴면 중지 여부는 구축 시점에 공식 요금표로 재확인한다.
- 모바일 앱은 오프라인에서도 작성 가능해야 하며, 서버 장애 시 기록을 지우지 않는다.
- Supabase PostgreSQL은 앱에서 직접 DB 관리자 계정으로 연결하지 않는다. 공개 가능한 anon/publishable 키 + 인증 + Row Level Security(RLS)를 사용한다. `service_role` 키는 앱에 포함하지 않는다.
- 기존 DaroCare JSON v1/v2 파일은 이전 성공 확인 및 별도 백업 검증 전 삭제하지 않는다.
- Study 다로펫의 기존 `@daro/app-core` 저장소 API를 보존하며 서버 동기화 계층은 별도 모듈로 추가한다.

## 논리 구조

```text
DaroCare / Study pet / 향후 신규 앱
   ├─ 로컬 저장소 (기존 데이터 유지)
   ├─ @daro/app-core (UI, 날짜/시간, 알림, 저장, OTA)
   └─ @daro/sync-core (향후 신설: outbox, 충돌 해결, API)
          ↓ HTTPS + Supabase Auth JWT
     Supabase API + RLS
          ↓
     PostgreSQL (사용자별 pets, records, schedules)
     Storage (선택: 사진; private bucket + 정책)
```

## 1차 데이터 모델 (제안)
- `profiles(id uuid PK references auth.users, created_at)`
- `pets(id uuid PK, owner_id uuid references auth.users, name text, species text, created_at, updated_at, deleted_at)`
- `care_records(id uuid PK, owner_id uuid references auth.users, pet_id uuid references pets, kind text, occurred_at timestamptz, amount numeric nullable, note text nullable, payload jsonb, updated_at, deleted_at)`
- `schedules(id uuid PK, owner_id uuid, pet_id uuid, kind text, due_at timestamptz, payload jsonb, updated_at, deleted_at)`
- 각 테이블에 `owner_id` 인덱스, `updated_at` 기반 증분 동기화 인덱스 및 RLS 정책을 설계한다.
- 기록 `pet_id`와 `owner_id`가 서로 다른 사용자를 가리키는 경우를 DB 제약/트리거 또는 안전한 API로 방지한다.
- 사진은 DB에 base64로 넣지 않고 비공개 객체 저장소에 파일로 보관한다.

## 인증·권한
1. 이메일 OTP/매직 링크 등 무료 범위에서 지원되는 로그인 방식을 선택한다.
2. RLS: `auth.uid() = owner_id`를 기본으로 적용하고, 펫 참조 관계도 검증한다.
3. 가족 공유는 1차 범위에서 제외한다. 도입 시 `pet_memberships` 테이블과 권한 모델을 별도로 설계한다.
4. 삭제는 동기화용 tombstone(`deleted_at`)을 우선 검토한다.

## 안전한 데이터 이전
1. 기존 DaroCare v1/v2 전체 백업 파일을 생성하고 복원 검증한다.
2. `petId`/기록 ID에 대해 안정적인 UUID 매핑을 만든다.
3. 기존 데이터는 로컬에 그대로 둔 채 서버로 **추가 업로드**한다.
4. 건수·해시·시간대·사진 참조를 비교하여 정합성을 확인한다.
5. 네트워크 실패 시 outbox 재시도; 중복 업로드는 동일 UUID upsert로 멱등 처리한다.
6. 두 기기에서 같은 기록을 수정하는 경우를 위한 충돌 정책을 먼저 정한다. 무조건 마지막 수정 덮어쓰기는 금지한다.
7. 사용자 승인과 검증 없이 로컬 기록을 삭제하지 않는다.

## 순서 / 완료 조건
- [x] DaroCare UI 개선 PR #6 코드 검증·APK 빌드·main 병합
- [ ] OTA 배포 성공 및 사용자의 실제 기기 확인
- [ ] Study/DaroCare 데이터 모델 차이 및 공통 모듈 인터페이스 상세 비교
- [ ] Supabase 무료 프로젝트 생성 (사용자 계정 연결 필요)
- [ ] SQL 마이그레이션 + RLS 정책 + 접근권한 자동 테스트
- [ ] 앱별 로컬 저장/서버 동기화 어댑터 구현
- [ ] 오프라인·중복·충돌·서버 장애·복원 테스트
- [ ] 기존 데이터 보존 확인 후 단계적 출시

## 운영비·제약
- 무료 서비스는 프로젝트 수, DB 용량, 스토리지, API 사용량, 휴면 중지, 백업 보장 등의 제한이 있을 수 있다.
- 무료 DB만으로 무조건 안전한 백업이 보장되지는 않는다. 별도 내보내기·복구 리허설이 필요하다.
- 기존 `services/scan-api`는 AI 사진 판독 서비스이며, 기록 동기화 API나 PostgreSQL DB가 아니다.
