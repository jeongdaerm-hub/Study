# 다로 앱 모노레포

여러 앱이 **같은 개발·배포·인앱 업데이트 구조**를 쓰도록 만든 저장소.
공통 기능은 `packages/` 에 한 번만 만들고, 각 앱(`apps/`)은 가져다 씀.

## 1. 폴더 구조

| 경로 | 역할 | 비유 |
|---|---|---|
| `packages/app-core` | 공통 기능 (인앱 업데이트, 알림, 저장소, 사진, UI) | 프랜차이즈 공용 주방 설비 |
| `packages/app-config` | 공통 빌드 설정 (OTA, 버전 정책, 권한, Metro) | 매장 인테리어 표준 도면 |
| `templates/expo-app` | 새 앱 뼈대 | 신규 매장 오픈 키트 |
| `apps/<slug>` | 실제 앱 (현재: `pet` 다로펫) | 개별 매장 |
| `manifests/<slug>.json` | 앱별 최신/최소 지원 버전 | 매장 공지판 |
| `scripts/` | 앱 생성, 매니페스트 갱신·검증 | 운영 매뉴얼 자동화 |
| `.github/workflows/` | CI, OTA 배포, 스토어 빌드 | 품질검사 + 배송 라인 |

## 2. 공통 모듈 (`@daro/app-core`)

| 모듈 | 제공 기능 | 앱에서 쓰는 법 |
|---|---|---|
| update | OTA + 스토어 버전 체크, [업데이트] 버튼, 필수 업데이트 모달 | `<UpdateGate />` 한 줄 |
| notifications | 권한 요청, 알림 예약/취소, 매일·매주·매월 반복 | `initNotifications()`, `scheduleReminder()` |
| storage | 기기 저장소, 사진 선택(앨범/카메라)·보관·삭제 | `loadList/saveList`, `pickPhotos` |
| logic | 날짜, 반복 일정 계산 (순수 함수) | `@daro/app-core/logic.ts` (테스트·스크립트용) |
| ui | 테마(브랜드 색), Chip, 버튼, FAB, 날짜·시간 선택 | `<ThemeProvider theme={...}>` |

- 표준 SDK: **Expo SDK 51** (버전 목록 = `packages/app-core/package.json` 의 `peerDependencies`)
- 모든 앱이 같은 SDK → 공통 모듈 호환 보장. SDK 업그레이드는 저장소 전체에서 한 번에 진행

## 3. 새 앱 만들기

```bash
npm run new-app -- <slug> "<앱 이름>" --color "#2BB673"
npm install
cd apps/<slug> && npx eas init      # EAS 프로젝트 ID → app.config.js easProjectId
npm run start -w @daro/<slug>
```

| 자동으로 들어가는 것 | 내용 |
|---|---|
| 인앱 업데이트 | `UpdateGate` 장착, OTA + 버전 매니페스트 연결 |
| 빌드 설정 | `app.config.js` (createAppConfig), `eas.json` (dev/preview/production 채널) |
| 모노레포 | `metro.config.js`, `tsconfig.json` |
| 의존성 | 표준 SDK 버전으로 고정 |
| 매니페스트 | `manifests/<slug>.json` |
| 테스트 | `tests/` + CI 자동 포함 |

## 4. 개발 → 배포 → 업데이트 흐름

| 단계 | 언제 | 명령 / 방법 | 사용자에게 보이는 것 |
|---|---|---|---|
| ① 검증 | 항상 (PR마다 자동) | `npm run check` / CI | — |
| ② OTA 배포 | JS·화면·문구만 바뀜 | Actions → **OTA Update** 또는 `npm run update:production -w @daro/<slug> -- "메시지"` | 상단 배너 [업데이트] → 즉시 적용 |
| ③ 스토어 빌드 | 네이티브 변경 (권한, SDK, 새 네이티브 모듈) | `app.config.js` version 올림 → Actions → **Store Build** | — |
| ④ 출시 공지 | ③ 스토어 배포 **완료 후** | `npm run release:manifest -- <slug> 1.1.0 --note "변경 내용"` → main 머지 | 배너 [업데이트] → 스토어 이동 |
| ⑤ 구버전 차단 | 보안·데이터 호환 문제 시 | `release:manifest -- <slug> 1.1.0 --min 1.1.0` | 닫을 수 없는 필수 업데이트 창 |

### OTA vs 스토어 판단 기준

| 변경 내용 | 경로 |
|---|---|
| 화면, 문구, 로직, 이미지 | OTA |
| 권한 추가, Expo SDK 업, 네이티브 패키지 추가 | 스토어 |
| 모르겠으면 | 스토어 (안전) |

> `runtimeVersion: appVersion` 정책 → 앱 version 이 다르면 OTA 가 섞이지 않아 **네이티브 불일치로 인한 크래시를 원천 차단**

## 5. 안전장치

| 장치 | 막아주는 사고 |
|---|---|
| CI: 테스트 + 타입체크 + 전 앱 번들 빌드 | 공통 모듈 수정이 다른 앱을 깨뜨림 |
| CI: 매니페스트 검증 | 잘못된 JSON 으로 업데이트 체크 마비 |
| `release:manifest` 규칙 | 버전 역행, min > latest 같은 실수 |
| 버전 서버 장애 시 fail-open | 매니페스트 접근 실패로 앱 사용 불가 |
| OTA 배포 전 `npm run check` | 깨진 번들이 사용자에게 배포 |

## 6. 최초 1회 설정

| 항목 | 위치 |
|---|---|
| `EXPO_TOKEN` | GitHub → Settings → Secrets → Actions |
| EAS 프로젝트 ID | 각 앱 `app.config.js` 의 `easProjectId` |
| 매니페스트 공개 URL | 저장소가 비공개면 `DARO_MANIFEST_BASE_URL` 환경변수로 공개 위치(CDN, GitHub Pages 등) 지정 |
| iOS 앱 ID | `manifests/<slug>.json` 의 `storeUrl.ios` |

## 7. 명령어 모음

| 명령 | 설명 |
|---|---|
| `npm install` | 전체 설치 (워크스페이스 연결) |
| `npm run check` | 전체 테스트 + 타입체크 + 매니페스트 검증 |
| `npm run new-app -- <slug> "<이름>"` | 새 앱 생성 |
| `npm run release:manifest -- <slug> <ver>` | 출시 공지 (스토어 업데이트 버튼) |
| `npm run start -w @daro/<slug>` | 앱 개발 서버 |
