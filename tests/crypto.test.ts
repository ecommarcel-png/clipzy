import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret, lastFour } from "@/lib/crypto";

const KEY = randomBytes(32).toString("base64");

describe("API key encryption", () => {
  it("round-trips a secret", () => {
    const secret = "sk-ant-api03-very-secret-value-1234";
    const sealed = encryptSecret(secret, KEY);
    expect(sealed).not.toContain(secret);
    expect(decryptSecret(sealed, KEY)).toBe(secret);
  });

  it("uses a fresh IV every time", () => {
    expect(encryptSecret("same", KEY)).not.toBe(encryptSecret("same", KEY));
  });

  it("rejects tampered ciphertext", () => {
    const sealed = encryptSecret("secret", KEY);
    const parts = sealed.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptSecret(parts.join("."), KEY)).toThrow();
  });

  it("rejects the wrong key", () => {
    const sealed = encryptSecret("secret", KEY);
    expect(() => decryptSecret(sealed, randomBytes(32).toString("base64"))).toThrow();
  });

  it("refuses a key of the wrong length", () => {
    expect(() => encryptSecret("x", Buffer.alloc(16).toString("base64"))).toThrow(/32 bajty/);
  });

  it("keeps only the last four characters for display", () => {
    expect(lastFour("  abcdefgh1234 ")).toBe("1234");
  });
});
