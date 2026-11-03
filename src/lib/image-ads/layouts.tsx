import type { CSSProperties, ReactNode } from "react";
import { AD_SIZE, fitFont, type AdFormat, type AdStyle, type Fields, type TemplateKey } from "./templates";
import { alpha, inkOn, luminance, readableAccent, shade } from "./colors";
import { Icon } from "./icons";

// Image ad layouts, drawn with the subset of CSS that next/og (satori) renders:
// flexbox, absolute positioning, gradients, shadows, rotation. Every element with
// more than one child is display:flex. 1:1 and 9:16 come from the same layout.

export type AdBrand = { name: string; logo: string | null; colors: { primary: string; secondary: string; accent: string } };
export type LayoutInput = {
  template: TemplateKey;
  fields: Fields;
  style: AdStyle;
  brand: AdBrand;
  /** data URLs of the photos from fal, in slot order (null = not ready) */
  photos: Array<string | null>;
  /** product without background */
  cutout: string | null;
  format: AdFormat;
};

type Pal = { bg: string; panel: string; ink: string; muted: string; accent: string; accentInk: string; dark: boolean };

function palette(st: AdStyle, brand: AdBrand): Pal {
  let bg = "#ffffff";
  if (st.theme === "dark") bg = "#100e14";
  if (st.theme === "brand") {
    const p = brand.colors.primary;
    const l = luminance(p);
    bg = l > 0.85 ? shade(st.accent, 0.9) : l < 0.02 ? "#100e14" : p;
  }
  const dark = luminance(bg) < 0.35;
  const accent = readableAccent(st.accent, bg);
  return {
    bg,
    panel: dark ? shade(bg, 0.08) : shade(st.accent, 0.92),
    ink: dark ? "#ffffff" : "#121014",
    muted: dark ? "rgba(255,255,255,0.78)" : "rgba(18,16,20,0.72)",
    accent,
    accentInk: inkOn(accent),
    dark,
  };
}

const FONT = {
  anton: { fontFamily: "Anton", fontWeight: 400, upper: true, lh: 1.08, glyph: "anton" as const },
  inter: { fontFamily: "Inter", fontWeight: 900, upper: false, lh: 1.06, glyph: "inter" as const },
  bricolage: { fontFamily: "Bricolage", fontWeight: 800, upper: false, lh: 1.04, glyph: "bricolage" as const },
};

const norm = (w: string) => w.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/ł/g, "l").replace(/[^\p{L}\p{N}%+-]/gu, "");

// ---------- primitives ----------

function Headline({ text, st, pal, width, lines, max, min, color, align = "left", font }: {
  text: string; st: AdStyle; pal: Pal; width: number; lines: number; max: number; min: number; color?: string; align?: "left" | "center"; font?: AdStyle["font"];
}) {
  const f = FONT[font ?? st.font];
  const size = fitFont(text, { font: f.glyph, width, lines, max, min, upper: f.upper });
  const marks = new Set(st.highlight.flatMap((h) => h.split(/\s+/)).map(norm).filter(Boolean));
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", width, justifyContent: align === "center" ? "center" : "flex-start", fontFamily: f.fontFamily, fontWeight: f.fontWeight, fontSize: size, lineHeight: f.lh, letterSpacing: f.upper ? 0.5 : -1 }}>
      {words.map((w, i) => (
        <span key={i} style={{ color: marks.has(norm(w)) ? pal.accent : color ?? pal.ink, marginRight: i < words.length - 1 ? size * 0.24 : 0, textTransform: f.upper ? "uppercase" : "none" }}>{w}</span>
      ))}
    </div>
  );
}

function Text({ children, size, color, weight = 600, width, align = "left", lh = 1.25, family = "Inter", style }: {
  children: ReactNode; size: number; color: string; weight?: number; width?: number; align?: "left" | "center" | "right"; lh?: number; family?: string; style?: CSSProperties;
}) {
  return <div style={{ display: "flex", fontFamily: family, fontWeight: weight, fontSize: size, color, lineHeight: lh, ...(width ? { width } : {}), textAlign: align, justifyContent: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start", ...style }}>{children}</div>;
}

function Cta({ text, pal, size = 34 }: { text: string; pal: Pal; size?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.4, background: pal.accent, color: pal.accentInk, fontFamily: "Inter", fontWeight: 800, fontSize: size, padding: `${size * 0.5}px ${size * 1.1}px`, borderRadius: 999, boxShadow: `0 ${size * 0.3}px ${size}px ${alpha("#000000", 0.25)}` }}>
      <span>{text}</span>
      <span style={{ fontSize: size * 1.1, marginTop: -size * 0.08 }}>›</span>
    </div>
  );
}

function Badge({ text, pal, size = 190, rotate = -10 }: { text: string; pal: Pal; size?: number; rotate?: number }) {
  if (!text) return null;
  const fs = fitFont(text, { font: "inter", width: size * 0.78, lines: 2, max: size * 0.3, min: size * 0.12 });
  return (
    <div style={{ display: "flex", width: size, height: size, borderRadius: size, background: pal.accent, color: pal.accentInk, alignItems: "center", justifyContent: "center", transform: `rotate(${rotate}deg)`, boxShadow: `0 12px 36px ${alpha("#000000", 0.3)}`, border: "6px solid #ffffff" }}>
      <div style={{ display: "flex", fontFamily: "Inter", fontWeight: 900, fontSize: fs, lineHeight: 1, textAlign: "center", width: size * 0.8, justifyContent: "center" }}>{text}</div>
    </div>
  );
}

