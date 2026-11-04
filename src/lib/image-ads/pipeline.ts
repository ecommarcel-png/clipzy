import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BUCKET, signedUrls } from "@/lib/storage";
import { getProviderKey } from "@/lib/api-keys";
import { getBrand, getProduct, getProductImages } from "@/lib/data";
import { brandPalette } from "./colors";
import { renderAd } from "./render";
import { nextStep, type AdState, type PhotoState, type SetState, type Stage, type Step } from "./steps";
import { AD_FORMATS, StyleSchema, clip, parseFields, usesCutout, type AdFormat, type AdStyle, type Fields, type TemplateKey } from "./templates";
import type { Concept } from "./concepts";
import { cutout as cutoutImage, imageStatus, submitImage, type ImageJob } from "@/lib/ai/fal-image";
import { FalError } from "@/lib/ai/fal";
import { designStyles, photoPrompts, photosNeeded, planConcepts, reviewAds, writeCopy, type AdContext, type AdCopy, type AdReview } from "@/lib/ai/image-ads";
import { downloadName } from "@/lib/files";

// Image ads pipeline: one bounded step per server action, state kept in the database
// (image_ad_sets / image_ads), so leaving the page pauses and coming back resumes.

export type PhotoRec = {
  prompt: string; with_product: boolean; state: PhotoState; job?: ImageJob; path?: string; error?: string; attempts?: number; submitted_at?: string;
  /** made as an edit of this photo slot (before/after: "before" = the "after" photo with the problem added — same frame) */
  edit_of?: number;
};

/** Before/after: the "after" photo (slot 1) is generated first, the "before" (slot 0) is an edit of it. */
export function photoRecs(template: TemplateKey, briefs: Array<{ prompt: string; with_product: boolean }>, hasRefs: boolean): PhotoRec[] {
  return briefs.map((x, slot) =>
    template === "before_after" && slot === 0 && briefs.length > 1
      ? { prompt: x.prompt, with_product: false, state: "waiting", edit_of: 1 }
      : // the "after" photo of a before/after always shows the real product in the scene
        { prompt: x.prompt, with_product: (x.with_product || (template === "before_after" && slot === 1)) && hasRefs, state: "pending" },
  );
}

/** Edits whose source photo is ready can go to fal. */
export function promoteWaiting(photos: PhotoRec[]): PhotoRec[] {
  return photos.map((p) => (p.state === "waiting" && p.edit_of !== undefined && photos[p.edit_of]?.state === "done" ? { ...p, state: "pending" } : p));
}
export type Renders = { "1x1"?: string; "9x16"?: string; v?: number; files?: Partial<Record<AdFormat, string>> };

export type ImageAdSetRow = {
  id: string; user_id: string; brand_id: string; product_id: string | null; name: string; count: number; status: string;
  settings: {
    cutout_path?: string | null; cutout_error?: string; last_poll_at?: string;
    /** "Wskazówki dla zespołu" from the form — the agents treat them as the top priority */
    brief?: string;
    /** "Przed/po jako priorytet" (default: on) */
    before_after?: boolean;
  };
  error: string | null; created_at: string;
};
export type ImageAdRow = {
  id: string; set_id: string; idx: number; stage: Stage; template: TemplateKey; concept: Concept;
  copy: AdCopy | null; fields: Fields | null; style: AdStyle | null; photos: PhotoRec[]; renders: Renders;
  review: { first?: AdReview; final?: AdReview } | null; round: number; error: string | null; created_at: string; updated_at: string;
};

const PHOTO_TIMEOUT_MS = 10 * 60_000;
const POLL_EVERY_MS = 4000;

export async function loadSet(supabase: SupabaseClient, id: string) {
  const [{ data: set, error }, { data: ads }] = await Promise.all([
    supabase.from("image_ad_sets").select("*").eq("id", id).maybeSingle(),
    supabase.from("image_ads").select("*").eq("set_id", id).order("idx"),
  ]);
  if (error || !set) return null;
  return { set: set as ImageAdSetRow, ads: (ads ?? []) as ImageAdRow[] };
}

