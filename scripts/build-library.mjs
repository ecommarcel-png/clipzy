// Builds src/generated/library.json from public/biblioteka (music + SFX) so the
// app knows what is in the library without reading the disk at runtime.
import fs from "node:fs";
import path from "node:path";
import { parseFile } from "music-metadata";

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
      bytes: fs.statSync(path.join(full, file)).size,
    });
  }
  return out;
}

const library = { music: await list("muzyka"), sfx: await list("sfx") };
fs.mkdirSync("src/generated", { recursive: true });
fs.writeFileSync("src/generated/library.json", JSON.stringify(library, null, 1) + "\n");
console.log(`biblioteka: ${library.music.length} utworów, ${library.sfx.length} SFX`);
