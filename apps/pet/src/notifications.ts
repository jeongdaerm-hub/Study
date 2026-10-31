import { formatBefore, scheduleReminder } from '@daro/app-core';
import type { Schedule } from './types.ts';
import { PETS } from './data/pets.ts';

export const PET_CHANNEL = 'schedule';

/** 펫 일정 → 공통 알림 모듈 입력으로 변환 */
export function schedulePetReminder(s: Schedule): Promise<string | undefined> {
  const pet = PETS.find((p) => p.id === s.petId);
  return scheduleReminder({
    ...s,
    channelId: PET_CHANNEL,
    title: `🐾 ${pet?.name ?? ''} ${s.type} 일정`,
    body: s.remindBefore > 0 ? `${s.title} — ${formatBefore(s.remindBefore)} 전이에요` : `${s.title} 시간이에요`,
    data: { scheduleId: s.id },
  });
}
