const pad = (n: number) => String(n).padStart(2, '0');

function valid(y: number, m: number, d: number): boolean {
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/**
 * 다양한 날짜 표기 → YYYY-MM-DD (못 읽으면 null)
 * 2025-03-02, 2025.3.2, 2025/03/02, 25.03.02, 2025년 3월 2일, 20250302
 */
export function normalizeDate(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const s = input.trim().replace(/\s+/g, '');
  let m = /^(\d{4})[-./년](\d{1,2})[-./월](\d{1,2})일?\.?$/.exec(s);
  if (!m) m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  let y: number, mo: number, d: number;
  if (m) {
    [y, mo, d] = [+m[1], +m[2], +m[3]];
  } else {
    const short = /^(\d{2})[-./](\d{1,2})[-./](\d{1,2})\.?$/.exec(s);
    if (!short) return null;
    [y, mo, d] = [2000 + +short[1], +short[2], +short[3]];
  }
  return valid(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
}

export function toKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addMonthsKey(key: string, months: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1 + months, 1);
  const last = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
  dt.setDate(Math.min(d, last));
  return toKey(dt);
}
