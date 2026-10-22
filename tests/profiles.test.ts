import { describe, expect, it } from "vitest";
import { cleanLists, getAt, setAt, withDefaults } from "@/lib/profiles/common";
import { BrandProfileSchema, EMPTY_BRAND_PROFILE } from "@/lib/profiles/brand";
import { EMPTY_PRODUCT_PROFILE, ProductProfileSchema } from "@/lib/profiles/product";
import { plural } from "@/lib/plural";

describe("profile helpers", () => {
  it("reads and writes nested paths without mutating the input", () => {
    const base = { a: { b: 1 } };
    const next = setAt(base, "a.c", 2);
    expect(getAt(next, "a.c")).toBe(2);
    expect(getAt(base, "a.c")).toBeUndefined();
  });

  it("fills missing fields from defaults (older stored profiles)", () => {
    const merged = withDefaults(EMPTY_BRAND_PROFILE, { name: "X", target_audience: { gender: "kobiety" } });
    expect(merged.name).toBe("X");
    expect(merged.target_audience.gender).toBe("kobiety");
    expect(merged.target_audience.age_from).toBe(18);
    expect(BrandProfileSchema.safeParse(merged).success).toBe(true);
  });

  it("removes blank list lines", () => {
    expect(cleanLists({ usps: ["  a ", "", "b", "   "], nested: { x: ["", "c"] }, n: 3 })).toEqual({ usps: ["a", "b"], nested: { x: ["c"] }, n: 3 });
  });

  it("empty profiles are valid against their schemas", () => {
    expect(BrandProfileSchema.safeParse(EMPTY_BRAND_PROFILE).success).toBe(true);
    expect(ProductProfileSchema.safeParse(EMPTY_PRODUCT_PROFILE).success).toBe(true);
  });
});

describe("Polish plurals", () => {
  it.each([
    [1, "usterkę"],
    [2, "usterki"],
    [4, "usterki"],
    [5, "usterek"],
    [12, "usterek"],
    [22, "usterki"],
    [25, "usterek"],
  ])("%i → %s", (n, word) => expect(plural(n, "usterkę", "usterki", "usterek")).toBe(word));
});
