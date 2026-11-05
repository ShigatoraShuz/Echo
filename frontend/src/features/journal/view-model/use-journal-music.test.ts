import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";

const contexts: FakeAudio[] = [];
class FakeAudio {
  state = "suspended";
  currentTime = 0;
  destination = {};
  source = { buffer: null, loop: false, connect: vi.fn(), start: vi.fn() };
  gain = { gain: { setValueAtTime: vi.fn(), setTargetAtTime: vi.fn() }, connect: vi.fn() };
  constructor() { contexts.push(this); }
  resume = vi.fn(async () => { this.state = "running"; });
  suspend = vi.fn(async () => { this.state = "suspended"; });
  close = vi.fn(async () => { this.state = "closed"; });
  decodeAudioData = vi.fn(async () => ({ duration: 62 }));
  createBufferSource = vi.fn(() => this.source);
  createGain = vi.fn(() => this.gain);
}
let useJournalMusic: typeof import("./use-journal-music").useJournalMusic;
beforeEach(async () => {
  vi.resetModules();
  contexts.length = 0;
  vi.stubGlobal("AudioContext", FakeAudio);
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ audio: btoa("audio") }) })));
  ({ useJournalMusic } = await import("./use-journal-music"));
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("loads on demand, loops once without restarting for each keystroke, and obeys pause and volume", async () => {
  const { result, unmount } = renderHook(() => useJournalMusic(false));
  expect(fetch).not.toHaveBeenCalled();
  await act(async () => { await result.current.start(); await result.current.start(); });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(String(vi.mocked(fetch).mock.calls[0][0])).toMatch(/journal-music-.*\.json$/);
  expect(contexts).toHaveLength(1);
  expect(contexts[0].source.loop).toBe(true);
  expect(contexts[0].source.start).toHaveBeenCalledTimes(1);
  expect(result.current.playback).toBe("playing");
  act(() => { result.current.changeVolume(0.4); result.current.toggle(); });
  expect(contexts[0].gain.gain.setTargetAtTime).toHaveBeenLastCalledWith(0.4, 0, 0.04);
  await act(async () => { await result.current.start(); });
  expect(result.current.playback).toBe("paused");
  expect(contexts[0].resume).toHaveBeenCalledTimes(1);
  await act(async () => { result.current.toggle(); });
  expect(result.current.playback).toBe("playing");
  unmount();
  expect(contexts[0].close).toHaveBeenCalledTimes(1);
});

it("cancels pending playback when navigating away and never starts after the editor unmounts", async () => {
  let finish!: (value: Response) => void;
  vi.mocked(fetch).mockImplementation(() => new Promise(resolve => { finish = resolve; }) as Promise<Response>);
  const { result, unmount } = renderHook(() => useJournalMusic(false));
  let pending!: Promise<void>;
  act(() => { pending = result.current.start(); });
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  unmount();
  await act(async () => { finish(new Response(JSON.stringify({ audio: btoa("audio") }))); await pending; });
  expect(contexts[0].source.start).not.toHaveBeenCalled();
  expect(contexts[0].close).toHaveBeenCalledTimes(1);
});

it("stops for saved analysis and reuses the decoded asset for the next reflection", async () => {
  const { result, rerender } = renderHook(({ disabled }) => useJournalMusic(disabled), { initialProps: { disabled: false } });
  await act(async () => { await result.current.start(); });
  rerender({ disabled: true });
  expect(contexts[0].close).toHaveBeenCalledTimes(1);
  await act(async () => { await result.current.start(); });
  expect(contexts).toHaveLength(1);
  rerender({ disabled: false });
  await act(async () => { await result.current.start(); });
  expect(contexts).toHaveLength(2);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(contexts[1].source.start).toHaveBeenCalledTimes(1);
});

it("keeps the editor usable after an audio failure without retrying on every keystroke", async () => {
  vi.mocked(fetch).mockRejectedValue(new Error("offline"));
  const { result } = renderHook(() => useJournalMusic(false));
  await act(async () => { await result.current.start(); await result.current.start(); });
  expect(result.current.playback).toBe("unavailable");
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("pauses in a hidden tab and resumes with one click after returning", async () => {
  const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  const { result } = renderHook(() => useJournalMusic(false));
  await act(async () => { await result.current.start(); });
  act(() => { hidden.mockReturnValue(true); document.dispatchEvent(new Event("visibilitychange")); });
  expect(result.current.playback).toBe("paused");
  hidden.mockReturnValue(false);
  await act(async () => { result.current.toggle(); });
  expect(result.current.playback).toBe("playing");
  expect(contexts[0].source.start).toHaveBeenCalledTimes(1);
});
