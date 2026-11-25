import type { ScanResult } from './types.ts';
import { addMonthsKey } from './dates.ts';

/**
 * 체험용 예시 결과 (스캔 서버 미연결 시 '예시 결과로 체험')
 * 실제 사진 분석 결과가 아님을 화면에 명시해서 사용
 */
export function demoScanResult(todayKey: string): ScanResult {
  const ago = (m: number) => addMonthsKey(todayKey, -m);
  return {
    documentType: 'vaccination_record',
    petName: null,
    vaccines: [
      { name: '종합백신(DHPPL)', date: ago(24), nextDate: ago(12), hospital: '다로동물병원', confidence: 'high' },
      { name: '종합백신(DHPPL)', date: ago(11), nextDate: null, hospital: '다로동물병원', confidence: 'high' },
      { name: '광견병', date: ago(10), nextDate: addMonthsKey(ago(10), 12), hospital: '다로동물병원', confidence: 'medium' },
      { name: '켄넬코프', date: ago(9), nextDate: null, hospital: '다로동물병원', confidence: 'low' },
    ],
    visits: [
      { date: ago(2), hospital: '다로동물병원', reason: '피부 가려움', diagnosis: '알레르기성 피부염', treatment: '약용 샴푸, 내복약 7일', cost: 68000, confidence: 'high' },
    ],
    labs: [],
    followUps: [{ date: addMonthsKey(todayKey, 1), title: '피부 재진', type: 'hospital', confidence: 'medium' }],
    warnings: ['켄넬코프 접종일 일부가 흐려 확인이 필요해요.'],
  };
}
