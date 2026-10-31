/** Explicit local-only release rehearsal. Creates fresh databases, never resets existing ones. */
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { localEnvironment, localSql } from "./lib/professional-local-target.mts";

const root = fileURLToPath(new URL("../../", import.meta.url));
const output = new URL("../tmp/professional-release/", import.meta.url);
let target = "supabase_db_Echo";
let databaseUser = "postgres";
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
type Entry = { version: string; name?: string; file: string; sha256: string; recordedStatementsSha256?: string };
function docker(args: string[], input?: string) {
  try {
    return execFileSync("docker", ["--context", "desktop-linux", ...args], {
      encoding: "utf8", input, stdio: ["pipe", "pipe", "pipe"], timeout: 120_000, maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, POSTGRES_PASSWORD: randomBytes(32).toString("hex") },
    });
  } catch (error) {
    const detail = String((error as { stderr?: string }).stderr ?? "").split(/\r?\n/)
      .filter((line) => /ERROR:|FATAL:|DETAIL:|HINT:|Error response/.test(line)).join(" ").slice(0, 600);
    throw new Error(`Local rehearsal SQL failed: ${detail || "private process diagnostics suppressed"}`);
  }
}
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
const sql = (database: string, statement: string) => docker(["exec", "-i", target, "psql", "-U", databaseUser, "-d", database, "-X", "-qAt", "-v", "ON_ERROR_STOP=1"], statement).trim();
async function main() {
  const env = localEnvironment(root);
  const fixture = JSON.parse(await readFile(new URL("../tmp/professional-fixtures/state.json", import.meta.url), "utf8"));
  if (env.fingerprint !== fixture.fingerprint) throw new Error("Local fixture database identity changed.");
  const manifest = JSON.parse(await readFile(new URL("../../docs/releases/professional-cloud-manifest.json", import.meta.url), "utf8"));
  const snapshot = JSON.parse(await readFile(new URL("remote-history.json", output), "utf8"));
  if (snapshot.projectRef !== manifest.projectRef || manifest.baseline.length !== snapshot.rows.length) throw new Error("Verified read-only history export is required.");
  const entries: Entry[] = [...manifest.baseline, ...manifest.applyInOrder];
  if (new Set(entries.map((entry) => entry.version)).size !== entries.length) throw new Error("Duplicate migration version.");
  for (const entry of entries) {
    if (!/^\d{14}_[a-z0-9_]+\.sql$/.test(entry.file)) throw new Error("Invalid migration path.");
    if (sha(await readFile(new URL(`../../supabase/migrations/${entry.file}`, import.meta.url))) !== entry.sha256) throw new Error(`Manifest hash mismatch: ${entry.file}`);
    const recorded = snapshot.rows.find((row: { version: string }) => row.version === entry.version);
    if (recorded && (recorded.name !== entry.name || sha(JSON.stringify(recorded.statements)) !== entry.recordedStatementsSha256)) throw new Error(`Authentic baseline mismatch: ${entry.version}`);
  }
  const existingCounts = localSql("select json_build_array((select count(*) from auth.users),(select count(*) from professional_service.organizations),(select count(*) from professional_service.memberships),(select count(*) from professional_service.credential_reviews));");
  // Only platform schema definitions are copied: no accounts, sessions, passwords or data.
  let bootstrap = docker(["exec", "supabase_db_Echo", "pg_dump", "-U", "postgres", "-d", "postgres", "--schema-only", "--no-owner", "--no-acl", "--schema=auth", "--schema=storage", "--schema=extensions", "--schema=supabase_migrations"]);
  // Application Auth hooks are recreated by authentic migration history, after dependencies exist.
  bootstrap = bootstrap.replace(/CREATE TRIGGER[\s\S]*?;/g, (statement) => statement.includes("ON auth.users") ? "" : statement)
    .replace(/CREATE POLICY[\s\S]*?;/g, "") // App storage policies are recreated by the recorded history.
    .replace("CREATE SCHEMA extensions;", "CREATE SCHEMA IF NOT EXISTS extensions;");
  bootstrap = "create schema if not exists extensions; create extension if not exists pgcrypto with schema extensions; create extension if not exists \"uuid-ossp\" with schema extensions;\n" + bootstrap;
  const suffix = randomBytes(4).toString("hex");
  // A separate cluster is essential: historical ALTER ROLE statements are cluster-wide.
  // No published ports or network; existing Supabase roles/settings cannot be affected.
  target = `echo_release_validation_${suffix}`;
  docker(["run", "--detach", "--name", target, "--network", "none", "--env", "POSTGRES_PASSWORD", "public.ecr.aws/supabase/postgres:17.6.1.155"]);
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const health = docker(["inspect", target, "--format", "{{.State.Health.Status}}"]);
      if (health.trim() !== "healthy") throw new Error("Waiting for PostgreSQL initialization.");
      sql("postgres", "select 1;"); ready = true; break;
    }
    catch { await new Promise((resolve) => setTimeout(resolve, 500)); }
  }
  if (!ready) throw new Error(`Isolated PostgreSQL did not start: ${target}`);
  const roles = JSON.parse(localSql("select json_agg(rolname) from pg_roles where rolname not like 'pg_%';")) as string[];
  databaseUser = "supabase_admin";
  for (const role of roles) {
    if (!/^[a-z0-9_]+$/.test(role)) throw new Error("Unexpected role identifier.");
    sql("postgres", `do $$ begin if not exists(select 1 from pg_roles where rolname=${literal(role)}) then create role ${role}; end if; end $$;`);
  }
  databaseUser = "postgres";
  const results: Array<{ mode: string; database: string; applied: number; report?: unknown; error?: string; ownerBefore?: string; ownerAfter?: string; withdrawalGuards?: string }> = [];
  const ownerProbe = await readFile(new URL("../tests/fixtures/professional-cloud-owner-compatibility.sql", import.meta.url), "utf8");
  for (const mode of ["cloud", "fresh"]) {
    const database = `echo_release_${mode}_${suffix}`;
    sql("postgres", `create database ${database} template template0;`);
    const result: typeof results[number] = { mode, database, applied: 0 };
    results.push(result);
    try {
      sql(database, bootstrap);
      sql(database, "grant usage on schema auth to anon,authenticated,service_role;");
      sql(database, "create publication supabase_realtime;");
      const apply = async (entry: Entry, recorded = false) => {
        const history = snapshot.rows.find((row: { version: string }) => row.version === entry.version);
        const source = recorded ? history.statements.map((statement: string) => statement.trimEnd().replace(/;\s*$/, "") + ";").join("\n\n")
          : await readFile(new URL(`../../supabase/migrations/${entry.file}`, import.meta.url), "utf8");
        try { sql(database, source); }
        catch (error) { throw new Error(`${entry.file}: ${(error as Error).message}`); }
        sql(database, `insert into supabase_migrations.schema_migrations(version,name,statements) values(${literal(entry.version)},${literal(entry.file.slice(15, -4))},array[${literal(source)}]);`);
        result.applied++;
      };
      if (mode === "cloud") {
        for (const entry of manifest.baseline) await apply(entry, true);
        try { sql(database, ownerProbe); result.ownerBefore = "PASS"; }
        catch (error) { result.ownerBefore = (error as Error).message; }
        for (const entry of manifest.applyInOrder) await apply(entry);
      } else {
        for (const entry of entries.sort((a, b) => a.version.localeCompare(b.version))) await apply(entry);
      }
      const reportSql = (await readFile(new URL("professional-preflight.sql", import.meta.url), "utf8"))
        .replace(/--[^\n]*/g, "").replace(/begin transaction read only;|commit;/g, "");
      result.report = JSON.parse(sql(database, reportSql));
      try { sql(database, ownerProbe); result.ownerAfter = "PASS"; }
      catch (error) { result.ownerAfter = (error as Error).message; }
      sql(database, await readFile(new URL("../tests/fixtures/professional-withdrawal-regression.sql", import.meta.url), "utf8"));
      result.withdrawalGuards = "PASS";
      if (Number(sql(database, "select count(*) from supabase_migrations.schema_migrations;")) !== entries.length) throw new Error("Ledger count mismatch.");
    } catch (error) { result.error = (error as Error).message; }
    process.stdout.write(JSON.stringify(result) + "\n");
  }
  const afterCounts = localSql("select json_build_array((select count(*) from auth.users),(select count(*) from professional_service.organizations),(select count(*) from professional_service.memberships),(select count(*) from professional_service.credential_reviews));");
  if (existingCounts !== afterCounts) throw new Error("Existing fixture counts changed.");
  await writeFile(new URL("validation.json", output), JSON.stringify({ container: target, existingFixturesUnchanged: true, results }, null, 2) + "\n");
  if (results.some((result) => result.error || result.withdrawalGuards !== "PASS" || result.ownerAfter !== "PASS" || (result.mode === "cloud" && result.ownerBefore !== "PASS"))) process.exitCode = 1;
}
main().catch((error: unknown) => { process.stderr.write((error instanceof Error ? error.message : "Local release check failed.") + "\n"); process.exitCode = 1; })
  .finally(() => {
    // Stop only this runner's isolated cluster, retaining it for inspection.
    if (/^echo_release_validation_[a-f0-9]{8}$/.test(target)) {
      try { docker(["stop", target]); } catch { process.stderr.write(`Stop the isolated validation container manually: ${target}\n`); }
    }
  });
