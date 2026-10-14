import { createHmac, timingSafeEqual } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { loadEnvironment } from "../src/config/environment.js";
import { createSupabaseAdminClient } from "../src/infrastructure/supabase/supabase-admin.client.js";

const [mode, filePath] = process.argv.slice(2);
if (!["archive", "check", "requeue"].includes(mode) || !filePath)
  throw new Error("Usage: account-erasure-restore <archive|check|requeue> <archive.json>");
const environment = loadEnvironment();
if (!environment.ACCOUNT_ERASURE_HMAC_KEY_BASE64)
  throw new Error("ACCOUNT_ERASURE_HMAC_KEY_BASE64 is required.");
const key = Buffer.from(environment.ACCOUNT_ERASURE_HMAC_KEY_BASE64, "base64");
if (key.length !== 32) throw new Error("The account erasure HMAC key must be 32 bytes.");
const database = createSupabaseAdminClient(environment);
const subjectHash = (id: string) => createHmac("sha256", key).update(`echo:account-erasure:v1:${id}`).digest("hex");
const signature = (payload: string) => createHmac("sha256", key).update(`echo:account-erasure-archive:v1:${payload}`).digest("hex");
type Archive = { format: "echo-account-erasure-tombstones-v1"; generatedAt: string; subjectHashes: string[] };

if (mode === "archive") {
  const hashes: string[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await database.schema("user_service").from("account_erasure_jobs")
      .select("subject_hash").eq("state", "completed").order("subject_hash")
      .range(offset, offset + 499);
    if (error || !data) throw new Error("The tombstone inventory could not be read.");
    for (const row of data) {
      if (typeof row.subject_hash !== "string" || !/^[a-f0-9]{64}$/.test(row.subject_hash))
        throw new Error("A tombstone is malformed.");
      hashes.push(row.subject_hash);
    }
    if (data.length < 500) break;
  }
  const archive: Archive = {
    format: "echo-account-erasure-tombstones-v1",
    generatedAt: new Date().toISOString(),
    subjectHashes: [...new Set(hashes)].sort(),
  };
  const payload = JSON.stringify(archive);
  await writeFile(filePath, JSON.stringify({ archive, signature: signature(payload) }) + "\n", { flag: "wx", mode: 0o600 });
  process.stdout.write(`${JSON.stringify({ mode, count: archive.subjectHashes.length, filePath })}\n`);
} else {
  const parsed = JSON.parse(await readFile(filePath, "utf8")) as { archive?: Archive; signature?: string };
  const archive = parsed.archive;
  if (archive?.format !== "echo-account-erasure-tombstones-v1" ||
      !Array.isArray(archive.subjectHashes) ||
      archive.subjectHashes.some((hash) => typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash)) ||
      typeof parsed.signature !== "string" || !/^[a-f0-9]{64}$/.test(parsed.signature))
    throw new Error("The tombstone archive is invalid.");
  const expected = Buffer.from(signature(JSON.stringify(archive)), "hex");
  if (!timingSafeEqual(expected, Buffer.from(parsed.signature, "hex")))
    throw new Error("The tombstone archive signature does not match this deployment key.");
  const hashes = new Set(archive.subjectHashes);
  const restored: string[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await database.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data) throw new Error("The restored Auth inventory could not be read.");
    restored.push(...data.users.filter((user) => hashes.has(subjectHash(user.id))).map((user) => user.id));
    if (data.users.length < 1000) break;
  }
  if (mode === "requeue") {
    for (const userId of restored) {
      const existing = await database.schema("user_service").from("account_erasure_jobs")
        .select("request_id").eq("subject_hash", subjectHash(userId)).eq("state", "completed").maybeSingle();
      if (existing.error) throw new Error("Restored tombstone lookup failed.");
      let requestId = existing.data?.request_id;
      if (!requestId) {
        const requested = await database.schema("user_service").rpc("request_account_deletion", { p_user_id: userId });
        if (requested.error || typeof requested.data !== "string") throw new Error("Restored identity requeue failed.");
        requestId = requested.data;
      }
      const { data: updated, error } = await database.schema("user_service").from("account_erasure_jobs")
        .update({ state: "retry", stage: "restore_requeue", scheduled_for: new Date(0).toISOString(),
          next_attempt_at: new Date(0).toISOString(), lease_token: null, lease_until: null,
          user_id: userId, subject_hash: null, completed_at: null })
        .eq("request_id", requestId).select("request_id").single();
      if (error || !updated) throw new Error("Restored identity requeue failed.");
    }
  }
  process.stdout.write(`${JSON.stringify({ mode, tombstones: hashes.size, restoredIdentities: restored.length })}\n`);
  if (mode === "check" && restored.length) process.exitCode = 2;
}
