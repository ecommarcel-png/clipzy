import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { encryptionKey } from "@/lib/env";

// AES-256-GCM for API keys at rest. Stored format: v1.<iv>.<tag>.<ciphertext>
// (all base64url). The key comes from APP_ENCRYPTION_KEY and never reaches
// the browser or the database.

const VERSION = "v1";

function loadKey(raw: string = encryptionKey()): Buffer {
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("APP_ENCRYPTION_KEY musi mieć 32 bajty zapisane w base64 (openssl rand -base64 32).");
  }
  return key;
}

export function encryptSecret(plaintext: string, rawKey?: string): string {
  const key = loadKey(rawKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptSecret(payload: string, rawKey?: string): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(".");
  if (version !== VERSION || !ivB64 || !tagB64 || dataB64 === undefined) {
    throw new Error("Nieprawidłowy format zaszyfrowanego klucza.");
  }
  const key = loadKey(rawKey);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64url")), decipher.final()]).toString("utf8");
}

export function lastFour(secret: string): string {
  return secret.trim().slice(-4);
}
