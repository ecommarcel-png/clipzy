// Speech-to-text often misspells brand names ("Depli" -> "Depily"). Captions and
// on-screen texts must show the brand exactly as written in the brand profile.

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/\u0142/g, "l");

function distance(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

export function fixBrandName(text: string, brand: string): string {
  const name = brand.trim();
  // only single-word brands of 4+ letters: short or multi-word names are too easy to get wrong
  if (!name || /\s/.test(name) || name.length < 4) return text;
  const target = norm(name);
  return text.replace(/[\p{L}]+/gu, (word) => {
    const w = norm(word);
    if (w === target) return word === name ? word : name;
    if (Math.abs(w.length - target.length) > 1 || w.length < 4) return word;
    if (w.slice(0, 3) !== target.slice(0, 3)) return word;
    return distance(w, target) <= (target.length >= 6 ? 2 : 1) + (w.length > target.length ? 1 : 0) ? name : word;
  });
}
