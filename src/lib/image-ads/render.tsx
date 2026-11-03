import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { AD_SIZE, type AdFormat } from "./templates";
import { AdLayout, type LayoutInput } from "./layouts";

// PNG of one creative, drawn on the server (satori + resvg): no browser needed,
// Polish letters come from our own fonts.

type FontSpec = { name: string; file: string; weight: 400 | 600 | 700 | 800 | 900 };
const FONTS: FontSpec[] = [
  { name: "Inter", file: "Inter_400Regular.ttf", weight: 400 },
  { name: "Inter", file: "Inter_600SemiBold.ttf", weight: 600 },
  { name: "Inter", file: "Inter_800ExtraBold.ttf", weight: 800 },
  { name: "Inter", file: "Inter_900Black.ttf", weight: 900 },
  { name: "Anton", file: "Anton_400Regular.ttf", weight: 400 },
  { name: "Bricolage", file: "BricolageGrotesque_800ExtraBold.ttf", weight: 800 },
  { name: "Caveat", file: "Caveat_700Bold.ttf", weight: 700 },
];

let fonts: Promise<Array<{ name: string; data: Buffer; weight: FontSpec["weight"]; style: "normal" }>> | null = null;

function loadFonts() {
  fonts ??= Promise.all(
    FONTS.map(async (f) => ({ name: f.name, weight: f.weight, style: "normal" as const, data: await readFile(path.join(process.cwd(), "assets", "fonts", f.file)) })),
  );
  return fonts;
}

export async function renderAd(input: Omit<LayoutInput, "format">, format: AdFormat): Promise<Buffer> {
  const { width, height } = AD_SIZE[format];
  const res = new ImageResponse(<AdLayout {...input} format={format} />, { width, height, fonts: await loadFonts() });
  return Buffer.from(await res.arrayBuffer());
}
