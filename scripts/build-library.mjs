// Builds src/generated/library.json from public/biblioteka (music + SFX) so the
// app knows what is in the library without reading the disk at runtime.
import fs from "node:fs";
import path from "node:path";
import { parseFile } from "music-metadata";
import { spawnSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

// Where the groove is steady: earliest point after which ~25 s stays loud with no long drops.
function bestStart(file) {
  const r = spawnSync(ffmpegPath, ["-hide_banner", "-t", "90", "-i", file, "-vn", "-af", "ebur128=peak=none", "-f", "null", "-"], { maxBuffer: 64 * 1024 * 1024 });
  return pick(String(r.stderr ?? ""));
}
function pick(out) {
  const curve = [];
  for (const m of out.matchAll(/t:\s*(\d+(?:\.\d+)?)\s+TARGET[^\n]*?M:\s*(-?\d+(?:\.\d+)?)/g)) {
    const i = Math.floor(Number(m[1]) / 0.5);
    if (curve[i] === undefined) curve[i] = Number(m[2]);
  }
  const win = 50;
  if (curve.length <= win) return 0;
  let best = 0, bestScore = -Infinity;
  for (let i = 0; i + win <= curve.length && i <= 120; i++) {
    const w = curve.slice(i, i + win).map((v) => (v === undefined ? -70 : v));
    const mean = w.reduce((a, b) => a + b, 0) / w.length;
    const drops = w.filter((v) => v < mean - 12).length;
    const score = mean - drops * 3 - i * 0.02;
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return best * 0.5;
}

const root = path.resolve("public/biblioteka");
const AUDIO = /\.(mp3|m4a|wav|aac|ogg)$/i;

async function list(dir) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return [];
  const files = fs.readdirSync(full).filter((f) => AUDIO.test(f)).sort();
  const out = [];
  for (const file of files) {
    let duration = null;
    try {
      duration = (await parseFile(path.join(full, file), { duration: true })).format.duration ?? null;
    } catch {
      /* unreadable file: keep it, duration unknown */
    }
    const name = file.replace(AUDIO, "");
    out.push({
      file: `/biblioteka/${dir}/${file}`,
      name,
      category: dir === "sfx" ? name.split(/[-_ ]/)[0].toLowerCase() : null,
      duration: duration ? Math.round(duration * 100) / 100 : null,
      start: dir === "muzyka" ? bestStart(path.join(full, file)) : 0,
      bytes: fs.statSync(path.join(full, file)).size,
    });
  }
  return out;
}

const library = { music: await list("muzyka"), sfx: await list("sfx") };
fs.mkdirSync("src/generated", { recursive: true });
fs.writeFileSync("src/generated/library.json", JSON.stringify(library, null, 1) + "\n");
console.log(`biblioteka: ${library.music.length} utworów, ${library.sfx.length} SFX`);
