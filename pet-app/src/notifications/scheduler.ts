import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Schedule } from '../types.ts';
import { reminderTime } from '../logic/schedule.ts';
import { PETS } from '../data/pets.ts';

const CHANNEL_ID = 'schedule';

// 앱이 켜져 있을 때도 알림 배너 표시
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function initNotifications(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: '반려동물 일정',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

/**
 * 일정 알림 예약
 * - 매일/매주: OS 반복 알림 (앱을 안 열어도 계속 울림)
 * - 1회/매월: 다음 1회만 예약, 앱 실행 시 rollForward 후 재예약
 * 반환: 예약 ID (지난 일정·완료 일정이면 undefined)
 */
export async function scheduleReminder(s: Schedule): Promise<string | undefined> {
  if (s.done) return undefined;
  const pet = PETS.find((p) => p.id === s.petId);
  const content: Notifications.NotificationContentInput = {
    title: `🐾 ${pet?.name ?? ''} ${s.type} 일정`,
    body: s.remindBefore > 0 ? `${s.title} — ${labelBefore(s.remindBefore)} 전이에요` : `${s.title} 시간이에요`,
    data: { scheduleId: s.id },
    sound: true,
  };

  const at = new Date(new Date(s.dateTime).getTime() - s.remindBefore * 60_000);
  let trigger: Notifications.NotificationTriggerInput;
  if (s.repeat === 'daily') {
    trigger = { hour: at.getHours(), minute: at.getMinutes(), repeats: true, channelId: CHANNEL_ID };
  } else if (s.repeat === 'weekly') {
    trigger = { weekday: at.getDay() + 1, hour: at.getHours(), minute: at.getMinutes(), repeats: true, channelId: CHANNEL_ID };
  } else {
    const t = reminderTime(s);
    if (!t) return undefined;
    trigger = { date: t, channelId: CHANNEL_ID };
  }
  return Notifications.scheduleNotificationAsync({ content, trigger });
}

export async function cancelReminder(id?: string): Promise<void> {
  if (id) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

function labelBefore(min: number): string {
  if (min % 1440 === 0) return `${min / 1440}일`;
  if (min % 60 === 0) return `${min / 60}시간`;
  return `${min}분`;
}
