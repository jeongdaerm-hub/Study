import type { Recurring } from '@daro/app-core';

/* ───────── 반려동물 ───────── */
export type Species = 'dog' | 'cat' | 'other';
export type Sex = 'M' | 'F' | 'U';

export interface Pet {
  id: string;
  name: string;
  species: Species;
  breed: string;
  sex: Sex;
  neutered: boolean;
  /** YYYY-MM-DD (모르면 빈 문자열) */
  birthDate: string;
  /** 프로필 사진 */
  photo?: string;
  createdAt: number;
}

/* ───────── 건강수첩 ───────── */
/** 진료 기록 */
export interface VisitRecord {
  id: string;
  petId: string;
  date: string;
  hospital: string;
  reason: string;
  diagnosis: string;
  treatment: string;
  /** 원 단위 (선택) */
  cost?: number;
  photos: string[];
}

/** 검사 수치 1건 */
export interface LabItem {
  name: string;
  value: number;
  unit: string;
  /** 검사지에 적힌 참고 범위 */
  refMin?: number;
  refMax?: number;
}

export interface LabResult {
  id: string;
  petId: string;
  date: string;
  title: string;
  items: LabItem[];
  memo: string;
}

/** 예방접종 */
export interface Vaccination {
  id: string;
  petId: string;
  name: string;
  date: string;
  /** 다음 접종 예정일 (선택) → 일정 자동 등록 */
  nextDate?: string;
  hospital: string;
  /** 자동 생성된 일정 ID */
  scheduleId?: string;
}

/* ───────── 체중 ───────── */
export interface WeightEntry {
  id: string;
  petId: string;
  date: string;
  kg: number;
}

/* ───────── 생활일지 ───────── */
export type LogKind = 'meal' | 'water' | 'poop' | 'vomit' | 'note';
export type PoopStatus = 'normal' | 'hard' | 'soft' | 'diarrhea' | 'blood' | 'none';
export type VomitType = 'food' | 'foam' | 'hairball' | 'blood' | 'other';

export interface DailyLog {
  id: string;
  petId: string;
  date: string;
  /** HH:mm */
  time: string;
  kind: LogKind;
  /** meal: g, water: ml */
  amount?: number;
  /** meal: 사료/간식 이름 */
  food?: string;
  poop?: PoopStatus;
  vomit?: VomitType;
  memo: string;
  photos: string[];
}

/* ───────── 일정·알림 ───────── */
export type ScheduleType = 'vaccine' | 'medicine' | 'hospital' | 'grooming' | 'etc';

export interface Schedule extends Recurring {
  id: string;
  petId: string;
  title: string;
  type: ScheduleType;
  memo: string;
  notificationId?: string;
}

/** 저장소 전체 */
export interface PetDb {
  pets: Pet[];
  visits: VisitRecord[];
  labs: LabResult[];
  vaccines: Vaccination[];
  weights: WeightEntry[];
  logs: DailyLog[];
  schedules: Schedule[];
}

export type Collection = keyof PetDb;
