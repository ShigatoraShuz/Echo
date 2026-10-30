import { spawn } from "node:child_process";
import { resolve } from "node:path";

// Compile against nonresolving public placeholders. This is a bundle/build check,
// not a live production Auth test, deployment or connection to shared Supabase.
const child = spawn(process.execPath, [resolve("node_modules/next/dist/bin/next"), "build"], {
  cwd: resolve("frontend"),
  windowsHide: true,
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
    NEXT_DIST_DIR: ".next-model-production",
    NEXT_PUBLIC_SUPABASE_URL: "https://echo-model-build.invalid",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "build-only-public-placeholder",
    NEXT_PUBLIC_API_BASE_URL: "https://echo-model-api.invalid/api/v1",
    GATEWAY_API_BASE_URL: "https://echo-model-api.invalid/api/v1",
    NEXT_PUBLIC_DATA_ADAPTER: "http",
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: "",
    NEXT_PUBLIC_ENABLE_ANALYSIS_PREVIEW: "false",
    NEXT_PUBLIC_ENABLE_ANALYSIS_FIXTURES: "false",
    SUPABASE_SERVICE_ROLE_KEY: "",
  },
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
