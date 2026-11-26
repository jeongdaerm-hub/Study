# 가족 공유 (나 + 가족이 같은 기록 보기)

## 1. 한눈에 보기

| 항목 | 내용 |
|---|---|
| 하는 일 | 같은 '가족'에 들어간 사람끼리 반려동물·건강수첩·체중·생활일지·일정을 함께 보고 함께 적기 |
| 로그인 | 이메일로 받은 6자리 코드 (비밀번호 없음) |
| 가족 참여 | 가족이 만든 **초대 코드 8자리** (24시간, 1회용) |
| 인터넷이 없을 때 | 지금처럼 폰에 저장 → 연결되면 자동으로 주고받음 |
| 동시에 같은 기록 수정 | 먼저 저장한 사람 값 유지 + "가족이 먼저 고쳤어요" 안내 (말없이 덮어쓰지 않음) |
| 사진 | 1단계에서는 **각자 폰에만** (기록 글·숫자만 공유) |
| 비용 | Supabase 무료 요금제 범위 (가족 몇 명 기록 정도는 충분) |

## 2. 구조

```text
나의 폰 ─┐                         ┌─ 다래의 폰
 (기록은 폰에 먼저 저장)              (기록은 폰에 먼저 저장)
   └─ 바뀐 것만 보냄/받음 ── HTTPS ── Supabase ──┘
                                 ├ 로그인 (이메일 코드)
                                 ├ items 표 (가족별 기록, RLS 로 같은 가족만)
                                 └ RPC: 가족 만들기·초대·참여·나가기·기록 쓰기(버전 검사)
```

| 코드 위치 | 역할 |
|---|---|
| `supabase/migrations/202611260001_family_sharing.sql` | 표·권한(RLS)·RPC. Supabase SQL Editor 에서 한 번 실행 |
| `supabase/tests/` | 권한 테스트 (CI `family-db` 작업이 매번 실행) |
| `packages/sync-core` | 로그인·가족·동기화 규칙 (React 없음, 모든 앱 공용) |
| `packages/app-core/src/family` | 설정 화면 '가족 공유' 영역 + 자동 동기화 |
| `apps/pet/src/state/AppData.tsx` | 저장할 때 바뀐 것 기록, 받은 기록 반영 |

## 3. 처음 한 번 설정 (관리자)

| 순서 | 어디서 | 할 일 |
|---|---|---|
| 1 | https://supabase.com → Sign in (GitHub 로그인 가능) | **New project** → 이름 `daro`, 지역 **Seoul (ap-northeast-2)**, DB 비밀번호는 자동 생성 그대로 (어디에도 붙여넣지 않음) |
| 2 | 프로젝트 → **SQL Editor** → New query | `supabase/migrations/202611260001_family_sharing.sql` 내용을 붙여넣고 **Run** |
| 3 | **Authentication → Sign In / Providers → Email** | Email 켜짐 확인, **Confirm email** 켜짐 |
| 4 | **Authentication → Emails → Magic Link** 템플릿 | 본문에 `{{ .Token }}` 추가 (예: `인증 코드: {{ .Token }}`) → Save. 이게 있어야 메일에 6자리 코드가 와요 |
| 5 | **Project Settings → API** (또는 Data API / API Keys) | **Project URL** 과 **anon public**(또는 publishable) 키 복사. ⚠️ `service_role` / `secret` 키는 절대 복사하지 않기 |
| 6 | GitHub → Settings → Secrets and variables → Actions → **Variables** | `DARO_SUPABASE_URL` = Project URL, `DARO_SUPABASE_ANON_KEY` = anon 키 |
| 7 | GitHub Actions → **Release** 실행 | 새 버전(OTA)에 서버 주소가 들어감 → 앱 설치 다시 필요 없음 |

> 📮 Supabase 기본 메일은 무료라서 **시간당 보낼 수 있는 메일 수가 적어요**. 코드가 안 오면 잠시 뒤 다시 받거나, 나중에 Authentication → Emails → SMTP 에 개인 메일 서버를 연결하면 늘어나요.

> anon 키는 앱 안에 들어가도 되는 **공개 키**예요. 모든 데이터는 로그인 + RLS(같은 가족만) 로 보호돼요. 실수로 관리자 키를 넣으면 빌드가 멈추도록 막아 뒀어요.

## 4. 사용법

| 누가 | 순서 |
|---|---|
| 나 | 설정 → 가족 공유 → 이메일 → 받은 코드로 로그인 → **새 가족 만들기** → **가족 초대 코드 만들기** → 코드를 다래에게 전달 |
| 다래 | 다로펫 설치 → 설정 → 가족 공유 → 로그인 → **초대 코드로 참여하기** → 코드 입력 |
| 둘 다 | 이후 기록은 자동으로 주고받음 (앱 켤 때, 저장 직후, 켜져 있는 동안 1분마다, **지금 동기화** 버튼) |

## 5. 보안

| 위협 | 막는 방법 |
|---|---|
| 남이 우리 기록 보기 | 모든 표 RLS: `is_family_member(family_id)` 일 때만 읽기 |
| 직접 표 수정·삭제 | 쓰기 권한 없음. 기록 쓰기는 `upsert_item` RPC 로만 (가족 확인 + 버전 검사) |
| 초대 코드 대입 | 32^8 ≈ 1조 가지, 24시간 만료, 1회용, 가족당 미사용 5개 제한, 초대 표는 조회 불가 |
| 말없이 덮어쓰기 | rev(버전) 가 다르면 '충돌' → 서버 값 유지 후 안내 |
| 관리자 키 유출 | 앱에는 anon 키만. service_role/secret 키면 빌드 중단 + 앱에서도 거부 |
| 다른 서버로 전송 | 앱은 `https://<프로젝트>.supabase.co` 주소만 허용 |
| 로그인 정보 | 이메일 코드만 (비밀번호 저장 없음). 로그인 유지 토큰은 앱 전용 저장소 (백업 꺼짐) |

## 6. 한계와 다음 단계

| 지금 | 다음 |
|---|---|
| 사진은 각 폰에만 | Supabase Storage(비공개 버킷 + 가족 정책)로 사진 공유 |
| 1분마다 확인 | Realtime 으로 즉시 반영 |
| 한 사람 = 한 가족 | 필요하면 여러 가족 |
| 로그인 토큰: AsyncStorage | 다음 네이티브 버전에서 SecureStore(기기 암호화 저장소)로 이동 |
