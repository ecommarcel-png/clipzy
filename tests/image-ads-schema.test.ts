import { describe, expect, it } from "vitest";
import { z } from "zod";
import { toolSchema } from "@/lib/ai/claude";
import { FIELDS, TEMPLATES } from "@/lib/image-ads/templates";

describe("agent schemas", () => {
  it("every layout's fields can be sent to Claude as a tool schema", () => {
    const schema = z.object(Object.fromEntries(TEMPLATES.map((t) => [t, z.object({ fields: FIELDS[t] })])));
    const json = toolSchema(schema, "input") as { properties: Record<string, unknown> };
    expect(Object.keys(json.properties)).toHaveLength(12);
  });
});
