import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

// The knowledge base lives in /knowledge as plain Markdown, so it can be
// improved without touching code. Files are read once per server instance.

const cache = new Map<string, Promise<string>>();

function load(relPath: string): Promise<string> {
  let p = cache.get(relPath);
  if (!p) {
    p = readFile(path.join(process.cwd(), "knowledge", relPath), "utf8").catch(() => "");
    cache.set(relPath, p);
  }
  return p;
}

export type KnowledgeDoc = { title: string; content: string };

async function bundle(files: Array<[title: string, relPath: string]>): Promise<KnowledgeDoc[]> {
  const docs = await Promise.all(files.map(async ([title, rel]) => ({ title, content: await load(rel) })));
  return docs.filter((d) => d.content);
}

const SKLEJKI: [string, string] = ["Baza wiedzy Clipzy: sklejki pod Meta Ads", "sklejki/SKILL.md"];
const META_CORE: [string, string] = ["Meta Ads 2026: zasady", "meta-ads/SKILL.md"];
const REZYSER: [string, string] = ["Reżyser Clipzy: sposób pracy i kontrola jakości", "rezyser/SKILL.md"];

// Brand profile: positioning, offer and how the profile is used later.
export function brandKnowledge() {
  return bundle([
    REZYSER,
    SKLEJKI,
    META_CORE,
    ["Meta Ads: zasady marketingu i pozycjonowania", "meta-ads/references/zasady-marketingu.md"],
    ["Meta Ads: oferta", "meta-ads/references/oferta.md"],
  ]);
}

// Product profile: mechanism, awareness levels, hooks and angles.
export function productKnowledge() {
  return bundle([
    REZYSER,
    SKLEJKI,
    META_CORE,
    ["Meta Ads: wypalenie obietnicy i unikalny mechanizm", "meta-ads/references/wypalenie-obietnicy.md"],
    ["Meta Ads: poziomy świadomości", "meta-ads/references/poziomy-swiadomosci.md"],
    ["Meta Ads: skrypty i hooki", "meta-ads/references/skrypty-i-hooki.md"],
  ]);
}

// The independent reviewer: its checklist plus the rules it checks against.
export function reviewerKnowledge() {
  return bundle([REZYSER, SKLEJKI, META_CORE]);
}

// Sklejki: editing rules, effects, hooks and scripts.
export function clipsKnowledge() {
  return bundle([
    REZYSER,
    SKLEJKI,
    ["Meta Ads: skrypty i hooki", "meta-ads/references/skrypty-i-hooki.md"],
    ["Meta Ads: poziomy świadomości", "meta-ads/references/poziomy-swiadomosci.md"],
  ]);
}

// Voiceover scripts for sklejki: hooks, awareness levels, promise fatigue.
export function scriptKnowledge() {
  return bundle([
    SKLEJKI,
    ["Meta Ads: skrypty i hooki", "meta-ads/references/skrypty-i-hooki.md"],
    ["Meta Ads: poziomy świadomości", "meta-ads/references/poziomy-swiadomosci.md"],
    ["Meta Ads: wypalenie obietnicy", "meta-ads/references/wypalenie-obietnicy.md"],
  ]);
}

export function knowledgeText(docs: KnowledgeDoc[]): string {
  return docs.map((d) => `<wiedza tytul="${d.title}">\n${d.content}\n</wiedza>`).join("\n\n");
}
