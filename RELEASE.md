# 배포 가이드: 내 폰에서 먼저 확인 → 승인 → 사용자에게

## 1. 한눈에 보기

| 단계 | 누가 | 어디서 | 사용자 영향 |
|---|---|---|---|
| ① 테스트 채널 게시 | GitHub Actions (자동) | Actions → **Release** → Run workflow | 없음 (내 폰 테스트 앱만 받음) |
| ② 내 폰에서 확인 | 나 | 폰의 **다로펫 테스트** 앱 | 없음 |
| ③ 승인 | 나 | Release 실행 화면 → **Review deployments → Approve** | — |
| ④ 사용자에게 배포 | GitHub Actions (자동) | — | 백그라운드로 받아 두고 **다음 실행 때 적용** |
| ⑤ (선택) 비율 올리기 / 되돌리기 | 나 | Actions → **Release Control** | — |

- ①에서 확인한 **바로 그 업데이트**를 ④에서 그대로 보냄 (다시 빌드하지 않음 → "확인한 것 = 배포되는 것")
- 화면·문구·로직 변경만 이 방식(OTA). 권한·SDK·네이티브 모듈 변경은 **Store Build** (production 은 승인 필요)

## 2. 두 개의 앱

| 구분 | 테스트 앱 | 실제 앱 |
|---|---|---|
| 이름 | 다로펫 테스트 | 다로펫 |
| 앱 ID | `com.daro.pet.preview` | `com.daro.pet` |
| 받는 업데이트 | preview 채널 (①) | production 채널 (④) |
| 표시 | 맨 위 보라색 **🧪 테스트 버전 · v1.0.0 · 업데이트 #abc123** | 없음 |
| 설치 | [테스트 앱 다운로드](https://github.com/jeongdaerm-hub/Study/releases/tag/pet-android-test) | 스토어 |
| 데이터 | 따로 (마음껏 테스트) | 사용자 데이터 |

## 3. 처음 한 번 설정

| 순서 | 위치 | 할 일 |
|---|---|---|
| 1 | Settings → **Environments** → New environment | 이름 `production` |
| 2 | production 설정 화면 | **Required reviewers** 체크 → 본인 추가 → **Prevent self-review 는 끄기** (혼자 작업이므로) → Save |
| 3 | Settings → Secrets → Actions | `EXPO_TOKEN` (expo.dev → Access tokens) |
| 4 | Settings → Variables → Actions | `EAS_PROJECT_ID_PET` (`cd apps/pet && npx eas init`) |
| 5 | 테스트 앱 | 위 설정 후 테스트 APK 가 다시 빌드되면 새로 설치 (업데이트 주소가 들어감) |

> 2번을 하지 않으면 승인 없이 바로 배포돼요. 꼭 설정하세요.

## 4. 내 폰 확인 목록 (②)

| 확인 | 방법 |
|---|---|
| 새 업데이트 적용됨 | 테스트 앱을 **완전히 종료 후 다시 열기** (한 번 더 열면 확실) → 띠의 `업데이트 #` 가 Release 요약과 같은지 |
| 바뀐 기능 | 이번 변경 내용 직접 사용 |
| 기존 데이터 유지 | 반려동물·일지·체중·일정이 그대로인지 |
| 홈 / 건강수첩 / 체중 / 생활일지 / 일정 | 5개 탭 모두 열어보기 |
| 기록 추가·수정·삭제 | 아무 탭에서 1건씩 |
| 알림 | 2~3분 뒤 일정 추가 → 앱 닫고 대기 |
| 사진 | 촬영 1장, 앨범 1장 |
| 껐다 켜기 | 완전히 종료 후 다시 열어도 정상 |

문제가 있으면 **승인하지 말고** 실행을 취소(Cancel)하세요. 사용자에게는 아무것도 가지 않아요.

## 5. 사용자가 끊김 없는 이유

| 장치 | 효과 |
|---|---|
| 백그라운드 다운로드 | 사용 중 화면을 막지 않음 |
| 다음 실행 때 적용 | 작성 중이던 화면이 갑자기 재시작되지 않음 (원하면 배너의 [지금 적용]) |
| 같은 버전끼리만 OTA (`runtimeVersion: appVersion`) | 네이티브가 다른 앱에 잘못된 업데이트가 가지 않음 |
| 데이터는 기기에 그대로 | 업데이트는 화면·로직만 바꿈, 저장된 기록은 유지 |
| 점진 배포 (10% → 50% → 100%) | 문제가 있어도 일부 사용자에게만 |
| 긴급 되돌리기 | Release Control → rollback → 다음 실행 때 설치 당시 버전으로 |

## 6. 점진 배포·되돌리기

| 상황 | 방법 |
|---|---|
| 10% 로 시작 | Release 실행 시 `rollout` = 10 |
| 괜찮으면 늘리기 | Release Control → `rollout`, group = Release 요약의 업데이트 ID, percentage = 50 → 100 |
| 문제 발생 | Release Control → `rollback` (승인 필요) |
