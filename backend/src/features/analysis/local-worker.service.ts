import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { journalAnalysisResultSchema } from "@echo/contracts";
import { z } from "zod";
import {
  ConflictError,
  AuthorizationError,
  ValidationError,
  ExternalServiceError,
} from "../../shared/errors/app-error.js";
import type { JournalService } from "../journals/journals.service.js";
import type { LocalWorkerProtocol } from "../../infrastructure/analysis/analysis-provider.types.js";

export function canonicalCallback(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalCallback).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalCallback(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const progressSchema = z
  .object({
    status: z.enum(["safety_checking", "classifying_distress", "estimating_screening", "generating_recommendation"]),
  })
  .strict();
const safetySchema = z.object({ actionRequired: z.boolean() }).strict();
const failureSchema = z.object({ code: z.enum(["PROCESSING_FAILED", "MODEL_UNAVAILABLE", "TIMEOUT"]) }).strict();

export function workerDatabaseError(error: { message?: string }): never {
  const message = error.message ?? "";
  if (message.includes("CALLBACK_IDEMPOTENCY_CONFLICT"))
    throw new ConflictError("CALLBACK_IDEMPOTENCY_CONFLICT", "The callback key was used with different content.");
  if (message.includes("LEASE_REJECTED"))
    throw new AuthorizationError("The worker lease is expired, revoked, or mismatched.");
  if (/INVALID_ANALYSIS_TRANSITION|SAFETY_REVIEW_REQUIRED|ANALYSIS_GATE_FAILED/.test(message))
    throw new ConflictError(
      "ANALYSIS_TRANSITION_REJECTED",
      "This analysis job does not accept the requested transition.",
    );
  throw new ExternalServiceError("DATABASE_UNAVAILABLE", "The worker operation could not be committed.");
}

/** External protocol only. No in-process model inference or analyze() adapter. */
export class LocalWorkerService implements LocalWorkerProtocol {
  constructor(
    private readonly database: SupabaseClient,
    private readonly journals: JournalService,
    private readonly workerSecret: string,
    private readonly authorizedWorkerId = "local-worker",
  ) {}

  authenticate(token: string | undefined): void {
    const actual = Buffer.from(token ?? "");
    const expected = Buffer.from(this.workerSecret);
    if (!token || actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw new AuthorizationError("Worker authentication failed.");
  }
  private authenticateIdentity(workerId: string): void {
    if (workerId !== this.authorizedWorkerId)
      throw new AuthorizationError("The credential does not authorize this worker identity.");
  }
  async protocolHealth() {
    const { error } = await this.database.schema("ai_analysis").from("worker_health").select("worker_id").limit(1);
    if (error) workerDatabaseError(error);
    return {
      protocol: "available",
      storage: "available",
      authentication: "required",
      claims: "enabled",
      leases: "enabled",
      modelHealth: "not_asserted",
    };
  }
  async reportHealth(workerId: string, acceptingJobs: boolean, modelStatus?: string, modelVersion?: string) {
    this.authenticateIdentity(workerId);
    const { error } = await this.database
      .schema("ai_analysis")
      .from("worker_health")
      .upsert({
        worker_id: workerId,
        accepting_jobs: acceptingJobs,
        model_status: modelStatus,
        model_version: modelVersion,
        last_heartbeat_at: new Date().toISOString(),
        metadata: {},
      });
    if (error) workerDatabaseError(error);
    if (acceptingJobs) await this.recover();
    return {
      protocol: "available",
      workerReportedModelHealth: { status: modelStatus ?? "not_reported", version: modelVersion ?? null },
      modelHealthIndependentlyVerified: false,
    };
  }
  async releaseExpiredLeases(): Promise<number> {
    const { data, error } = await this.database.schema("ai_analysis").rpc("release_expired_worker_leases");
    if (error) workerDatabaseError(error);
    return Number(data ?? 0);
  }
  async recover(): Promise<void> {
    await this.releaseExpiredLeases();
    const { data, error } = await this.database
      .schema("ai_analysis")
      .from("analysis_requests")
      .select("id,status,attempt_count")
      .in("status", ["waiting_for_provider", "retrying"])
      .in("processing_mode", ["disabled", "local_worker"])
      .is("deleted_at", null);
    if (error) workerDatabaseError(error);
    for (const job of data ?? []) {
      const outcome = await this.database
        .schema("ai_analysis")
        .rpc("requeue_job", {
          p_job_id: job.id,
          p_mode: "local_worker",
          p_transition_key: `${job.status}:${job.attempt_count}:local-worker-v1`,
        });
      if (outcome.error) workerDatabaseError(outcome.error);
    }
  }
  async claim(workerId: string) {
    this.authenticateIdentity(workerId);
    const leaseToken = randomBytes(32).toString("base64url");
    const { data, error } = await this.database
      .schema("ai_analysis")
      .rpc("claim_worker_job", { p_worker_id: workerId, p_lease_hash: hash(leaseToken) });
    if (error) workerDatabaseError(error);
    if (!data) return null;
    const journal = await this.journals.get(String(data.userId), String(data.journalId));
    return {
      jobId: data.jobId,
      journalId: data.journalId,
      status: data.status,
      leaseToken,
      leaseExpiresAt: data.leaseExpiresAt,
      input: { journalText: journal.body, language: "en" },
      modelHealthNotAsserted: true,
    };
  }
  private identity(key: string | undefined, payload: unknown) {
    if (!key || key.length < 16 || key.length > 200)
      throw new ValidationError({ callbackKey: ["A callback idempotency key of 16–200 characters is required."] });
    return {
      keyHmac: createHmac("sha256", this.workerSecret).update(key).digest("hex"),
      payloadHash: hash(canonicalCallback(payload)),
    };
  }
  private async probe(
    type: string,
    jobId: string,
    workerId: string,
    leaseToken: string,
    identity: { keyHmac: string; payloadHash: string },
  ) {
    const { data, error } = await this.database.schema("ai_analysis").rpc("lookup_worker_receipt", {
      p_job_id: jobId,
      p_type: type,
      p_key_hmac: identity.keyHmac,
      p_payload_hash: identity.payloadHash,
      p_worker_id: workerId,
      p_lease_hash: hash(leaseToken),
    });
    if (error) workerDatabaseError(error);
    return data;
  }
  private async callback(
    type: string,
    jobId: string,
    workerId: string,
    leaseToken: string,
    key: string | undefined,
    payload: unknown,
    schema?: z.ZodType,
  ) {
    this.authenticateIdentity(workerId);
    const identity = this.identity(key, payload);
    const receipt = await this.probe(type, jobId, workerId, leaseToken, identity);
    if (receipt?.replay) return receipt.outcome;
    const parsed = schema ? this.parse(schema, payload) : payload;
    const { data, error } = await this.database.schema("ai_analysis").rpc("apply_worker_callback", {
      p_job_id: jobId,
      p_type: type,
      p_key_hmac: identity.keyHmac,
      p_payload_hash: identity.payloadHash,
      p_worker_id: workerId,
      p_lease_hash: hash(leaseToken),
      p_payload: parsed,
    });
    if (error) workerDatabaseError(error);
    return data;
  }
  heartbeat(jobId: string, workerId: string, leaseToken: string, key?: string) {
    return this.callback("heartbeat", jobId, workerId, leaseToken, key, {});
  }
  progress(jobId: string, workerId: string, leaseToken: string, key: string | undefined, payload: unknown) {
    return this.callback("progress", jobId, workerId, leaseToken, key, payload, progressSchema);
  }
  safetyResult(jobId: string, workerId: string, leaseToken: string, key: string | undefined, payload: unknown) {
    return this.callback("safety_result", jobId, workerId, leaseToken, key, payload, safetySchema);
  }
  failure(jobId: string, workerId: string, leaseToken: string, key: string | undefined, payload: unknown) {
    return this.callback("failure", jobId, workerId, leaseToken, key, payload, failureSchema);
  }
  async finalResult(jobId: string, workerId: string, leaseToken: string, key: string | undefined, payload: unknown) {
    this.authenticateIdentity(workerId);
    const identity = this.identity(key, payload);
    const receipt = await this.probe("final_result", jobId, workerId, leaseToken, identity);
    if (receipt?.replay) return receipt.outcome;
    const result = this.parse(journalAnalysisResultSchema, payload);
    const { data, error } = await this.database.schema("ai_analysis").rpc("complete_worker_callback", {
      p_job_id: jobId,
      p_result: result,
      p_callback_type: "final_result",
      p_key_hmac: identity.keyHmac,
      p_payload_hash: identity.payloadHash,
      p_worker_id: workerId,
      p_lease_token_hash: hash(leaseToken),
    });
    if (error) workerDatabaseError(error);
    return { resultId: data, status: "completed" };
  }
  private parse<T>(schema: z.ZodType<T>, payload: unknown): T {
    const result = schema.safeParse(payload);
    if (!result.success)
      throw new ValidationError({ callback: ["The callback does not match the versioned protocol."] });
    return result.data;
  }
}
