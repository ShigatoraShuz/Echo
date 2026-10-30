import { randomUUID } from "node:crypto";
import type { LocalWorkerService } from "../../features/analysis/local-worker.service.js";
import type { ModelServiceClient } from "./model-service.client.js";

const workerId = "echo-http-engineering-v1";
const urgentLanguage = /\b(kill myself|end my life|suicide plan|want to die|hurt myself|self harm)\b/i;

/** Single-flight, bounded, server-owned dispatcher. No public processing endpoint. */
export function startHttpModelProcessor(worker: LocalWorkerService, client: ModelServiceClient) {
  let stopped = false,
    busy = false;
  let lastHealthAt = 0;
  let lastRecoveryAt = 0;
  async function tick() {
    if (stopped || busy) return;
    busy = true;
    let lease: Awaited<ReturnType<LocalWorkerService["claim"]>> = null;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    try {
      if (Date.now() - lastHealthAt >= 15000) {
        lastHealthAt = Date.now();
        await worker.reportHealth(workerId, true, "engineering_http_bridge", "staged-v2");
      }
      if (Date.now() - lastRecoveryAt >= 30_000) {
        lastRecoveryAt = Date.now();
        // LocalWorkerService keeps recovery inside the same explicit account scope.
        await worker.recover();
      }
      lease = await worker.claim(workerId);
      if (!lease) return;
      const { jobId, leaseToken } = lease;
      heartbeat = setInterval(() => {
        void worker.heartbeat(jobId, workerId, leaseToken, randomUUID()).catch(() => {});
      }, 15_000);
      heartbeat.unref();
      if (lease.status === "queued") {
        await worker.progress(jobId, workerId, leaseToken, randomUUID(), { status: "safety_checking" });
        const actionRequired = urgentLanguage.test(lease.input.journalText);
        await worker.safetyResult(jobId, workerId, leaseToken, randomUUID(), { actionRequired });
        if (actionRequired) return;
      }
      const result = await client.analyze(String(lease.userId), lease.input.journalText);
      for (const status of ["classifying_distress", "estimating_screening", "generating_recommendation"])
        await worker.progress(jobId, workerId, leaseToken, randomUUID(), { status });
      await worker.finalResult(jobId, workerId, leaseToken, randomUUID(), result);
    } catch {
      if (lease)
        await worker
          .failure(lease.jobId, workerId, lease.leaseToken, randomUUID(), { code: "MODEL_UNAVAILABLE" })
          .catch(() => {});
      // No journal text, output, user identifiers, bearer tokens or native error strings.
      process.stderr.write(JSON.stringify({ service: "model-bridge", event: "processing_unavailable" }) + "\n");
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      busy = false;
    }
  }
  const timer = setInterval(() => {
    void tick();
  }, 1000);
  timer.unref();
  void tick();
  return {
    stop: async () => {
      stopped = true;
      clearInterval(timer);
      await worker.reportHealth(workerId, false, "stopped", "staged-v2");
    },
  };
}
