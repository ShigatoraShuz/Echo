import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

export const LOCAL_API = "http://127.0.0.1:54321";
export const FIXTURE_TAG = "echo-professional-local-v1";
const context = "desktop-linux";
export function assertLocalEndpoint(value: string) {
  const url = new URL(value);
  if (url.origin !== LOCAL_API || url.username || url.password) throw new Error("Nonlocal fixture endpoint refused.");
}
export function assertLocalDocker(endpoint: string) {
  if (endpoint !== "npipe:////./pipe/dockerDesktopLinuxEngine") throw new Error("A local Docker Desktop named pipe is required.");
}
export function assertFixtureUser(user: { email?: string; app_metadata: Record<string, unknown> }, email: string) {
  if (user.email !== email || !email.endsWith("@professional.echo.test") || user.app_metadata.fixture !== FIXTURE_TAG) {
    throw new Error("Account collision: refusing to adopt or modify a nonfixture account.");
  }
}
function docker(args: string[], input?: string) {
  try {
    return execFileSync("docker", ["--context", context, ...args], {
      encoding: "utf8", input, stdio: ["pipe", "pipe", "pipe"], timeout: 30_000,
    }).trim();
  } catch { throw new Error("Local Docker check failed; private command diagnostics suppressed."); }
}
export function localSql(sql: string) {
  return docker(["exec", "-i", "supabase_db_Echo", "psql", "-U", "postgres", "-d", "postgres", "-X", "-qAt", "-v", "ON_ERROR_STOP=1"], sql);
}
type Container = {
  Id: string; Config: { Labels: Record<string, string>; Env: string[] };
  State: { Running: boolean }; NetworkSettings: { Ports: Record<string, { HostPort: string }[] | null> };
};
export function localEnvironment(root: string) {
  // No process.env SUPABASE_*, DATABASE_URL, Docker host override or project link is used.
  assertLocalDocker(JSON.parse(docker(["context", "inspect", context]))[0].Endpoints.docker.Host);
  const names = ["db", "auth", "kong", "studio", "inbucket"];
  const containers = Object.fromEntries(names.map((name) => {
    const item: Container = JSON.parse(docker(["inspect", `supabase_${name}_Echo`]))[0];
    const labels = item.Config.Labels;
    if (!item.State.Running || labels["com.supabase.cli.project"] !== "Echo" ||
      resolve(labels["com.supabase.cli.workdir"] ?? "").toLowerCase() !== resolve(root).toLowerCase()) {
      throw new Error("Container is not the running local Echo stack for this checkout.");
    }
    return [name, item];
  }));
  const vars = (name: string) => Object.fromEntries(containers[name].Config.Env.map((entry) => {
    const index = entry.indexOf("="); return [entry.slice(0, index), entry.slice(index + 1)];
  }));
  const auth = vars("auth"); const studio = vars("studio");
  const database = new URL(auth.GOTRUE_DB_DATABASE_URL);
  if (database.hostname.toLowerCase() !== "supabase_db_echo" || database.pathname !== "/postgres" ||
    !containers.kong.NetworkSettings.Ports["8000/tcp"]?.some((p) => p.HostPort === "54321") ||
    !containers.db.NetworkSettings.Ports["5432/tcp"]?.some((p) => p.HostPort === "54322") ||
    auth.GOTRUE_SMTP_HOST !== "supabase_inbucket_Echo") throw new Error("Local Auth/database/Mailpit topology could not be verified.");
  if (!studio.SUPABASE_SERVICE_KEY || !studio.SUPABASE_ANON_KEY) throw new Error("Local stack API keys unavailable.");
  const fingerprint = localSql("select system_identifier from pg_control_system();");
  if (!/^\d+$/.test(fingerprint)) throw new Error("Local PostgreSQL identity unavailable.");
  return {
    fingerprint, serviceKey: studio.SUPABASE_SERVICE_KEY, anonKey: studio.SUPABASE_ANON_KEY,
    mfaEnabled: auth.GOTRUE_MFA_TOTP_ENROLL_ENABLED === "true" && auth.GOTRUE_MFA_TOTP_VERIFY_ENABLED === "true",
  };
}
export const localFetch: typeof fetch = (input, init) => {
  assertLocalEndpoint(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  return fetch(input, { ...init, redirect: "error", signal: init?.signal ?? AbortSignal.timeout(15_000) });
};
