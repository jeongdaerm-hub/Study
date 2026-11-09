/**
 * 건강수첩 사진 인식 결과 (AI 가 돌려주는 형식)
 * 서버·앱·웹 미리보기 모두 이 형식을 사용
 */
export type DocumentType = 'vaccination_record' | 'vet_receipt' | 'lab_report' | 'prescription' | 'other';
export type Confidence = 'high' | 'medium' | 'low';
export type FollowUpType = 'vaccine' | 'medicine' | 'hospital' | 'etc';

export interface ScannedVisit {
  /** YYYY-MM-DD */
  date: string;
  hospital: string;
  reason: string;
  diagnosis: string;
  treatment: string;
  /** 원 단위, 없으면 null */
  cost: number | null;
  confidence: Confidence;
}

export interface ScannedLabItem {
  name: string;
  value: number;
  unit: string;
  refMin: number | null;
  refMax: number | null;
}

export interface ScannedLab {
  date: string;
  title: string;
  items: ScannedLabItem[];
  confidence: Confidence;
}

export interface ScannedVaccine {
  name: string;
  date: string;
  /** 문서에 적힌 다음 접종 예정일, 없으면 null */
  nextDate: string | null;
  hospital: string;
  confidence: Confidence;
}

/** 문서에 적힌 다음 내원·투약 예정 (재검, 다음 진료일 등) */
export interface ScannedFollowUp {
  date: string;
  title: string;
  type: FollowUpType;
  confidence: Confidence;
}

export interface ScanResult {
  documentType: DocumentType;
  /** 문서에 적힌 반려동물 이름 (선택한 펫과 다른지 확인용) */
  petName: string | null;
  visits: ScannedVisit[];
  labs: ScannedLab[];
  vaccines: ScannedVaccine[];
  followUps: ScannedFollowUp[];
  /** 읽기 어려웠던 부분 등 안내 */
  warnings: string[];
}
