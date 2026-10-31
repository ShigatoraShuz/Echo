import { it, expect, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useBuddyVoiceControls } from "./use-buddy-voice-controls";
vi.mock("@/infrastructure/api/supabase-auth-token-provider", () => ({
  supabaseAuthTokenProvider: { getAccessToken: async () => "synthetic" },
}));
afterEach(() => {
  vi.unstubAllGlobals();
});
it("stops tracks, transcribes locally once, and delivers only final text", async () => {
  const stop = vi.fn();
  const stream = { getTracks: () => [{ stop }] };
  Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia: async () => stream }, configurable: true });
  let recorder: any;
  class Recorder {
    state = "inactive";
    mimeType = "audio/webm";
    ondataavailable: any;
    onstop: any;
    constructor() {
      recorder = this;
    }
    start() {
      this.state = "recording";
    }
    stop() {
      this.state = "inactive";
      this.ondataavailable({ data: new Blob(["synthetic"]) });
      void this.onstop();
    }
  }
  vi.stubGlobal("MediaRecorder", Recorder);
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { text: "Hello Buddy" } }) });
  vi.stubGlobal("fetch", fetcher);
  const callback = vi.fn();
  const { result, unmount } = renderHook(() => useBuddyVoiceControls());
  await act(async () => {
    await result.current.startListening(callback);
  });
  act(() => result.current.stopListening());
  await waitFor(() => expect(callback).toHaveBeenCalledWith("Hello Buddy"));
  expect(fetcher.mock.calls[0][0]).toContain("/buddy/voice/transcribe");
  expect(stop).toHaveBeenCalled();
  expect(callback).toHaveBeenCalledTimes(1);
  unmount();
});
it("releases a late microphone permission result after unmount", async () => {
  let resolve: any;
  const stop = vi.fn();
  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia: () => new Promise((r) => (resolve = r)) },
    configurable: true,
  });
  vi.stubGlobal("MediaRecorder", class {});
  const { result, unmount } = renderHook(() => useBuddyVoiceControls());
  act(() => {
    void result.current.startListening(() => {});
  });
  unmount();
  await act(async () => resolve({ getTracks: () => [{ stop }] }));
  expect(stop).toHaveBeenCalled();
});

it("reports microphone denial without sending anything", async () => {
  Object.defineProperty(navigator, "mediaDevices", {
    value: {
      getUserMedia: async () => {
        throw Error("denied");
      },
    },
    configurable: true,
  });
  vi.stubGlobal("MediaRecorder", class {});
  const callback = vi.fn();
  const { result } = renderHook(() => useBuddyVoiceControls());
  await act(async () => result.current.startListening(callback));
  expect(result.current.voiceError).toMatch(/permission/);
  expect(callback).not.toHaveBeenCalled();
});
it("cancels recording without transcribing or sending", async () => {
  const stop = vi.fn();
  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia: async () => ({ getTracks: () => [{ stop }] }) },
    configurable: true,
  });
  class Recorder {
    state = "inactive";
    onstop: any;
    ondataavailable: any;
    start() {
      this.state = "recording";
    }
    stop() {
      this.state = "inactive";
      this.ondataavailable({ data: new Blob(["synthetic"]) });
      this.onstop();
    }
  }
  vi.stubGlobal("MediaRecorder", Recorder);
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const callback = vi.fn();
  const { result } = renderHook(() => useBuddyVoiceControls());
  await act(async () => result.current.startListening(callback));
  act(() => result.current.cancel());
  expect(stop).toHaveBeenCalled();
  expect(fetcher).not.toHaveBeenCalled();
  expect(callback).not.toHaveBeenCalled();
});
it("reports blocked autoplay and releases the temporary audio URL", async () => {
  const create = vi.fn(() => "blob:synthetic"),
    revoke = vi.fn();
  vi.stubGlobal(
    "URL",
    class {
      static createObjectURL = create;
      static revokeObjectURL = revoke;
    },
  );
  vi.stubGlobal(
    "Audio",
    class {
      src = "";
      onended: any;
      onerror: any;
      play = async () => {
        throw Error("autoplay blocked");
      };
      pause() {}
      load() {}
    },
  );
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(["synthetic"]) }));
  const { result } = renderHook(() => useBuddyVoiceControls());
  await act(async () => result.current.speak("Approved synthetic reply"));
  expect(result.current.voiceError).toMatch(/playback blocked/);
  expect(result.current.isSpeaking).toBe(false);
  expect(revoke).toHaveBeenCalledWith("blob:synthetic");
});

it("handles a recorder failure without sending or retaining the microphone", async () => {
  const stop = vi.fn();
  let recorder: any;
  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia: async () => ({ getTracks: () => [{ stop }] }) },
    configurable: true,
  });
  class Recorder {
    state = "inactive";
    onerror: any;
    onstop: any;
    constructor() {
      recorder = this;
    }
    start() {
      this.state = "recording";
    }
    stop() {
      this.state = "inactive";
      this.onstop();
    }
  }
  vi.stubGlobal("MediaRecorder", Recorder);
  const callback = vi.fn();
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const { result } = renderHook(() => useBuddyVoiceControls());
  await act(async () => result.current.startListening(callback));
  act(() => recorder.onerror());
  expect(result.current.voiceError).toMatch(/Recording failed/);
  expect(stop).toHaveBeenCalled();
  expect(callback).not.toHaveBeenCalled();
  expect(fetcher).not.toHaveBeenCalled();
});
