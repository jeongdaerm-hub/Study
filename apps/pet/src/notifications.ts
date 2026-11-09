import { formatBefore, scheduleReminder } from '@daro/app-core';
import type { Pet, Schedule } from './types.ts';
import { SCHEDULE_LABEL } from './labels.ts';

export const PET_CHANNEL = 'schedule';

/** 펫 일정 → 공통 알림 모듈 입력으로 변환 */
export function schedulePetReminder(s: Schedule, pets: Pet[]): Promise<string | undefined> {
  const pet = pets.find((p) => p.id === s.petId);
  return scheduleReminder({
    ...s,
    channelId: PET_CHANNEL,
    title: `🐾 ${pet?.name ?? ''} ${SCHEDULE_LABEL[s.type]}`,
    body: s.remindBefore > 0 ? `${s.title} — ${formatBefore(s.remindBefore)} 전이에요` : `${s.title} 시간이에요`,
    // 알림에는 식별자만 포함 (잠금화면 노출 최소화)
    data: { scheduleId: s.id },
  });
}
