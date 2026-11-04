// Colour helpers for the ad layouts. Pure.

const HEX = /^#([0-9a-f]{6})$/i;

export function isHex(c: unknown): c is string {
  return typeof c === "string" && HEX.test(c);
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;

/** WCAG relative luminance, 0 (black) – 1 (white). */
export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Text colour that reads on this background. */
export function inkOn(bg: string): string {
  return contrast(bg, "#ffffff") >= contrast(bg, "#111111") ? "#ffffff" : "#111111";
}

/** Mix with white (amount > 0) or black (amount < 0). */
export function shade(hex: string, amount: number): string {
  const [r, g, b] = rgb(hex);
  const t = amount > 0 ? 255 : 0;
  const k = Math.abs(amount);
  return toHex(r + (t - r) * k, g + (t - g) * k, b + (t - b) * k);
}

export function alpha(hex: string, a: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** An accent that stands out on the background: darkened/lightened until it does. */
export function readableAccent(accent: string, bg: string): string {
  let c = accent;
  const dark = luminance(bg) < 0.4;
  for (let i = 0; i < 6 && contrast(c, bg) < 3; i++) c = shade(c, dark ? 0.18 : -0.18);
  return c;
}

function hue(hex: string): { h: number; s: number; l: number } {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = (max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
  return { h, s, l };
}

/** Strong red — the shop's "sale" colour, not the brand's (unless the logo itself is red). */
export function isSaleRed(hex: string): boolean {
  const { h, s } = hue(hex);
  return (h >= 340 || h <= 12) && s > 0.45;
}

/** Accent colours for the ads: logo colours first, then the brand profile; no near-white/black, no sale reds. */
export function brandPalette(profile: { accent?: string; primary?: string; secondary?: string }, logo: string[]): string[] {
  const fromLogo = logo.filter(isHex).map((c) => c.toLowerCase());
  const fromProfile = [profile.accent, profile.primary, profile.secondary].filter(isHex).map((c) => c.toLowerCase()).filter((c) => !isSaleRed(c));
  const usable = (c: string) => luminance(c) > 0.02 && luminance(c) < 0.88;
  const out = [...new Set([...fromLogo, ...fromProfile])].filter(usable);
  return out.length ? out : ["#ff5a36"];
}
