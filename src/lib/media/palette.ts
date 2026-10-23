import "server-only";

// Brand colours straight from the logo: the most common saturated hues.
// (Shop CSS is full of "sale" reds and UI greys; the logo is the identity.)

function rgbToHsl(r: number, g: number, b: number) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  h *= 60;
  return { h, s, l };
}

const hex = (n: number) => Math.round(n).toString(16).padStart(2, "0");

export function paletteFromPixels(data: Uint8Array | Buffer, channels: number, max = 3): string[] {
  const bins = new Map<number, { n: number; r: number; g: number; b: number }>();
  let total = 0;
  for (let i = 0; i < data.length; i += channels) {
    const a = channels === 4 ? data[i + 3] : 255;
    if (a < 200) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const { h, s, l } = rgbToHsl(r, g, b);
    total++;
    if (s < 0.08 || l < 0.12 || l > 0.93) continue; // greys (s < 0.08), black, white — muted brand tones like sage stay
    const key = Math.floor(h / 15); // 24 hue bins
    const bin = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bin.n++;
    bin.r += r;
    bin.g += g;
    bin.b += b;
    bins.set(key, bin);
  }
  // merge neighbouring bins into the stronger one, so one hue is not split in two
  const sorted = [...bins.entries()].sort((a, b) => b[1].n - a[1].n);
  const picked: Array<{ key: number; n: number; r: number; g: number; b: number }> = [];
  for (const [key, bin] of sorted) {
    const near = picked.find((p) => Math.min(Math.abs(p.key - key), 24 - Math.abs(p.key - key)) <= 1);
    if (near) {
      near.n += bin.n;
      continue;
    }
    if (bin.n < Math.max(4, total * 0.01)) continue; // stray anti-aliasing pixels
    picked.push({ key, ...bin });
  }
  return picked
    .sort((a, b) => b.n - a.n)
    .slice(0, max)
    .map((p) => `#${hex(p.r / (bins.get(p.key)?.n ?? 1))}${hex(p.g / (bins.get(p.key)?.n ?? 1))}${hex(p.b / (bins.get(p.key)?.n ?? 1))}`);
}

export async function logoPalette(image: Buffer): Promise<string[]> {
  try {
    // loaded on use: if the image library is missing on a server, only the swatches are lost
    const sharp = (await import("sharp")).default;
    const { data, info } = await sharp(image, { density: 72 }).resize(160, 160, { fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return paletteFromPixels(data, info.channels);
  } catch {
    return [];
  }
}
