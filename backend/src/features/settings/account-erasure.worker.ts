import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

type Bucket = "avatars" | "journal-images" | "verification-documents";
type Job = { request_id: string; user_id: string; lease_token: string };
type ObjectRow = { bucket: Bucket; object_path: string };
const BUCKETS: Bucket[] = ["avatars", "journal-images", "verification-documents"];
const PAGE_SIZE = 500;

class ErasureFailure extends Error {
  constructor(readonly code: string) { super(code); }
}

function safePath(userId: string, path: string): boolean {
  return path.startsWith(`${userId}/`) && /^[a-zA-Z0-9_./-]+$/.test(path) &&
    !path.split("/").some((segment) => segment === "." || segment === "..");
}

export class AccountErasureWorker {
  constructor(private readonly database: SupabaseClient, private readonly hmacKey: Buffer) {
    if (hmacKey.length !== 32) throw new Error("The account erasure HMAC key must be 32 bytes.");
  }

  private async renew(job: Job, stage: string) {
    const { data, error } = await this.database.schema("user_service").rpc("renew_account_erasure", {
      p_request_id: job.request_id, p_lease_token: job.lease_token, p_stage: stage,
    });
    if (error || data !== true) throw new ErasureFailure("LEASE_LOST");
  }

  private async listedPaths(job: Job, bucket: Bucket): Promise<string[]> {
    const paths: string[] = [];
    const folders = [job.user_id];
    const visited = new Set<string>();
    while (folders.length) {
      const folder = folders.shift()!;
      if (visited.has(folder)) continue;
      visited.add(folder);
      for (let offset = 0; ; offset += PAGE_SIZE) {
        await this.renew(job, "inventory_storage");
        const { data, error } = await this.database.storage.from(bucket).list(folder, {
          limit: PAGE_SIZE, offset, sortBy: { column: "name", order: "asc" },
        });
        if (error || !data) throw new ErasureFailure("STORAGE_LIST_FAILED");
        for (const item of data) {
          const path = `${folder}/${item.name}`;
          if (!safePath(job.user_id, path)) throw new ErasureFailure("UNSAFE_STORAGE_PATH");
          if (item.id) paths.push(path);
          else folders.push(path);
        }
        if (data.length < PAGE_SIZE) break;
      }
    }
    return paths;
  }

  private async databasePaths(job: Job): Promise<ObjectRow[]> {
    const sources: Array<{ schema: string; table: string; bucket: Bucket; optional?: boolean }> = [
      { schema: "journal_service", table: "journal_images", bucket: "journal-images" },
      { schema: "journal_service", table: "journal_draft_images", bucket: "journal-images", optional: true },
      { schema: "verification_service", table: "verification_documents", bucket: "verification-documents" },
      { schema: "public", table: "verification_documents", bucket: "verification-documents" },
    ];
    const paths: ObjectRow[] = [];
    for (const source of sources) {
      for (let offset = 0; ; offset += PAGE_SIZE) {
        await this.renew(job, "inventory_records");
        const { data, error } = await this.database.schema(source.schema).from(source.table)
          .select("storage_path").eq("user_id", job.user_id).range(offset, offset + PAGE_SIZE - 1);
        if (source.optional && ["42P01", "PGRST205"].includes(error?.code ?? "")) break;
        if (error || !data) throw new ErasureFailure("OBJECT_RECORDS_UNAVAILABLE");
        for (const row of data) {
          if (typeof row.storage_path !== "string" || !safePath(job.user_id, row.storage_path))
            throw new ErasureFailure("UNSAFE_STORAGE_PATH");
          paths.push({ bucket: source.bucket, object_path: row.storage_path });
        }
        if (data.length < PAGE_SIZE) break;
      }
    }
    return paths;
  }

  private async inventory(job: Job) {
    const objects = new Map<string, ObjectRow>();
    for (const bucket of BUCKETS) {
      for (const path of await this.listedPaths(job, bucket)) objects.set(`${bucket}/${path}`, { bucket, object_path: path });
    }
    for (const row of await this.databasePaths(job)) objects.set(`${row.bucket}/${row.object_path}`, row);
    for (const batch of chunk([...objects.values()], 100)) {
      await this.renew(job, "record_manifest");
      const { error } = await this.database.schema("user_service").from("account_erasure_objects")
        .upsert(batch.map((item) => ({ request_id: job.request_id, ...item })),
          { onConflict: "request_id,bucket,object_path", ignoreDuplicates: true });
      if (error) throw new ErasureFailure("MANIFEST_WRITE_FAILED");
    }
  }

