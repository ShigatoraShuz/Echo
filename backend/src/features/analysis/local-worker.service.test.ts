import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LocalWorkerService, canonicalCallback } from "./local-worker.service.js";
import type { JournalService } from "../journals/journals.service.js";

function serviceWith(error: { message: string } | null = null) {
  const rpc = vi.fn().mockResolvedValue({ data: { status: "safety_checking", progress: 10 }, error });
  const database = { schema: () => ({ rpc }) } as unknown as SupabaseClient;
  const service = new LocalWorkerService(database, {} as JournalService, "a-dedicated-worker-secret-of-32-characters");
  return { service, rpc };
}
describe("external worker protocol", () => {
  it("authenticates credentials and binds the single configured worker identity", async () => {
    const { service, rpc } = serviceWith();
    expect(() => service.authenticate("wrong")).toThrow();
    expect(() => service.authenticate("a-dedicated-worker-secret-of-32-characters")).not.toThrow();
    await expect(service.claim("other-worker")).rejects.toThrow(/identity/);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("sends only a hashed lease and HMAC callback key to the transaction", async () => {
    const { service, rpc } = serviceWith();
    await service.progress("job-id", "local-worker", "raw-lease-token", "raw-callback-key-16", {
      status: "safety_checking",
    });
    const args = rpc.mock.calls[0][1];
    expect(args.p_key_hmac).toMatch(/^[a-f0-9]{64}$/);
    expect(args.p_lease_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(args)).not.toMatch(/raw-/);
  });
  it("requires a fresh callback key for lease heartbeats", async () => {
    const { service, rpc } = serviceWith();
    await expect(service.heartbeat("job", "local-worker", "lease")).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("maps an exact-key/different-payload database conflict to 409", async () => {
    const { service } = serviceWith({ message: "CALLBACK_IDEMPOTENCY_CONFLICT" });
    await expect(
      service.progress("job", "local-worker", "lease", "callback-key-long", { status: "safety_checking" }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
  it("does not allow client progress percentages or skipping the safety callback", async () => {
    const { service, rpc } = serviceWith();
    await expect(
      service.progress("job", "local-worker", "lease", "callback-key-long", {
        status: "safety_checking",
        progress: 100,
      }),
    ).rejects.toThrow();
    await expect(
      service.progress("job", "local-worker", "lease", "callback-key-long", { status: "analyzing_emotions" }),
    ).rejects.toThrow();
    expect(rpc.mock.calls.every(([name]) => name === "lookup_worker_receipt")).toBe(true);
  });
  it("canonicalizes callback object ordering but not content", () => {
    expect(canonicalCallback({ b: 2, a: [1] })).toBe(canonicalCallback({ a: [1], b: 2 }));
    expect(canonicalCallback({ a: 1 })).not.toBe(canonicalCallback({ a: 2 }));
  });
});
