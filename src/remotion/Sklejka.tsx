import React from "react";
import { AbsoluteFill, Easing, Img, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio, Video } from "@remotion/media";
import { loadFont } from "@remotion/google-fonts/Inter";
import type { EditPlan, Format, LookT, Overlay, Shot, SrcRef } from "@/lib/clips/plan";
import { FPS } from "@/lib/clips/plan";
import type { CaptionChunk, VoSegment } from "@/lib/clips/timeline";
import { Icon } from "./icons";

// The sklejka itself: a data-driven Remotion composition. Renders in the
// user's browser (@remotion/web-renderer) and in the preview <Player>.
// Only features supported by client-side rendering are used (no object-position,
// mix-blend-mode or z-index; elements are drawn in DOM order).

const { fontFamily: INTER } = loadFont("normal", { weights: ["600", "700", "800"], subsets: ["latin", "latin-ext"] });

export type SklejkaProps = {
  format: Format;
  plan: EditPlan;
  assets: Record<string, { url: string; mirrored?: boolean }>;
  vo: { url: string; segments: VoSegment[] } | null;
  captions: CaptionChunk[];
  brand: { name: string; logoUrl: string | null; accent: string };
  packshotUrl: string | null;
};

const INK = "#1C1A1E";
const RED = "#E5484D";
const f = (s: number) => Math.round(s * FPS);

// Highlight colour: brand accent, darkened when too light for white text.
export function readableAccent(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#7E9A86";
  const n = parseInt(m[1], 16);
  let [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (lum > 0.55) {
    const k = 0.55 / lum;
    [r, g, b] = [r * k, g * k, b * k].map((x) => Math.round(x));
  }
  return `rgb(${r}, ${g}, ${b})`;
}

const layout = (format: Format) =>
  format === "9x16" ? { capY: 0.655, cap: 66, head: 88, label: 40 } : format === "4x5" ? { capY: 0.73, cap: 60, head: 76, label: 34 } : { capY: 0.76, cap: 56, head: 70, label: 32 };

const pop = (frame: number, fps: number, at: number, damping = 11) =>
  spring({ frame: frame - f(at), fps, config: { damping, stiffness: 170, mass: 0.7 } });

// ---------- media ----------

const Clip: React.FC<{ src: SrcRef; look: LookT; assets: SklejkaProps["assets"]; dur: number; startAt: number }> = ({ src, look, assets, dur, startAt }) => {
  const frame = useCurrentFrame();
  const a = assets[src.asset];
  const s = interpolate(frame, [0, Math.max(1, dur)], [look.zoom_from, look.zoom_to], { extrapolateRight: "clamp" });
  let dx = 0;
  let dy = 0;
  if (look.shake_at !== null && look.shake_at !== undefined) {
    const k = frame - (f(look.shake_at) - f(startAt));
    if (k >= 0 && k < 9) {
      const amp = 26 * (1 - k / 9);
      dx = Math.sin(k * 2.7) * amp;
      dy = Math.cos(k * 3.3) * amp * 0.6;
    }
  }
  const filter = look.gray > 0 ? `grayscale(${look.gray}) contrast(${1 + 0.12 * look.gray}) brightness(${1 - 0.06 * look.gray})` : undefined;
  if (!a) return <AbsoluteFill style={{ backgroundColor: "#111" }} />;
  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#000" }}>
      <Video
        src={a.url}
        trimBefore={f(src.from)}
        playbackRate={src.rate}
        muted
        objectFit="cover"
        style={{ width: "100%", height: "100%", filter, transform: `translate(${dx}px, ${dy}px) scale(${s})${a.mirrored ? " scaleX(-1)" : ""}` }}
      />
    </AbsoluteFill>
  );
};

const Pill: React.FC<{ children: React.ReactNode; size: number; dark?: boolean; style?: React.CSSProperties }> = ({ children, size, dark, style }) => (
  <div
    style={{
      display: "inline-flex", alignItems: "center", gap: size * 0.3, padding: `${size * 0.32}px ${size * 0.7}px`, borderRadius: 999,
      backgroundColor: dark ? "rgba(28,26,30,0.8)" : "rgba(255,255,255,0.96)", color: dark ? "#fff" : INK,
      fontFamily: INTER, fontWeight: 700, fontSize: size, letterSpacing: -0.3, boxShadow: "0 8px 24px rgba(0,0,0,0.25)", ...style,
    }}
  >
    {children}
  </div>
);

