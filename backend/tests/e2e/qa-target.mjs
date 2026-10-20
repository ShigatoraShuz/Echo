import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function parseEnvironment(file) {
  return Object.fromEntries(readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator), line.slice(separator + 1).replace(/^(["'])(.*)\1$/, "$2")];
    }));
}

export function loadQaTarget() {
  const envFile = process.env.ECHO_QA_ENV_FILE;
  const environment = parseEnvironment(path.resolve(process.cwd(), envFile || ".env"));
  if (!envFile) return { environment, staging: false };

  const projectRef = process.env.ECHO_STAGING_PROJECT_REF;
  const webBase = process.env.ECHO_STAGING_BASE_URL;
  const apiBase = process.env.ECHO_STAGING_API_BASE_URL;
  if (!projectRef || !webBase || !apiBase) {
    throw new Error("Staging QA requires ECHO_STAGING_PROJECT_REF, ECHO_STAGING_BASE_URL and ECHO_STAGING_API_BASE_URL.");
  }
  const databaseUrl = new URL(environment.SUPABASE_URL);
  const webUrl = new URL(webBase);
  const apiUrl = new URL(apiBase);
  if (databaseUrl.protocol !== "https:" || databaseUrl.hostname !== `${projectRef}.supabase.co` ||
      webUrl.protocol !== "https:" || apiUrl.protocol !== "https:" ||
      /^(localhost|127\.0\.0\.1)$/.test(webUrl.hostname) ||
      /^(localhost|127\.0\.0\.1)$/.test(apiUrl.hostname) ||
      !apiUrl.pathname.replace(/\/$/, "").endsWith("/api/v1")) {
    throw new Error("Staging QA target must use the declared separate HTTPS web, API, and Supabase project.");
  }
  const linkedPath = path.resolve(process.cwd(), "../supabase/.temp/project-ref");
  if (existsSync(linkedPath) && readFileSync(linkedPath, "utf8").trim() === projectRef) {
    throw new Error("Staging QA cannot target the currently linked Supabase project.");
  }
  if (!environment.SUPABASE_SERVICE_ROLE_KEY || !environment.SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("The server-only staging environment needs Supabase service and publishable keys.");
  }
  return { environment, staging: true, projectRef, webBase: webUrl.origin, apiBase: apiUrl.href.replace(/\/$/, "") };
}

export async function verifyQaUserRemoved(admin, userId) {
  for (const [schema, table] of [
    ["user_service", "profiles"], ["user_service", "user_consents"],
    ["user_service", "calendar_items"], ["journal_service", "journals"],
  ]) {
    const result = await admin.schema(schema).from(table)
      .select("user_id", { count: "exact", head: true }).eq("user_id", userId);
    if (result.error || result.count !== 0) {
      throw new Error(`Disposable account cleanup left ${schema}.${table} records (${result.error?.code ?? result.count}).`);
    }
  }
}
