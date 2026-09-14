import { describe, expect, it } from "vitest";
import { validateJournalImage } from "../journal-images.service.js";
describe("journal image validation", () => {
  it("accepts supported binary signatures", () => {
    const bytes = Buffer.alloc(20);
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
    expect(() => validateJournalImage(bytes, "image/png")).not.toThrow();
  });
  it("rejects SVG, spoofed MIME, truncated and oversized files", () => {
    expect(() => validateJournalImage(Buffer.from("<svg><script>alert(1)</script></svg>"), "image/svg+xml")).toThrow();
    expect(() => validateJournalImage(Buffer.alloc(100), "image/png")).toThrow();
    expect(() => validateJournalImage(Buffer.from([255, 216, 255]), "image/jpeg")).toThrow();
    const bytes = Buffer.alloc(5 * 1024 * 1024 + 1);
    bytes.set([255, 216, 255]);
    expect(() => validateJournalImage(bytes, "image/jpeg")).toThrow();
  });
});
