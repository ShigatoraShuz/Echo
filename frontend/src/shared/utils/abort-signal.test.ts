import { describe, it, expect, vi, afterEach } from "vitest";
import { composeSignal } from "./abort-signal";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("composeSignal", () => {
  it("returns undefined when no signal or timeout", () => {
    const result = composeSignal(null, 0);
    expect(result).toBeUndefined();
  });

  it("returns undefined for Infinity timeout with no external signal", () => {
    const result = composeSignal(null, Infinity);
    expect(result).toBeUndefined();
  });

  it("aborts on caller signal", () => {
    const controller = new AbortController();
    const signal = composeSignal(controller.signal, 0);
    expect(signal?.aborted).toBe(false);
    controller.abort();
    expect(signal?.aborted).toBe(true);
  });

  it("aborts on timeout", async () => {
    vi.useFakeTimers();
    const signal = composeSignal(null, 100);
    expect(signal?.aborted).toBe(false);
    vi.advanceTimersByTime(100);
    expect(signal?.aborted).toBe(true);
    vi.useRealTimers();
  });

  it("cleans up listeners on abort", () => {
    const controller = new AbortController();
    const addEventListenerSpy = vi.spyOn(controller.signal, "addEventListener");
    const removeEventListenerSpy = vi.spyOn(controller.signal, "removeEventListener");

    const signal = composeSignal(controller.signal, 0);
    expect(signal).toBeDefined();
    controller.abort();

    expect(removeEventListenerSpy).toHaveBeenCalled();
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it("clears timeout timer on abort", async () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

    const controller = new AbortController();
    composeSignal(controller.signal, 5000);
    controller.abort();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
    vi.useRealTimers();
  });

  it("aborts immediately if external signal already aborted", () => {
    const controller = new AbortController();
    controller.abort(new Error("cancelled"));
    const signal = composeSignal(controller.signal, 0);
    expect(signal?.aborted).toBe(true);
  });
});
