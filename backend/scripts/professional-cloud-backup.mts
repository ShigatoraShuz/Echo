/** Explicit cloud backup/isolated restore. No migrations or remote application writes. */
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { readFile, writeFile, rename, stat } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { localEnvironment, localSql } from "./lib/professional-local-target.mts";

const root = fileURLToPath(new URL("../../", import.meta.url));
const project = "lruciislmmqvcwweqjop";
const image = "public.ecr.aws/supabase/postgres:17.6.1.155";
let phase = "preflight";
let restoreContainer = "";
async function main() {
  const restoreOnly = process.argv.includes("--restore-only");
  const local = localEnvironment(root);
  const fixture = JSON.parse(await readFile(new URL("../tmp/professional-fixtures/state.json", import.meta.url), "utf8"));
  if (local.fingerprint !== fixture.fingerprint) throw new Error("Local fixture identity changed.");
  const before = localSql("select json_build_array((select count(*) from auth.users),(select count(*) from professional_service.organizations),(select count(*) from professional_service.memberships),(select count(*) from professional_service.credential_reviews));");
  const directory = resolve((await readFile(new URL("../tmp/professional-release/backup-location.txt", import.meta.url), "utf8")).trim());
  const parent = resolve(process.env.USERPROFILE!, "EchoBackups") + sep;
  if (!directory.startsWith(parent) || !directory.split(sep).at(-1)?.startsWith(project + "_") || directory.startsWith(resolve(root))) throw new Error("Backup must be in the private external destination.");
  const decrypt = "Add-Type -AssemblyName System.Security; $b=[Convert]::FromBase64String([Console]::In.ReadToEnd()); $p=[Security.Cryptography.ProtectedData]::Unprotect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Text.Encoding]::UTF8.GetString($p))";
  const credential = restoreOnly ? { host: "aws-0-ap-south-1.pooler.supabase.com", port: "5432", user: "offline." + project, database: "postgres", password: "" } : JSON.parse(execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", decrypt], {
    input: await readFile(join(directory, "temporary-backup-connection.dpapi"), "utf8"), encoding: "utf8", stdio: ["pipe", "pipe", "pipe"],
  }));
  if (credential.host !== "aws-0-ap-south-1.pooler.supabase.com" || credential.port !== "5432" || !credential.user.endsWith("." + project) || credential.database !== "postgres") throw new Error("Cloud backup connection target mismatch.");
  const environment = { ...process.env, PGHOST: credential.host, PGPORT: credential.port, PGDATABASE: "postgres", PGUSER: credential.user,
    PGPASSWORD: credential.password, PGSSLMODE: "verify-full", PGSSLROOTCERT: "/backup/supabase-ca.crt", PGCONNECT_TIMEOUT: "15" };
  const sourceRole = credential.user.split(".")[0] === "cli_login_postgres" ? ["--role=postgres"] : [];
  const client = (command: string[], writable = false) => {
    if (restoreOnly) throw new Error("Remote connections are prohibited in restore-only mode.");
    const args = ["--context", "desktop-linux", "run", "--rm", "--mount", `type=bind,source=${directory},target=/backup${writable ? "" : ",readonly"}`];
    for (const key of ["PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD", "PGSSLMODE", "PGSSLROOTCERT", "PGCONNECT_TIMEOUT"]) args.push("--env", key);
    try { return execFileSync("docker", [...args, image, ...command], { env: environment, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 180_000, maxBuffer: 16 * 1024 * 1024 }); }
    catch (error) {
      const diagnostic = String((error as { stderr?: string }).stderr ?? "");
      void writeFile(join(directory, `${phase}-error.log`), diagnostic);
      const category = ["row-level security", "permission denied", "password authentication failed", "certificate verify failed", "query_wait_timeout"].find((term) => diagnostic.includes(term));
      throw new Error(`Backup ${phase} failed${category ? ": " + category : "; inspect private diagnostic"}.`);
    }
  };
  const query = (sql: string) => JSON.parse(client(["psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-c", `${sourceRole.length ? "set role postgres;" : ""} begin transaction read only; ${sql}; rollback;`]).trim());
  phase = "source-metadata";
  const cached = restoreOnly ? JSON.parse(await readFile(join(directory, "source-metadata.json"), "utf8")) : null;
  const ledger = restoreOnly ? cached.ledger : query("select json_agg(r order by version) from(select version,name from supabase_migrations.schema_migrations)r");
  const manifest = JSON.parse(await readFile(new URL("../../docs/releases/professional-cloud-manifest.json", import.meta.url), "utf8"));
  if (JSON.stringify(ledger) !== JSON.stringify(manifest.baseline.map((entry: { version: string; name: string }) => ({ version: entry.version, name: entry.name })))) throw new Error("Cloud ledger changed; refresh the release manifest before backup.");
  const schemas = "('auth','storage','user_service','journal_service','buddy_service','professional_service','notification_service','verification_service','auth_provisioning','ai_analysis','insights_service','grounding_service')";
  const tablesSql = `select coalesce(json_agg(r order by schema,table_name),'[]') from(select n.nspname as schema,c.relname as table_name,c.relrowsecurity as rls from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ${schemas} and c.relkind='r')r`;
  const policiesSql = `select coalesce(json_agg(r order by schemaname,tablename,policyname),'[]') from(select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname in ${schemas})r`;
  const tables = (restoreOnly ? cached.tables : query(tablesSql)) as Array<{ schema: string; table_name: string; rls: boolean }>;
  const policies = restoreOnly ? cached.policies : query(policiesSql);
  const identifier = (value: string) => '"' + value.replaceAll('"', '""') + '"';
  const countSql = "select json_agg(r order by table_name) from(" + tables.map((table) => {
    const name = table.schema + "." + table.table_name;
    if (!/^[a-z0-9_.]+$/.test(name)) throw new Error("Unexpected table identifier.");
    return `select '${name}' as table_name,count(*)::text as rows from ${identifier(table.schema)}.${identifier(table.table_name)}`;
  }).join(" union all ") + ")r";
  const counts = restoreOnly ? cached.counts : query(countSql);
  const databaseMetadata = restoreOnly ? cached.database : query("select json_build_object('owner',pg_get_userbyid(d.datdba),'encoding',pg_encoding_to_char(d.encoding),'collate',d.datcollate,'ctype',d.datctype,'grants',(select json_agg(json_build_object('grantee',case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,'privilege',a.privilege_type,'grantable',a.is_grantable)) from aclexplode(coalesce(d.datacl,acldefault('d',d.datdba)))a)) from pg_database d where d.datname=current_database()");
  if (!databaseMetadata?.owner || !databaseMetadata.grants) throw new Error("Source database owner/grants metadata is required for a faithful restore.");
  if (!restoreOnly) {
  await writeFile(join(directory, "source-metadata.json"), JSON.stringify({ project, ledger, tables, policies, counts, database: databaseMetadata }, null, 2) + "\n");
  phase = "database-dump";
  // No row filtering / --enable-row-security: an incomplete RLS-filtered backup is rejected.
  client(["pg_dump", ...sourceRole, "--format=custom", "--file=/backup/database.partial.dump", "--lock-wait-timeout=10000"], true);
  await rename(join(directory, "database.partial.dump"), join(directory, "database.dump"));
  phase = "roles-dump";
  client(["pg_dumpall", ...sourceRole, "--roles-only", "--no-role-passwords", "--file=/backup/roles.partial.sql"], true);
  await rename(join(directory, "roles.partial.sql"), join(directory, "roles.sql"));
  }
  const run = (args: string[], input?: string) => execFileSync("docker", ["--context", "desktop-linux", ...args], {
    input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 180_000, maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, POSTGRES_PASSWORD: randomBytes(32).toString("hex") },
  });
  phase = "archive-integrity";
  const toc = run(["run", "--rm", "--network", "none", "--mount", `type=bind,source=${directory},target=/backup,readonly`, image, "pg_restore", "--list", "/backup/database.dump"]);
  await writeFile(join(directory, "archive-toc.txt"), toc);
  phase = "isolated-restore";
  restoreContainer = "echo_cloud_restore_" + randomBytes(4).toString("hex");
  run(["run", "--detach", "--name", restoreContainer, "--network", "none", "--env", "POSTGRES_PASSWORD", "--mount", `type=bind,source=${directory},target=/backup,readonly`, image]);
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (run(["inspect", restoreContainer, "--format", "{{.State.Health.Status}} "]).trim() === "healthy") { ready = true; break; }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error("Isolated restore server unavailable.");
  const topology = JSON.parse(run(["inspect", restoreContainer]))[0];
  if (topology.HostConfig.NetworkMode !== "none" || Object.keys(topology.HostConfig.PortBindings ?? {}).length) throw new Error("Restore isolation failed.");
  const restoredSql = (sql: string, database = "echo_backup_verify") => run(["exec", "-i", restoreContainer, "psql", "-U", "supabase_admin", "-d", database, "-X", "-qAt", "-v", "ON_ERROR_STOP=1"], sql).trim();
  const existingRoles = new Set(JSON.parse(restoredSql("select json_agg(rolname) from pg_roles;", "postgres")) as string[]);
  const roles = (await readFile(join(directory, "roles.sql"), "utf8")).replace(/^CREATE ROLE ([a-z0-9_]+);$/gm, (line, role) => existingRoles.has(role) ? "" : line);
  restoredSql(roles, "postgres");
  const literal = (value: string) => "'" + value.replaceAll("'", "''") + "'";
  restoredSql(`create database echo_backup_verify owner ${identifier(databaseMetadata.owner)} template template0 encoding ${literal(databaseMetadata.encoding)} lc_collate ${literal(databaseMetadata.collate)} lc_ctype ${literal(databaseMetadata.ctype)};`, "postgres");
  restoredSql("revoke all on database echo_backup_verify from PUBLIC;", "postgres");
  for (const grant of databaseMetadata.grants) {
    if (!["CREATE", "CONNECT", "TEMPORARY"].includes(grant.privilege)) throw new Error("Unexpected database privilege.");
    restoredSql(`grant ${grant.privilege} on database echo_backup_verify to ${grant.grantee === "PUBLIC" ? "PUBLIC" : identifier(grant.grantee)}${grant.grantable ? " with grant option" : ""};`, "postgres");
  }
  // Managed schema owners (e.g. pgbouncer) need not have database CREATE.
  // Bootstrap only the archived schemas as superuser, retaining their exact owners;
  // restore contents/ACLs with their archived ownership without widening grants.
  const restoreList = toc.split(/\r?\n/).filter((line) => {
    if (/^\d+; \d+ \d+ EVENT TRIGGER /.test(line)) return false;
    const schema = line.match(/^\d+; \d+ \d+ SCHEMA - ([a-z0-9_]+) ([a-z0-9_]+)$/);
    if (!schema) return true;
    restoredSql(`create schema ${identifier(schema[1])} authorization ${identifier(schema[2])};`);
    return false;
  }).join("\n");
  run(["exec", "-i", restoreContainer, "sh", "-c", "cat > /tmp/restore.list"], restoreList);
  const schemaAcls = toc.split(/\r?\n/).filter((line) => /^\d+; 0 0 ACL - SCHEMA /.test(line)).join("\n");
  run(["exec", "-i", restoreContainer, "sh", "-c", "cat > /tmp/schema-acls.list"], schemaAcls);
  run(["exec", restoreContainer, "pg_restore", "-U", "supabase_admin", "--use-set-session-authorization", "--use-list=/tmp/schema-acls.list", "--dbname=echo_backup_verify", "--exit-on-error", "/backup/database.dump"]);
  // Normal superuser restore preserves object owners while handling managed
  // cross-schema triggers whose table owners cannot themselves create them.
  // Event triggers need session authorization matching their function owners.
  const events = toc.split(/\r?\n/).filter((line) => /^\d+; \d+ \d+ EVENT TRIGGER /.test(line)).join("\n");
  run(["exec", "-i", restoreContainer, "sh", "-c", "cat > /tmp/event-triggers.list"], events);
  try {
    run(["exec", restoreContainer, "pg_restore", "-U", "supabase_admin", "--use-list=/tmp/restore.list", "--dbname=echo_backup_verify", "--exit-on-error", "--single-transaction", "/backup/database.dump"]);
    if (events) run(["exec", restoreContainer, "pg_restore", "-U", "supabase_admin", "--use-set-session-authorization", "--use-list=/tmp/event-triggers.list", "--dbname=echo_backup_verify", "--exit-on-error", "--single-transaction", "/backup/database.dump"]);
  }
  catch (error) { await writeFile(join(directory, "restore-error.log"), String((error as { stderr?: string }).stderr ?? "")); throw new Error("Isolated restore failed; inspect protected restore diagnostic."); }
  phase = "restored-validation";
  if (JSON.stringify(JSON.parse(restoredSql(tablesSql))) !== JSON.stringify(tables)) throw new Error("Restored schema/RLS mismatch.");
  // Match the cloud owner's deparser search path, rather than the local
  // supabase_admin default (which can omit auth. qualification from identical SQL).
  if (JSON.stringify(JSON.parse(restoredSql("set search_path=public,extensions; " + policiesSql))) !== JSON.stringify(policies)) throw new Error("Restored policy mismatch.");
  if (JSON.stringify(JSON.parse(restoredSql(countSql))) !== JSON.stringify(counts)) throw new Error("Restored record counts mismatch.");
  if (JSON.stringify(JSON.parse(restoredSql("select json_agg(r order by version) from(select version,name from supabase_migrations.schema_migrations)r"))) !== JSON.stringify(ledger)) throw new Error("Restored migration ledger mismatch.");
  const after = localSql("select json_build_array((select count(*) from auth.users),(select count(*) from professional_service.organizations),(select count(*) from professional_service.memberships),(select count(*) from professional_service.credential_reviews));");
  if (before !== after) throw new Error("Existing local fixture counts changed.");
  const files = [];
  for (const file of ["database.dump", "roles.sql", "source-metadata.json", "archive-toc.txt"]) {
    const contents = await readFile(join(directory, file));
    files.push({ file, bytes: contents.length, modifiedUtc: (await stat(join(directory, file))).mtime.toISOString(), sha256: createHash("sha256").update(contents).digest("hex") });
  }
  const report = { project, backup: "CREATED", restore: "VERIFIED", verifiedAtUtc: new Date().toISOString(), directory, restoreContainer, files, tablesChecked: tables.length, policiesChecked: policies.length, countsChecked: counts.length, ledgerEntriesChecked: ledger.length, localFixturesUnchanged: true };
  await writeFile(join(directory, "verification.json"), JSON.stringify(report, null, 2) + "\n");
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}
main().catch((error: unknown) => { process.stderr.write((error instanceof Error ? error.message : `Backup failed at ${phase}`) + "\n"); process.exitCode = 1; })
  .finally(() => {
    if (/^echo_cloud_restore_[a-f0-9]{8}$/.test(restoreContainer)) {
      try { execFileSync("docker", ["--context", "desktop-linux", "stop", restoreContainer], { stdio: "ignore", timeout: 30_000 }); } catch { /* Retained isolated container; no existing service is stopped. */ }
    }
  });
