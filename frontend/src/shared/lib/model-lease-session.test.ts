import { afterEach, expect, it, vi } from "vitest";
import { startModelLease } from "./model-lease-session";
afterEach(() => vi.useRealTimers());
const ready = { id: "old", state: "ready" };
function setup() {
  const options = {
    acquire: vi.fn().mockResolvedValue(ready),
    status: vi.fn().mockResolvedValue(ready),
    heartbeat: vi.fn().mockResolvedValue(ready),
    release: vi.fn().mockResolvedValue({}),
    change: vi.fn(),
    error: vi.fn(),
  };
  return { options, session: startModelLease(options) };
}
it("reacquires after an expired lease and stops requesting its old id", async () => {
  vi.useFakeTimers();
  const { options, session } = setup();
  await vi.advanceTimersByTimeAsync(0);
  options.heartbeat.mockRejectedValueOnce(Object.assign(Error(), { status: 404 }));
  options.acquire.mockResolvedValue({ id: "replacement", state: "ready" });
  await vi.advanceTimersByTimeAsync(18000);
  expect(options.acquire).toHaveBeenCalledTimes(2);
  expect(options.change).toHaveBeenLastCalledWith({ id: "replacement", state: "ready" });
  session.stop();
  expect(options.release).toHaveBeenLastCalledWith("replacement");
});
it("stops automatic retries after access denial", async () => {
  vi.useFakeTimers();
  const { options, session } = setup();
  await vi.advanceTimersByTimeAsync(0);
  options.heartbeat.mockRejectedValue(Object.assign(Error(), { status: 403 }));
  await vi.advanceTimersByTimeAsync(120000);
  expect(options.acquire).toHaveBeenCalledTimes(1);
  expect(options.heartbeat).toHaveBeenCalledTimes(1);
  session.stop();
});
it("bounds network retries and supports a deliberate retry after recovery", async () => {
  vi.useFakeTimers();
  const { options, session } = setup();
  await vi.advanceTimersByTimeAsync(0);
  options.heartbeat.mockRejectedValue(Error("offline"));
  await vi.advanceTimersByTimeAsync(200000);
  expect(options.heartbeat).toHaveBeenCalledTimes(6);
  options.heartbeat.mockResolvedValue(ready);
  session.retry();
  await vi.advanceTimersByTimeAsync(0);
  expect(options.change).toHaveBeenLastCalledWith(ready);
  session.stop();
});
it("releases a late acquisition after the page has exited", async () => {
  let resolve!: (value: typeof ready) => void;
  const release = vi.fn().mockResolvedValue({});
  const session = startModelLease({
    acquire: () =>
      new Promise((r) => {
        resolve = r;
      }),
    status: async () => ready,
    heartbeat: async () => ready,
    release,
    change: vi.fn(),
    error: vi.fn(),
  });
  session.stop();
  resolve(ready);
  await Promise.resolve();
  await Promise.resolve();
  expect(release).toHaveBeenCalledWith("old");
});
