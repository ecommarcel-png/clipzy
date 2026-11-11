import "server-only";
import { z } from "zod";
import { structuredCall } from "./claude";
import type { CreativeAnalysis } from "./gemini";
import { adCopyKnowledge, knowledgeText } from "@/lib/knowledge";
import type { BrandProfile } from "@/lib/profiles/brand";
import type { ProductProfile } from "@/lib/profiles/product";
import { fixBrandName } from "@/lib/clips/names";

// Copywriter: the primary text, headline and description that finish one ready creative.

export const AdCopy = z.object({
  angle: z.string().describe("kąt tekstu jednym zdaniem — ten sam co kreacji (dla użytkownika)"),
  primary: z.string().min(40).max(1500).describe("tekst główny: hook ≤125 znaków w 1. linijce → problem → rozwiązanie i mechanizm → korzyści → dowód/bezpieczeństwo → CTA; krótkie akapity rozdzielone pustą linią"),
  headline: z.string().min(3).max(60).describe("nagłówek: ≤40 znaków, najlepiej ~27; korzyść, efekt albo oferta"),
  description: z.string().min(2).max(50).describe("opis: ≤30 znaków; dowód albo zdjęcie ryzyka, tylko fakty z profilu"),
  why: z.string().describe("1–2 zdania dla użytkownika: jak ten tekst dopełnia kreację"),
});
export type AdCopy = z.infer<typeof AdCopy>;

/** What the copywriter needs from the brand and product profiles (no colours, music, layouts). */
export function profileBlock(brand: { name: string; profile: BrandProfile }, product: { name: string; profile: ProductProfile } | null): string {
  const b = brand.profile;
  const p = product?.profile;
  const brandPart = {
    nazwa: brand.name,
    czym_jest: b.tagline,
    nisza: b.niche,
    grupa: b.target_audience,
    persony: b.personas,
    ton: b.tone_of_voice,
    przewagi: b.usps,
    bezpieczenstwo: b.risk_reversal,
    dowody: b.social_proof,
    typowe_oferty: b.typical_offers,
    zakazane: b.forbidden_claims,
    uwagi: b.notes,
    preferencje: b.learned_preferences,
  };
  const productPart = p
    ? {
        nazwa: product!.name,
        co_to: p.one_liner,
        cena: p.price,
        glowny_problem: p.problem,
        problemy: p.problems,
        mechanizm: p.mechanism,
        jezyk_klienta: p.customer_language,
        korzysci: p.benefits,
        cechy: p.features,
        obiekcje: p.objections,
        oferta: p.offer,
        dowody: p.social_proof,
        emocje: p.emotions,
        grupa_produktu: p.target_audience_note,
        zakazane: p.forbidden_claims,
      }
    : null;
  return `<marka>${JSON.stringify(brandPart)}</marka>${productPart ? `\n<produkt>${JSON.stringify(productPart)}</produkt>` : ""}`;
}

export async function writeAdCopy(
  apiKey: string,
  input: { brand: { name: string; profile: BrandProfile }; product: { name: string; profile: ProductProfile } | null; creative: CreativeAnalysis; kind: "video" | "image"; note: string; previous?: AdCopy | null; ask?: string },
): Promise<AdCopy> {
  const docs = await adCopyKnowledge();
  const note = input.note.trim() ? `\n<uwagi_uzytkownika>${input.note.trim()}</uwagi_uzytkownika>` : "";
  const redo = input.previous
    ? `\n<poprzednia_wersja>${JSON.stringify({ primary: input.previous.primary, headline: input.previous.headline, description: input.previous.description })}</poprzednia_wersja>\nNapisz NOWĄ, wyraźnie inną wersję (inny hook i inne ujęcie tej samej myśli).${input.ask?.trim() ? ` Prośba użytkownika (nadrzędna): ${input.ask.trim()}` : ""}`
    : "";
  const copy = await structuredCall({
    apiKey,
    system: `Jesteś copywriterem Clipzy: piszesz tekst główny, nagłówek i opis do gotowej kreacji Meta Ads, po polsku, językiem grupy docelowej. Trzymasz się przewodnika poniżej, zwłaszcza zasady „copy dopina kreację” i zakazu zmyślania liczb.\n\n${knowledgeText(docs)}`,
    schema: AdCopy,
    maxTokens: 3000,
    content: [
      {
        type: "text",
        text: `${profileBlock(input.brand, input.product)}${note}

<kreacja typ="${input.kind === "video" ? "wideo" : "grafika"}">${JSON.stringify(input.creative)}</kreacja>${redo}

Napisz tekst główny, nagłówek i opis do TEJ kreacji: ta sama myśl i ten sam problem co w kreacji, prościej i pełniej — problem → rozwiązanie → produkt → CTA. Nagłówek ≤ 40 znaków, opis ≤ 30 znaków.`,
      },
    ],
  });
  const fix = (t: string) => fixBrandName(t.trim(), input.brand.name);
  return { ...copy, primary: fix(copy.primary), headline: fix(copy.headline), description: fix(copy.description) };
}
