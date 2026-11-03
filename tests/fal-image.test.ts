import { describe, expect, it } from "vitest";
import { resultImage } from "@/lib/ai/fal-image";

describe("fal image results", () => {
  it("reads nano-banana and birefnet results", () => {
    expect(resultImage({ images: [{ url: "https://x/a.jpg" }], description: "" })).toBe("https://x/a.jpg");
    expect(resultImage({ image: { url: "https://x/b.png" } })).toBe("https://x/b.png");
    expect(resultImage({ images: [] })).toBeNull();
    expect(resultImage({})).toBeNull();
  });
});
