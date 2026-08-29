import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { referencedDatabaseTables, usesDirectSupabaseClient } from "./architecture-rules.mjs";

const root = resolve(import.meta.dirname, "..");
const violations = [];
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".py"]);
const extension = (path) => path.slice(path.lastIndexOf("."));
function files(directory) {
  const result = [];
  for (const name of readdirSync(directory)) {
    if (["node_modules", "dist", ".next", ".git", ".venv", ".pytest_cache", ".ruff_cache", "__pycache__"].includes(name)) continue;
    const path = join(directory, name);
    if (statSync(path).isDirectory()) result.push(...files(path));
    else if (sourceExtensions.has(extension(path))) result.push(path);
  }
  return result;
}
function check(condition, file, message) { if (condition) violations.push(`${relative(root, file)}: ${message}`); }

const serviceDirectories = [join(root, "services"), join(root, "ai-service"), join(root, "ml")];
for (const directory of serviceDirectories) {
  for (const file of files(directory)) {
    const content = readFileSync(file, "utf8");
    check(/(?:from|require\s*\()\s*["'][^"']*(?:backend\/src|services\/[^/]+\/src)/.test(content), file, "imports another service or the deprecated backend internals");
    check(/https?:\/\/(?:localhost|127\.0\.0\.1):\d+/.test(content) && !file.endsWith(".test.ts"), file, "hardcodes a localhost service dependency instead of configuration");
  }
}

const ownership = {
  "api-gateway": new Set(),
  "user-service": new Set(["profiles", "user_consents", "notification_preferences", "privacy_preferences", "trusted_contacts", "data_export_requests", "account_deletion_requests", "notifications", "verification_admins", "identity_verifications", "verification_documents", "verification_reviews", "audit_events"]),
  "journal-service": new Set(["journals", "journal_drafts"]),
  "assessment-service": new Set(["mood_entries"]),
  "recommendation-service": new Set(["support_resources"]),
  "wellness-service": new Set(["buddy_conversations", "buddy_messages", "grounding_sessions", "support_resources"]),
  "insights-service": new Set(),
};
for (const [service, allowed] of Object.entries(ownership)) {
  for (const file of files(join(root, "services", service))) {
    const content = readFileSync(file, "utf8");
    for (const table of referencedDatabaseTables(content)) check(!allowed.has(table), file, `${service} accesses non-owned table ${table}`);
    check(service !== "api-gateway" && usesDirectSupabaseClient(content), file, `${service} constructs a direct Supabase client instead of using the ownership wrapper`);
  }
}

const pythonOwnership = {
  "ai-service": new Set(["journal_analyses", "analysis_windows", "analysis_feedback", "model_versions", "safety_events", "safety_event_resources"]),
  ml: new Set(),
};
for (const [service, allowed] of Object.entries(pythonOwnership)) {
  for (const file of files(join(root, service))) {
    const content = readFileSync(file, "utf8");
    for (const table of referencedDatabaseTables(content)) check(!allowed.has(table), file, `${service} accesses non-owned table ${table}`);
    check(usesDirectSupabaseClient(content), file, `${service} constructs a direct Supabase client instead of using its approved database boundary`);
  }
}

const deprecatedBackend = join(root, "backend", "src");
if (existsSync(deprecatedBackend) && files(deprecatedBackend).length > 0) {
  violations.push("backend/src: deprecated modular-monolith source still exists");
}

for (const file of files(join(root, "frontend", "src"))) {
  const content = readFileSync(file, "utf8");
  check(/(?:USER|JOURNAL|ASSESSMENT|ANALYSIS|ML|RECOMMENDATION|WELLNESS|INSIGHTS)_SERVICE_URL|(?:user|journal|assessment|analysis|ml|recommendation|wellness|insights)-service:\d+/.test(content), file, "frontend knows internal service topology");
  check(/SUPABASE_SERVICE_ROLE_KEY|SUPABASE_DATABASE_KEY|INTERNAL_SERVICE_TOKEN|(?:USER|JOURNAL|ASSESSMENT|ANALYSIS|ML|RECOMMENDATION|WELLNESS|INSIGHTS)_SERVICE_TOKEN/.test(content), file, "frontend references a server credential");
  check(/\.from\(\s*["'][a-z_]+["']\s*\)/.test(content), file, "frontend accesses an application table directly instead of using the Gateway");
}

const graph = JSON.parse(readFileSync(join(root, "docs", "architecture", "service-map.json"), "utf8")).services;
function visit(node, path = []) {
  if (path.includes(node)) violations.push(`service-map.json: circular dependency ${[...path, node].join(" -> ")}`);
  else for (const target of graph[node] ?? []) visit(target, [...path, node]);
}
for (const node of Object.keys(graph)) visit(node);

const compose = readFileSync(join(root, "docker-compose.yml"), "utf8");
check(/^\s{2}backend:/m.test(compose), join(root, "docker-compose.yml"), "deprecated modular monolith is still orchestrated");
check(!/^\s{2}api-gateway:/m.test(compose), join(root, "docker-compose.yml"), "API gateway is missing");

if (violations.length) {
  console.error(`Architecture check failed with ${violations.length} violation(s):\n${violations.map((value) => `- ${value}`).join("\n")}`);
  process.exit(1);
}
console.log("Architecture check passed: service imports, wrapper/raw-REST ownership, graph, frontend boundary, and Compose topology are valid.");
