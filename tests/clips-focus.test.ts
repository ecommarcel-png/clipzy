import { describe, expect, it } from "vitest";
import { focusBlock, focusLabel, planFocus } from "@/lib/clips/focus";
import { shotCost, shotSeconds, spokenBetween } from "@/lib/clips/new-shot";

const profile = {
  problems: ["truskawkowe nogi", "podrażnienia po goleniu", "wrastające włoski"],
  angles: ["Gładkie nogi w jeden wieczór", "Koniec z truskawkowymi nogami", "Zamiast wosku", "Prezent dla siebie"],
};

describe("series focus", () => {
  it("keeps only values from the product profile, at most 3 each, no duplicates", () => {
    const [f] = planFocus(1, [{ problems: ["truskawkowe nogi", "truskawkowe nogi", "zmyślony problem"], angles: profile.angles }], profile);
    expect(f.problems).toEqual(["truskawkowe nogi"]);
    expect(f.angles).toEqual(profile.angles.slice(0, 3));
  });

  it("gives every sklejka of a series without picks an angle nobody else uses", () => {
    const out = planFocus(3, [{ problems: [], angles: ["Zamiast wosku"] }, { problems: [], angles: [] }, { problems: ["wrastające włoski"], angles: [] }], profile);
    expect(out).toHaveLength(3);
    expect(out[0].angles).toEqual(["Zamiast wosku"]);
    expect(out[1].angles).toEqual(["Gładkie nogi w jeden wieczór"]);
    // picked a problem: the user's choice stays as it is
    expect(out[2]).toEqual({ problems: ["wrastające włoski"], angles: [] });
  });

  it("a single sklejka without picks is left to the Reżyser; the count stays within 1–5", () => {
    expect(planFocus(1, [], profile)).toEqual([{ problems: [], angles: [] }]);
    expect(planFocus(9, [], profile)).toHaveLength(5);
    expect(planFocus(0, [], profile)).toHaveLength(1);
  });

  it("label and the block for the Reżyser", () => {
    expect(focusLabel({ problems: [], angles: ["Koniec z truskawkowymi nogami raz na zawsze bez bólu"] })).toBe("Koniec z truskawkowymi nogami raz na…");
    expect(focusBlock({ problems: [], angles: [] })).toBe("");
    expect(focusBlock({ problems: ["truskawkowe nogi"], angles: [] })).toContain("truskawkowe nogi");
  });
});

describe("new AI shot", () => {
  it("length and price shown before the click", () => {
    expect(shotSeconds(1.2)).toBe(4);
    expect(shotSeconds(5.8)).toBe(7);
    expect(shotSeconds(20)).toBe(8);
    expect(shotCost(1.2)).toBeCloseTo(1.88);
  });

  it("what the voiceover says during the shot", () => {
    const caps = [
      { start: 0, end: 1.2, text: "Masz truskawkowe nogi?" },
      { start: 1.2, end: 2.6, text: "To nie Twoja wina." },
      { start: 2.6, end: 4, text: "To zła maszynka." },
    ];
    expect(spokenBetween(caps, 1.1, 2.7)).toBe("To nie Twoja wina.");
    expect(spokenBetween(caps, 0, 4)).toBe("Masz truskawkowe nogi? To nie Twoja wina. To zła maszynka.");
  });
});