function Logo({ brand, pal, height = 54, onPhoto = false }: { brand: AdBrand; pal: Pal; height?: number; onPhoto?: boolean }) {
  if (brand.logo) {
    // eslint-disable-next-line @next/next/no-img-element
    const img = <img src={brand.logo} alt="" height={height} style={{ height, objectFit: "contain", maxWidth: height * 5 }} />;
    return onPhoto ? <div style={{ display: "flex", background: "rgba(255,255,255,0.92)", borderRadius: 16, padding: "10px 18px" }}>{img}</div> : img;
  }
  return <Text size={height * 0.62} weight={900} color={onPhoto ? "#ffffff" : pal.ink} style={{ letterSpacing: -0.5 }}>{brand.name}</Text>;
}

function Photo({ src, width, height, radius = 0, focus = "center", style }: { src: string | null; width: number | string; height: number | string; radius?: number; focus?: AdStyle["focus"]; style?: CSSProperties }) {
  if (!src) return <div style={{ display: "flex", width, height, borderRadius: radius, backgroundImage: "linear-gradient(135deg, #2a2730, #4a4652)", ...style }} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" style={{ width, height, objectFit: "cover", objectPosition: focus, borderRadius: radius, ...style }} />;
}

function Product({ src, fallback, width, height, focus }: { src: string | null; fallback: string | null; width: number; height: number; focus?: AdStyle["focus"] }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={width} height={height} style={{ width, height, objectFit: "contain" }} />;
  }
  return <Photo src={fallback} width={width} height={height} radius={36} focus={focus} style={{ boxShadow: "0 24px 60px rgba(0,0,0,0.28)" }} />;
}

function BenefitRow({ b, pal, size, width, onDark }: { b: { icon: Fields<"hero_benefits">["benefits"][number]["icon"]; text: string }; pal: Pal; size: number; width: number; onDark?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.55, width }}>
      <div style={{ display: "flex", width: size * 1.9, height: size * 1.9, borderRadius: size * 2, background: pal.accent, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon name={b.icon} size={size * 1.05} color={pal.accentInk} width={2.4} />
      </div>
      <Text size={size} weight={700} color={onDark ? "#ffffff" : pal.ink} lh={1.2} width={width - size * 2.5}>{b.text}</Text>
    </div>
  );
}

function Fill({ style, children }: { style?: CSSProperties; children?: ReactNode }) {
  return <div style={{ display: "flex", position: "absolute", left: 0, top: 0, right: 0, bottom: 0, ...style }}>{children}</div>;
}

function At({ children, style }: { children: ReactNode; style: CSSProperties }) {
  return <div style={{ display: "flex", position: "absolute", ...style }}>{children}</div>;
}

const shadeOver = (dark: boolean, dir: string, a = 0.92, b = 0.0, stop = 62) =>
  `linear-gradient(${dir}, ${alpha(dark ? "#0c0a10" : "#ffffff", a)} 0%, ${alpha(dark ? "#0c0a10" : "#ffffff", a * 0.75)} ${stop * 0.6}%, ${alpha(dark ? "#0c0a10" : "#ffffff", b)} ${stop}%)`;

const NOTE_COLORS = ["#ffe873", "#ffb3c7", "#a9e4ff", "#c8f5a8"];

// ---------- layouts ----------

type L<K extends TemplateKey> = { f: Fields<K>; st: AdStyle; pal: Pal; b: AdBrand; P: Array<string | null>; cut: string | null; W: number; H: number; tall: boolean };

// 9:16 is also shown in Reels and Stories: their buttons cover the top and bottom of the screen,
// so text and CTAs stay inside this safe area.
const ST = 230;
const SB = 290;