export function setState(set: ImageAdSetRow, ads: ImageAdRow[], now = Date.now()): SetState {
  const last = set.settings.last_poll_at ? Date.parse(set.settings.last_poll_at) : 0;
  return {
    hasAds: ads.length > 0,
    ads: ads.map((a): AdState => ({ id: a.id, stage: a.stage, photos: a.photos.map((p) => p.state) })),
    pollDue: now - last >= POLL_EVERY_MS,
  };
}

// ---------- context ----------

type Ctx = AdContext & { userId: string; refs: string[]; logo: string | null; cutoutPath: string | null };

async function toDataUrl(supabase: SupabaseClient, path: string, png = false): Promise<string | null> {
  const { data } = await supabase.storage.from(BUCKET).download(path);
  if (!data) return null;
  let buf: Buffer = Buffer.from(await data.arrayBuffer());
  let type = data.type || "image/jpeg";
  // satori draws PNG/JPEG; logos can be SVG/WebP — normalise them
  if (png || !/^image\/(png|jpe?g)$/.test(type)) {
    try {
      const sharp = (await import("sharp")).default;
      buf = await sharp(buf, { density: 200 }).resize(png ? 600 : 2048, png ? 240 : 2048, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
      type = "image/png";
    } catch {
      if (!/^image\/(png|jpe?g)$/.test(type)) return null;
    }
  }
  return `data:${type};base64,${buf.toString("base64")}`;
}

async function buildContext(supabase: SupabaseClient, set: ImageAdSetRow): Promise<Ctx> {
  const [brand, product, images] = await Promise.all([
    getBrand(supabase, set.brand_id),
    set.product_id ? getProduct(supabase, set.brand_id, set.product_id).catch(() => null) : Promise.resolve(null),
    set.product_id ? getProductImages(supabase, set.product_id).catch(() => []) : Promise.resolve([]),
  ]);
  const usable = images.filter((i) => /\.(png|jpe?g|webp)$/i.test(i.storage_path)).slice(0, 6);
  const urls = await signedUrls(supabase, usable.map((i) => i.storage_path), 3600);
  const palette = brandPalette(brand.profile.colors as unknown as Record<string, string>, Array.isArray(brand.source.logo_colors) ? (brand.source.logo_colors as string[]) : []);
  const pp = product?.profile;
  const quotes = (pp?.social_proof ?? []).filter((s) => s.split(/\s+/).length >= 8);
  return {
    userId: set.user_id,
    brand: { ...brand.profile, name: brand.name },
    product: product ? { ...product.profile, name: product.name } : null,
    palette,
    brief: (set.settings.brief ?? "").trim(),
    hasProductPhotos: usable.length > 0,
    allowed: {
      beforeAfter: set.settings.before_after ?? Boolean(pp?.before_after?.possible),
      testimonial: quotes.length > 0,
      offer: Boolean(pp?.offer?.trim() || brand.profile.typical_offers.length),
    },
    refs: usable.map((i) => urls[i.storage_path]).filter(Boolean),
    logo: brand.logo_path ? await toDataUrl(supabase, brand.logo_path, true).catch(() => null) : null,
    cutoutPath: set.settings.cutout_path ?? null,
  };
}

const folder = (ctx: { userId: string }, setId: string) => `${ctx.userId}/image-ads/${setId}`;

async function updateAd(supabase: SupabaseClient, id: string, patch: Partial<ImageAdRow>) {
  const { error } = await supabase.from("image_ads").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);

/** Account problems (bad key, no balance) stop the whole set instead of failing every creative. */
export const isAccountError = (e: unknown) => e instanceof FalError && /środków|odrzucony/.test(e.message);

// ---------- steps ----------

async function stepStrategy(supabase: SupabaseClient, set: ImageAdSetRow, ctx: Ctx) {
  const key = await getProviderKey(supabase, "anthropic");
  const concepts = await planConcepts(key, ctx, set.count);
  if (!concepts.length) throw new Error("Strateg nie zaplanował żadnej kreacji.");
  // the set open in two tabs: the other one already planned it
  const { count: existing } = await supabase.from("image_ads").select("id", { count: "exact", head: true }).eq("set_id", set.id);
  if (existing) return;
  const rows = concepts.map((c, idx) => ({ user_id: set.user_id, set_id: set.id, idx, stage: "copy", template: c.template, concept: c }));
  const { error } = await supabase.from("image_ads").insert(rows);
  if (error) throw new Error(error.message);
  if (concepts.some((c) => usesCutout(c.template))) await ensureCutout(supabase, set, ctx);
}

/** Product without background, once per set (packshot layouts, product over before/after). */
async function ensureCutout(supabase: SupabaseClient, set: ImageAdSetRow, ctx: Ctx) {
  if (ctx.cutoutPath || !ctx.refs[0] || set.settings.cutout_error) return;
  const { data } = await supabase.from("image_ad_sets").select("settings").eq("id", set.id).maybeSingle();
  const settings = { ...((data?.settings as ImageAdSetRow["settings"]) ?? set.settings) };
  if (settings.cutout_path) {
    ctx.cutoutPath = settings.cutout_path;
    return;
  }
  try {
    const fal = await getProviderKey(supabase, "fal");
    const url = await cutoutImage(fal, ctx.refs[0]);
    const path = `${folder(ctx, set.id)}/cutout.png`;
    await upload(supabase, path, await fetchBytes(url), "image/png");
    settings.cutout_path = path;
    ctx.cutoutPath = path;
  } catch (e) {
    if (isAccountError(e)) throw e;
    settings.cutout_error = errText(e);
    settings.cutout_path = null;
  }
  await supabase.from("image_ad_sets").update({ settings }).eq("id", set.id);
}

async function stepCopy(supabase: SupabaseClient, ctx: Ctx, ads: ImageAdRow[]) {
  const key = await getProviderKey(supabase, "anthropic");
  const items = ads.map((a, i) => ({ key: `k${i + 1}`, template: a.template, concept: a.concept }));
  const out = await writeCopy(key, ctx, items);
  await Promise.all(ads.map((a, i) => {
    const r = out[`k${i + 1}`];
    return r ? updateAd(supabase, a.id, { fields: r.fields, copy: r.copy, stage: "design" }) : updateAd(supabase, a.id, { stage: "error", error: "Copywriter nie oddał tekstów." });
  }));
}

async function stepDesign(supabase: SupabaseClient, set: ImageAdSetRow, ctx: Ctx, ads: ImageAdRow[]) {
  const key = await getProviderKey(supabase, "anthropic");
  // a creative regenerated into a packshot layout may need the cut-out product now
  if (ads.some((a) => usesCutout(a.template))) await ensureCutout(supabase, set, ctx);
  const cut = Boolean(ctx.cutoutPath);
  const items = ads.map((a, i) => ({ key: `k${i + 1}`, template: a.template, concept: a.concept, fields: a.fields as Fields }));
  const [photos, styles] = await Promise.all([photoPrompts(key, ctx, items, cut), designStyles(key, ctx, items)]);
  await Promise.all(ads.map((a, i) => {
    const k = `k${i + 1}`;
    const p = photos[k];
    const need = photosNeeded(a.template, cut);
    const style = StyleSchema.parse({ ...styles[k], focus: p?.focus ?? "center" });
    const recs: PhotoRec[] = need ? photoRecs(a.template, (p?.photos ?? []).slice(0, need), ctx.refs.length > 0) : [];
    if (need && recs.length < need) return updateAd(supabase, a.id, { stage: "error", error: "Fotograf nie przygotował zdjęć." });
    return updateAd(supabase, a.id, { style, photos: recs, stage: recs.length ? "photos" : "render" });
  }));
}

async function stepSubmit(supabase: SupabaseClient, ctx: Ctx, ads: ImageAdRow[]) {
  const fal = await getProviderKey(supabase, "fal");
  await Promise.all(ads.map(async (a) => {
    const photos = [...a.photos];
    try {
      for (let s = 0; s < photos.length; s++) {
        if (photos[s].state !== "pending") continue;
        const src = photos[s].edit_of !== undefined ? photos[photos[s].edit_of!]?.path : undefined;
        const editUrl = src ? (await supabase.storage.from(BUCKET).createSignedUrl(src, 3600)).data?.signedUrl : undefined;
        const job = await submitImage(fal, { prompt: photos[s].prompt, imageUrls: editUrl ? [editUrl] : photos[s].with_product ? ctx.refs : [] });
        photos[s] = { ...photos[s], state: "submitted", job, submitted_at: new Date().toISOString(), attempts: (photos[s].attempts ?? 0) + 1 };
      }
      await updateAd(supabase, a.id, { photos });
    } catch (e) {
      if (isAccountError(e)) {
        await updateAd(supabase, a.id, { photos });
        throw e;
      }
      await updateAd(supabase, a.id, { photos, stage: "error", error: `Zdjęcie (fal.ai): ${errText(e)}` });
    }
  }));
}

async function fetchBytes(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`pobieranie obrazu (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

async function upload(supabase: SupabaseClient, path: string, body: Buffer, contentType: string) {
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, { contentType, upsert: true });
  if (error) throw new Error(error.message);
}

async function stepPoll(supabase: SupabaseClient, set: ImageAdSetRow, ctx: Ctx, ads: ImageAdRow[], wait: boolean) {
  if (wait) await new Promise((r) => setTimeout(r, POLL_EVERY_MS));
  await supabase.from("image_ad_sets").update({ settings: { ...set.settings, last_poll_at: new Date().toISOString() } }).eq("id", set.id);
  const fal = await getProviderKey(supabase, "fal");
  await Promise.all(ads.map(async (a) => {
    const photos = [...a.photos];
    let failed: string | null = null;
    for (let s = 0; s < photos.length; s++) {
      const p = photos[s];
      if (p.state !== "submitted" || !p.job) continue;
      try {
        const st = await imageStatus(fal, p.job);
        if (st.state === "done" && st.url) {
          const path = `${folder(ctx, a.set_id)}/${a.id}-p${s}-${randomUUID().slice(0, 8)}.jpg`;
          await upload(supabase, path, await fetchBytes(st.url), "image/jpeg");
          if (p.path) await supabase.storage.from(BUCKET).remove([p.path]);
          photos[s] = { ...p, state: "done", path, job: undefined, error: undefined };
        } else if (st.state === "failed") {
          // one more try with the same prompt, then the creative reports the error
          photos[s] = (p.attempts ?? 1) < 2 ? { ...p, state: "pending", error: st.error } : { ...p, state: "error", error: st.error };
          if (photos[s].state === "error") failed = st.error ?? "błąd";
        } else if (p.submitted_at && Date.now() - Date.parse(p.submitted_at) > PHOTO_TIMEOUT_MS) {
          photos[s] = { ...p, state: "error", error: "fal.ai nie oddał zdjęcia w 10 minut" };
          failed = photos[s].error!;
        }
      } catch (e) {
        if (isAccountError(e)) throw e;
        failed = errText(e);
      }
    }
    const next = promoteWaiting(photos);
    const allDone = next.every((p) => p.state === "done");
    await updateAd(supabase, a.id, failed ? { photos: next, stage: "error", error: `Zdjęcie (fal.ai): ${failed}` } : { photos: next, stage: allDone ? "render" : "photos" });
  }));
}

/** Draw both formats of one creative and store them (a new version each time, so links never show a stale picture). */
export async function renderAndStore(supabase: SupabaseClient, ctx: { userId: string; logo: string | null; cutoutPath: string | null; brandName: string; brandColors: { primary: string; secondary: string; accent: string } }, a: ImageAdRow) {
  if (!a.fields || !a.style) throw new Error("Kreacja nie ma jeszcze tekstów.");
  const [photos, cut] = await Promise.all([
    Promise.all(a.photos.map((p) => (p.path ? toDataUrl(supabase, p.path) : Promise.resolve(null)))),
    ctx.cutoutPath && usesCutout(a.template) ? toDataUrl(supabase, ctx.cutoutPath) : Promise.resolve(null),
  ]);
  const v = (a.renders.v ?? 0) + 1;
  const next: Renders = { v, files: a.renders.files ?? {} };
  const old: string[] = [];
  for (const fmt of AD_FORMATS) {
    const png = await renderAd({ template: a.template, fields: a.fields, style: a.style, brand: { name: ctx.brandName, logo: ctx.logo, colors: ctx.brandColors }, photos, cutout: cut }, fmt);
    const path = `${folder(ctx, a.set_id)}/${a.id}-${fmt}-v${v}.png`;
    await upload(supabase, path, png, "image/png");
    next[fmt] = path;
    if (a.renders[fmt]) old.push(a.renders[fmt]!);
  }
  return { renders: next, old };
}

function renderCtx(ctx: Ctx) {
  const c = ctx.brand.colors as unknown as Record<string, string>;
  return { userId: ctx.userId, logo: ctx.logo, cutoutPath: ctx.cutoutPath, brandName: ctx.brand.name, brandColors: { primary: c.primary || "#111111", secondary: c.secondary || "#ffffff", accent: c.accent || ctx.palette[0] } };
}

async function stepRender(supabase: SupabaseClient, set: ImageAdSetRow, ctx: Ctx, ads: ImageAdRow[]) {
  for (const a of ads) {
    try {
      const { renders, old } = await renderAndStore(supabase, renderCtx(ctx), a);
      const stage: Stage = a.round === 0 ? "review" : "final";
      await updateAd(supabase, a.id, { renders, stage });
      // files already in "Twoje pliki" point at the new version
      if (renders.files && Object.keys(renders.files).length) await syncFiles(supabase, set, ctx, { ...a, renders });
      if (old.length) await supabase.storage.from(BUCKET).remove(old);
    } catch (e) {
      await updateAd(supabase, a.id, { stage: "error", error: `Render: ${errText(e)}` });
    }
  }
}

async function small(supabase: SupabaseClient, path: string): Promise<string> {
  const { data } = await supabase.storage.from(BUCKET).download(path);
  if (!data) throw new Error("brak pliku renderu");
  const sharp = (await import("sharp")).default;
  const buf = await sharp(Buffer.from(await data.arrayBuffer())).resize(560).jpeg({ quality: 78 }).toBuffer();
  return buf.toString("base64");
}

export function applyReview(a: ImageAdRow, r: AdReview): Partial<ImageAdRow> {
  const fixes = r.score < 9 && (r.fields_patch || r.style_patch || r.photo_redo?.length || r.copy_patch);
  if (!fixes) return { review: { first: r, final: r }, stage: "done", round: 1 };
  const fields = (r.fields_patch && parseFields(a.template, { ...a.fields, ...r.fields_patch })) || a.fields;
  const style = StyleSchema.safeParse({ ...a.style, ...(r.style_patch ?? {}) });
  const copy = a.copy && r.copy_patch
    ? { primary_text: (r.copy_patch.primary_text ?? a.copy.primary_text).trim().slice(0, 900), headline: clip(r.copy_patch.headline ?? a.copy.headline, 40), description: clip(r.copy_patch.description ?? a.copy.description, 30) }
    : a.copy;
  const photos = [...a.photos];
  let redo = false;
  for (const p of r.photo_redo ?? []) {
    if (!photos[p.slot]) continue;
    const old = photos[p.slot];
    photos[p.slot] = { prompt: p.prompt, with_product: p.with_product && old.with_product, state: old.edit_of !== undefined && (r.photo_redo ?? []).some((x) => x.slot === old.edit_of) ? "waiting" : "pending", path: old.path, attempts: 0, ...(old.edit_of !== undefined ? { edit_of: old.edit_of } : {}) };
    redo = true;
  }
  // a new "after" photo means the "before" made from it is redone too
  for (const [i, p] of photos.entries()) {
    if (p.edit_of !== undefined && photos[p.edit_of].state === "pending" && p.state === "done") photos[i] = { ...p, state: "waiting", attempts: 0 };
  }
  return { review: { first: r }, fields, style: style.success ? style.data : a.style, copy, photos, round: 1, stage: redo ? "photos" : "render" };
}

/** The real product photo, small, for the Kontroler to compare with. */
async function refThumb(url: string): Promise<string> {
  const sharp = (await import("sharp")).default;
  const buf = await sharp(await fetchBytes(url)).resize(420, 420, { fit: "inside" }).flatten({ background: "#ffffff" }).jpeg({ quality: 80 }).toBuffer();
  return buf.toString("base64");
}

async function reviewItems(supabase: SupabaseClient, ads: ImageAdRow[]) {
  return Promise.all(ads.map(async (a, i) => ({
    key: `k${i + 1}`, template: a.template, fields: a.fields as Fields, copy: a.copy as AdCopy, style: a.style as AdStyle,
    square: await small(supabase, a.renders["1x1"]!), tall: await small(supabase, a.renders["9x16"]!), note: a.concept.note,
  })));
}

async function stepReview(supabase: SupabaseClient, set: ImageAdSetRow, ctx: Ctx, ads: ImageAdRow[], final: boolean) {
  const key = await getProviderKey(supabase, "anthropic");
  const ref = ctx.refs[0] ? await refThumb(ctx.refs[0]).catch(() => null) : null;
  const out = await reviewAds(key, ctx, await reviewItems(supabase, ads), final, ref);
  for (const [i, a] of ads.entries()) {
    const r = out[`k${i + 1}`];
    const patch: Partial<ImageAdRow> = !r
      ? { stage: "done" }
      : final
        ? { review: { ...(a.review ?? {}), final: r }, stage: "done" }
        : applyReview(a, r);
    await updateAd(supabase, a.id, patch);
    if (patch.stage === "done") await syncFiles(supabase, set, ctx, { ...a, ...patch } as ImageAdRow);
  }
}

/** Finished graphics in "Twoje pliki" (one file per format, updated in place on later renders). */
async function syncFiles(supabase: SupabaseClient, set: ImageAdSetRow, ctx: { userId: string; brand: { name: string }; product: { name: string } | null }, a: ImageAdRow) {
  const files = { ...(a.renders.files ?? {}) };
  const base = a.copy?.headline || (a.fields && "headline" in a.fields ? String((a.fields as { headline?: string }).headline ?? "") : "") || "Reklama";
  let changed = false;
  for (const fmt of AD_FORMATS) {
    const path = a.renders[fmt];
    if (!path) continue;
    const meta = { brand_name: ctx.brand.name, product_name: ctx.product?.name ?? null, set_name: set.name, copy: a.copy, template: a.template, link: `/image-ads/${set.id}` };
    if (files[fmt]) {
      await supabase.from("ad_files").update({ path, meta, review: a.review?.final ?? null }).eq("id", files[fmt]!);
    } else {
      const id = randomUUID();
      const { error } = await supabase.from("ad_files").insert({
        id, user_id: ctx.userId, brand_id: set.brand_id, product_id: set.product_id, image_set_id: set.id, tool: "image-ads", kind: "image",
        path, format: fmt, variant: a.idx + 1, name: clip(`${base} · ${fmt.replace("x", ":")}`, 80), meta, review: a.review?.final ?? null,
      });
      if (!error) {
        files[fmt] = id;
        changed = true;
      }
    }
  }
  if (changed) await updateAd(supabase, a.id, { renders: { ...a.renders, files } });
}

export type AdvanceResult = { step: Step["kind"]; done: boolean };

/** Run the next step of a set. Throws only on errors that stop the whole set (missing keys, Strateg failure). */
export async function advance(supabase: SupabaseClient, setId: string): Promise<AdvanceResult> {
  const loaded = await loadSet(supabase, setId);
  if (!loaded) throw new Error("Nie znaleziono zestawu.");
  const { set, ads } = loaded;
  const step = nextStep(setState(set, ads));
  // the Strateg failed: wait for "Spróbuj ponownie" instead of calling it again and again
  if (step.kind === "strategy" && set.status === "error") return { step: "done", done: true };
  if (step.kind === "done") {
    if (set.status !== "done") await supabase.from("image_ad_sets").update({ status: "done", error: null }).eq("id", set.id);
    return { step: "done", done: true };
  }
  const ctx = await buildContext(supabase, set);
  const pick = (ids: string[]) => ads.filter((a) => ids.includes(a.id));
  switch (step.kind) {
    case "strategy": await stepStrategy(supabase, set, ctx); break;
    case "copy": await stepCopy(supabase, ctx, pick(step.ids)); break;
    case "design": await stepDesign(supabase, set, ctx, pick(step.ids)); break;
    case "submit": await stepSubmit(supabase, ctx, pick(step.ids)); break;
    case "poll": await stepPoll(supabase, set, ctx, pick(step.ids), step.wait); break;
    case "render": await stepRender(supabase, set, ctx, pick(step.ids)); break;
    case "review": await stepReview(supabase, set, ctx, pick(step.ids), false); break;
    case "final": await stepReview(supabase, set, ctx, pick(step.ids), true); break;
    case "fix": await Promise.all(pick(step.ids).map((a) => updateAd(supabase, a.id, { stage: "render" }))); break;
  }
  return { step: step.kind, done: false };
}

/** Batch errors (a Claude call for 5 creatives failed) mark just those creatives, the rest goes on. */
export async function failStep(supabase: SupabaseClient, setId: string, message: string) {
  const loaded = await loadSet(supabase, setId);
  if (!loaded) return;
  const step = nextStep(setState(loaded.set, loaded.ads));
  if (step.kind === "strategy" || step.kind === "done") {
    await supabase.from("image_ad_sets").update({ status: "error", error: message }).eq("id", setId);
    return;
  }
  if (step.kind === "poll") return;
  await Promise.all(step.ids.map((id) => updateAd(supabase, id, { stage: "error", error: message })));
}

// ---------- user actions ----------

export async function resetAd(supabase: SupabaseClient, ad: ImageAdRow, change: { template?: TemplateKey; note?: string } = {}) {
  const template = change.template ?? ad.template;
  const note = change.note?.trim().slice(0, 600);
  const concept: Concept = { ...ad.concept, template, ...(note ? { note } : {}) };
  await updateAd(supabase, ad.id, { stage: "copy", template, concept, fields: null, copy: null, style: null, photos: [], review: null, round: 0, error: null });
  await supabase.from("image_ad_sets").update({ status: "running", error: null }).eq("id", ad.set_id);
}

export async function saveEdits(supabase: SupabaseClient, setId: string, adId: string, edits: { fields: unknown; style: unknown; copy: unknown }) {
  const loaded = await loadSet(supabase, setId);
  const ad = loaded?.ads.find((a) => a.id === adId);
  if (!loaded || !ad) throw new Error("Nie znaleziono kreacji.");
  const fields = parseFields(ad.template, edits.fields);
  if (!fields) throw new Error("Uzupełnij wszystkie wymagane teksty.");
  const style = StyleSchema.parse(edits.style);
  const c = (edits.copy ?? {}) as Partial<AdCopy>;
  const copy: AdCopy = { primary_text: String(c.primary_text ?? "").trim().slice(0, 900), headline: clip(String(c.headline ?? ""), 40), description: clip(String(c.description ?? ""), 30) };
  const ctx = await buildContext(supabase, loaded.set);
  const next = { ...ad, fields, style, copy };
  const { renders, old } = await renderAndStore(supabase, renderCtx(ctx), next);
  await updateAd(supabase, ad.id, { fields, style, copy, renders });
  await syncFiles(supabase, loaded.set, ctx, { ...next, renders });
  if (old.length) await supabase.storage.from(BUCKET).remove(old);
}

export function adDownloadName(a: Pick<ImageAdRow, "idx" | "copy">, fmt: AdFormat, brand: string) {
  return downloadName(`${brand} ${a.idx + 1} ${a.copy?.headline ?? ""} ${fmt}`, "png");
}
