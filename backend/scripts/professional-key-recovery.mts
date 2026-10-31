/** Read-only recovery proof: secrets/plaintexts remain in process memory only. */
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join, resolve, sep } from "node:path";
import { createEncryptionService, type EncryptedPayload } from "../src/infrastructure/encryption/encryption.service.js";
import { cloudReadOnly, cloudProject } from "./lib/professional-cloud-readonly.mts";

const identifier = (name: string) => {
  if (!/^[a-z0-9_]+$/.test(name)) throw new Error("Unexpected database identifier.");
  return '"' + name + '"';
};
type Column = { table_schema: string; table_name: string; column_name: string; udt_name: string };
let phase = "preflight";
async function main() {
  const directory = resolve((await readFile(new URL("../tmp/professional-release/backup-location.txt", import.meta.url), "utf8")).trim());
  if (!directory.startsWith(resolve(process.env.USERPROFILE!, "EchoBackups") + sep) || !directory.split(sep).at(-1)?.startsWith(cloudProject + "_")) throw new Error("Private backup destination required.");
  const cloud = await cloudReadOnly();
  const env = cloud.environment;
  const activeVersion = Number(env.JOURNAL_ENCRYPTION_KEY_VERSION ?? "1");
  const previous = JSON.parse(env.ENCRYPTION_PREVIOUS_KEYS_JSON ?? "{}") as Record<string, string>;
  const encryption = createEncryptionService(env.JOURNAL_ENCRYPTION_KEY_BASE64, activeVersion, previous);
  const keyring: Record<string, string> = { ...previous, [activeVersion]: env.JOURNAL_ENCRYPTION_KEY_BASE64 };
  let syntheticChecks = 0;
  for (const [version, key] of Object.entries(keyring)) {
    const synthetic = "Echo isolated recovery probe; fictional content";
    if (encryption.decrypt(createEncryptionService(key, Number(version)).encrypt(synthetic)) !== synthetic) throw new Error("Synthetic recovery failed.");
    syntheticChecks++;
  }
  phase = "ciphertext-inventory";
  const columns: Column[] = await cloud.query("select c.table_schema,c.table_name,c.column_name,c.udt_name from information_schema.columns c join information_schema.tables t on t.table_schema=c.table_schema and t.table_name=c.table_name and t.table_type='BASE TABLE' where (c.table_schema like '%_service' or c.table_schema in ('public','ai_analysis','auth_provisioning')) order by c.table_schema,c.table_name,c.ordinal_position");
  const sources: string[] = [];
  let unsupportedFormats = 0;
  for (const column of columns) {
    const table = identifier(column.table_schema) + "." + identifier(column.table_name);
    const field = identifier(column.column_name);
    const siblings = new Set(columns.filter((entry) => entry.table_schema === column.table_schema && entry.table_name === column.table_name).map((entry) => entry.column_name));
    if (column.udt_name === "text" || column.udt_name === "varchar") {
      sources.push(`select to_jsonb(${field}) as payload from ${table} where ${field} like 'echo:encrypted:v1:%'`);
      if (column.column_name.endsWith("_encrypted") || column.column_name.startsWith("encrypted_")) {
        const count = (await cloud.query(`select count(*)::int as count from ${table} where ${field} is not null and ${field}<>'' and ${field} not like 'echo:encrypted:v1:%'`))[0].count;
        unsupportedFormats += count;
      }
    } else if (column.udt_name === "bytea" && column.column_name.endsWith("_ciphertext")) {
      const prefix = column.column_name.slice(0, -"ciphertext".length);
      const metadata = siblings.has(prefix + "iv") ? prefix : "encryption_";
      if (!["iv", "auth_tag", "key_version"].every((part) => siblings.has(metadata + part))) {
        unsupportedFormats += (await cloud.query(`select count(*)::int as count from ${table} where ${field} is not null`))[0].count;
        continue;
      }
      sources.push(`select jsonb_build_object('ciphertext',encode(${field},'base64'),'iv',encode(${identifier(metadata + "iv")},'base64'),'authenticationTag',encode(${identifier(metadata + "auth_tag")},'base64'),'keyVersion',${identifier(metadata + "key_version")}) as payload from ${table} where ${field} is not null`);
    } else if (column.udt_name === "jsonb") {
      sources.push(`select jsonb_path_query(${field}, '$.** ? (@.type() == "string" && @ like_regex "^echo:encrypted:v1:")') as payload from ${table} where ${field} is not null`);
    }
  }
  const payloads = sources.length ? await cloud.query("select coalesce(json_agg(payload),'[]') as payloads from (" + sources.join(" union all ") + ") encrypted_only") : [{ payloads: [] }];
  phase = "in-memory-decryption";
  const required = new Set<number>();
  let decrypted = 0, failed = 0;
  for (const row of payloads[0].payloads) {
    try {
      const payload: EncryptedPayload = typeof row === "string" ? JSON.parse(Buffer.from(row.slice("echo:encrypted:v1:".length), "base64").toString("utf8")) : row;
      required.add(payload.keyVersion);
      // PostgreSQL encode(base64) wraps long bytea values; the encryption helper
      // requires canonical unwrapped base64, matching PostgREST bytea conversion.
      const normalized = { ...payload, ciphertext: payload.ciphertext.replace(/\s/g, ""), iv: payload.iv.replace(/\s/g, ""), authenticationTag: payload.authenticationTag.replace(/\s/g, "") };
      encryption.decrypt(normalized);
      decrypted++;
    } catch { failed++; }
  }
  phase = "other-recovery-prerequisites";
  const hmacKeys = JSON.parse(env.IDEMPOTENCY_HMAC_KEYS_JSON ?? "{}") as Record<string, string>;
  const hmacVersions = columns.some((column) => column.table_schema === "journal_service" && column.table_name === "idempotency_records")
    ? (await cloud.query("select distinct key_version from journal_service.idempotency_records where key_version is not null")).map((row: { key_version: string }) => row.key_version) : [];
  const missingHmacVersions = hmacVersions.filter((version: string) => typeof hmacKeys[version] !== "string" || hmacKeys[version].length < 32);
  const platform = (await cloud.query("select (select count(*)::int from auth.mfa_factors where factor_type='totp') as totp_factors,(select count(*)::int from auth.mfa_factors where factor_type='totp' and secret ~ '^[A-Z2-7]{16,}$') as recoverable_base32_factors,(select count(*)::int from vault.secrets) as vault_secrets"))[0];
  // Older Auth records may contain a directly recoverable base32 seed. Do not
  // assume that every TOTP factor requires an unavailable managed encryption key.
  // Compare seed fingerprints in memory against the isolated database restore;
  // never retrieve, log, or generate a code from the actual seed.
  let restoredTotpSecretsMatch = platform.totp_factors === 0;
  if (platform.totp_factors && platform.totp_factors === platform.recoverable_base32_factors) {
    phase = "isolated-restored-totp-proof";
    const proofSql = "select coalesce(json_agg(hash order by hash),'[]') as hashes from(select encode(sha256(convert_to(secret,'UTF8')),'hex') as hash from auth.mfa_factors where factor_type='totp')r";
    const sourceHashes = (await cloud.query(proofSql))[0].hashes;
    const backup = JSON.parse(await readFile(join(directory, "verification.json"), "utf8"));
    if (!/^echo_cloud_restore_[a-f0-9]{8}$/.test(backup.restoreContainer)) throw new Error("Verified isolated restore required.");
    const docker = (args: string[]) => execFileSync("docker", ["--context", "desktop-linux", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30_000 });
    const topology = JSON.parse(docker(["inspect", backup.restoreContainer]))[0];
    if (topology.HostConfig.NetworkMode !== "none" || Object.keys(topology.HostConfig.PortBindings ?? {}).length) throw new Error("Unsafe restored database topology.");
    const started = !topology.State.Running;
    if (started) docker(["start", backup.restoreContainer]);
    try {
      let ready = false;
      for (let attempt = 0; attempt < 40; attempt++) {
        try { if (docker(["exec", backup.restoreContainer, "pg_isready", "-U", "supabase_admin"]).includes("accepting connections")) { ready = true; break; } }
        catch { /* PostgreSQL can still be starting; no query or remote write. */ }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      if (!ready) throw new Error("Isolated restored database unavailable.");
      const restoredHashes = JSON.parse(docker(["exec", backup.restoreContainer, "psql", "-U", "supabase_admin", "-d", "echo_backup_verify", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-c", "begin transaction read only; " + proofSql + "; rollback;"]).trim().split(/\r?\n/).find((line) => line.startsWith("["))!);
      restoredTotpSecretsMatch = JSON.stringify(sourceHashes) === JSON.stringify(restoredHashes);
    } finally { if (started) docker(["stop", backup.restoreContainer]); }
  }
  const missingVersions = [...required].filter((version) => !Object.hasOwn(keyring, version));
  const blockers = [];
  if (failed) blockers.push("EXISTING_CIPHERTEXT_DECRYPTION_FAILED");
  if (unsupportedFormats) blockers.push("UNSUPPORTED_ENCRYPTED_RECORD_FORMAT");
  if (missingVersions.length) blockers.push("REQUIRED_AES_KEY_VERSION_UNAVAILABLE");
  if (missingHmacVersions.length) blockers.push("REQUIRED_HMAC_KEY_VERSION_UNAVAILABLE");
  if (!restoredTotpSecretsMatch || platform.vault_secrets) blockers.push("MANAGED_AUTH_OR_VAULT_RECOVERY_KEY_NOT_VERIFIED");
  const result = { project: cloudProject, status: blockers.length ? "BLOCKED" : "VERIFIED", verifiedAtUtc: new Date().toISOString(),
    mechanism: "existing ignored backend environment; no secrets exported/rotated; decryption in memory only",
    configuredVersions: Object.keys(keyring).map(Number), requiredVersions: [...required], missingVersions,
    syntheticChecks, existingPayloadsDecrypted: decrypted, failedPayloads: failed, unsupportedFormats,
    requiredHmacVersions: hmacVersions, missingHmacVersions, platform, restoredTotpSecretsMatch, blockers,
    independentOffDeviceEscrowVerified: false };
  await writeFile(join(directory, "key-recovery-verification.json"), JSON.stringify(result, null, 2) + "\n");
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  if (blockers.length) process.exitCode = 1;
}
main().catch(() => { process.stderr.write(`Encryption recovery BLOCKED at ${phase}; no secrets exported or modified.\n`); process.exitCode = 1; });