function HeroBenefits({ f, st, pal, b, P, W, H, tall }: L<"hero_benefits">) {
  if (tall) {
    return (
      <Fill style={{ flexDirection: "column", background: pal.bg }}>
        <div style={{ display: "flex", flexDirection: "column", padding: `${ST}px 70px 40px`, gap: 18 }}>
          {f.eyebrow ? <Text size={40} weight={800} color={pal.accent} style={{ textTransform: "uppercase", letterSpacing: 2 }}>{f.eyebrow}</Text> : null}
          <Headline text={f.headline} st={st} pal={pal} width={W - 140} lines={3} max={150} min={72} />
        </div>
        <div style={{ display: "flex", position: "relative", width: W, flex: 1 }}>
          <Photo src={P[0]} width="100%" height="100%" focus={st.focus} />
          <Fill style={{ backgroundImage: `linear-gradient(0deg, ${alpha(pal.bg, 0.97)} 0%, ${alpha(pal.bg, 0.8)} 30%, ${alpha(pal.bg, 0)} 58%)` }} />
          <At style={{ left: 50, top: 40 }}><Logo brand={b} pal={pal} height={50} onPhoto /></At>
          {f.badge ? <At style={{ right: 50, top: 40 }}><Badge text={f.badge} pal={pal} size={230} /></At> : null}
          <At style={{ left: 70, right: 70, bottom: 30, flexWrap: "wrap", rowGap: 26, columnGap: 30 }}>
            {f.benefits.map((x, i) => <BenefitRow key={i} b={x} pal={pal} size={38} width={(W - 170) / 2} />)}
          </At>
        </div>
        <div style={{ display: "flex", justifyContent: "center", padding: `36px 70px ${SB}px` }}><Cta text={f.cta} pal={pal} size={50} /></div>
      </Fill>
    );
  }
  return (
    <Fill style={{ background: pal.bg }}>
      <Photo src={P[0]} width={W} height={H} focus={st.focus} />
      <Fill style={{ backgroundImage: shadeOver(pal.dark, "90deg", 0.95, 0, 70) }} />
      <At style={{ left: 64, top: 60, width: 600, flexDirection: "column", gap: 22 }}>
        <Logo brand={b} pal={pal} height={48} />
        {f.eyebrow ? <Text size={28} weight={800} color={pal.accent} style={{ textTransform: "uppercase", letterSpacing: 2 }}>{f.eyebrow}</Text> : null}
        <Headline text={f.headline} st={st} pal={pal} width={600} lines={3} max={104} min={52} />
        <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 14 }}>
          {f.benefits.map((x, i) => <BenefitRow key={i} b={x} pal={pal} size={28} width={600} />)}
        </div>
      </At>
      <At style={{ left: 64, bottom: f.trust.length ? 118 : 60 }}><Cta text={f.cta} pal={pal} size={36} /></At>
      {f.badge ? <At style={{ right: 56, top: 56 }}><Badge text={f.badge} pal={pal} size={190} /></At> : null}
      {f.trust.length ? (
        <At style={{ left: 0, right: 0, bottom: 0, height: 86, background: pal.dark ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.9)", justifyContent: "center", alignItems: "center", gap: 36 }}>
          {f.trust.map((t, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Icon name="check" size={26} color={pal.accent} width={3} />
              <Text size={25} weight={700} color={pal.ink}>{t}</Text>
            </div>
          ))}
        </At>
      ) : null}
    </Fill>
  );
}

function Tag({ text, bg, color, size, rotate = -3 }: { text: string; bg: string; color: string; size: number; rotate?: number }) {
  return (
    <div style={{ display: "flex", background: bg, color, fontFamily: "Anton", fontSize: size, lineHeight: 1.1, padding: `${size * 0.14}px ${size * 0.42}px`, transform: `rotate(${rotate}deg)`, borderRadius: 10, boxShadow: "0 10px 30px rgba(0,0,0,0.35)", textTransform: "uppercase", letterSpacing: 1 }}>
      {text}
    </div>
  );
}

function Halves({ P, st, f, pal, W, height, size }: { P: Array<string | null>; st: AdStyle; f: Fields<"before_after">; pal: Pal; W: number; height: number | string; size: number }) {
  return (
    <div style={{ display: "flex", position: "relative", width: W, height }}>
      <Photo src={P[0]} width={W / 2} height="100%" focus={st.focus} />
      <Photo src={P[1]} width={W / 2} height="100%" focus={st.focus} />
      <At style={{ left: W / 2 - 4, top: 0, bottom: 0, width: 8, background: "#ffffff" }}><div style={{ display: "flex" }} /></At>
      <At style={{ left: 40, top: 40 }}><Tag text={f.before_label} bg="#e5312b" color="#ffffff" size={size} /></At>
      <At style={{ right: 40, top: 40 }}><Tag text={f.after_label} bg={pal.accent} color={pal.accentInk} size={size} rotate={3} /></At>
    </div>
  );
}

function BeforeAfter({ f, st, pal, b, P, cut, W, H, tall }: L<"before_after">) {
  if (tall) {
    const prodH = 620;
    return (
      <Fill style={{ flexDirection: "column", background: pal.bg }}>
        <div style={{ display: "flex", flexDirection: "column", padding: `${ST}px 70px 40px`, gap: 18 }}>
          <Headline text={f.headline} st={st} pal={pal} width={W - 140} lines={3} max={140} min={68} />
        </div>
        <div style={{ display: "flex", position: "relative", width: W, flex: 1 }}>
          <Halves P={P} st={st} f={f} pal={pal} W={W} height="100%" size={84} />
          {cut ? <At style={{ left: (W - prodH * 0.8) / 2, bottom: 20, width: prodH * 0.8, height: prodH }}><Product src={cut} fallback={null} width={prodH * 0.8} height={prodH} /></At> : null}
          {f.badge ? <At style={{ right: 46, bottom: 60 }}><Badge text={f.badge} pal={pal} size={210} /></At> : null}
          <At style={{ left: 40, bottom: 40 }}><Logo brand={b} pal={pal} height={46} onPhoto /></At>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 34, padding: `40px 70px ${SB}px` }}>
          {f.benefits.length ? (
            <div style={{ display: "flex", flexWrap: "wrap", rowGap: 24, columnGap: 30, width: W - 140 }}>
              {f.benefits.map((x, i) => <BenefitRow key={i} b={x} pal={pal} size={36} width={(W - 170) / 2} />)}
            </div>
          ) : null}
          <Cta text={f.cta} pal={pal} size={50} />
        </div>
      </Fill>
    );
  }
  const prodH = 470;
  return (
    <Fill style={{ background: pal.bg }}>
      <At style={{ left: 0, top: 0 }}><Halves P={P} st={st} f={f} pal={pal} W={W} height={H} size={66} /></At>
      <Fill style={{ backgroundImage: "linear-gradient(0deg, rgba(8,6,12,0.92) 0%, rgba(8,6,12,0.7) 24%, rgba(8,6,12,0) 46%)" }} />
      {cut ? <At style={{ left: (W - prodH * 0.8) / 2, top: H * 0.3, width: prodH * 0.8, height: prodH }}><Product src={cut} fallback={null} width={prodH * 0.8} height={prodH} /></At> : null}
      <At style={{ left: 60, right: 60, bottom: 50, flexDirection: "column", alignItems: "center", gap: 22 }}>
        <Headline text={f.headline} st={st} pal={{ ...pal, ink: "#ffffff" }} width={W - 120} lines={2} max={88} min={46} align="center" />
        <Cta text={f.cta} pal={pal} size={34} />
      </At>
      {f.badge ? <At style={{ right: 60, top: 170 }}><Badge text={f.badge} pal={pal} size={170} /></At> : null}
    </Fill>
  );
}

