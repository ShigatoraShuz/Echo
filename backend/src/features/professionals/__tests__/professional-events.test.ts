import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { ProfessionalEventService } from "../professional-events.service.js";
describe("professional maintenance service", () => {
  it("enqueues before processing and exposes only counters", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: 2, error: null }).mockResolvedValueOnce({ data: { delivered: 3, suppressed: 1, failures: 0, privateDiagnostic: "hidden" }, error: null }).mockResolvedValueOnce({ data: { pending: 4, ready: 2, failed: 1, oldestPendingAt: "2026-01-01T00:00:00Z", privateDiagnostic: "hidden" }, error: null });
    const service = new ProfessionalEventService({ schema: () => ({ rpc }) } as unknown as SupabaseClient);
    expect(await service.runBatch()).toEqual({ enqueued: 2, delivered: 3, suppressed: 1, failures: 0, pending: 4, ready: 2, failed: 1, oldestPendingAt: "2026-01-01T00:00:00Z" });
    expect(rpc.mock.calls.map(c => c[0])).toEqual(["enqueue_follow_up_reminders", "process_events", "event_health"]);
  });
  it("fails safely when migrations/service are unavailable", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "Private SQL diagnostic" } });
    const service = new ProfessionalEventService({ schema: () => ({ rpc }) } as unknown as SupabaseClient);
    await expect(service.runBatch()).rejects.toMatchObject({ statusCode: 503 }); await expect(service.runBatch()).rejects.not.toThrow("Private SQL");
  });
});
