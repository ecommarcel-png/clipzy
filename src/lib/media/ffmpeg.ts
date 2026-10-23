import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";

// ffmpeg on the server: probe files, find hard cuts inside clips (so the edit
// never shows 1–3 frames of a neighbouring scene) and pauses in the voiceover.
const run = promisify(execFile);

function bin(): string {
  if (!ffmpegPath) throw new Error("Brak ffmpeg na serwerze.");
  return ffmpegPath as unknown as string;
}

async function stderrOf(args: string[], timeout = 120_000): Promise<string> {
  try {
    const { stderr } = await run(bin(), ["-hide_banner", ...args], { timeout, maxBuffer: 32 * 1024 * 1024 });
    return stderr;
  } catch (e) {
    // `ffmpeg -i file` without an output exits with code 1 but still prints the info we need.
    const err = e as { stderr?: string; killed?: boolean };
    if (err.killed) throw new Error("Analiza pliku trwała za długo.");
    if (typeof err.stderr === "string") return err.stderr;
    throw e;
  }
}

export type Probe = { duration: number; width: number | null; height: number | null; fps: number | null; hasAudio: boolean; hasVideo: boolean };

export function parseProbe(stderr: string): Probe {
  const d = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  const duration = d ? Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]) : 0;
  const video = stderr.match(/Stream #[^\n]*Video:[^\n]*/);
  const size = video?.[0].match(/(\d{2,5})x(\d{2,5})/);
  const fps = video?.[0].match(/(\d+(?:\.\d+)?)\s*fps/);
  // Phones store portrait video as landscape + rotation metadata.
  const rotated = /rotation of -?90|rotate\s*:\s*-?90|displaymatrix: rotation of -?90/i.test(stderr);
  let width = size ? Number(size[1]) : null;
  let height = size ? Number(size[2]) : null;
  if (rotated && width && height) [width, height] = [height, width];
  return {
    duration,
    width,
    height,
    fps: fps ? Number(fps[1]) : null,
    hasAudio: /Stream #[^\n]*Audio:/.test(stderr),
    hasVideo: Boolean(video),
  };
}

export async function probe(file: string): Promise<Probe> {
  return parseProbe(await stderrOf(["-i", file]));
}

// Times (s) where the picture changes completely: hard cuts inside a clip.
export async function sceneCuts(file: string, threshold = 0.3): Promise<number[]> {
  const out = await stderrOf(["-i", file, "-an", "-vf", `select='gt(scene,${threshold})',showinfo`, "-f", "null", "-"], 180_000);
  return [...out.matchAll(/pts_time:(\d+(?:\.\d+)?)/g)].map((m) => Math.round(Number(m[1]) * 1000) / 1000);
}

export type Silence = { start: number; end: number };

export function parseSilences(stderr: string, total: number): Silence[] {
  const out: Silence[] = [];
  let start: number | null = null;
  for (const line of stderr.split("\n")) {
    const s = line.match(/silence_start:\s*(-?\d+(?:\.\d+)?)/);
    if (s) start = Math.max(0, Number(s[1]));
    const e = line.match(/silence_end:\s*(\d+(?:\.\d+)?)/);
    if (e && start !== null) {
      out.push({ start, end: Number(e[1]) });
      start = null;
    }
  }
  if (start !== null) out.push({ start, end: total });
  return out;
}

export async function silences(file: string, total: number, noiseDb = -38, minDur = 0.18): Promise<Silence[]> {
  const out = await stderrOf(["-i", file, "-vn", "-af", `silencedetect=noise=${noiseDb}dB:d=${minDur}`, "-f", "null", "-"]);
  return parseSilences(out, total);
}

// Momentary loudness (LUFS) every 0.5 s — used to start music where the groove is steady.
export async function loudnessCurve(file: string, seconds = 90): Promise<number[]> {
  const out = await stderrOf(["-t", String(seconds), "-i", file, "-vn", "-af", "ebur128=peak=none", "-f", "null", "-"], 120_000);
  const vals = [...out.matchAll(/t:\s*(\d+(?:\.\d+)?)\s+TARGET[^\n]*?M:\s*(-?\d+(?:\.\d+)?)/g)].map((m) => [Number(m[1]), Number(m[2])] as const);
  const step: number[] = [];
  for (const [t, m] of vals) {
    const i = Math.floor(t / 0.5);
    if (step[i] === undefined) step[i] = m;
  }
  return step.map((v) => (v === undefined ? -70 : v));
}

// Best start: the earliest moment after which ~25 s stays loud and steady (no long drops).
export function bestMusicStart(curve: number[], windowS = 25): number {
  const win = Math.round(windowS / 0.5);
  if (curve.length <= win) return 0;
  let best = 0;
  let bestScore = -Infinity;
  for (let i = 0; i + win <= curve.length && i <= 60 * 2; i++) {
    const w = curve.slice(i, i + win);
    const mean = w.reduce((a, b) => a + b, 0) / w.length;
    const drops = w.filter((v) => v < mean - 12).length;
    const score = mean - drops * 3 - i * 0.02; // prefer earlier starts on ties
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best * 0.5;
}

// Voiceover at a steady ad loudness (−16 LUFS, peaks ≤ −1.5 dBTP). WAV keeps the
// sample timing exact, so the word timestamps from transcription still match.
export async function normalizeVoice(input: string, output: string): Promise<void> {
  try {
    await run(bin(), ["-hide_banner", "-y", "-i", input, "-vn", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", output], {
      timeout: 120_000,
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (e) {
    const err = e as { killed?: boolean; stderr?: string };
    throw new Error(err.killed ? "Wyrównanie głośności lektora trwało za długo." : `ffmpeg: ${String(err.stderr ?? e).slice(-300)}`);
  }
}