function Callouts({ f, st, pal, b, P, cut, W, tall }: L<"callouts">) {
  const prodW = tall ? 620 : 470;
  const prodH = tall ? 780 : 560;
  const prodTop = tall ? 640 : 300;
  const cx = (W - prodW) / 2;
  const left = f.callouts.filter((_, i) => i % 2 === 0);
  const right = f.callouts.filter((_, i) => i % 2 === 1);
  const col = (list: string[], side: "l" | "r") => (
    <At style={{ [side === "l" ? "left" : "right"]: 46, top: prodTop + 40, height: prodH - 80, width: tall ? 290 : 250, flexDirection: "column", justifyContent: "space-around" }}>
      {list.map((t, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: side === "l" ? "flex-start" : "flex-end", gap: 10 }}>
          <Text size={tall ? 40 : 30} weight={800} color={pal.ink} align={side === "l" ? "left" : "right"} lh={1.18} width={tall ? 290 : 250}>{t}</Text>
          <div style={{ display: "flex", alignItems: "center", flexDirection: side === "l" ? "row" : "row-reverse" }}>
            <div style={{ display: "flex", width: tall ? 170 : 110, height: 3, background: pal.ink, opacity: 0.6 }} />
            <div style={{ display: "flex", width: 18, height: 18, borderRadius: 18, background: pal.accent }} />
          </div>
        </div>
      ))}
    </At>
  );
  return (
    <Fill style={{ background: pal.dark ? pal.bg : `linear-gradient(180deg, ${shade(st.accent, 0.93)} 0%, #ffffff 100%)` }}>
      <At style={{ left: 60, top: tall ? ST : 54, right: 60, flexDirection: "column", alignItems: "center", gap: 16 }}>
        <Logo brand={b} pal={pal} height={tall ? 52 : 44} />
        <Headline text={f.headline} st={st} pal={pal} width={W - 120} lines={2} max={tall ? 120 : 84} min={46} align="center" />
        {f.subheadline ? <Text size={tall ? 40 : 30} weight={500} color={pal.muted} align="center" width={W - 160}>{f.subheadline}</Text> : null}
      </At>
      <At style={{ left: cx, top: prodTop, width: prodW, height: prodH }}>
        <Product src={cut} fallback={P[0]} width={prodW} height={prodH} focus={st.focus} />
      </At>
      {col(left, "l")}
      {col(right, "r")}
      <At style={{ left: 0, right: 0, bottom: tall ? SB : 46, justifyContent: "center" }}><Cta text={f.cta} pal={pal} size={tall ? 50 : 34} /></At>
      {f.badge ? <At style={tall ? { right: 50, top: prodTop - 60 } : { right: 50, bottom: 30 }}><Badge text={f.badge} pal={pal} size={tall ? 210 : 160} /></At> : null}
    </Fill>
  );
}

