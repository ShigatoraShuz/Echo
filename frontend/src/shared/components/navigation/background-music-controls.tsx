"use client";
import { useEffect, useState } from "react";
import { Music2, Volume2 } from "lucide-react";
import { BACKGROUND_MUSIC_EVENT, DEFAULT_BACKGROUND_MUSIC, backgroundMusicPreference, saveBackgroundMusicPreference } from "@/services/audio/background-music";

export function BackgroundMusicControls() {
  const [preference, setPreference] = useState(DEFAULT_BACKGROUND_MUSIC);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const refresh = () => setPreference(backgroundMusicPreference());
    refresh(); window.addEventListener(BACKGROUND_MUSIC_EVENT, refresh); window.addEventListener("storage", refresh);
    return () => { window.removeEventListener(BACKGROUND_MUSIC_EVENT, refresh); window.removeEventListener("storage", refresh); };
  }, []);
  const save = (next: typeof preference) => {
    if (saveBackgroundMusicPreference(next)) { setPreference(next); setMessage("Saved on this device."); }
    else setMessage("This browser could not save your music preference.");
  };
  return <div className="mt-5 rounded-2xl border border-border bg-card/70 p-5">
    <label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><Music2 aria-hidden="true" className="size-4 text-primary" />Background music
      <input type="checkbox" className="size-5 accent-primary" checked={preference.enabled} onChange={event => save({ ...preference, enabled: event.target.checked })} />
    </label>
    <p className="mt-2 text-xs leading-6 text-muted-foreground">Golden Afternoon plays softly on a continuous loop across the app. Page changes and popups have no sound effects.</p>
    <label className="mt-3 flex min-h-11 items-center gap-3 text-xs text-muted-foreground"><Volume2 aria-hidden="true" className="size-4 shrink-0" />Music volume
      <input type="range" min="0" max="100" step="1" className="min-w-0 flex-1 accent-primary" value={Math.round(preference.volume * 100)} onChange={event => save({ ...preference, volume: Number(event.target.value) / 100 })} />
      <span className="w-9 tabular-nums">{Math.round(preference.volume * 100)}%</span>
    </label>
    <p className="mt-2 text-xs text-muted-foreground">Starts softly at 12%. Your choice stays on this device.</p>
    {message && <p role="status" className="mt-2 text-xs text-muted-foreground">{message}</p>}
  </div>;
}