const SplitShotView: React.FC<{ shot: Extract<Shot, { type: "split" }>; p: SklejkaProps; dur: number }> = ({ shot, p, dur }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const L = layout(p.format);
  const grow = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const markAt = shot.marks_at ?? shot.start + 0.1;
  const mark = (m: "ok" | "no" | "none", top: boolean) => {
    if (m === "none") return null;
    const k = frame - (f(markAt + (top ? 0 : 0.5)) - f(shot.start));
    if (k < 0) return null;
    const sc = spring({ frame: k, fps, config: { damping: 9, stiffness: 170, mass: 0.7 } });
    const size = Math.round(width * 0.12);
    return (
      <div style={{ position: "absolute", left: width - size - 40, top: (top ? height * 0.25 : height * 0.75) - size / 2, width: size, height: size, borderRadius: "50%", backgroundColor: m === "ok" ? readableAccent(p.brand.accent) : RED, border: "5px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${sc})`, boxShadow: "0 10px 30px rgba(0,0,0,0.35)" }}>
        <Icon name={m === "ok" ? "check" : "cross"} size={size * 0.6} color="#fff" sw={3} />
      </div>
    );
  };
  const label = (text: string, m: "ok" | "no" | "none") => (
    <Pill size={L.label}>
      {m !== "none" ? <Icon name={m === "ok" ? "check" : "cross"} size={L.label} color={m === "ok" ? readableAccent(p.brand.accent) : RED} sw={3} /> : null}
      {text}
    </Pill>
  );
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 0, top: 0, width, height: height / 2, overflow: "hidden" }}>
        <Clip src={shot.top} look={shot.top_look} assets={p.assets} dur={dur} startAt={shot.start} />
      </div>
      <div style={{ position: "absolute", left: 0, top: height / 2, width, height: height / 2, overflow: "hidden" }}>
        <Clip src={shot.bottom} look={shot.bottom_look} assets={p.assets} dur={dur} startAt={shot.start} />
      </div>
      <div style={{ position: "absolute", left: 0, top: height / 2 - 4, height: 8, width: width * grow, backgroundColor: "#fff", boxShadow: "0 0 18px rgba(0,0,0,0.35)" }} />
      <div style={{ position: "absolute", left: 48, top: height / 2 - L.label * 2.2 - 22, transform: `scale(${grow})`, transformOrigin: "left bottom" }}>{label(shot.top_label, shot.top_mark)}</div>
      <div style={{ position: "absolute", left: 48, top: height / 2 + 26, transform: `scale(${grow})`, transformOrigin: "left top" }}>{label(shot.bottom_label, shot.bottom_mark)}</div>
      {mark(shot.top_mark, true)}
      {mark(shot.bottom_mark, false)}
    </AbsoluteFill>
  );
};

