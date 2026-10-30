import { afterEach, describe, expect, it, vi } from "vitest";
import type { LocalWorkerService } from "../../features/analysis/local-worker.service.js";
import type { ModelServiceClient } from "./model-service.client.js";
import { startHttpModelProcessor } from "./http-model.processor.js";

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
describe("bounded trusted HTTP worker lifecycle", () => {
  it("runs scoped recovery on startup and periodically without duplicate claims", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-30T00:00:00Z"));
    const worker = { reportHealth: vi.fn().mockResolvedValue(undefined), recover: vi.fn().mockResolvedValue(undefined), claim: vi.fn().mockResolvedValue(null) };
    const processor = startHttpModelProcessor(worker as unknown as LocalWorkerService, {} as ModelServiceClient);
    await vi.advanceTimersByTimeAsync(1);
    expect(worker.recover).toHaveBeenCalledTimes(1);
    expect(worker.claim).toHaveBeenCalledWith("echo-http-engineering-v1");
    await vi.advanceTimersByTimeAsync(29_000);
    expect(worker.recover).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(worker.recover).toHaveBeenCalledTimes(2);
    await processor.stop();
    const calls = worker.claim.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(worker.claim).toHaveBeenCalledTimes(calls);
    expect(worker.reportHealth).toHaveBeenLastCalledWith("echo-http-engineering-v1", false, "stopped", "staged-v2");
  });
  it("never claims work while recovery remains in flight", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-30T00:00:00Z"));
    let release!: () => void;
    const worker = { reportHealth: vi.fn().mockResolvedValue(undefined), recover: vi.fn(() => new Promise<void>(done => { release = done; })), claim: vi.fn().mockResolvedValue(null) };
    const processor = startHttpModelProcessor(worker as unknown as LocalWorkerService, {} as ModelServiceClient);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(worker.recover).toHaveBeenCalledTimes(1);
    expect(worker.claim).not.toHaveBeenCalled();
    release(); await vi.advanceTimersByTimeAsync(1);
    expect(worker.claim).toHaveBeenCalledTimes(1);
    await processor.stop();
  });
});
