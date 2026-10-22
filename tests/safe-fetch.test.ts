import { describe, expect, it } from "vitest";
import { isPrivateIp, normalizeUrl, safeFetch } from "@/lib/scrape/safe-fetch";

describe("isPrivateIp", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "::ffff:127.0.0.1", "fd00::1", "fe80::1"])(
    "blocks %s",
    (ip) => expect(isPrivateIp(ip)).toBe(true),
  );
  it.each(["8.8.8.8", "172.32.0.1", "104.18.2.1", "2606:4700::1111"])("allows %s", (ip) => expect(isPrivateIp(ip)).toBe(false));
});

describe("normalizeUrl", () => {
  it("adds https when the scheme is missing", () => {
    expect(normalizeUrl("sklep.pl/produkt").toString()).toBe("https://sklep.pl/produkt");
  });
  it("rejects other protocols and credentials", () => {
    expect(() => normalizeUrl("file:///etc/passwd")).toThrow();
    expect(() => normalizeUrl("https://user:pass@sklep.pl")).toThrow();
  });
});

describe("safeFetch", () => {
  it("refuses internal hosts before connecting", async () => {
    await expect(safeFetch("http://127.0.0.1:8080/")).rejects.toThrow(/publiczny/);
    await expect(safeFetch("http://localhost/")).rejects.toThrow(/publiczny/);
    await expect(safeFetch("http://169.254.169.254/latest/meta-data")).rejects.toThrow(/publiczny/);
  });
});
