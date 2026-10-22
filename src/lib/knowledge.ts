import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

// The ad knowledge base (knowledge/sklejki/SKILL.md). Read once per server instance.
let cached: Promise<string> | null = null;

export function loadSkill(): Promise<string> {
  cached ??= readFile(path.join(process.cwd(), "knowledge", "sklejki", "SKILL.md"), "utf8").catch(() => "");
  return cached;
}
