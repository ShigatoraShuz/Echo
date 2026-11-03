import { afterEach, beforeEach, expect, it, vi } from "vitest";
let sound: typeof import("./interface-sound");
const contexts: FakeAudio[] = [];
const source = () => ({
  buffer: null as unknown,
  connect: vi.fn(),
  disconnect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  onended: null as (() => void) | null,
});
class FakeAudio {
  state = "suspended";
  currentTime = 1;
  destination = {};
  sources: ReturnType<typeof source>[] = [];
  constructor() {
    contexts.push(this);
  }
  resume = vi.fn(async () => {
    this.state = "running";
  });
  close = vi.fn(async () => {
    this.state = "closed";
  });
  decodeAudioData = vi.fn(async (data: ArrayBuffer) => ({ id: new Uint8Array(data)[0] }));
  createBufferSource = vi.fn(() => {
    const node = source();
    this.sources.push(node);
    return node;
  });
  createGain = vi.fn(() => ({
    gain: {
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      setTargetAtTime: vi.fn(),
      cancelScheduledValues: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));
}
beforeEach(async () => {
  vi.resetModules();
  sound = await import("./interface-sound");
  localStorage.clear();
  contexts.length = 0;
  vi.stubGlobal("AudioContext", FakeAudio);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => Object.fromEntries(["tab-change1.wav", "tab-change2.wav", "tab-change3.wav", "tab-change4.wav", "pop-upboxsound.wav"].map((name, index) => [name, btoa(String.fromCharCode(index === 4 ? 9 : index + 1))])),
    })),
  );
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  let now = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => (now += 100));
});
afterEach(() => {
  sound.stopInterfaceSound();
  vi.unstubAllGlobals();
});
it("defaults off without audio or asset downloads; navigation cannot unlock autoplay", async () => {
  expect(sound.interfaceSoundPreference()).toEqual({ enabled: false, volume: 0.35 });
  expect(await sound.playInterfaceSound("page")).toBe(false);
  expect(await sound.unlockInterfaceSound()).toBe(false);
  sound.saveInterfaceSoundPreference({ enabled: true, volume: 0.4 });
  expect(await sound.playInterfaceSound("page")).toBe(false);
  expect(fetch).not.toHaveBeenCalled();
  expect(contexts).toHaveLength(0);
});
it("decodes the actual five filenames once, randomizes four page WAVs without repeats and uses the fixed popup WAV", async () => {
  sound.saveInterfaceSoundPreference({ enabled: true, volume: 0.4 });
  await sound.unlockInterfaceSound();
  vi.spyOn(Math, "random").mockReturnValue(0);
  const ids: number[] = [];
  for (let i = 0; i < 8; i++) {
    expect(await sound.playInterfaceSound("page")).toBe(true);
    ids.push((contexts[0].sources.at(-1)!.buffer as { id: number }).id);
    if (i) expect(ids[i]).not.toBe(ids[i - 1]);
  }
  expect(new Set(ids).size).toBe(4);
  await sound.playInterfaceSound("popup");
  expect(contexts[0].sources.at(-1)!.buffer).toEqual({ id: 9 });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(contexts[0].decodeAudioData).toHaveBeenCalledTimes(5);
  expect(contexts[0].sources[0].stop).toHaveBeenCalledWith(1.025);
  expect(contexts[0].sources.at(-1)!.stop).not.toHaveBeenCalled();
  expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/sounds\/interface\/cues-[a-f0-9]+\.json$/), { cache: "force-cache" });
});
it("preserves preview while off, live volume, immediate mute, hidden-tab silence and decoded cache on re-enable", async () => {
  await sound.unlockInterfaceSound(true);
  expect(await sound.playInterfaceSound("popup", true)).toBe(true);
  expect(sound.interfaceSoundPreference().enabled).toBe(false);
  sound.saveInterfaceSoundPreference({ enabled: true, volume: 0.7 });
  expect(contexts[0].createGain.mock.results[0].value.gain.setTargetAtTime).toHaveBeenCalledWith(0.7, 1, 0.015);
  sound.saveInterfaceSoundPreference({ enabled: false, volume: 0.7 });
  expect(contexts[0].close).toHaveBeenCalledOnce();
  expect(await sound.playInterfaceSound("page")).toBe(false);
  sound.saveInterfaceSoundPreference({ enabled: true, volume: 0.7 });
  await sound.unlockInterfaceSound();
  await sound.playInterfaceSound("page");
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(contexts[1].decodeAudioData).not.toHaveBeenCalled();
  sound.saveInterfaceSoundPreference({ enabled: true, volume: 0 });
  expect(await sound.playInterfaceSound("popup", true)).toBe(false);
  vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  expect(await sound.unlockInterfaceSound(true)).toBe(false);
});
it("drops pending playback after mute or cleanup instead of playing a stale downloaded cue", async () => {
  let resolve!: (buffer: unknown) => void;
  const decoded = new Promise<unknown>((yes) => (resolve = yes));
  vi.stubGlobal(
    "AudioContext",
    class extends FakeAudio {
      decodeAudioData = vi.fn(() => decoded as Promise<{ id: number }>);
    },
  );
  sound.saveInterfaceSoundPreference({ enabled: true, volume: 0.5 });
  await sound.unlockInterfaceSound();
  const pending = sound.playInterfaceSound("page");
  sound.stopInterfaceSound();
  resolve({ id: 1 });
  expect(await pending).toBe(false);
  expect(contexts[0].sources).toHaveLength(0);
});
it("suppresses duplicate events and disconnects ended WAV voices", async () => {
  await sound.unlockInterfaceSound(true);
  vi.spyOn(performance, "now").mockReturnValue(5000);
  expect(await sound.playInterfaceSound("page", true)).toBe(true);
  expect(await sound.playInterfaceSound("page", true)).toBe(false);
  const voice = contexts[0].sources[0];
  voice.onended!();
  expect(voice.disconnect).toHaveBeenCalledOnce();
  expect(contexts[0].createGain.mock.results[0].value.disconnect).toHaveBeenCalledOnce();
});
it("handles missing files and unsupported audio without crashing the app", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: false })),
  );
  await sound.unlockInterfaceSound(true);
  expect(await sound.playInterfaceSound("page", true)).toBe(false);
  expect(contexts[0].sources).toHaveLength(0);
  sound.stopInterfaceSound();
  vi.stubGlobal("AudioContext", undefined);
  expect(await sound.unlockInterfaceSound(true)).toBe(false);
});
it("does not repeatedly fetch an intercepted or failed bundle on every interaction", async () => {
  let now = 1000;
  vi.spyOn(Date, "now").mockImplementation(() => now);
  vi.mocked(fetch).mockRejectedValue(new Error("Request intercepted"));
  await sound.unlockInterfaceSound(true);
  for (let i = 0; i < 8; i++) expect(await sound.playInterfaceSound("page", true)).toBe(false);
  expect(fetch).toHaveBeenCalledTimes(1);
  now += 30001;
  expect(await sound.playInterfaceSound("popup", true)).toBe(false);
  expect(fetch).toHaveBeenCalledTimes(2);
});