  private async deleteObjects(job: Job) {
    while (true) {
      await this.renew(job, "delete_storage");
      const { data, error } = await this.database.schema("user_service").from("account_erasure_objects")
        .select("bucket,object_path").eq("request_id", job.request_id).is("deleted_at", null).limit(100);
      if (error || !data) throw new ErasureFailure("MANIFEST_READ_FAILED");
      if (!data.length) break;
      for (const bucket of BUCKETS) {
        const paths = data.filter((item) => item.bucket === bucket).map((item) => String(item.object_path));
        if (!paths.length) continue;
        if (paths.some((path) => !safePath(job.user_id, path))) throw new ErasureFailure("UNSAFE_STORAGE_PATH");
        const removed = await this.database.storage.from(bucket).remove(paths);
        if (removed.error) throw new ErasureFailure("STORAGE_REMOVE_FAILED");
        const marked = await this.database.schema("user_service").from("account_erasure_objects")
          .update({ deleted_at: new Date().toISOString() }).eq("request_id", job.request_id)
          .eq("bucket", bucket).in("object_path", paths);
        if (marked.error) throw new ErasureFailure("MANIFEST_WRITE_FAILED");
      }
    }
    for (const bucket of BUCKETS) {
      if ((await this.listedPaths(job, bucket)).length) throw new ErasureFailure("STORAGE_NOT_EMPTY");
    }
  }

  private async process(job: Job) {
    await this.renew(job, "preflight");
    const blockers = await this.database.schema("user_service").rpc("account_erasure_blocked_cases", { p_user_id: job.user_id });
    if (blockers.error) throw new ErasureFailure("PREFLIGHT_UNAVAILABLE");
    if (Number(blockers.data) > 0) throw new ErasureFailure("PRACTITIONER_REASSIGNMENT_REQUIRED");
    await this.inventory(job);
    await this.deleteObjects(job);
    await this.renew(job, "delete_identity");
    const prepared = await this.database.schema("user_service").rpc("prepare_account_erasure_relations", { p_user_id: job.user_id });
    if (prepared.error) throw new ErasureFailure("RELATIONS_PREPARE_FAILED");
    const existing = await this.database.schema("user_service").rpc("account_erasure_subject_exists", { p_user_id: job.user_id });
    if (existing.error) throw new ErasureFailure("IDENTITY_CHECK_FAILED");
    if (existing.data === true) {
      const removed = await this.database.auth.admin.deleteUser(job.user_id);
      if (removed.error) throw new ErasureFailure("IDENTITY_DELETE_FAILED");
    }
    await this.renew(job, "verify_erasure");
    const remaining = await this.database.schema("user_service").rpc("account_erasure_remaining_rows", { p_user_id: job.user_id });
    if (remaining.error || !remaining.data || Object.keys(remaining.data as object).length)
      throw new ErasureFailure("ROWS_REMAINING");
    for (const bucket of BUCKETS) {
      if ((await this.listedPaths(job, bucket)).length) throw new ErasureFailure("STORAGE_NOT_EMPTY");
    }
    const subjectHash = createHmac("sha256", this.hmacKey)
      .update(`echo:account-erasure:v1:${job.user_id}`).digest("hex");
    const completed = await this.database.schema("user_service").rpc("finish_account_erasure", {
      p_request_id: job.request_id, p_lease_token: job.lease_token, p_subject_hash: subjectHash,
    });
    if (completed.error || completed.data !== true) throw new ErasureFailure("COMPLETION_FAILED");
    console.info(JSON.stringify({ service: "account-erasure", event: "completed", requestId: job.request_id }));
  }

  async tick(): Promise<boolean> {
    const claimed = await this.database.schema("user_service").rpc("claim_account_erasure");
    if (claimed.error) throw new ErasureFailure("CLAIM_FAILED");
    if (!claimed.data) return false;
    const job = claimed.data as Job;
    if (!job.request_id || !job.user_id || !job.lease_token) throw new ErasureFailure("INVALID_JOB");
    try {
      await this.process(job);
    } catch (cause) {
      const code = cause instanceof ErasureFailure ? cause.code : "UNEXPECTED_FAILURE";
      const retry = await this.database.schema("user_service").rpc("retry_account_erasure", {
        p_request_id: job.request_id, p_lease_token: job.lease_token, p_code: code,
      });
      console.warn(JSON.stringify({ service: "account-erasure", event: "retry", requestId: job.request_id, code,
        recorded: retry.data === true && !retry.error }));
    }
    return true;
  }
}

function* chunk<T>(input: T[], size: number): Generator<T[]> {
  for (let index = 0; index < input.length; index += size) yield input.slice(index, index + size);
}
