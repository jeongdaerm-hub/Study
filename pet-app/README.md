# 다로펫 (Daro Pet) — 인앱 업데이트 구조

반려동물 전용 앱(Expo / React Native) + **인앱 업데이트** 기본 골격.

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
npm test      # 업데이트 판단 로직 단위 테스트
npx tsc       # 타입 체크
```
