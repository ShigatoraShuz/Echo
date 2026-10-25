import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { startProfessionalEventProcessor } from "../professional-event-processor.js";

const counts = { enqueued: 0, delivered: 1, suppressed: 0, failures: 0, pending: 0, ready: 0, failed: 0, oldestPendingAt: null };
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("runs a trusted bounded batch on startup and subsequently without a browser request", async () => {
  const service = { runBatch: vi.fn().mockResolvedValue(counts) }, report = vi.fn();
  const processor = startProfessionalEventProcessor(service, { enabled: true, httpOnly: false, report });
  await vi.advanceTimersByTimeAsync(0);
  expect(service.runBatch).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(service.runBatch).toHaveBeenCalledTimes(3);
  expect(report).toHaveBeenCalledWith({ event: "processor_started", enabled: true, intervalMs: 30_000 });
  expect(report).toHaveBeenCalledWith({ event: "batch_completed", ...counts });
  await processor.stop();
  await vi.advanceTimersByTimeAsync(60_000);
  expect(service.runBatch).toHaveBeenCalledTimes(3);
});

it.each([{ enabled: false, httpOnly: false }, { enabled: true, httpOnly: true }])("reports disabled execution and never touches a queue: %j", async flags => {
  const service = { runBatch: vi.fn() }, report = vi.fn();
  const processor = startProfessionalEventProcessor(service, { ...flags, report });
  await vi.advanceTimersByTimeAsync(120_000);
  expect(service.runBatch).not.toHaveBeenCalled();
  expect(report).toHaveBeenCalledWith(expect.objectContaining({ event: "processor_disabled", enabled: false }));
  await processor.stop();
});

it("never overlaps slow batches and waits for the current batch on shutdown", async () => {
  let finish!: (value: typeof counts) => void;
  const service = { runBatch: vi.fn(() => new Promise<typeof counts>(resolve => { finish = resolve; })) };
  const processor = startProfessionalEventProcessor(service, { enabled: true, httpOnly: false, report: vi.fn(), intervalMs: 1 });
  await vi.advanceTimersByTimeAsync(120_000);
  expect(service.runBatch).toHaveBeenCalledTimes(1);
  const stop = processor.stop(); finish(counts); await stop;
  await vi.advanceTimersByTimeAsync(120_000);
  expect(service.runBatch).toHaveBeenCalledTimes(1);
});

it("retries after an unavailable batch without leaking diagnostics or replaying terminal events", async () => {
  const service = { runBatch: vi.fn().mockRejectedValueOnce(new Error("private event id / token")).mockResolvedValue(counts) }, report = vi.fn();
  const processor = startProfessionalEventProcessor(service, { enabled: true, httpOnly: false, report });
  await vi.advanceTimersByTimeAsync(30_000);
  expect(service.runBatch).toHaveBeenCalledTimes(2);
  expect(report).toHaveBeenCalledWith({ event: "batch_failed" });
  expect(JSON.stringify(report.mock.calls)).not.toContain("private");
  await processor.stop();
});
