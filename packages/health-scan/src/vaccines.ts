/**
 * 백신 이름 표준화 + 일반적인 추가접종 간격
 * (간격은 '추정' 표시와 함께 제안만 하며, 사용자가 확인 후 저장)
 */
interface VaccineDef {
  name: string;
  match: RegExp;
  /** 일반적인 추가접종 간격(개월). 수의사 지시가 우선 */
  intervalMonths: number;
}

// 순서 중요: 고양이 종합백신을 개 종합백신보다 먼저 판별
const DEFS: VaccineDef[] = [
  { name: '종합백신(FVRCP)', match: /fvrcp|fvrc|고양이\s*종합|3종/i, intervalMonths: 12 },
  { name: '종합백신(DHPPL)', match: /dhpp|dhppl|da2pp|종합\s*백신(?!.*fvrcp)|5종|6종/i, intervalMonths: 12 },
  { name: '광견병', match: /rabies|광견/i, intervalMonths: 12 },
  { name: '코로나 장염', match: /corona|코로나/i, intervalMonths: 12 },
  { name: '켄넬코프', match: /kennel|켄넬|기관지염|bordetella/i, intervalMonths: 12 },
  { name: '인플루엔자', match: /influenza|인플루엔자|신종플루/i, intervalMonths: 12 },
  { name: '백혈병(FeLV)', match: /felv|백혈병/i, intervalMonths: 12 },
];

export function normalizeVaccineName(raw: string): string {
  const t = raw.trim();
  const def = DEFS.find((d) => d.match.test(t));
  return def ? def.name : t;
}

export function vaccineIntervalMonths(name: string): number | null {
  const def = DEFS.find((d) => d.name === name || d.match.test(name));
  return def ? def.intervalMonths : null;
}
