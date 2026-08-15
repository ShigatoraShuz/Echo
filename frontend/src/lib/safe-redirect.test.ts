import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it("keeps an internal path with its query string", () => {
    expect(safeRedirectPath("/journal/new?source=dashboard")).toBe(
      "/journal/new?source=dashboard",
    );
  });

  it.each([
    "https://attacker.example/steal",
    "//attacker.example/steal",
    "/\\attacker.example/steal",
    "javascript:alert(1)",
    "\n/dashboard",
  ])("rejects unsafe redirect value %s", (candidate) => {
    expect(safeRedirectPath(candidate)).toBe("/dashboard");
  });

  it("uses the requested fallback for an absent value", () => {
    expect(safeRedirectPath(null, "/login")).toBe("/login");
  });
});
