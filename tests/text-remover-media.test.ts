import { describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { chunkMask, cutChunk } from "@/lib/text-remover/media";
import { CHUNK_FRAMES } from "@/lib/text-remover/plan";

const ff = ffmpegPath as unknown as string;
const count = (f: string) => {
  const out = spawnSync(ff, ["-hide_banner", "-i", f, "-map", "0:v", "-f", "null", "-"], { encoding: "utf8" }).stderr;
  return Number([...out.matchAll(/frame=\s*(\d+)/g)].pop()?.[1] ?? 0);
};

describe("text remover pieces", () => {
  it("a short shot is padded to exactly the mask's frame count", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "trm-"));
    const src = path.join(dir, "src.mp4");
    execFileSync(ff, ["-v", "error", "-f", "lavfi", "-i", "testsrc=size=320x240:rate=30:duration=5", "-pix_fmt", "yuv420p", src]);
    for (const c of [{ start: 40, len: 20 }, { start: 0, len: CHUNK_FRAMES }]) {
      await cutChunk(src, path.join(dir, "c.mp4"), { y: 40, h: 120 }, 320, c);
      await chunkMask(path.join(dir, "m.mp4"), { y: 40, h: 120 }, 320, [{ start: 1.5, end: 2, boxes: [{ x: 10, y: 60, w: 100, h: 30 }] }], c, 30);
      expect(count(path.join(dir, "c.mp4"))).toBe(CHUNK_FRAMES);
      expect(count(path.join(dir, "m.mp4"))).toBe(CHUNK_FRAMES);
    }
  }, 60_000);

  it("the padded frames of the mask repeat its last real frame (the caption stays covered)", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "trm-"));
    const m = path.join(dir, "m.mp4");
    // caption on screen for the whole real part of the piece (frames 40–59 = 1.33–2.0 s)
    await chunkMask(m, { y: 0, h: 120 }, 320, [{ start: 1, end: 2.1, boxes: [{ x: 10, y: 20, w: 100, h: 30 }] }], { start: 40, len: 20 }, 30);
    const px = (n: number) => execFileSync(ff, ["-v", "error", "-i", m, "-vf", `select=eq(n\\,${n}),format=gray,crop=2:2:50:30`, "-vsync", "0", "-f", "rawvideo", "-"])[0];
    expect(px(5)).toBeLessThan(60);
    expect(px(19)).toBeLessThan(60);
    expect(px(70)).toBeLessThan(60);
  }, 60_000);
});
