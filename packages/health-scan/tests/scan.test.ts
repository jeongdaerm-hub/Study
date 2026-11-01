import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addMonthsKey,
  buildImportPlan,
  demoScanResult,
  normalizeDate,
  normalizeVaccineName,
  sanitizeScan,
  summarize,
  type ExistingRecords,
} from '../src/index.ts';

const TODAY = '2026-11-01';
const empty: ExistingRecords = { visits: [], labs: [], vaccines: [], schedules: [] };

test('normalizeDate: 다양한 표기', () => {
  assert.equal(normalizeDate('2025-03-02'), '2025-03-02');
  assert.equal(normalizeDate('2025.3.2'), '2025-03-02');
  assert.equal(normalizeDate('2025/03/02'), '2025-03-02');
  assert.equal(normalizeDate('25.03.02'), '2025-03-02');
  assert.equal(normalizeDate('2025년 3월 2일'), '2025-03-02');
  assert.equal(normalizeDate('20250302'), '2025-03-02');
  for (const bad of ['2025-02-30', '2025-13-01', 'abc', '', null, 20250302, '1800-01-01']) {
    assert.equal(normalizeDate(bad as unknown), null, String(bad));
  }
});

test('normalizeVaccineName', () => {
  assert.equal(normalizeVaccineName('DHPPL 5차'), '종합백신(DHPPL)');
  assert.equal(normalizeVaccineName('고양이 종합백신'), '종합백신(FVRCP)');
  assert.equal(normalizeVaccineName('Rabies'), '광견병');
  assert.equal(normalizeVaccineName('켄넬코프(KC)'), '켄넬코프');
  assert.equal(normalizeVaccineName('심장사상충 검사'), '심장사상충 검사');
});

