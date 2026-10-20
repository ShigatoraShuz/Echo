import type { NextConfig } from "next";
import { unstable_getResponseFromNextConfig } from "next/experimental/testing/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

let nextConfig: NextConfig;

beforeAll(async () => {
  // Test production header rules without loading backend development secrets.
  vi.stubEnv("NODE_ENV", "production");
  nextConfig = (await import("../../next.config")).default;
});
afterAll(() => vi.unstubAllEnvs());

async function headersFor(path: string) {
  const response = await unstable_getResponseFromNextConfig({
    url: `http://localhost:3000${path}`,
    nextConfig: { headers: nextConfig.headers },
  });
  return response.headers;
}

describe("Google sign-in page headers", () => {
  it.each(["/login", "/signup", "/professional/login?next=%2Fprofessional"])(
    "allows the GIS popup to communicate with %s",
    async (path) => {
      const headers = await headersFor(path);
      expect(headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin-allow-popups");
      expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
      expect(headers.get("X-Frame-Options")).toBe("DENY");
      expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    },
  );

  it.each(["/professional", "/professional/access", "/professional/cases/case-1", "/professional/login/nested", "/dashboard"])(
    "retains private-page isolation and referrer protection on %s",
    async (path) => {
      const headers = await headersFor(path);
      expect(headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
      expect(headers.get("Referrer-Policy")).toBe("no-referrer");
    },
  );
});
