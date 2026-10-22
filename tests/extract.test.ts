import { describe, expect, it } from "vitest";
import { colorCandidates, extractPage, pickInfoLinks } from "@/lib/scrape/extract";

const HTML = `<!doctype html><html lang="pl"><head>
<title>Wieczna Łapa — pamiątka po pupilu</title>
<meta name="description" content="Zestaw do odcisku łapy psa i kota.">
<meta property="og:site_name" content="Wieczna Łapa">
<meta property="og:image" content="/img/og.jpg">
<meta name="theme-color" content="#F5C542">
<link rel="icon" href="/favicon.png">
<link rel="stylesheet" href="https://cdn.shopify.com/s/files/theme.css">
<style>:root{--color-primary:#3b2a1a;--button-bg:#F5C542} .x{color:#3b2a1a} .y{background:#fff}</style>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","logo":"https://wiecznalapa.pl/logo.png"}</script>
<script>var Shopify = Shopify || {}; Shopify.theme = {};</script>
</head><body>
<header><a href="/"><img src="/assets/brand-logo.svg" alt="Wieczna Łapa logo"></a></header>
<nav><a href="/pages/o-nas">O nas</a><a href="/pages/faq">Najczęstsze pytania</a><a href="https://instagram.com/x">IG</a></nav>
<h1>Zachowaj jego ślad na zawsze</h1>
<p>Bezpieczne dla zwierząt. Gotowe w 10 minut.</p>
<script>console.log("should not appear")</script>
</body></html>`;

describe("extractPage", () => {
  const facts = extractPage(HTML, "https://wiecznalapa.pl/");

  it("reads meta data", () => {
    expect(facts.title).toBe("Wieczna Łapa — pamiątka po pupilu");
    expect(facts.description).toBe("Zestaw do odcisku łapy psa i kota.");
    expect(facts.siteName).toBe("Wieczna Łapa");
    expect(facts.ogImage).toBe("https://wiecznalapa.pl/img/og.jpg");
    expect(facts.themeColor).toBe("#F5C542");
    expect(facts.lang).toBe("pl");
    expect(facts.isShopify).toBe(true);
  });

  it("finds logo candidates from JSON-LD and img tags", () => {
    expect(facts.logoCandidates).toContain("https://wiecznalapa.pl/logo.png");
    expect(facts.logoCandidates).toContain("https://wiecznalapa.pl/assets/brand-logo.svg");
  });

  it("extracts visible text without scripts", () => {
    expect(facts.text).toContain("Gotowe w 10 minut");
    expect(facts.text).not.toContain("should not appear");
    expect(facts.headings).toContain("Zachowaj jego ślad na zawsze");
  });

  it("picks about/FAQ pages on the same site", () => {
    expect(pickInfoLinks(facts)).toEqual(["https://wiecznalapa.pl/pages/o-nas", "https://wiecznalapa.pl/pages/faq"]);
  });

  it("ranks brand colors from CSS custom properties first", () => {
    const colors = colorCandidates(facts.inlineCss);
    expect(colors[0].hex).toBe("#3b2a1a");
    expect(colors.map((c) => c.hex)).toContain("#f5c542");
    expect(colors.map((c) => c.hex)).toContain("#ffffff");
  });
});
