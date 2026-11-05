/* eslint-disable @typescript-eslint/no-this-alias -- Worker test doubles expose their instance for lifecycle assertions. */
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createRef } from "react";
import { JournalFaceCapture, type JournalFaceCaptureHandle } from "./journal-face-capture";
vi.mock("@/infrastructure/api/supabase-auth-token-provider", () => ({supabaseAuthTokenProvider:{getAccessToken:async()=>"synthetic-token"}}));
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

it("captures immediately at Save even when the live preview request never completes", async () => {
  const image = new Blob(["synthetic frame"], {type:"image/jpeg"});
  vi.spyOn(HTMLVideoElement.prototype,"videoWidth","get").mockReturnValue(640);
  vi.spyOn(HTMLMediaElement.prototype,"readyState","get").mockReturnValue(4);
  vi.spyOn(HTMLCanvasElement.prototype,"toBlob").mockImplementation(callback=>callback(image));
  const clock=vi.spyOn(Date,"now").mockReturnValue(20000);
  let worker!: FakeWorker;
  class FakeWorker {
    onmessage: ((event: MessageEvent)=>void)|null=null;
    postMessage=vi.fn(); terminate=vi.fn();
    constructor(){worker=this;}
  }
  vi.stubGlobal("Worker",FakeWorker);
  Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia:async()=>({getTracks:()=>[{stop:vi.fn()}]})}});
  const pending=vi.fn(()=>new Promise(()=>{}));vi.stubGlobal("fetch",pending);
  const ref=createRef<JournalFaceCaptureHandle>();
  const view=render(<JournalFaceCapture ref={ref} running />);
  await waitFor(()=>expect(worker).toBeDefined());
  const timers=new Map<number,()=>void>();
  vi.spyOn(globalThis,"setInterval").mockImplementation(((callback:()=>void,delay:number)=>{timers.set(delay,callback);return 12345;}) as typeof setInterval);
  await act(async()=>{
    worker.onmessage?.({data:{type:"ready",connections:[]}} as MessageEvent);
    worker.onmessage?.({data:{type:"result",landmarks:Array.from({length:478},()=>[0.5,0.5,0]),blendshapes:Array.from({length:52},()=>({name:"test",score:0}))}} as MessageEvent);
  });
  clock.mockReturnValue(21000);
  await act(async()=>timers.get(1000)?.());
  expect(pending).toHaveBeenCalledOnce();
  await act(async()=>expect(await ref.current!.getStill()).toBe(image));
  expect((pending.mock.calls[0] as unknown as [string,RequestInit])[1].signal?.aborted).toBe(true);
  expect(ref.current!.getCapture()?.landmarks).toHaveLength(478);
  view.unmount();
});
