import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

function readBackendDevelopmentEnvironment(): Record<string, string> {
  if (process.env.NODE_ENV === "production") return {};
  const filePath = path.join(__dirname, "..", "backend", ".env");
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
      }),
  );
}

const backendDevelopmentEnvironment = readBackendDevelopmentEnvironment();

const isDevelopment = process.env.NODE_ENV !== "production";
function isProductionUrl(value: string | undefined): boolean {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" && !["localhost", "127.0.0.1"].includes(url.hostname);
  } catch {
    return false;
  }
}
if (!isDevelopment && (
  !isProductionUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) ||
  !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  !isProductionUrl(process.env.NEXT_PUBLIC_API_BASE_URL) ||
  process.env.NEXT_PUBLIC_DATA_ADAPTER === "mock"
)) {
  throw new Error("Production requires Supabase and API public configuration and cannot use the mock adapter.");
}
const securityHeaders = [
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
  ...(isDevelopment
    ? []
    : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

const nextConfig: NextConfig = {
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  // Defense in depth: neither clinician demo nor the legacy fixture laboratory
  // can enter a production client/server graph, even if a route imports them.
  turbopack: { resolveAlias: process.env.NODE_ENV === "production" ? {
    "@/features/professionals/dev/professional-clinician-preview": "./src/features/professionals/dev/production-preview-disabled.tsx",
    "@/features/professionals/dev/professional-preview": "./src/features/professionals/dev/production-preview-disabled.tsx",
  } : {} },
  webpack(config, { dev }) {
    if (!dev) {
      config.resolve.alias = { ...config.resolve.alias,
        "@/features/professionals/dev/professional-clinician-preview$": path.join(__dirname, "src/features/professionals/dev/production-preview-disabled.tsx"),
        "@/features/professionals/dev/professional-preview$": path.join(__dirname, "src/features/professionals/dev/production-preview-disabled.tsx"),
      };
    }
    return config;
  },
  outputFileTracingRoot: path.join(__dirname, ".."),
  // Local monorepo development reuses only the public Supabase values from
  // backend/.env. The service-role and encryption keys are never exposed.
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? backendDevelopmentEnvironment.SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? backendDevelopmentEnvironment.SUPABASE_PUBLISHABLE_KEY ?? "",
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL ?? (isDevelopment ? "http://127.0.0.1:4200/api/v1" : ""),
    NEXT_PUBLIC_DATA_ADAPTER:
      process.env.NEXT_PUBLIC_DATA_ADAPTER ?? (isDevelopment && !backendDevelopmentEnvironment.SUPABASE_URL ? "mock" : "http"),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "plus.unsplash.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/buddy/:path*",
        headers: [
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), payment=(), usb=()" },
        ],
      },
      {
        source: "/(dashboard|journal|buddy|insights|tools|settings|professional-support|admin)/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, max-age=0",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
