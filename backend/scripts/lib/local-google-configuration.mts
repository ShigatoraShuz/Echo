import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const nextEnvironment = createRequire(import.meta.url).resolve("@next/env");

/** Read the same public audience as Next, without merging dotenv secrets into the launcher. */
export function localGoogleConfiguration(frontendDirectory: string, environment: NodeJS.ProcessEnv = process.env) {
  let clientId: string;
  try {
    // Next's loader mutates process.env. Isolate it so cloud URLs, private keys and
    // other dotenv settings cannot override the verified local stack configuration.
    clientId = execFileSync(process.execPath, ["-e", `
      const { loadEnvConfig } = require(process.argv[1]);
      loadEnvConfig(process.cwd(), true, { info() {}, error() { throw new Error("Invalid development environment"); } });
      process.stdout.write(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? "");
    `, nextEnvironment], {
      cwd: frontendDirectory, env: { ...environment, NODE_ENV: "development" },
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 10_000, windowsHide: true,
    });
  } catch {
    throw new Error("Could not read the frontend Google public configuration; private diagnostics suppressed.");
  }
  // GIS and server-side ID-token verification must use exactly the same audience.
  return { NEXT_PUBLIC_GOOGLE_CLIENT_ID: clientId, GOOGLE_WEB_CLIENT_ID: clientId };
}
