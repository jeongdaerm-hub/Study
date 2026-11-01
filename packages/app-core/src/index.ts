/**
 * @daro/app-core — 모든 다로 앱이 공통으로 쓰는 모듈
 *
 *  update/        인앱 업데이트 (OTA + 스토어 버전 체크 + 업데이트 버튼)
 *  notifications/ 로컬 알림 예약/취소 (반복 일정 지원)
 *  storage/       기기 저장소, 사진 선택·보관
 *  logic/         날짜, 반복 일정 계산 (순수 함수, 단위 테스트 대상)
 *  ui/            테마 + 공통 컴포넌트
 */

// update
export { UpdateGate, type UpdateGateProps } from './update/UpdateGate.tsx';
export { UpdateBanner } from './update/UpdateBanner.tsx';
export { ForceUpdateModal } from './update/ForceUpdateModal.tsx';
export { useAppUpdate, type AppUpdateState, type UpdateStatus } from './update/useAppUpdate.ts';
export {
  decideStoreUpdate,
  isValidManifest,
  isSafeStoreUrl,
  sanitizeManifest,
  shouldShowBanner,
  type StoreUpdateLevel,
  type VersionManifest,
} from './update/policy.ts';
export { compareVersions } from './update/version.ts';

// notifications
export {
  initNotifications,
  scheduleReminder,
  cancelReminder,
  formatBefore,
  notificationsSupported,
  type ReminderInput,
} from './notifications/scheduler.ts';

// storage
export { loadList, loadValidList, saveList, storageKey } from './storage/store.ts';
export { pickPhotos, deletePhotos, MAX_PHOTOS, type PickPhotoMessages } from './storage/photos.ts';

// logic
export { toDateKey, formatDateTime, addDays, newId } from './logic/date.ts';
export {
  nextOccurrence,
  reminderTime,
  rollForward,
  sortByUpcoming,
  REMIND_OPTIONS,
  REPEAT_LABEL,
  type Repeat,
  type Recurring,
} from './logic/recurrence.ts';

// ui
export { ThemeProvider, useTheme, defaultTheme, type Theme } from './ui/theme.tsx';
export { Chip, ChipRow, SelectChips, PrimaryButton, Fab, Label } from './ui/components.tsx';
export { DateTimeField } from './ui/DateTimeField.tsx';
export { DialogProvider, DialogHost, useDialog } from './ui/Dialog.tsx';
