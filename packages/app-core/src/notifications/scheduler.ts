import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { reminderTime, type Recurring } from '../logic/recurrence.ts';

const DEFAULT_CHANNEL = 'default';

/** 웹 미리보기는 OS 알림 예약 불가 → 일정은 저장되고 알림만 생략 */
export const notificationsSupported = Platform.OS !== 'web';

// 앱이 켜져 있을 때도 알림 배너 표시
if (notificationsSupported) Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** 권한 요청 + 안드로이드 채널 생성. 앱 시작 시 1회 호출 */
export async function initNotifications(channelName = '알림', channelId = DEFAULT_CHANNEL): Promise<boolean> {
  if (!notificationsSupported) return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(channelId, {
      name: channelName,
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

export interface ReminderInput extends Recurring {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: string;
}

/**
 * 로컬 알림 예약 (앱 공통)
 * - 매일/매주: OS 반복 알림 (앱을 안 열어도 계속 울림)
 * - 1회/매월: 다음 1회만 예약 → 앱 실행 시 rollForward 후 재예약
 * 반환: 예약 ID (지난 일정·완료 일정이면 undefined)
 */
export async function scheduleReminder(r: ReminderInput): Promise<string | undefined> {
  if (r.done || !notificationsSupported) return undefined;
  const channelId = r.channelId ?? DEFAULT_CHANNEL;
  const content: Notifications.NotificationContentInput = { title: r.title, body: r.body, data: r.data, sound: true };

  const at = new Date(new Date(r.dateTime).getTime() - r.remindBefore * 60_000);
  let trigger: Notifications.NotificationTriggerInput;
  if (r.repeat === 'daily') {
    trigger = { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: at.getHours(), minute: at.getMinutes(), channelId };
  } else if (r.repeat === 'weekly') {
    trigger = {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: at.getDay() + 1, // 1 = 일요일
      hour: at.getHours(),
      minute: at.getMinutes(),
      channelId,
    };
  } else {
    const t = reminderTime(r);
    if (!t) return undefined;
    trigger = { type: Notifications.SchedulableTriggerInputTypes.DATE, date: t, channelId };
  }
  return Notifications.scheduleNotificationAsync({ content, trigger });
}

export async function cancelReminder(id?: string): Promise<void> {
  if (id && notificationsSupported) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

/** 300 → '5시간', 1440 → '1일' */
export function formatBefore(min: number): string {
  if (min % 1440 === 0) return `${min / 1440}일`;
  if (min % 60 === 0) return `${min / 60}시간`;
  return `${min}분`;
}
