import type { LogKind, PoopStatus, ScheduleType, Sex, Species, VomitType } from './types.ts';

export const SPECIES_LABEL: Record<Species, string> = { dog: '강아지', cat: '고양이', other: '기타' };
export const SPECIES_EMOJI: Record<Species, string> = { dog: '🐶', cat: '🐱', other: '🐾' };
export const SEX_LABEL: Record<Sex, string> = { M: '남아', F: '여아', U: '모름' };

export const LOG_LABEL: Record<LogKind, string> = { meal: '식사', water: '음수', poop: '배변', vomit: '구토', note: '메모' };
export const LOG_EMOJI: Record<LogKind, string> = { meal: '🍚', water: '💧', poop: '💩', vomit: '🤮', note: '📝' };

export const POOP_LABEL: Record<PoopStatus, string> = {
  normal: '정상',
  hard: '딱딱함',
  soft: '무름',
  diarrhea: '설사',
  blood: '혈변',
  none: '안 봄',
};

export const VOMIT_LABEL: Record<VomitType, string> = {
  food: '사료/음식',
  foam: '거품/노란 토',
  hairball: '헤어볼',
  blood: '피 섞임',
  other: '기타',
};

export const SCHEDULE_LABEL: Record<ScheduleType, string> = {
  vaccine: '예방접종',
  medicine: '투약',
  hospital: '병원 방문',
  grooming: '미용',
  etc: '기타',
};
export const SCHEDULE_EMOJI: Record<ScheduleType, string> = {
  vaccine: '💉',
  medicine: '💊',
  hospital: '🏥',
  grooming: '✂️',
  etc: '📌',
};