function UsVsThem({ f, st, pal, b, P, cut, W, tall }: L<"us_vs_them">) {
  const cardW = (W - 150) / 2;
  const rowSize = tall ? 34 : 25;
  const prodH = tall ? 440 : 260;
  const card = (ours: boolean) => (
    <div style={{ display: "flex", flexDirection: "column", width: cardW, borderRadius: 36, background: ours ? pal.accent : pal.dark ? "#2a2730" : "#eceaf0", padding: `${ours ? prodH * 0.62 : 40}px 30px 40px`, gap: tall ? 30 : 16, boxShadow: ours ? `0 24px 60px ${alpha(pal.accent, 0.4)}` : "none" }}>
      <Text size={tall ? 52 : 36} weight={900} color={ours ? pal.accentInk : pal.muted} align="center" width={cardW - 60}>{ours ? f.ours_label : f.theirs_label}</Text>
      {f.rows.map((r, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, borderTop: `2px solid ${alpha(ours ? pal.accentInk : "#000000", 0.14)}`, paddingTop: tall ? 26 : 14 }}>
          <Icon name={ours ? "check" : "cross"} size={rowSize * 1.2} color={ours ? pal.accentInk : "#e5312b"} width={3} />
          <Text size={rowSize} weight={ours ? 800 : 600} color={ours ? pal.accentInk : pal.muted} width={cardW - 60 - rowSize * 1.7} lh={1.2}>{ours ? r.ours : r.theirs}</Text>
        </div>
      ))}
    </div>
  );
  return (
    <Fill style={{ background: pal.dark ? pal.bg : shade(st.accent, 0.95), flexDirection: "column", alignItems: "center", justifyContent: tall ? "space-between" : "flex-start", padding: tall ? `${ST}px 50px ${SB}px` : "50px 50px", gap: tall ? 40 : 30 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <Logo brand={b} pal={pal} height={tall ? 52 : 44} />
        <Headline text={f.headline} st={st} pal={pal} width={W - 120} lines={2} max={tall ? 110 : 76} min={44} align="center" />
      </div>
      <div style={{ display: "flex", gap: 50, alignItems: "flex-end", position: "relative", marginTop: prodH * 0.45 }}>
        {card(false)}
        {card(true)}
        <At style={{ right: (cardW - prodH * 0.75) / 2, top: -prodH * 0.5, width: prodH * 0.75, height: prodH }}>
          <Product src={cut} fallback={P[0]} width={prodH * 0.75} height={prodH} focus={st.focus} />
        </At>
      </div>
      <div style={{ display: "flex" }}><Cta text={f.cta} pal={pal} size={tall ? 50 : 32} /></div>
    </Fill>
  );
}

function Note({ text, i, size, width }: { text: string; i: number; size: number; width: number }) {
  const rot = [-5, 4, -2, 6][i % 4];
  return (
    <div style={{ display: "flex", width, minHeight: width * 0.82, background: NOTE_COLORS[i % NOTE_COLORS.length], padding: size * 0.55, transform: `rotate(${rot}deg)`, boxShadow: "0 18px 40px rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", fontFamily: "Caveat", fontWeight: 700, fontSize: size, lineHeight: 1.05, color: "#1d1b22", textAlign: "center", justifyContent: "center", width: width - size * 1.1 }}>{text}</div>
    </div>
  );
}

function StickyNotes({ f, st, pal, b, P, W, H, tall }: L<"sticky_notes">) {
  const notes = [...f.notes, ...(f.badge ? [f.badge] : [])].slice(0, 4);
  const w = tall ? 440 : 330;
  const size = (t: string) => fitFont(t, { font: "caveat", width: w - 60, lines: 4, max: tall ? 88 : 66, min: 40 });
  const spots = tall
    ? [{ top: f.headline ? 560 : 300, left: 70 }, { top: f.headline ? 640 : 380, right: 70 }, { bottom: SB + 80, left: 80 }, { bottom: SB + 20, right: 80 }]
    : st.focus === "left"
      ? [{ top: 70, right: 70 }, { top: 400, right: 330 }, { bottom: 80, right: 60 }, { bottom: 120, right: 420 }]
      : [{ top: 80, right: 70 }, { top: 420, right: 60 }, { bottom: 90, left: 70 }, { top: 90, left: 70 }];
  return (
    <Fill>
      <Photo src={P[0]} width={W} height={H} focus={st.focus} />
      {f.headline ? (
        <At style={{ left: 0, right: 0, top: 0, padding: tall ? `${ST}px 70px 120px` : "50px 60px 90px", backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0.65), rgba(0,0,0,0))", flexDirection: "column", gap: 16 }}>
          <Logo brand={b} pal={pal} height={44} onPhoto />
          <Headline text={f.headline} st={st} pal={{ ...pal, ink: "#ffffff" }} width={W - 140} lines={2} max={tall ? 110 : 76} min={44} />
        </At>
      ) : <At style={{ left: 50, top: tall ? ST - 40 : 50 }}><Logo brand={b} pal={pal} height={44} onPhoto /></At>}
      {notes.map((t, i) => <At key={i} style={spots[i]}><Note text={t} i={i} size={size(t)} width={w} /></At>)}
    </Fill>
  );
}

function Whiteboard({ f, st, P, W, tall }: L<"whiteboard">) {
  const ink = "#1f2a44";
  const inner = W - 220;
  const head = fitFont(f.headline, { font: "caveat", width: inner - 40, lines: 2, max: tall ? 150 : 110, min: 56, upper: true });
  const lineSize = Math.min(...f.lines.map((t) => fitFont(t, { font: "caveat", width: inner - 40, lines: 1, max: tall ? 96 : 70, min: 40, upper: true })));
  const photo = tall ? { left: 140, top: 950, width: 800, height: 440 } : { left: 60, bottom: 40, width: 440, height: 400 };
  return (
    <Fill style={{ background: "#d9d4cc" }}>
      <At style={{ left: 50, right: 50, top: tall ? ST - 60 : 40, height: tall ? 920 : 700, background: "#fbfbf8", border: "18px solid #b9bcc2", borderRadius: 14, boxShadow: "0 20px 50px rgba(0,0,0,0.25)", flexDirection: "column", alignItems: "center", padding: "40px 50px", gap: tall ? 26 : 18 }}>
        <div style={{ display: "flex", fontFamily: "Caveat", fontWeight: 700, fontSize: head, color: ink, lineHeight: 1, textAlign: "center", justifyContent: "center", width: inner, textTransform: "uppercase" }}>{f.headline}</div>
        <div style={{ display: "flex", width: inner - 80, height: 6, background: "#e5312b", borderRadius: 6, transform: "rotate(-1deg)" }} />
        {f.lines.map((t, i) => <div key={i} style={{ display: "flex", fontFamily: "Caveat", fontWeight: 700, fontSize: lineSize, color: ink, lineHeight: 1.05, textAlign: "center", justifyContent: "center", width: inner, textTransform: "uppercase" }}>{t}</div>)}
      </At>
      <At style={photo}>
        <Photo src={P[0]} width={photo.width} height={photo.height} radius={28} focus={st.focus} style={{ border: "8px solid #ffffff", boxShadow: "0 24px 60px rgba(0,0,0,0.35)" }} />
      </At>
      <At style={tall ? { left: 50, right: 50, bottom: SB, flexDirection: "column", alignItems: "center", background: "#d8231f", borderRadius: 18, padding: "30px 30px", gap: 6 } : { right: 50, bottom: 70, width: 500, flexDirection: "column", alignItems: "center", background: "#d8231f", borderRadius: 18, padding: "26px 24px", gap: 6 }}>
        <Text size={tall ? 60 : 40} weight={900} color="#ffffff" align="center" lh={1.1}>{f.banner}</Text>
        {f.sub_banner ? <Text size={tall ? 38 : 27} weight={700} color="#ffffff" align="center">{f.sub_banner}</Text> : null}
      </At>
    </Fill>
  );
}

function HandwrittenNote({ f, st, pal, b, P, W, H, tall }: L<"handwritten_note">) {
  const w = tall ? 840 : 620;
  const size = fitFont(f.note, { font: "caveat", width: w - 120, lines: 5, max: tall ? 104 : 78, min: 44, upper: true });
  const top = st.focus === "bottom" || st.focus === "center";
  const edge = tall ? (top ? ST : SB + 140) : 60;
  return (
    <Fill>
      <Photo src={P[0]} width={W} height={H} focus={st.focus} />
      <At style={{ [top ? "top" : "bottom"]: edge, left: tall ? 120 : 70, width: w, background: "#f7f4ec", padding: "50px 60px", transform: "rotate(-3deg)", boxShadow: "0 22px 50px rgba(0,0,0,0.4)", flexDirection: "column" }}>
        <div style={{ display: "flex", fontFamily: "Caveat", fontWeight: 700, fontSize: size, lineHeight: 1.12, color: "#2b3a67", textTransform: "uppercase", letterSpacing: 2, width: w - 120 }}>{f.note}</div>
      </At>
      <At style={{ left: 0, right: 0, [top ? "bottom" : "top"]: 0, padding: tall ? (top ? `120px 60px ${SB}px` : `${ST}px 60px 120px`) : "40px 60px", backgroundImage: `linear-gradient(${top ? "0deg" : "180deg"}, rgba(0,0,0,0.7), rgba(0,0,0,0))`, justifyContent: "space-between", alignItems: "center" }}>
        {f.caption ? <Text size={tall ? 46 : 32} weight={800} color="#ffffff" width={W - 380}>{f.caption}</Text> : <div style={{ display: "flex" }} />}
        <Logo brand={b} pal={pal} height={tall ? 48 : 40} onPhoto />
      </At>
    </Fill>
  );
}

function Listicle({ f, st, pal, b, P, W, tall }: L<"listicle">) {
  const bg = pal.dark ? pal.bg : "#fbf6ee";
  const item = (t: string, i: number, size: number, width: number) => (
    <div key={i} style={{ display: "flex", alignItems: "center", gap: size * 0.6 }}>
      <div style={{ display: "flex", width: size * 1.7, height: size * 1.7, borderRadius: size * 2, background: pal.accent, color: pal.accentInk, alignItems: "center", justifyContent: "center", fontFamily: "Inter", fontWeight: 900, fontSize: size * 0.95, flexShrink: 0 }}>{String(i + 1)}</div>
      <Text size={size} weight={700} color={pal.ink} width={width} lh={1.2}>{t}</Text>
    </div>
  );
  if (tall) {
    return (
      <Fill style={{ background: bg, flexDirection: "column", padding: `${ST}px 70px ${SB}px`, gap: 30 }}>
        <Headline text={f.headline} st={st} pal={pal} width={W - 140} lines={3} max={110} min={58} />
        <div style={{ display: "flex", position: "relative", flex: 1, minHeight: 300 }}>
          <Photo src={P[0]} width="100%" height="100%" radius={36} focus={st.focus} />
          <At style={{ left: 24, top: 24 }}><Logo brand={b} pal={pal} height={42} onPhoto /></At>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>{f.items.map((t, i) => item(t, i, 38, W - 280))}</div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          {f.question ? <Text size={52} weight={900} color={pal.ink} align="center">{f.question}</Text> : null}
          <Text size={32} weight={600} color={pal.muted} align="center" width={W - 160}>{f.solution}</Text>
          <Cta text={f.cta} pal={pal} size={44} />
        </div>
      </Fill>
    );
  }
  return (
    <Fill style={{ background: bg, padding: 50, gap: 44 }}>
      <Photo src={P[0]} width={400} height={980} radius={36} focus={st.focus} style={{ border: `6px solid ${pal.accent}` }} />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 22, paddingTop: 10 }}>
        <Headline text={f.headline} st={st} pal={pal} width={540} lines={4} max={76} min={42} />
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>{f.items.map((t, i) => item(t, i, 28, 450))}</div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginTop: "auto" }}>
          {f.question ? <Text size={42} weight={900} color={pal.ink} align="center">{f.question}</Text> : null}
          <Text size={26} weight={600} color={pal.muted} align="center" width={520}>{f.solution}</Text>
          <Cta text={f.cta} pal={pal} size={32} />
          <Logo brand={b} pal={pal} height={36} />
        </div>
      </div>
    </Fill>
  );
}

