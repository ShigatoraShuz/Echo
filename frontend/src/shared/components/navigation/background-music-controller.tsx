"use client";
import { useEffect, useState } from "react";
import { Music2, VolumeX } from "lucide-react";
import {
  BACKGROUND_MUSIC_EVENT, BACKGROUND_MUSIC_KEY, DEFAULT_BACKGROUND_MUSIC,
  backgroundMusicPreference, saveBackgroundMusicPreference, playBackgroundMusic,
  pauseBackgroundMusic, releaseBackgroundMusic,
} from "@/services/audio/background-music";

/** Mounted once in the root layout so navigation never restarts the track. */
export function BackgroundMusicController() {
  const [preference, setPreference] = useState(DEFAULT_BACKGROUND_MUSIC);
  useEffect(() => {
    const sync = () => { setPreference(backgroundMusicPreference()); void playBackgroundMusic(); };
    const unlock = () => { void playBackgroundMusic(); };
    const visibility = () => { if (document.hidden) pauseBackgroundMusic(); else sync(); };
    const storage = (event: StorageEvent) => { if (event.key === null || event.key === BACKGROUND_MUSIC_KEY) sync(); };
    sync();
    document.addEventListener("pointerdown", unlock, true);
    document.addEventListener("keydown", unlock, true);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener(BACKGROUND_MUSIC_EVENT, sync);
    window.addEventListener("storage", storage);
    return () => {
      document.removeEventListener("pointerdown", unlock, true);
      document.removeEventListener("keydown", unlock, true);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener(BACKGROUND_MUSIC_EVENT, sync);
      window.removeEventListener("storage", storage);
      releaseBackgroundMusic();
    };
  }, []);
  const enabled = preference.enabled && preference.volume > 0;
  return <button type="button" aria-label={enabled ? "Mute background music" : "Play background music"} aria-pressed={enabled}
    title="Golden Afternoon · Background music"
    onClick={() => saveBackgroundMusicPreference({ ...preference, enabled: !enabled, volume: preference.volume || DEFAULT_BACKGROUND_MUSIC.volume })}
    className="fixed bottom-4 right-4 z-[60] inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card/95 px-4 text-xs font-semibold text-primary shadow-sm backdrop-blur outline-none hover:bg-secondary focus-visible:ring-4 focus-visible:ring-ring/20">
    {enabled ? <Music2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />} Music {enabled ? "on" : "off"}
  </button>;
}