test('addMonthsKey: 말일 보정', () => {
  assert.equal(addMonthsKey('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonthsKey('2025-11-01', 12), '2026-11-01');
});

test('sanitizeScan: 형식 오류·미래 날짜·과도한 입력 정제', () => {
  const out = sanitizeScan(
    {
      documentType: 'hack',
      petName: '다로\u0000',
      vaccines: [
        { name: 'DHPPL', date: '2025.11.01', nextDate: '2026.11.01', hospital: 'A', confidence: 'high' },
        { name: 'DHPPL', date: '2025.11.01', nextDate: null, hospital: 'A' }, // 같은 사진 내 중복
        { name: '광견병', date: '2027-01-01', nextDate: null, hospital: '' }, // 미래 접종일
        { name: '', date: '2025-01-01' }, // 이름 없음
        { name: '켄넬', date: '2025-05-05', nextDate: '2025-01-01' }, // 다음 접종일이 과거 → null
        'garbage',
      ],
      visits: [
        { date: '2026-10-01', hospital: '다로병원', reason: '<script>x</script>', diagnosis: 'a'.repeat(500), treatment: '', cost: '68,000', confidence: 'medium' },
        { date: 'nope', reason: 'x' },
      ],
      labs: [
        {
          date: '2026-10-12',
          title: '',
          items: [
            { name: 'BUN', value: '31', unit: 'mg/dL', refMin: 7, refMax: 27 },
            { name: 'CREA', value: 'positive', unit: '' },
            { name: 'ALT', value: 62, unit: 'U/L', refMin: 125, refMax: 10 },
            { name: 'bun', value: 1, unit: '' },
          ],
        },
        { date: '2026-10-12', items: [] },
      ],
      followUps: [{ date: '2026-11-20', title: '', type: 'weird' }],
      warnings: ['흐림', 42],
    },
    TODAY,
  );
  assert.ok(out);
  const r = out.result;
  assert.equal(r.documentType, 'other');
  assert.equal(r.petName, '다로');
  assert.deepEqual(r.vaccines.map((v) => [v.name, v.date, v.nextDate, v.confidence]), [
    ['종합백신(DHPPL)', '2025-11-01', '2026-11-01', 'high'],
    ['켄넬코프', '2025-05-05', null, 'low'],
  ]);
  assert.equal(r.visits.length, 1);
  assert.equal(r.visits[0].cost, 68000);
  assert.equal(r.visits[0].diagnosis.length, 300);
  assert.equal(r.visits[0].reason, '<script>x</script>'); // 글자 그대로 보관 (표시할 때 텍스트로만 렌더링)
  assert.equal(r.labs.length, 1);
  assert.deepEqual(r.labs[0].items.map((i) => [i.name, i.value, i.refMin, i.refMax]), [
    ['BUN', 31, 7, 27],
    ['ALT', 62, null, null],
  ]);
  assert.equal(r.labs[0].title, '검사');
  assert.deepEqual(r.followUps, [{ date: '2026-11-20', type: 'hospital', title: '병원 방문', confidence: 'low' }]);
  assert.deepEqual(r.warnings, ['흐림']);
  assert.ok(out.dropped >= 6);
  assert.equal(sanitizeScan('[]', TODAY), null);
  assert.equal(sanitizeScan(null, TODAY), null);
});

test('buildImportPlan: 중복 해제, 최신 접종에만 다음 일정, 추정 표시', () => {
  const scan = sanitizeScan(
    {
      documentType: 'vaccination_record',
      petName: '초코',
      vaccines: [
        { name: 'DHPPL', date: '2024-10-01', nextDate: '2025-10-01', hospital: 'A', confidence: 'high' },
        { name: 'DHPPL', date: '2025-10-05', nextDate: null, hospital: 'A', confidence: 'high' },
        { name: '광견병', date: '2025-06-01', nextDate: null, hospital: 'A', confidence: 'low' },
        { name: '코로나', date: '2025-03-03', nextDate: '2026-03-03', hospital: 'A', confidence: 'high' },
      ],
      visits: [{ date: '2026-09-01', hospital: 'A병원', reason: '피부', diagnosis: '', treatment: '', cost: null, confidence: 'high' }],
      labs: [],
      followUps: [
        { date: '2026-12-01', title: '피부 재진', type: 'hospital', confidence: 'high' },
        { date: '2026-01-01', title: '지난 일정', type: 'hospital', confidence: 'high' },
      ],
      warnings: [],
    },
    TODAY,
  )!.result;
  const existing: ExistingRecords = {
    visits: [{ date: '2026-09-01', hospital: 'A 병원', reason: '정기검진' }],
    labs: [],
    vaccines: [
      { name: '광견병', date: '2025-06-01' }, // 이미 있음
      { name: '코로나 장염', date: '2026-03-10' }, // 스캔본보다 최신
    ],
    schedules: [],
  };
  const plan = buildImportPlan(scan, existing, { todayKey: TODAY, petName: '다로' });
  const vac = plan.items.filter((i) => i.kind === 'vaccine');
  const byDate = Object.fromEntries(vac.map((v) => [`${v.data.name}@${v.data.date}`, v]));
  const old = byDate['종합백신(DHPPL)@2024-10-01'];
  const latest = byDate['종합백신(DHPPL)@2025-10-05'];
  const rabies = byDate['광견병@2025-06-01'];
  const corona = byDate['코로나 장염@2025-03-03'];
  assert.equal(old.kind === 'vaccine' && old.data.nextDate, null); // 예전 접종: 다음 일정 만들지 않음
  assert.equal(latest.kind === 'vaccine' && latest.data.nextDate, '2026-10-05');
  assert.equal(latest.kind === 'vaccine' && latest.nextEstimated, true);
  assert.equal(rabies.duplicate, true);
  assert.equal(rabies.selected, false);
  assert.equal(rabies.lowConfidence, true);
  assert.equal(corona.kind === 'vaccine' && corona.data.nextDate, null); // 기존에 더 최근 기록 있음
  const visit = plan.items.find((i) => i.kind === 'visit')!;
  assert.equal(visit.duplicate, true); // 같은 날 같은 병원
  assert.equal(plan.items.filter((i) => i.kind === 'followUp').length, 1);
  assert.equal(plan.skippedPastFollowUps, 1);
  assert.equal(plan.petNameMismatch, '초코');
  assert.deepEqual(summarize(plan.items), { vaccine: 3, visit: 0, lab: 0, followUp: 1 }); // 4건 중 중복 1건 해제
});

test('demoScanResult 는 검증을 통과', () => {
  const out = sanitizeScan(demoScanResult(TODAY), TODAY);
  assert.ok(out);
  assert.equal(out.dropped, 0);
  assert.equal(out.result.vaccines.length, 4);
});
