import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const frontend = path.resolve(__dirname, "..");
export default defineConfig({
  root: path.join(__dirname, "harness"), plugins: [react()],
  // Explicit nonsensitive values; never import the application .env into QA.
  define: { "process.env": JSON.stringify({ NODE_ENV: "development", NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:3101/__disabled", NEXT_PUBLIC_DATA_ADAPTER: "http" }) },
  server: { host: "127.0.0.1", port: 3101, strictPort: true, fs: { allow: [frontend, path.resolve(frontend, "../node_modules")] } },
  css: { postcss: frontend },
  resolve: { alias: [
    ...["next/navigation", "next/link"].map((find) => ({ find, replacement: path.join(__dirname, "harness/next.tsx") })),
    { find: "next/image", replacement: path.join(__dirname, "harness/image.tsx") },
    {find: /^@\/services\/notifications$/, replacement: path.join(__dirname,"harness/services.ts")},
    ...[ "@/services/settings/settings.service", "@/services/professionals/professional-api", "@/services/experience/experience-api", "@/services/authentication/auth-service.factory", "@/services/authentication/reviewer-mfa"].map((find) => ({ find, replacement: path.join(__dirname, "harness/services.ts") })),
    { find: "@", replacement: path.join(frontend, "src") },
  ] },
});
