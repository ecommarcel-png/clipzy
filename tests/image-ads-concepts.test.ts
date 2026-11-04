import { describe, expect, it } from "vitest";
import { allowedTemplates, balanceConcepts, beforeAfterTarget, type Concept } from "@/lib/image-ads/concepts";

const c = (template: Concept["template"], angle = template): Concept => ({ template, angle, persona: "p", awareness: "a", visual: "v", idea: "i" });

describe("balanceConcepts", () => {
  it("drops layouts the product can't use", () => {
    expect(allowedTemplates({ beforeAfter: false, testimonial: false, offer: false })).not.toContain("testimonial");
    const out = balanceConcepts([c("testimonial"), c("hero_benefits")], 2, { beforeAfter: false, testimonial: false, offer: true });
    expect(out.map((x) => x.template)).not.toContain("testimonial");
    expect(out).toHaveLength(2);
  });

  it("puts before/after first and adds it when missing", () => {
    expect(balanceConcepts([c("hero_benefits"), c("before_after")], 2, { beforeAfter: true, testimonial: false, offer: false })[0].template).toBe("before_after");
    expect(balanceConcepts([c("hero_benefits"), c("listicle")], 2, { beforeAfter: true, testimonial: false, offer: false })[0].template).toBe("before_after");
  });

  it("never adds before/after for products without an effect", () => {
    const out = balanceConcepts([c("before_after"), c("listicle")], 2, { beforeAfter: false, testimonial: false, offer: false });
    expect(out.map((x) => x.template)).not.toContain("before_after");
  });

  it("returns exactly the requested count", () => {
    expect(balanceConcepts([c("hero_benefits"), c("listicle"), c("callouts")], 2, { beforeAfter: false, testimonial: false, offer: false })).toHaveLength(2);
    expect(balanceConcepts([c("hero_benefits")], 5, { beforeAfter: false, testimonial: false, offer: false })).toHaveLength(5);
    expect(balanceConcepts([], 3, { beforeAfter: false, testimonial: false, offer: false })).toEqual([]);
  });

  it("makes about half of the set before/after when the product has an effect", () => {
    expect(beforeAfterTarget(5, true)).toBe(3);
    expect(beforeAfterTarget(1, true)).toBe(1);
    expect(beforeAfterTarget(10, false)).toBe(0);
    const out = balanceConcepts([c("problem_solution"), c("offer"), c("callouts"), c("handwritten_note"), c("question_hook")], 5, { beforeAfter: true, testimonial: false, offer: true });
    expect(out.filter((x) => x.template === "before_after")).toHaveLength(3);
    expect(out[0].template).toBe("before_after");
    expect(out.map((x) => x.angle)).toContain("handwritten_note");
  });
});
