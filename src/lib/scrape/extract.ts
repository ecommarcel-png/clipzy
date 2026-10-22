import * as cheerio from "cheerio";

// Pure HTML → facts extraction (no network), so it can be unit-tested.

export type PageFacts = {
  url: string;
  title: string | null;
  description: string | null;
  siteName: string | null;
  ogImage: string | null;
  themeColor: string | null;
  lang: string | null;
  icons: string[];
  logoCandidates: string[];
  jsonLd: unknown[];
  headings: string[];
  text: string;
  links: Array<{ href: string; text: string }>;
  stylesheets: string[];
  inlineCss: string;
  isShopify: boolean;
};

const MAX_TEXT = 12_000;

function abs(href: string | undefined | null, base: string): string | null {
  if (!href) return null;
  try {
    const u = new URL(href.trim(), base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function clean(s: string | undefined | null): string | null {
  const v = (s ?? "").replace(/\s+/g, " ").trim();
  return v || null;
}

export function extractPage(html: string, url: string): PageFacts {
  const $ = cheerio.load(html);

  const jsonLd: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).text());
      if (Array.isArray(parsed)) jsonLd.push(...parsed);
      else if (parsed && typeof parsed === "object" && Array.isArray((parsed as { "@graph"?: unknown[] })["@graph"])) {
        jsonLd.push(...(parsed as { "@graph": unknown[] })["@graph"]);
      } else jsonLd.push(parsed);
    } catch {
      /* malformed JSON-LD is common; skip it */
    }
  });

  const isShopify = /cdn\.shopify\.com|Shopify\.theme|shopify-section/i.test(html);
  const inlineCss = $("style").map((_, el) => $(el).text()).get().join("\n").slice(0, 200_000)
    + "\n" + $("[style]").map((_, el) => $(el).attr("style")).get().join(";\n").slice(0, 50_000);
  const stylesheets = $('link[rel="stylesheet"]').map((_, el) => abs($(el).attr("href"), url)).get().filter(Boolean) as string[];

  const icons = $('link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]')
    .map((_, el) => abs($(el).attr("href"), url)).get().filter(Boolean) as string[];

  const logoCandidates = new Set<string>();
  for (const item of jsonLd) {
    const logo = (item as { logo?: unknown })?.logo;
    const logoUrl = typeof logo === "string" ? logo : (logo as { url?: string } | undefined)?.url;
    const a = abs(logoUrl, url);
    if (a) logoCandidates.add(a);
  }
  $("img").each((_, el) => {
    const img = $(el);
    const hint = `${img.attr("class") ?? ""} ${img.attr("alt") ?? ""} ${img.attr("src") ?? ""} ${img.attr("id") ?? ""} ${img.parent().attr("class") ?? ""}`;
    if (/logo/i.test(hint)) {
      const src = img.attr("src") ?? img.attr("data-src") ?? img.attr("srcset")?.split(/[\s,]+/)[0];
      const a = abs(src, url);
      if (a) logoCandidates.add(a);
    }
  });
  $("header img").slice(0, 2).each((_, el) => {
    const a = abs($(el).attr("src"), url);
    if (a) logoCandidates.add(a);
  });

  const headings = $("h1, h2, h3").map((_, el) => clean($(el).text())).get().filter(Boolean).slice(0, 40) as string[];

  const links: Array<{ href: string; text: string }> = [];
  const seen = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = abs($(el).attr("href"), url);
    const text = clean($(el).text()) ?? "";
    if (!href || seen.has(href)) return;
    seen.add(href);
    links.push({ href, text: text.slice(0, 80) });
  });

  $("script, style, noscript, svg, iframe, template").remove();
  const text = (clean($("body").text()) ?? "").slice(0, MAX_TEXT);

  return {
    url,
    title: clean($("title").first().text()),
    description: clean($('meta[name="description"]').attr("content") ?? $('meta[property="og:description"]').attr("content")),
    siteName: clean($('meta[property="og:site_name"]').attr("content")),
    ogImage: abs($('meta[property="og:image"]').attr("content") ?? $('meta[name="twitter:image"]').attr("content"), url),
    themeColor: clean($('meta[name="theme-color"]').attr("content")),
    lang: clean($("html").attr("lang")),
    icons,
    logoCandidates: [...logoCandidates].slice(0, 6),
    jsonLd: jsonLd.slice(0, 10),
    headings,
    text,
    links: links.slice(0, 300),
    stylesheets: stylesheets.slice(0, 10),
    inlineCss,
    isShopify,
  };
}

// Count hex colors in CSS, weighting brand-ish custom properties higher.
export function colorCandidates(css: string, limit = 16): Array<{ hex: string; score: number }> {
  const scores = new Map<string, number>();
  const add = (raw: string, weight: number) => {
    let hex = raw.toLowerCase();
    if (hex.length === 4) hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    if (hex.length !== 7) return;
    scores.set(hex, (scores.get(hex) ?? 0) + weight);
  };
  for (const m of css.matchAll(/--[\w-]*(?:primary|accent|brand|button|btn|highlight|secondary|color)[\w-]*\s*:\s*(#[0-9a-f]{3}(?:[0-9a-f]{3})?)\b/gi)) {
    add(m[1], 8);
  }
  for (const m of css.matchAll(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi)) add(m[0], 1);
  return [...scores.entries()]
    .map(([hex, score]) => ({ hex, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// Links on the homepage that likely describe the brand (about, story, FAQ).
export function pickInfoLinks(facts: PageFacts, max = 2): string[] {
  const origin = new URL(facts.url).origin;
  const pattern = /(o-nas|onas|about|nasza-historia|historia|our-story|kim-jestesmy|faq|pytania|czeste-pytania)/i;
  return facts.links
    .filter((l) => l.href.startsWith(origin) && (pattern.test(l.href) || pattern.test(l.text.replace(/\s+/g, "-"))))
    .map((l) => l.href.split("#")[0])
    .filter((href, i, all) => href !== facts.url && all.indexOf(href) === i)
    .slice(0, max);
}
