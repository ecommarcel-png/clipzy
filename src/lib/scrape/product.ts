import "server-only";
import { extractPage } from "./extract";
import { FetchError, normalizeUrl, safeFetch } from "./safe-fetch";

export type ProductSource = {
  url: string;
  title: string | null;
  description: string | null;
  price: string | null;
  currency: string | null;
  images: string[];
  variants: string[];
  tags: string[];
  pageText: string;
  reviewsHint: string | null;
  fetchedAt: string;
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

type JsonLdProduct = {
  "@type"?: string | string[];
  name?: string;
  description?: string;
  image?: string | string[] | Array<{ url?: string }>;
  offers?: { price?: string | number; priceCurrency?: string } | Array<{ price?: string | number; priceCurrency?: string }>;
  aggregateRating?: { ratingValue?: string | number; reviewCount?: string | number };
};

function isProduct(x: unknown): x is JsonLdProduct {
  const t = (x as JsonLdProduct)?.["@type"];
  return t === "Product" || (Array.isArray(t) && t.includes("Product"));
}

export async function scrapeProductPage(input: string): Promise<ProductSource> {
  const url = normalizeUrl(input);
  const page = await safeFetch(url);
  if (page.status >= 400) throw new FetchError(`Strona produktu zwróciła błąd ${page.status}.`);
  const facts = extractPage(page.body.toString("utf8"), page.url);

  const out: ProductSource = {
    url: page.url,
    title: facts.title,
    description: facts.description,
    price: null,
    currency: null,
    images: [],
    variants: [],
    tags: [],
    pageText: facts.text.slice(0, 8000),
    reviewsHint: null,
    fetchedAt: new Date().toISOString(),
  };

  // Shopify: /products/<handle>.js is the cleanest source.
  const handle = new URL(page.url).pathname.match(/\/products\/([^/?#]+)/)?.[1];
  if (facts.isShopify && handle) {
    try {
      const res = await safeFetch(new URL(`/products/${handle}.js`, page.url), { accept: "application/json" });
      if (res.status < 400) {
        const p = JSON.parse(res.body.toString("utf8")) as {
          title?: string; description?: string; price?: number; images?: string[]; tags?: string[];
          variants?: Array<{ title?: string }>;
        };
        out.title = p.title ?? out.title;
        out.description = p.description ? stripHtml(p.description).slice(0, 6000) : out.description;
        out.price = typeof p.price === "number" ? (p.price / 100).toFixed(2) : null;
        out.images = (p.images ?? []).map((src) => (src.startsWith("//") ? `https:${src}` : src));
        out.tags = p.tags ?? [];
        out.variants = (p.variants ?? []).map((v) => v.title ?? "").filter((t) => t && t !== "Default Title");
      }
    } catch {
      /* fall back to JSON-LD / meta below */
    }
  }

  const ld = facts.jsonLd.find(isProduct);
  if (ld) {
    out.title = out.title ?? ld.name ?? null;
    if (!out.description && ld.description) out.description = stripHtml(ld.description);
    const offer = Array.isArray(ld.offers) ? ld.offers[0] : ld.offers;
    out.price = out.price ?? (offer?.price != null ? String(offer.price) : null);
    out.currency = offer?.priceCurrency ?? null;
    if (out.images.length === 0 && ld.image) {
      const imgs = Array.isArray(ld.image) ? ld.image : [ld.image];
      out.images = imgs.map((i) => (typeof i === "string" ? i : i.url ?? "")).filter(Boolean);
    }
    if (ld.aggregateRating?.ratingValue) {
      out.reviewsHint = `Ocena ${ld.aggregateRating.ratingValue}${ld.aggregateRating.reviewCount ? ` z ${ld.aggregateRating.reviewCount} opinii` : ""}`;
    }
  }

  if (out.images.length === 0 && facts.ogImage) out.images = [facts.ogImage];
  out.images = [...new Set(out.images)].slice(0, 12);
  out.currency =
    out.currency ??
    page.body.toString("utf8").match(/Shopify\.currency\s*=\s*\{\s*"active"\s*:\s*"([A-Z]{3})"/)?.[1] ??
    null;
  return out;
}