function Offer({ f, st, pal, b, P, W, tall }: L<"offer">) {
  const bg = pal.dark ? `linear-gradient(180deg, ${shade(pal.bg, 0.06)} 0%, ${pal.bg} 100%)` : `linear-gradient(180deg, ${shade(st.accent, 0.88)} 0%, #ffffff 70%)`;
  const perks = (size: number) => (
    <div style={{ display: "flex", gap: 30, flexWrap: "wrap", justifyContent: "center" }}>
      {f.perks.map((t, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Icon name="check" size={size * 1.1} color={pal.accent} width={3} />
          <Text size={size} weight={700} color={pal.ink}>{t}</Text>
        </div>
      ))}
    </div>
  );
  const price = (old: number, now: number) =>
    f.new_price ? (
      <div style={{ display: "flex", alignItems: "flex-end", gap: 24 }}>
        {f.old_price ? <Text size={old} weight={600} color={pal.muted} style={{ textDecoration: "line-through" }}>{f.old_price}</Text> : null}
        <Text size={now} weight={900} color={pal.accent} lh={1}>{f.new_price}</Text>
      </div>
    ) : null;
  if (tall) {
    return (
      <Fill style={{ background: bg, flexDirection: "column", alignItems: "center", padding: `${ST}px 60px ${SB}px`, gap: 26 }}>
        <Headline text={f.headline} st={st} pal={pal} width={W - 120} lines={2} max={116} min={56} align="center" />
        <div style={{ display: "flex", position: "relative", width: W - 120, flex: 1, minHeight: 520 }}>
          <Photo src={P[0]} width="100%" height="100%" radius={36} focus={st.focus} />
          <At style={{ left: 24, top: 24 }}><Logo brand={b} pal={pal} height={44} onPhoto /></At>
          <At style={{ right: -20, top: -20 }}><Badge text={f.offer} pal={pal} size={250} rotate={-12} /></At>
        </div>
        {price(50, 100)}
        {perks(34)}
        {f.urgency ? <div style={{ display: "flex", background: "#d8231f", borderRadius: 999, padding: "14px 34px" }}><Text size={34} weight={900} color="#ffffff" style={{ textTransform: "uppercase", letterSpacing: 1 }}>{f.urgency}</Text></div> : null}
        <Cta text={f.cta} pal={pal} size={52} />
      </Fill>
    );
  }
  return (
    <Fill style={{ background: bg, flexDirection: "column", alignItems: "center", padding: "44px 50px 40px", gap: 18 }}>
      <Logo brand={b} pal={pal} height={40} />
      <Headline text={f.headline} st={st} pal={pal} width={W - 120} lines={2} max={72} min={44} align="center" />
      <div style={{ display: "flex", position: "relative", width: 760, height: 520 }}>
        <Photo src={P[0]} width={760} height={520} radius={36} focus={st.focus} />
        <At style={{ right: -30, top: -30 }}><Badge text={f.offer} pal={pal} size={210} rotate={-12} /></At>
      </div>
      {price(38, 70)}
      {perks(27)}
      <Cta text={f.cta} pal={pal} size={34} />
      {f.urgency ? <At style={{ left: 0, right: 0, bottom: 0, height: 66, background: "#d8231f", justifyContent: "center", alignItems: "center" }}><Text size={28} weight={900} color="#ffffff" style={{ textTransform: "uppercase", letterSpacing: 1 }}>{f.urgency}</Text></At> : null}
    </Fill>
  );
}

