import { z } from 'zod';

/**
 * Claude 구조화 출력 스키마 (@daro/health-scan ScanResult 와 같은 모양)
 * 응답 형식을 API 단에서 강제하고, 받은 뒤 sanitizeScan 으로 한 번 더 검증
 */
const confidence = z.enum(['high', 'medium', 'low']).describe('이 항목을 얼마나 확실히 읽었는지');
const date = z.string().describe('YYYY-MM-DD');

export const ScanSchema = z.object({
  documentType: z.enum(['vaccination_record', 'vet_receipt', 'lab_report', 'prescription', 'other']),
  petName: z.string().nullable().describe('문서에 적힌 반려동물 이름, 없으면 null'),
  visits: z.array(
    z.object({
      date,
      hospital: z.string(),
      reason: z.string(),
      diagnosis: z.string(),
      treatment: z.string(),
      cost: z.number().nullable().describe('총 결제 금액(원), 없으면 null'),
      confidence,
    }),
  ),
  labs: z.array(
    z.object({
      date,
      title: z.string(),
      items: z.array(
        z.object({
          name: z.string(),
          value: z.number(),
          unit: z.string(),
          refMin: z.number().nullable(),
          refMax: z.number().nullable(),
        }),
      ),
      confidence,
    }),
  ),
  vaccines: z.array(
    z.object({
      name: z.string(),
      date,
      nextDate: z.string().nullable().describe('문서에 적힌 다음 접종일 YYYY-MM-DD, 없으면 null'),
      hospital: z.string(),
      confidence,
    }),
  ),
  followUps: z.array(
    z.object({
      date,
      title: z.string(),
      type: z.enum(['vaccine', 'medicine', 'hospital', 'etc']),
      confidence,
    }),
  ),
  warnings: z.array(z.string()),
});
