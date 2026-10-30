import { describe, expect, it } from "vitest";
import { JournalService } from "../journals.service.js";

function harness(consent: boolean | null, job: { job_id: string; status: string } | null = null, mode = "disabled") {
  const calls: { table: string; filters: Record<string, unknown>; columns?: string; limit?: number }[] = [];
  const reader = { schema: () => ({ from: (table: string) => {
    const call = { table, filters: {} } as typeof calls[number];
    calls.push(call);
    const query = {
      select: (columns: string) => { call.columns = columns; return query; },
      eq: (key: string, value: unknown) => { call.filters[key] = value; return query; },
      is: (key: string, value: unknown) => { call.filters[key] = value; return query; },
      order: () => query,
      limit: (count: number) => { call.limit = count; return query; },
      maybeSingle: async () => ({ error: null, data: table === "journals" ? consent === null ? null : { id: "journal", analysis_consent: consent } : job }),
    };
    return query;
  } }) };
  const service = new JournalService({} as never, {} as never, {} as never, undefined,
    { mode, developmentUserIds: new Set(), timeoutMs: 1000 } as never, undefined, undefined, () => reader as never);
  return { service, calls };
}

describe("owned journal analysis availability", () => {
  it("does not read another account's job or return entry text", async () => {
    const { service, calls } = harness(null);
    await expect(service.analysisAvailability("owner", "journal")).rejects.toThrow("not found");
    expect(calls).toEqual([{ table: "journals", columns: "id,analysis_consent", filters: { id: "journal", user_id: "owner", deleted_at: null } }]);
  });
  it("does not request analysis when entry consent is absent", async () => {
    const { service, calls } = harness(false);
    expect(await service.analysisAvailability("owner", "journal")).toMatchObject({ status: "not_requested", reason: "NOT_REQUESTED", jobId: null });
    expect(calls).toHaveLength(1);
  });
  it.each([
    [null, "disabled", "unavailable", "NO_REQUEST_FOUND"],
    [{ job_id: "job", status: "waiting_for_provider" }, "disabled", "waiting_for_provider", "PROCESSOR_DISABLED"],
    [{ job_id: "job", status: "waiting_for_provider" }, "local_worker", "waiting_for_provider", null],
    [{ job_id: "job", status: "failed" }, "local_worker", "failed", "PROCESSING_FAILED"],
    [{ job_id: "job", status: "completed" }, "local_worker", "completed", null],
  ] as const)("reports truthful status for %j", async (job, mode, status, reason) => {
    const { service, calls } = harness(true, job, mode);
    expect(await service.analysisAvailability("owner", "journal")).toMatchObject({ status, reason });
    expect(calls[1]).toEqual({ table: "analysis_status_projection", columns: "job_id,status", filters: { user_id: "owner", journal_id: "journal" }, limit: 1 });
  });
});
