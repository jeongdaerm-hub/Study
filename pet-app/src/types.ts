export type Species = '강아지' | '고양이';

export interface Pet {
  id: string;
  name: string;
  species: Species;
}

/** 배변 상태 (브리스톨 척도를 반려동물용으로 단순화) */
export type PoopStatus = 'normal' | 'hard' | 'soft' | 'diarrhea' | 'blood' | 'none';

export interface PoopCheck {
  status: PoopStatus;
  count: number;
}

export type Mood = '😆' | '🙂' | '😐' | '😢' | '🤒';

export interface DiaryEntry {
  id: string;
  petId: string;
  /** YYYY-MM-DD */
  date: string;
  mood: Mood;
  text: string;
  /** 앱 전용 폴더에 복사된 사진 경로 */
  photos: string[];
  poop?: PoopCheck;
  createdAt: number;
}

export type ScheduleType = '병원' | '예방접종' | '구충제' | '미용' | '산책' | '기타';
export type Repeat = 'none' | 'daily' | 'weekly' | 'monthly';

export interface Schedule {
  id: string;
  petId: string;
  title: string;
  type: ScheduleType;
  /** ISO 문자열 */
  dateTime: string;
  /** 몇 분 전에 알림 (0 = 정각) */
  remindBefore: number;
  repeat: Repeat;
  done: boolean;
  /** expo-notifications 예약 ID (취소용) */
  notificationId?: string;
}
