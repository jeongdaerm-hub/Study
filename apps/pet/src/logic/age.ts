/** 생일 → '3살 2개월' / '5개월' / '' */
export function ageText(birthDate: string, today = new Date()): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!m) return '';
  const b = new Date(+m[1], +m[2] - 1, +m[3]);
  if (b > today) return '';
  let months = (today.getFullYear() - b.getFullYear()) * 12 + (today.getMonth() - b.getMonth());
  if (today.getDate() < b.getDate()) months -= 1;
  const y = Math.floor(months / 12);
  const mo = months % 12;
  if (y === 0) return `${mo}개월`;
  return mo ? `${y}살 ${mo}개월` : `${y}살`;
}
