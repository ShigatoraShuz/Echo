import { INTERFACE_SOUND_BUNDLE } from "./interface-sound-assets";

export const INTERFACE_SOUND_KEY = "echo:interface-sounds";
export const INTERFACE_SOUND_EVENT = "echo:interface-sounds-changed";
const defaults = { enabled: false, volume: 0.35 };
type Cue = "page" | "popup";
const files = {
  page: ["tab-change1.wav", "tab-change2.wav", "tab-change3.wav", "tab-change4.wav"],
  popup: ["pop-upboxsound.wav"],
};
const buffers = new Map<string, Promise<AudioBuffer>>();
let bundle: Promise<Record<string, string>> | null = null;
let retryAfter = 0;
let context: AudioContext | null = null;
let active: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
let previousPage = -1;
let generation = 0;
let lastCue: Cue | null = null;
let lastTime = -Infinity;

export function interfaceSoundPreference() {
  try {
    const value = JSON.parse(localStorage.getItem(INTERFACE_SOUND_KEY) || "null");
    return {
      enabled: value?.enabled === true,
      volume:
        typeof value?.volume === "number" && Number.isFinite(value.volume)
          ? Math.max(0, Math.min(1, value.volume))
          : defaults.volume,
    };
  } catch {
    return { ...defaults };
  }
}

function loadBuffer(name: string, audio: AudioContext) {
  let pending = buffers.get(name);
  if (!pending) {
    // IDM intercepts direct media URLs. Fetch application data once instead.
    if (!bundle && Date.now() < retryAfter) return Promise.reject(new Error("Sound retry deferred"));
    bundle ??= fetch(INTERFACE_SOUND_BUNDLE, { cache: "force-cache" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Interface sounds unavailable");
        return (await response.json()) as Record<string, string>;
      })
      .catch((error: unknown) => {
        bundle = null;
        retryAfter = Date.now() + 30_000;
        throw error;
      });
    pending = bundle
      .then((data) => {
        if (typeof data[name] !== "string") throw new Error("Interface sound missing");
        const bytes = Uint8Array.from(atob(data[name]), (character) => character.charCodeAt(0));
        return audio.decodeAudioData(bytes.buffer);
      })
      .catch((error: unknown) => {
        buffers.delete(name);
        throw error;
      });
    buffers.set(name, pending);
  }
  return pending;
}

export function stopInterfaceSound() {
  generation++;
  active = null;
  const previous = context;
  context = null;
  lastCue = null;
  lastTime = -Infinity;
  if (previous) void previous.close().catch(() => {});
}

export function saveInterfaceSoundPreference(value: typeof defaults) {
  const preference = { enabled: value.enabled, volume: Math.max(0, Math.min(1, value.volume)) };
  try {
    localStorage.setItem(INTERFACE_SOUND_KEY, JSON.stringify(preference));
  } catch {
    return false;
  }
  if (!preference.enabled || preference.volume === 0) stopInterfaceSound();
  else if (active && context) active.gain.gain.setTargetAtTime(preference.volume, context.currentTime, 0.015);
  window.dispatchEvent(new Event(INTERFACE_SOUND_EVENT));
  return true;
}

// Only an interaction unlocks audio. Decode once, after opting in or previewing.
export async function unlockInterfaceSound(preview = false) {
  if (document.hidden || (!preview && !interfaceSoundPreference().enabled)) return false;
  try {
    if (!window.AudioContext) return false;
    if (!context) {
      context = new window.AudioContext({ latencyHint: "interactive" });
      for (const name of [...files.page, ...files.popup]) void loadBuffer(name, context).catch(() => {});
    }
    const current = context;
    if (current.state === "suspended") await current.resume();
    return context === current && current.state === "running";
  } catch {
    return false;
  }
}

export async function playInterfaceSound(cue: Cue, preview = false) {
  const preference = interfaceSoundPreference();
  const audio = context;
  if ((!preview && !preference.enabled) || preference.volume === 0 || document.hidden || audio?.state !== "running")
    return false;
  const now = performance.now();
  if (lastCue === cue && now - lastTime < 75) return false;
  lastCue = cue;
  lastTime = now;
  const request = ++generation;
  const index =
    cue === "popup"
      ? 0
      : previousPage < 0
        ? Math.floor(Math.random() * files.page.length)
        : (previousPage + 1 + Math.floor(Math.random() * (files.page.length - 1))) % files.page.length;
  try {
    const buffer = await loadBuffer(files[cue][index], audio);
    const current = interfaceSoundPreference();
    if (
      request !== generation ||
      context !== audio ||
      audio.state !== "running" ||
      document.hidden ||
      (!preview && !current.enabled) ||
      current.volume === 0
    )
      return false;
    if (active) {
      active.gain.gain.cancelScheduledValues(audio.currentTime);
      active.gain.gain.setTargetAtTime(0, audio.currentTime, 0.006);
      active.source.stop(audio.currentTime + 0.025);
    }
    const source = audio.createBufferSource();
    const gain = audio.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(0, audio.currentTime);
    gain.gain.linearRampToValueAtTime(current.volume, audio.currentTime + 0.008);
    source.connect(gain);
    gain.connect(audio.destination);
    const voice = { source, gain };
    active = voice;
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      if (active === voice) active = null;
    };
    source.start();
    if (cue === "page") previousPage = index;
    return true;
  } catch {
    return false;
  }
}