const LogoPill: React.FC<{ brand: SklejkaProps["brand"]; height: number }> = ({ brand, height }) => (
  <div style={{ display: "inline-flex", alignItems: "center", height, padding: `0 ${height * 0.38}px`, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.96)", boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}>
    {brand.logoUrl ? (
      <Img src={brand.logoUrl} style={{ height: height * 0.6, maxWidth: height * 3.2, objectFit: "contain" }} />
    ) : (
      <span style={{ fontFamily: INTER, fontWeight: 800, fontSize: height * 0.45, color: INK }}>{brand.name}</span>
    )}
  </div>
);

const PackshotView: React.FC<{ shot: Extract<Shot, { type: "packshot" }>; p: SklejkaProps; dur: number }> = ({ shot, p, dur }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const L = layout(p.format);
  const big = p.format === "9x16";
  const s = interpolate(frame, [0, dur], [1, 1.07]);
  const head = pop(frame, fps, 0.05);
  const cta = pop(frame, fps, 1.2);
  const bob = Math.sin(frame / 5) * 8;
  const accent = readableAccent(p.brand.accent);
  return (
    <AbsoluteFill style={{ backgroundColor: accent }}>
      {p.packshotUrl ? (
        <>
          <Img src={p.packshotUrl} style={{ position: "absolute", left: -width * 0.1, top: -height * 0.1, width: width * 1.2, height: height * 1.2, objectFit: "cover", filter: "blur(34px) brightness(0.85)" }} />
          <div style={{ position: "absolute", left: 0, top: 0, width, height, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Img src={p.packshotUrl} style={{ width: big ? width : width * 0.8, maxHeight: height * 0.62, objectFit: "contain", transform: `scale(${s})` }} />
          </div>
        </>
      ) : null}
      <div style={{ position: "absolute", top: height * (big ? 0.15 : 0.04), width, display: "flex", justifyContent: "center" }}>
        <LogoPill brand={p.brand} height={big ? 96 : 80} />
      </div>
      <div style={{ position: "absolute", top: height * (big ? 0.235 : 0.13), width, textAlign: "center", transform: `scale(${head})`, fontFamily: INTER, fontWeight: 800, fontSize: L.head, color: "#fff", letterSpacing: -1.5, textShadow: "0 4px 22px rgba(0,0,0,0.45)" }}>
        {shot.headline}
      </div>
      <div style={{ position: "absolute", top: height * (big ? 0.66 : 0.67), width, display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap", padding: "0 40px" }}>
        {shot.chips.map((c, i) => (
          <div key={c} style={{ transform: `scale(${pop(frame, fps, 0.3 + i * 0.3, 10)})` }}>
            <Pill dark size={big ? 36 : 32}>
              <Icon name="check" size={big ? 36 : 32} color="#CFE3D4" sw={3} />
              {c}
            </Pill>
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", top: height * (big ? 0.745 : 0.77), width, display: "flex", justifyContent: "center", transform: `scale(${cta})` }}>
        <Pill size={big ? 50 : 44} style={{ padding: big ? "22px 44px" : "18px 38px" }}>
          {shot.cta}
          <span style={{ display: "inline-flex", transform: `translateY(${bob}px)` }}>
            <svg viewBox="0 0 24 24" width={big ? 46 : 40} height={big ? 46 : 40} fill="none" stroke={accent} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 4v15M6 13l6 6 6-6" />
            </svg>
          </span>
        </Pill>
      </div>
    </AbsoluteFill>
  );
};

// ---------- overlays ----------

const OverlayView: React.FC<{ o: Overlay; p: SklejkaProps }> = ({ o, p }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const accent = readableAccent(p.brand.accent);
  const at = f(o.at);
  if (frame < at) return null;
  const k = frame - at;
  switch (o.type) {
    case "struck_icon": {
      if (o.until !== null && frame >= f(o.until)) return null;
      const size = Math.round(width * (p.format === "9x16" ? 0.2 : 0.17));
      const sc = pop(frame, fps, o.at);
      const sp = interpolate(frame, [f(o.strike_at), f(o.strike_at) + 7], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
      return (
        <div style={{ position: "absolute", left: o.x * width - size / 2, top: o.y * height - size / 2, width: size, height: size, transform: `scale(${sc})` }}>
          <div style={{ width: size, height: size, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.96)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 12px 34px rgba(0,0,0,0.3)" }}>
            <Icon name={o.icon} size={size * 0.56} />
          </div>
          <svg width={size} height={size} style={{ position: "absolute", left: 0, top: 0 }}>
            {sp > 0 ? <line x1={size * 0.14} y1={size * 0.14} x2={size * 0.14 + size * 0.72 * sp} y2={size * 0.14 + size * 0.72 * sp} stroke={RED} strokeWidth={size * 0.085} strokeLinecap="round" /> : null}
          </svg>
          {o.label ? (
            <div style={{ position: "absolute", top: size + 12, left: -size, width: size * 3, textAlign: "center", fontFamily: INTER, fontWeight: 700, fontSize: size * 0.2, color: "#fff", textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>{o.label}</div>
          ) : null}
        </div>
      );
    }
    case "icon": {
      if (frame > f(o.until)) return null;
      const size = Math.round(width * 0.16);
      return (
        <div style={{ position: "absolute", left: o.x * width - size / 2, top: o.y * height - size / 2, width: size, height: size, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.94)", display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${pop(frame, fps, o.at)})`, boxShadow: "0 12px 34px rgba(0,0,0,0.3)" }}>
          <div style={{ transform: o.spin ? `rotate(${k * 12}deg)` : undefined }}>
            <Icon name={o.icon} size={size * 0.62} color={accent} sw={2.4} />
          </div>
        </div>
      );
    }
    case "badge": {
      if (o.until !== null && frame >= f(o.until)) return null;
      const size = Math.round(width * 0.12);
      return (
        <div style={{ position: "absolute", left: o.x * width - size / 2, top: o.y * height - size / 2, width: size, height: size, borderRadius: "50%", backgroundColor: o.ok ? accent : RED, border: "5px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${pop(frame, fps, o.at, 9)})`, boxShadow: "0 10px 30px rgba(0,0,0,0.35)" }}>
          <Icon name={o.ok ? "check" : "cross"} size={size * 0.6} color="#fff" sw={3} />
        </div>
      );
    }
    case "ring": {
      if (frame > f(o.until)) return null;
      const r = o.r * width;
      const sc = pop(frame, fps, o.at, 8) * (1 + 0.06 * Math.sin(k / 3));
      return <div style={{ position: "absolute", left: o.x * width - r, top: o.y * height - r, width: r * 2, height: r * 2, borderRadius: "50%", border: `7px solid ${RED}`, boxShadow: "0 0 0 4px rgba(255,255,255,0.7)", transform: `scale(${sc})` }} />;
    }
    case "sheen": {
      const t = interpolate(frame, [at, at + f(o.len)], [-0.6, 1.4], { extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) });
      if (t >= 1.4) return null;
      return <AbsoluteFill style={{ backgroundImage: `linear-gradient(115deg, rgba(255,255,255,0) ${t * 100 - 18}%, rgba(255,255,255,0.38) ${t * 100}%, rgba(255,255,255,0) ${t * 100 + 18}%)` }} />;
    }
    case "sparkles": {
      if (k > f(o.len) + 12) return null;
      const pts: Array<[number, number, number]> = [[0.34, 0.38, 1.1], [0.62, 0.47, 0.8], [0.47, 0.56, 1.2], [0.7, 0.32, 0.7], [0.28, 0.52, 0.8]];
      return (
        <AbsoluteFill>
          {pts.map(([x, y, s], i) => {
            const kk = k - i * 3;
            const sc = kk < 0 ? 0 : Math.max(0, Math.sin((kk / 14) * Math.PI)) * s;
            return (
              <svg key={i} viewBox="-10 -10 20 20" width={80} height={80} style={{ position: "absolute", left: x * width - 40, top: y * height - 40, transform: `scale(${sc}) rotate(${kk * 4}deg)` }}>
                <path d="M0 -10 C1 -2 2 -1 10 0 C2 1 1 2 0 10 C-1 2 -2 1 -10 0 C-2 -1 -1 -2 0 -10Z" fill="#fff" style={{ filter: "drop-shadow(0 0 6px rgba(255,255,255,0.9))" }} />
              </svg>
            );
          })}
        </AbsoluteFill>
      );
    }
    case "wipe": {
      if (k > 10) return null;
      const x = interpolate(k, [0, 10], [-1.1, 1.1], { easing: Easing.inOut(Easing.cubic) });
      return <div style={{ position: "absolute", top: 0, left: x * width, width: width, height, backgroundImage: `linear-gradient(90deg, ${accent}, ${readableAccent("#ffffff")})`, transform: "skewX(-12deg)" }} />;
    }
    case "logo": {
      if (frame > f(o.until)) return null;
      return (
        <div style={{ position: "absolute", top: height * (p.format === "9x16" ? 0.15 : 0.035), width, display: "flex", justifyContent: "center", transform: `scale(${Math.min(1, pop(frame, fps, o.at, 14))})` }}>
          <LogoPill brand={p.brand} height={p.format === "9x16" ? 84 : 70} />
        </div>
      );
    }
  }
};

// ---------- captions ----------

const Captions: React.FC<{ p: SklejkaProps }> = ({ p }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const L = layout(p.format);
  const t = frame / fps;
  if (p.plan.shots.some((s) => s.type === "packshot" && t >= s.start)) return null;
  const plates = p.vo ? p.captions : p.plan.text_plates.map((x) => ({ text: x.text, start: x.start, end: x.end }));
  const c = plates.find((x) => t >= x.start && t < x.end);
  if (!c) return null;
  const hl = p.vo ? p.plan.caption_highlights.find((h) => c.text.includes(h)) : p.plan.text_plates.find((x) => x.text === c.text)?.highlight ?? undefined;
  const sp = spring({ frame: frame - f(c.start), fps, config: { damping: 14, stiffness: 220, mass: 0.6 } });
  const parts = hl ? c.text.split(hl) : [c.text];
  const size = p.vo ? L.cap : L.cap * 1.25;
  return (
    <div style={{ position: "absolute", left: 70, width: width - 140, top: height * L.capY - size * 0.75, textAlign: "center", opacity: Math.min(1, sp * 1.6), transform: `scale(${0.9 + 0.1 * sp})` }}>
      <span style={{ fontFamily: INTER, fontWeight: 700, fontSize: size, lineHeight: 1.22, color: "#fff", letterSpacing: -0.5, textShadow: "0 3px 14px rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.6)" }}>
        {parts[0]}
        {hl ? <span style={{ backgroundColor: readableAccent(p.brand.accent), borderRadius: 14, padding: "0 14px", textShadow: "none" }}>{hl}</span> : null}
        {hl ? parts.slice(1).join(hl) : null}
      </span>
    </div>
  );
};

// ---------- audio ----------

const AudioTrack: React.FC<{ p: SklejkaProps; duration: number }> = ({ p, duration }) => {
  const { plan } = p;
  return (
    <>
      {p.vo?.segments.map((s, i) => (
        <Sequence key={`vo${i}`} from={f(s.outStart)} durationInFrames={Math.max(1, f(s.srcEnd - s.srcStart))}>
          <Audio src={p.vo!.url} trimBefore={f(s.srcStart)} trimAfter={f(s.srcEnd)} volume={1} />
        </Sequence>
      ))}
      {plan.music.file ? (
        <Audio
          src={plan.music.file}
          trimBefore={f(plan.music.start_at)}
          volume={(fr: number) => {
            const t = fr / FPS;
            const v = p.vo ? plan.music.volume : Math.max(plan.music.volume, 0.5);
            const endBoost = p.vo ? Math.min(0.38, v * 2.2) : v;
            const voEnd = p.vo ? p.vo.segments.reduce((m, s) => Math.max(m, s.outStart + (s.srcEnd - s.srcStart)), 0) : 0;
            return interpolate(t, [0, Math.max(0.01, voEnd), voEnd + 0.4, duration - 0.7, duration], [v, v, endBoost, endBoost, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          }}
        />
      ) : null}
      {plan.original_audio.map((o, i) =>
        p.assets[o.asset] ? (
          <Sequence key={`oa${i}`} from={f(o.at)} durationInFrames={Math.max(1, f(o.len))}>
            <Audio src={p.assets[o.asset].url} trimBefore={f(o.from)} volume={o.volume} />
          </Sequence>
        ) : null,
      )}
      {plan.sfx.map((s, i) => (
        <Sequence key={`sfx${i}`} from={f(s.at)} durationInFrames={f(2)}>
          <Audio src={s.file} volume={Math.min(0.4, s.volume)} />
        </Sequence>
      ))}
    </>
  );
};

// ---------- composition ----------

export const Sklejka: React.FC<SklejkaProps> = (p) => {
  const duration = p.plan.shots.reduce((m, s) => Math.max(m, s.end), 0);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {p.plan.shots.map((shot, i) => {
        const dur = f(shot.end) - f(shot.start);
        return (
          <Sequence key={i} from={f(shot.start)} durationInFrames={Math.max(1, dur)} layout="none">
            {shot.type === "clip" ? (
              <Clip src={shot.src} look={shot.look} assets={p.assets} dur={dur} startAt={shot.start} />
            ) : shot.type === "split" ? (
              <SplitShotView shot={shot} p={p} dur={dur} />
            ) : (
              <PackshotView shot={shot} p={p} dur={dur} />
            )}
          </Sequence>
        );
      })}
      {p.plan.overlays.map((o, i) => (
        <OverlayView key={`o${i}`} o={o} p={p} />
      ))}
      <Captions p={p} />
      <AudioTrack p={p} duration={duration} />
    </AbsoluteFill>
  );
};

export function durationInFrames(plan: EditPlan) {
  return Math.max(1, f(plan.shots.reduce((m, s) => Math.max(m, s.end), 0)));
}
