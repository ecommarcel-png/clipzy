import { describe, expect, it } from "vitest";
import { brandCompleteness, productCompleteness } from "@/lib/profiles/completeness";
import { EMPTY_BRAND_PROFILE, BrandProfileSchema } from "@/lib/profiles/brand";
import { EMPTY_PRODUCT_PROFILE, ProductProfileSchema, upgradeProductProfile } from "@/lib/profiles/product";
import { withDefaults } from "@/lib/profiles/common";

const fullBrand = {
  ...EMPTY_BRAND_PROFILE,
  target_audience: {
    gender: "kobiety" as const,
    age_from: 25,
    age_to: 40,
    description: "Mamy niemowląt, które dużo spacerują z wózkiem po mieście.",
    pains: ["a1", "a2", "a3", "a4", "a5", "a6"],
    desires: ["d1", "d2", "d3", "d4"],
    objections: [],
  },
  personas: [
    { name: "Mama w biegu", who: "x", main_problem: "brak rąk", trigger: "spacer" },
    { name: "Babcia na prezent", who: "x", main_problem: "szuka prezentu", trigger: "baby shower" },
    { name: "Tata gadżeciarz", who: "x", main_problem: "bałagan w wózku", trigger: "wyjazd" },
  ],
  tone_of_voice: { ...EMPTY_BRAND_PROFILE.tone_of_voice, description: "Ciepło, po koleżeńsku, konkretnie." },
};

describe("brand completeness", () => {
  it("is 100 when audience, personas and problems are there — no operational details needed", () => {
    expect(brandCompleteness(fullBrand)).toEqual({ score: 100, missing: [] });
  });

  it("names what's missing", () => {
    const c = brandCompleteness({ ...fullBrand, personas: [] });
    expect(c.score).toBe(80);
    expect(c.missing).toEqual(["co najmniej 3 persony"]);
  });

  it("an empty profile scores low", () => {
    expect(brandCompleteness(EMPTY_BRAND_PROFILE).score).toBeLessThan(20);
  });

  it("filling more in never lowers the score", () => {
    const before = brandCompleteness({ ...fullBrand, personas: fullBrand.personas.slice(0, 1) }).score;
    const after = brandCompleteness(fullBrand).score;
    expect(after).toBeGreaterThanOrEqual(before);
  });
});

describe("product completeness", () => {
  const angle = (i: number) => ({ angle: `Kąt numer ${i}`, persona: "p", problem: "x", awareness: "świadomy problemu", hook: `Hook numer ${i} z obrazem` });
  const full = {
    ...EMPTY_PRODUCT_PROFILE,
    problem: "Mama nie ma wolnej ręki na spacerze",
    problems: ["1", "2", "3", "4", "5", "6"],
    mechanism: "Mocowanie na rączce wózka trzyma wszystko pod ręką",
    benefits: ["b1", "b2", "b3", "b4", "b5"],
    ad_angles: Array.from({ length: 8 }, (_, i) => angle(i)),
    objections: [
      { objection: "Czy się zmieści?", answer: "Pasuje do 9/10 wózków" },
      { objection: "Czy wytrzyma?", answer: "Wzmocnione szwy" },
      { objection: "Czy łatwo zdjąć?", answer: "Jeden ruch" },
    ],
  };

  it("is 100 with problems, mechanism, angles and objections", () => {
    expect(productCompleteness(full).score).toBe(100);
  });

  it("angles without hooks don't count", () => {
    const c = productCompleteness({ ...full, ad_angles: full.ad_angles.map((a) => ({ ...a, hook: "" })) });
    expect(c.missing).toContain("co najmniej 8 kątów reklamowych z hookiem");
  });
});

describe("profile upgrades", () => {
  it("turns old string angles into structured ones that pass the schema", () => {
    const old = { name: "X", ad_angles: ["Mama w biegu", "Prezent dla mamy"] };
    const upgraded = withDefaults(EMPTY_PRODUCT_PROFILE, upgradeProductProfile(old));
    expect(upgraded.ad_angles[0]).toEqual({ angle: "Mama w biegu", persona: "", problem: "", awareness: "", hook: "" });
    expect(ProductProfileSchema.safeParse(upgraded).success).toBe(true);
  });

  it("old brand profiles without personas still pass the schema", () => {
    const old = { name: "MAMIQO", target_audience: { gender: "kobiety", age_from: 25, age_to: 40 } };
    expect(BrandProfileSchema.safeParse(withDefaults(EMPTY_BRAND_PROFILE, old)).success).toBe(true);
  });
});
