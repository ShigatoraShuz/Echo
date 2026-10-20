import { afterEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AccountErasureWorker } from "../account-erasure.worker.js";

afterEach(() => vi.restoreAllMocks());

function harness(options: { blockedCases?: number; storageFailure?: boolean; identityFailure?: boolean; remainingRows?: boolean } = {}) {
  const job = {
    request_id: "74000000-0000-4000-8000-000000000001",
    user_id: "74000000-0000-4000-8000-000000000002",
    lease_token: "74000000-0000-4000-8000-000000000003",
  };
  const events: string[] = [];
  const rpc = vi.fn(async (name: string, args?: Record<string, unknown>) => {
    events.push(name);
    if (name === "claim_account_erasure") return { data: job, error: null };
    if (name === "renew_account_erasure") return { data: true, error: null };
    if (name === "account_erasure_blocked_cases") return { data: options.blockedCases ?? 0, error: null };
    if (name === "account_erasure_subject_exists") return { data: true, error: null };
    if (name === "account_erasure_remaining_rows") return { data: options.remainingRows ? { "public.orphan.user_id": 1 } : {}, error: null };
    if (name === "finish_account_erasure") return { data: true, error: null };
    if (name === "retry_account_erasure") return { data: true, error: null, code: args?.p_code };
    return { data: null, error: null };
  });
  const deleted = vi.fn(async () => { events.push("auth.deleteUser"); return { error: options.identityFailure ? new Error("offline") : null }; });
  const database = {
    schema: () => ({ rpc, from: (table: string) => ({
      select: () => ({ eq: () => table === "account_erasure_objects"
        ? { is: () => ({ limit: async () => ({ data: [], error: null }) }) }
        : { range: async () => ({ data: [], error: null }) } }),
    }) }),
    storage: { from: () => ({ list: async () => options.storageFailure
      ? { data: null, error: new Error("offline") } : { data: [], error: null } }) },
    auth: { admin: { deleteUser: deleted } },
  };
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  return { worker: new AccountErasureWorker(database as unknown as SupabaseClient, Buffer.alloc(32, 7)), rpc, deleted, events };
}

it("deletes identity only after storage inventory and completes after verification", async () => {
  const { worker, rpc, deleted, events } = harness();
  await expect(worker.tick()).resolves.toBe(true);
  expect(deleted).toHaveBeenCalledOnce();
  expect(events.indexOf("auth.deleteUser")).toBeGreaterThan(events.indexOf("account_erasure_blocked_cases"));
  expect(events.indexOf("finish_account_erasure")).toBeGreaterThan(events.indexOf("auth.deleteUser"));
  expect(rpc).not.toHaveBeenCalledWith("retry_account_erasure", expect.anything());
});

it("retries a storage failure without deleting identity or claiming completion", async () => {
  const { worker, rpc, deleted } = harness({ storageFailure: true });
  await expect(worker.tick()).resolves.toBe(true);
  expect(deleted).not.toHaveBeenCalled();
  expect(rpc).toHaveBeenCalledWith("retry_account_erasure", expect.objectContaining({ p_code: "STORAGE_LIST_FAILED" }));
  expect(rpc).not.toHaveBeenCalledWith("finish_account_erasure", expect.anything());
});

it("blocks erasure while a practitioner still owns active cases", async () => {
  const { worker, rpc, deleted } = harness({ blockedCases: 1 });
  await expect(worker.tick()).resolves.toBe(true);
  expect(deleted).not.toHaveBeenCalled();
  expect(rpc).toHaveBeenCalledWith("retry_account_erasure", expect.objectContaining({ p_code: "PRACTITIONER_REASSIGNMENT_REQUIRED" }));
});

it("retries an Auth deletion failure without recording completion", async () => {
  const { worker, rpc } = harness({ identityFailure: true });
  await expect(worker.tick()).resolves.toBe(true);
  expect(rpc).toHaveBeenCalledWith("retry_account_erasure", expect.objectContaining({ p_code: "IDENTITY_DELETE_FAILED" }));
  expect(rpc).not.toHaveBeenCalledWith("finish_account_erasure", expect.anything());
});

it("keeps an identity-deleted job retryable when relational verification finds an orphan", async () => {
  const { worker, rpc, deleted } = harness({ remainingRows: true });
  await expect(worker.tick()).resolves.toBe(true);
  expect(deleted).toHaveBeenCalledOnce();
  expect(rpc).toHaveBeenCalledWith("retry_account_erasure", expect.objectContaining({ p_code: "ROWS_REMAINING" }));
  expect(rpc).not.toHaveBeenCalledWith("finish_account_erasure", expect.anything());
});
