/* eslint-disable @typescript-eslint/no-this-alias -- Worker test doubles expose their instance for lifecycle assertions. */
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { JournalFaceCapture } from "./journal-face-capture";
const original = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (original) Object.defineProperty(navigator, "mediaDevices", original);
  else Reflect.deleteProperty(navigator, "mediaDevices");
});
it("does not request a camera before writing, then automatically starts when running", async () => {
  const getUserMedia = vi.fn(() => new Promise<MediaStream>(() => {}));
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
  const view = render(<JournalFaceCapture running={false} />);
  expect(getUserMedia).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Start camera" })).not.toBeInTheDocument();
  view.rerender(<JournalFaceCapture running />);
  await waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce());
});
it("stops a camera that resolves after the component unmounts", async () => {
  let resolve!: (value: unknown) => void;
  const stop = vi.fn();
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: () =>
        new Promise((r) => {
          resolve = r;
        }),
    },
  });
  const view = render(<JournalFaceCapture running />);
  view.unmount();
  await act(async () => resolve({ getTracks: () => [{ stop }] }));
  expect(stop).toHaveBeenCalledOnce();
});
it("keeps video hidden, exposes only the mesh canvas, and releases failed workers", async () => {
  const stop = vi.fn(),
    terminate = vi.fn();
  let worker!: FakeWorker;
  class FakeWorker {
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: (() => void) | null = null;
    terminate = terminate;
    postMessage = vi.fn();
    constructor() {
      worker = this;
    }
  }
  vi.stubGlobal("Worker", FakeWorker);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: async () => ({ getTracks: () => [{ stop }] }) },
  });
  render(<JournalFaceCapture running />);
  await waitFor(() => expect(worker).toBeDefined());
  expect(document.querySelector("video")).toHaveAttribute("aria-hidden", "true");
  expect(document.querySelector("video")).toHaveClass("opacity-0");
  expect(screen.getByRole("img", { name: /Live face landmark mesh/ })).toHaveClass("face-studio-canvas");
  await act(async () => worker.onmessage?.({ data: { type: "error" } } as MessageEvent));
  expect(stop).toHaveBeenCalledOnce();
  expect(terminate).toHaveBeenCalledOnce();
});
it("releases the camera and worker immediately when writing stops", async () => {
  const stop = vi.fn(),
    terminate = vi.fn();
  let worker!: FakeWorker;
  class FakeWorker {
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: (() => void) | null = null;
    terminate = terminate;
    postMessage = vi.fn();
    constructor() {
      worker = this;
    }
  }
  vi.stubGlobal("Worker", FakeWorker);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: async () => ({ getTracks: () => [{ stop }] }) },
  });
  const view = render(<JournalFaceCapture running />);
  await waitFor(() => expect(worker).toBeDefined());
  view.rerender(<JournalFaceCapture running={false} />);
  expect(stop).toHaveBeenCalledOnce();
  expect(terminate).toHaveBeenCalledOnce();
});

it("shows a recoverable camera denial without starting a worker", async () => {
  const WorkerMock = vi.fn();
  vi.stubGlobal("Worker", WorkerMock);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: async () => {
        throw new DOMException("Denied", "NotAllowedError");
      },
    },
  });
  render(<JournalFaceCapture running />);
  expect(await screen.findByText("Camera access is blocked")).toBeVisible();
  expect(screen.getByRole("button", { name: "Retry camera" })).toBeEnabled();
  expect(WorkerMock).not.toHaveBeenCalled();
});
