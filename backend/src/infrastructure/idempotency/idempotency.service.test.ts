import { describe, expect, it } from "vitest";
import { IdempotencyService } from "./idempotency.service.js";

describe("journal idempotency", () => {
  const keys = { v1: "first-dedicated-secret-32-characters", v2: "second-dedicated-secret-32-characters" };
  const service = new IdempotencyService("v1", keys);
  it("uses keyed HMAC and canonical request hashes without retaining raw keys", () => {
    const a = service.identify("1234567890123456", { title: "private", body: "text" });
    const b = service.identify("1234567890123456", { body: "text", title: "private" });
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).not.toContain("1234567890123456");
    expect(a.keyHmac).toHaveLength(64);
  });
  it("detects changed requests and supports prior key versions", () => {
    const a = service.identify("1234567890123456", { analysisConsent: true });
    const b = service.identify("1234567890123456", { analysisConsent: false });
    expect(() => service.assertSameRequest(a.requestHash, b.requestHash)).toThrow();
    const rotated = new IdempotencyService("v2", keys);
    expect(rotated.matches("1234567890123456", a.keyVersion, a.keyHmac)).toBe(true);
    expect(rotated.identify("1234567890123456", {}).keyHmac).not.toBe(a.keyHmac);
  });
  it("rejects missing and short keys", () => {
    expect(() => service.identify(undefined, {})).toThrow();
    expect(() => service.identify("short", {})).toThrow();
  });
});
