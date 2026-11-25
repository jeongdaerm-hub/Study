# 다로 앱 모노레포

여러 앱이 **같은 개발·배포·인앱 업데이트 구조**를 쓰도록 만든 저장소.
공통 기능은 `packages/` 에 한 번만 만들고, 각 앱(`apps/`)은 가져다 씀.

## 1. 폴더 구조

| 경로 | 역할 | 비유 |
|---|---|---|
| `packages/app-core` | 공통 기능 (인앱 업데이트, 알림, 저장소, 사진, UI) | 프랜차이즈 공용 주방 설비 |
| `packages/app-config` | 공통 빌드 설정 (OTA, 버전 정책, 권한, Metro) | 매장 인테리어 표준 도면 |
| `packages/health-scan` | 건강수첩 사진 인식 규칙 (결과 형식·AI 지시문·검증·가져오기 계획) | 서류 접수 기준표 |
| `services/scan-api` | 사진 인식 서버 (Claude API, 키는 서버에만) | 서류 판독 창구 |
| `templates/expo-app` | 새 앱 뼈대 | 신규 매장 오픈 키트 |
| `apps/<slug>` | 실제 앱 (현재: `pet` 다로펫) | 개별 매장 |
| `manifests/<slug>.json` | 앱별 최신/최소 지원 버전 | 매장 공지판 |
| `scripts/` | 앱 생성, 매니페스트 갱신·검증 | 운영 매뉴얼 자동화 |
| `.github/workflows/` | CI, 보안 점검, OTA 배포, 스토어 빌드 | 품질검사 + 보안검색대 + 배송 라인 |
| `SECURITY.md` | 보안 점검 결과·정책 | 안전 점검표 |

## 2. 공통 모듈 (`@daro/app-core`)

| 모듈 | 제공 기능 | 앱에서 쓰는 법 |
|---|---|---|
| update | OTA + 스토어 버전 체크, [업데이트] 버튼, 필수 업데이트 모달 | `<UpdateGate />` 한 줄 |
| notifications | 권한 요청, 알림 예약/취소, 매일·매주·매월 반복 | `initNotifications()`, `scheduleReminder()` |
| storage | 기기 저장소, 사진 선택(앨범/카메라)·보관·삭제 | `loadList/saveList`, `pickPhotos` |
| logic | 날짜, 반복 일정 계산 (순수 함수) | `@daro/app-core/logic.ts` (테스트·스크립트용) |
| ui | 테마(브랜드 색), Chip, 버튼, FAB, 날짜·시간 선택, 확인 창 | `<ThemeProvider>`, `<DialogProvider>` |

- 표준 SDK: **Expo SDK 58** (React 19 · React Native 0.88) (버전 목록 = `packages/app-core/package.json` 의 `peerDependencies`)
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

## 4. 개발 → 확인 → 배포 흐름 (자세히: [RELEASE.md](RELEASE.md))

| 단계 | 언제 | 방법 | 결과 |
|---|---|---|---|
| ① 검증 | PR 마다 자동 | CI (`npm run check`, 보안, APK) | 테스트 앱 APK 갱신 |
| ② 내 폰 확인 | 화면·로직 변경 | Actions → **Release** 실행 | 내 폰 **다로펫 테스트** 앱만 먼저 받음 |
| ③ 승인 | 확인 끝나면 | Release 실행 화면 → **Approve** | 확인한 그 업데이트가 사용자에게 (선택: 10%·50% 점진 배포) |
| ④ 조절·되돌리기 | 필요할 때 | Actions → **Release Control** | 비율 올리기 / 긴급 되돌리기 |
| 스토어 빌드 | 네이티브 변경 | Actions → **Store Build** (production 은 승인 필요) | — |
| 출시 공지 | 스토어 배포 후 | `npm run release:manifest -- <slug> <ver>` | 배너 [업데이트] → 스토어 |

- 사용자 앱: 업데이트를 **백그라운드에서 받아 두었다가 다음에 앱을 열 때 적용** → 사용 중 끊김 없음
- 테스트 앱과 실제 앱은 앱 ID 가 달라 **나란히 설치**, 데이터도 분리

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
| Security 워크플로 + Dependabot | 취약 라이브러리·비밀키 유출 (자세한 내용 `SECURITY.md`) |
| 스토어 주소 허용 목록 | 변조된 매니페스트로 피싱 사이트 이동 |
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

## 7. 웹 미리보기 (기획·QA 확인용)

```bash
cd apps/<slug> && npx expo export --platform web --output-dir dist-web
```

| 항목 | 웹 미리보기 | 실제 앱 |
|---|---|---|
| 화면·기능 | 동일 | 동일 |
| 알림 | 저장만 됨 (울리지 않음) | OS 알림 |
| 사진 | 파일 선택 | 앨범 + 카메라 |
| 데이터 | 브라우저 저장소 | 기기 앱 전용 영역 |

## 8. 명령어 모음

| 명령 | 설명 |
|---|---|
| `npm install` | 전체 설치 (워크스페이스 연결) |
| `npm run check` | 전체 테스트 + 타입체크 + 매니페스트 검증 + 보안 스캔 |
| `npm run security` | 보안 점검 (비밀키·위험코드 스캔 + npm audit) |
| `npm run new-app -- <slug> "<이름>"` | 새 앱 생성 |
| `npm run release:manifest -- <slug> <ver>` | 출시 공지 (스토어 업데이트 버튼) |
| `npm run start -w @daro/<slug>` | 앱 개발 서버 |
