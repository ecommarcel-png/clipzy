// Polish plural forms: 1 usterkę, 2–4 usterki, 5+ usterek (but 12–14 usterek, 22–24 usterki).
export function plural(n: number, one: string, few: string, many: string) {
  if (n === 1) return one;
  const last = n % 10;
  const lastTwo = n % 100;
  return last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? few : many;
}
