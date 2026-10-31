/** Read-only local readiness check. Never loads .env, contacts cloud or creates actors. */
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { FIXTURE_TAG, LOCAL_API, localEnvironment, localSql } from "./lib/professional-local-target.mts";

async function main() {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const cli = spawnSync("docker", ["--version"], { encoding: "utf8", windowsHide: true, timeout: 10_000 });
  if (cli.error || cli.status !== 0) {
    process.stdout.write(JSON.stringify({ status: "BLOCKED", target: LOCAL_API, reason: "Docker CLI unavailable. Install/start the existing local Docker Desktop stack; do not use cloud .env settings." }) + "\n");
    process.exitCode = 1; return;
  }
  const local = localEnvironment(root);
  const fixture = JSON.parse(await readFile(new URL("../tmp/professional-fixtures/state.json", import.meta.url), "utf8"));
  if (fixture.tag !== FIXTURE_TAG || fixture.fingerprint !== local.fingerprint || !fixture.complete || fixture.retired) throw new Error("Local fixture identity unavailable");
  const migrations = JSON.parse(localSql("select coalesce(json_agg(version order by version),'[]') from supabase_migrations.schema_migrations;")) as string[];
  const bridge = "20261020103920";
  // Only fixture-owned metadata: no summaries, messages, notes, tokens or passwords.
  const owner = fixture.accounts.client?.id;
  if (typeof owner !== "string" || !/^[a-f0-9-]{36}$/.test(owner)) throw new Error("Fixture owner unavailable");
  const requests = JSON.parse(localSql(`select coalesce(json_agg(json_build_object('requestId',r.id,'organizationId',r.organization_id,'status',r.status)),'[]') from professional_service.support_requests r where user_id='${owner}'::uuid;`));
  process.stdout.write(JSON.stringify({ status: local.mfaEnabled && migrations.includes(bridge) ? "PASS" : "BLOCKED", target: LOCAL_API, database: "supabase_db_Echo/postgres (Docker Desktop, verified checkout)", mfaEnabled: local.mfaEnabled, sharedSnapshotMigrationApplied: migrations.includes(bridge), fixtureRequests: requests }) + "\n");
  if (!local.mfaEnabled || !migrations.includes(bridge)) process.exitCode = 1;
}
main().catch(() => {
  process.stderr.write("BLOCKED: local Docker topology, database identity, migration ledger or private fixture manifest could not be verified. No data was modified; private diagnostics suppressed.\n");
  process.exitCode = 1;
});