function Stars({ size }: { size: number }) {
  return <div style={{ display: "flex", gap: size * 0.15 }}>{[0, 1, 2, 3, 4].map((i) => <Icon key={i} name="star" size={size} color="#ffc531" width={1.5} fill />)}</div>;
}

function Testimonial({ f, st, pal, b, P, W, H, tall }: L<"testimonial">) {
  const size = fitFont(f.quote, { font: "inter", width: W - 140, lines: tall ? 7 : 5, max: tall ? 70 : 52, min: 32 });
  return (
    <Fill>
      <Photo src={P[0]} width={W} height={H} focus={st.focus} />
      <Fill style={{ backgroundImage: "linear-gradient(180deg, rgba(10,8,14,0.85) 0%, rgba(10,8,14,0.5) 42%, rgba(10,8,14,0) 70%)" }} />
      <Fill style={{ backgroundImage: "linear-gradient(0deg, rgba(10,8,14,0.7) 0%, rgba(10,8,14,0) 30%)" }} />
      <At style={{ left: 70, top: tall ? ST : 60, right: 70, flexDirection: "column", gap: 22 }}>
        <Stars size={tall ? 60 : 48} />
        <Text size={size} weight={800} color="#ffffff" width={W - 140} lh={1.18}>{`„${f.quote}”`}</Text>
        <Text size={tall ? 40 : 30} weight={600} color="rgba(255,255,255,0.85)">{`— ${f.author}`}</Text>
      </At>
      <At style={{ left: 70, right: 70, bottom: tall ? SB : 56, justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {f.rating_note ? <div style={{ display: "flex", background: "rgba(255,255,255,0.94)", borderRadius: 999, padding: "10px 24px" }}><Text size={tall ? 32 : 26} weight={800} color="#121014">{f.rating_note}</Text></div> : null}
          <Cta text={f.cta} pal={pal} size={tall ? 46 : 34} />
        </div>
        <Logo brand={b} pal={pal} height={44} onPhoto />
      </At>
    </Fill>
  );
}

function ProblemSolution({ f, st, pal, b, P, W, H, tall }: L<"problem_solution">) {
  const half = H / 2;
  const block = (label: string, text: string, ok: boolean, top: number) => (
    <At style={{ left: 0, top, width: W, height: half }}>
      <Photo src={P[ok ? 1 : 0]} width={W} height={half} focus={st.focus} />
      <At style={{ left: 0, right: 0, [ok ? "bottom" : "top"]: 0, height: half * 0.7, backgroundImage: `linear-gradient(${ok ? "0deg" : "180deg"}, rgba(8,6,12,0.85), rgba(8,6,12,0))` }}><div style={{ display: "flex" }} /></At>
      <At style={{ left: 60, right: 60, [ok ? "bottom" : "top"]: tall ? (ok ? SB : ST) : 40, flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", width: tall ? 76 : 64, height: tall ? 76 : 64, borderRadius: 80, background: ok ? pal.accent : "#e5312b", alignItems: "center", justifyContent: "center" }}><Icon name={ok ? "check" : "cross"} size={tall ? 44 : 38} color={ok ? pal.accentInk : "#ffffff"} width={3.2} /></div>
          <Text size={tall ? 46 : 32} weight={900} color="#ffffff" style={{ textTransform: "uppercase", letterSpacing: 2 }}>{label}</Text>
        </div>
        <Headline text={text} st={{ ...st, highlight: ok ? st.highlight : [] }} pal={{ ...pal, ink: "#ffffff" }} width={W - 120} lines={tall ? 3 : 2} max={tall ? 100 : 62} min={40} />
      </At>
    </At>
  );
  return (
    <Fill style={{ background: "#000000" }}>
      {block(f.problem_label, f.problem, false, 0)}
      {block(f.solution_label, f.solution, true, half)}
      <At style={{ left: 0, right: 0, top: half - 6, height: 12, background: "#ffffff" }}><div style={{ display: "flex" }} /></At>
      <At style={{ left: 0, right: 0, top: half - (tall ? 50 : 42), justifyContent: "center", alignItems: "center", gap: 20 }}>
        <Logo brand={b} pal={pal} height={tall ? 48 : 40} onPhoto />
        <Cta text={f.cta} pal={pal} size={tall ? 42 : 30} />
      </At>
    </Fill>
  );
}

function QuestionHook({ f, st, pal, b, P, W, H, tall }: L<"question_hook">) {
  return (
    <Fill>
      <Photo src={P[0]} width={W} height={H} focus={st.focus} />
      <Fill style={{ backgroundImage: "linear-gradient(0deg, rgba(6,5,9,0.94) 0%, rgba(6,5,9,0.66) 32%, rgba(6,5,9,0) 60%)" }} />
      <At style={{ left: 50, top: tall ? ST - 40 : 50 }}><Logo brand={b} pal={pal} height={44} onPhoto /></At>
      <At style={{ left: 70, right: 70, bottom: tall ? SB : 60, flexDirection: "column", gap: 28 }}>
        <Headline text={f.question} st={st} pal={{ ...pal, ink: "#ffffff", accent: readableAccent(st.accent, "#0a080d") }} width={W - 140} lines={tall ? 4 : 3} max={tall ? 140 : 108} min={54} />
        {f.sub ? <Text size={tall ? 44 : 32} weight={600} color="rgba(255,255,255,0.88)" width={W - 160}>{f.sub}</Text> : null}
        <div style={{ display: "flex" }}><Cta text={f.cta} pal={pal} size={tall ? 50 : 36} /></div>
      </At>
    </Fill>
  );
}

const LAYOUTS: { [K in TemplateKey]: (p: L<K>) => ReactNode } = {
  hero_benefits: HeroBenefits,
  before_after: BeforeAfter,
  callouts: Callouts,
  us_vs_them: UsVsThem,
  sticky_notes: StickyNotes,
  whiteboard: Whiteboard,
  handwritten_note: HandwrittenNote,
  listicle: Listicle,
  offer: Offer,
  testimonial: Testimonial,
  problem_solution: ProblemSolution,
  question_hook: QuestionHook,
};

export function AdLayout(input: LayoutInput) {
  const { width: W, height: H } = AD_SIZE[input.format];
  const pal = palette(input.style, input.brand);
  const Comp = LAYOUTS[input.template] as (p: L<TemplateKey>) => ReactNode;
  return (
    <div style={{ display: "flex", position: "relative", width: W, height: H, overflow: "hidden", background: pal.bg, fontFamily: "Inter" }}>
      <Comp f={input.fields as Fields<TemplateKey>} st={input.style} pal={pal} b={input.brand} P={input.photos} cut={input.cutout} W={W} H={H} tall={input.format === "9x16"} />
    </div>
  );
}
