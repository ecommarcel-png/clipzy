import "server-only";
import { colorCandidates, extractPage, pickInfoLinks, type PageFacts } from "./extract";
import { FetchError, normalizeUrl, safeFetch } from "./safe-fetch";

// What we learn about a brand from its website before asking Claude.
export type BrandSource = {
  url: string;
  home: Omit<PageFacts, "inlineCss" | "links" | "stylesheets">;
  infoPages: Array<{ url: string; title: string | null; text: string }>;
  colors: Array<{ hex: string; score: number }>;
  products: Array<{ title: string; type?: string; price?: string; url?: string }>;
  fetchedAt: string;
  warnings: string[];
};

function trimFacts(f: PageFacts): BrandSource["home"] {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { inlineCss, links, stylesheets, ...rest } = f;
  return rest;
}

export async function scrapeBrandSite(input: string): Promise<BrandSource> {
  const warnings: string[] = [];
  const start = normalizeUrl(input);
  const page = await safeFetch(start);
  if (page.status >= 400) throw new FetchError(`Strona zwróciła błąd ${page.status}. Sprawdź adres.`);
  const home = extractPage(page.body.toString("utf8"), page.url);

  // About / FAQ pages carry most of the brand voice.
  const infoPages: BrandSource["infoPages"] = [];
  for (const link of pickInfoLinks(home)) {
    try {
      const p = await safeFetch(link);
      if (p.status < 400) {
        const f = extractPage(p.body.toString("utf8"), p.url);
        infoPages.push({ url: p.url, title: f.title, text: f.text.slice(0, 5000) });
      }
    } catch {
      warnings.push(`Nie udało się pobrać ${link}`);
    }
  }

  // Colors: inline CSS plus the first couple of stylesheets.
  let css = home.inlineCss;
  for (const sheet of home.stylesheets.slice(0, 3)) {
    try {
      const s = await safeFetch(sheet, { maxBytes: 1_500_000, accept: "text/css,*/*;q=0.1" });
      if (s.status < 400) css += `\n${s.body.toString("utf8")}`;
    } catch {
      /* stylesheet is optional */
    }
  }
  const colors = colorCandidates(css);
  if (home.themeColor && /^#[0-9a-f]{3,6}$/i.test(home.themeColor)) {
    colors.unshift({ hex: home.themeColor.toLowerCase(), score: 999 });
  }

  // Shopify stores expose their catalogue as JSON.
  const products: BrandSource["products"] = [];
  if (home.isShopify) {
    try {
      const res = await safeFetch(new URL("/products.json?limit=15", page.url), { accept: "application/json" });
      if (res.status < 400) {
        const json = JSON.parse(res.body.toString("utf8")) as {
          products?: Array<{ title: string; handle: string; product_type?: string; variants?: Array<{ price?: string }> }>;
        };
        for (const p of json.products ?? []) {
          products.push({
            title: p.title,
            type: p.product_type || undefined,
            price: p.variants?.[0]?.price,
            url: new URL(`/products/${p.handle}`, page.url).toString(),
          });
        }
      }
    } catch {
      warnings.push("Nie udało się pobrać listy produktów ze sklepu.");
    }
  }

  return {
    url: page.url,
    home: trimFacts(home),
    infoPages,
    colors,
    products,
    fetchedAt: new Date().toISOString(),
    warnings,
  };
}
