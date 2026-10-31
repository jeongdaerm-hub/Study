# 다로펫 (Daro Pet)

반려동물 전용 앱 (Expo / React Native) — 일기 · 배변 체크 · 사진 · 일정 알림 · 인앱 업데이트

## 0. 주요 기능

| 탭 | 기능 | 세부 |
|---|---|---|
| 🏠 홈 | 펫별 요약 | 오늘 일기 여부, 배변 건강 신호(정상/관찰/병원 권장), 다음 일정 |
| 📔 일기 | 일기 작성 | 날짜, 기분, 본문, 사진(앨범/촬영 최대 5장), 배변 체크(상태·횟수) |
| 🔔 일정 | 일정 + 알림 | 병원/접종/구충제/미용/산책, 정각·30분·1시간·하루 전 알림, 매일/매주/매월 반복 |
| (공통) | 인앱 업데이트 | 새 버전이 있으면 상단에 [업데이트] 버튼 |

### 배변 건강 신호 규칙 (`src/logic/poop.ts`)

| 조건 (최근 7일) | 결과 |
|---|---|
| 혈변 1회 이상 | 🔴 병원 권장 |
| 이상 배변 2일 연속 | 🔴 병원 권장 |
| 이상 배변 1회 이상 | 🟠 관찰 |
| 그 외 | 🟢 정상 |

### 알림 동작 (`src/notifications/scheduler.ts`)

| 반복 | 방식 |
|---|---|
| 매일 / 매주 | OS 반복 알림 → 앱을 안 열어도 계속 울림 |
| 1회 / 매월 | 다음 1회 예약 → 앱 실행 시 다음 회차로 자동 이동·재예약 |
| 반복 일정 완료 체크 | 이번 회차 완료 → 다음 회차로 이동 |

### 데이터 저장

| 데이터 | 위치 |
|---|---|
| 일기 / 일정 | 기기 내부 AsyncStorage (`src/storage/store.ts`) |
| 사진 | 앱 전용 폴더로 복사 (갤러리 원본 삭제돼도 유지), 일기 삭제 시 함께 삭제 |

## 1. 업데이트 2-트랙 구조

| 트랙 | 대상 변경 | 방식 | 사용자 경험 |
|---|---|---|---|
| OTA (expo-updates) | 화면·문구·JS 로직 | 앱 안에서 번들 다운로드 → 재시작 | [업데이트] 버튼 1번, 스토어 이동 없음 |
| 스토어 (version.json) | 네이티브 모듈·권한·SDK | 스토어 페이지로 이동 | optional: 배너 / force: 차단 모달 |

## 2. 판단 규칙 (`src/update/policy.ts`)

| 조건 | 결과 | 화면 |
|---|---|---|
| 현재 < minSupportedVersion | `force` | 닫기 없는 필수 업데이트 모달 |
| 현재 < latestVersion | `optional` | 상단 배너 + [업데이트]/[나중에] |
| OTA 번들 존재 | OTA | 상단 배너 + [업데이트] → 즉시 적용 |
| 그 외 | `none` | 아무것도 표시 안 함 |

- 확인 시점: 앱 시작 + 포그라운드 복귀(30분 간격)
- 버전 서버 장애 시 fail-open(앱 사용 차단 안 함)

## 3. 파일 구성

| 파일 | 역할 |
|---|---|
| `src/update/version.ts` | 시맨틱 버전 비교 |
| `src/update/policy.ts` | force / optional / none 판단 |
| `src/update/useAppUpdate.ts` | OTA + 스토어 확인, `applyUpdate()` |
| `src/update/UpdateGate.tsx` | 앱 최상단에 두는 업데이트 컨트롤러 |
| `src/update/UpdateBanner.tsx` | 업데이트 버튼 배너 |
| `src/update/ForceUpdateModal.tsx` | 필수 업데이트 모달 |
| `server/version.json` | 버전 서버 응답 예시 |
| `src/screens/*` | 홈 / 일기 / 일정 화면 |
| `src/state/AppData.tsx` | 일기·일정 상태 + 저장 + 알림 연동 |
| `src/logic/*` | 배변 분석, 일정 반복·알림 시각 계산 (단위 테스트 대상) |

## 4. 운영 절차

| 상황 | 작업 |
|---|---|
| JS만 수정 | `npm run update:publish "메시지"` (EAS Update) |
| 네이티브 수정 | `app.json` version 올림 → 스토어 배포 → `version.json`의 `latestVersion` 갱신 |
| 구버전 차단 | `version.json`의 `minSupportedVersion` 올림 |

## 5. 초기 설정

1. `app.json` → `updates.url` 에 EAS 프로젝트 ID 입력 (`eas init`, `eas update:configure`)
2. `app.json` → `extra.versionManifestUrl` 에 실제 version.json URL 입력
3. `server/version.json` 의 `storeUrl.ios` 앱 ID 교체

```bash
npm install
npm test      # 업데이트·배변·일정 로직 단위 테스트
npx tsc       # 타입 체크
```
