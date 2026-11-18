export const BACKGROUND_MUSIC_KEY = "echo:background-music";
export const BACKGROUND_MUSIC_EVENT = "echo:background-music-changed";
export const DEFAULT_BACKGROUND_MUSIC = { enabled: true, volume: 0.12 };
let audio: HTMLAudioElement | null = null;
let voiceFocus = false;
export function setBackgroundMusicVoiceFocus(active: boolean) {
  voiceFocus = active;
  if (active) pauseBackgroundMusic();
  else void playBackgroundMusic();
}

export function backgroundMusicPreference() {
  try {
    const value = JSON.parse(localStorage.getItem(BACKGROUND_MUSIC_KEY) || "null");
    return value && typeof value.enabled === "boolean" && typeof value.volume === "number" && Number.isFinite(value.volume)
      ? { enabled: value.enabled, volume: Math.max(0, Math.min(1, value.volume)) }
      : { ...DEFAULT_BACKGROUND_MUSIC };
  } catch { return { ...DEFAULT_BACKGROUND_MUSIC }; }
}
export async function playBackgroundMusic() {
  const preference = backgroundMusicPreference();
  if (voiceFocus || document.hidden || !preference.enabled || !preference.volume) { pauseBackgroundMusic(); return false; }
  if (!audio) {
    audio = new Audio("/audio/golden-afternoon.mp3");
    audio.loop = true;
    audio.preload = "none";
  }
  audio.volume = preference.volume;
  if (!audio.paused) return true;
  try { await audio.play(); return true; } catch { return false; }
}
export function pauseBackgroundMusic() { audio?.pause(); }
export function releaseBackgroundMusic() { audio?.pause(); audio = null; }
export function saveBackgroundMusicPreference(value: { enabled: boolean; volume: number }) {
  const next = { enabled: value.enabled, volume: Math.max(0, Math.min(1, value.volume)) };
  try { localStorage.setItem(BACKGROUND_MUSIC_KEY, JSON.stringify(next)); }
  catch { return false; }
  if (audio) audio.volume = next.volume;
  if (!next.enabled || !next.volume) pauseBackgroundMusic();
  window.dispatchEvent(new Event(BACKGROUND_MUSIC_EVENT));
  return true;
}
