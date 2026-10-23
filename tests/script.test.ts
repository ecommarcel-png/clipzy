import { describe, expect, it } from "vitest";
import { ScriptSchema } from "@/lib/ai/script";

const hook = (t: string) => ({ text: t, idea: "x" });

describe("ScriptSchema", () => {
  it("accepts fewer than 5 hooks instead of failing the whole script", () => {
    expect(ScriptSchema.safeParse({ angle: "a", hooks: [hook("A"), hook("B"), hook("C"), hook("D")], body: "Reszta.", notes: "" }).success).toBe(true);
  });
  it("rejects a pasted wall of text that would burn ElevenLabs credits", () => {
    const five = ["A", "B", "C", "D", "E"].map(hook);
    expect(ScriptSchema.safeParse({ angle: "a", hooks: five, body: "słowo ".repeat(600), notes: "" }).success).toBe(false);
    expect(ScriptSchema.safeParse({ angle: "a", hooks: [hook("x".repeat(300)), ...five.slice(1)], body: "Reszta.", notes: "" }).success).toBe(false);
  });
});
