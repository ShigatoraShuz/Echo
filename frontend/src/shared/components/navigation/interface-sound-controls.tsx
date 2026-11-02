"use client";

import { useEffect, useState } from "react";
import { Music2, Volume2 } from "lucide-react";
import {
  INTERFACE_SOUND_EVENT,
  interfaceSoundPreference,
  saveInterfaceSoundPreference,
  playInterfaceSound,
  unlockInterfaceSound,
} from "@/services/audio/interface-sound";

export function InterfaceSoundControls() {
  const [preference, setPreference] = useState({ enabled: false, volume: 0.35 });
  const [message, setMessage] = useState("");
  useEffect(() => {
    const refresh = () => setPreference(interfaceSoundPreference());
    refresh();
    window.addEventListener(INTERFACE_SOUND_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(INTERFACE_SOUND_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  const save = (next: typeof preference) => {
    if (saveInterfaceSoundPreference(next)) {
      setPreference(next);
      setMessage("Saved on this device.");
    } else setMessage("This browser could not save your sound preference.");
  };
  const preview = (cue: "page" | "popup") => {
    void unlockInterfaceSound(true).then(async (ready) => {
      const played = ready && (await playInterfaceSound(cue, true));
      setMessage(
        played
          ? cue === "page"
            ? "Playing a tab-change sound."
            : "Playing the popup sound."
          : "Sound unavailable. Check your volume and browser audio permission.",
      );
    });
  };
  return (
    <div className="mt-5 rounded-2xl border border-border bg-card/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
          <Music2 aria-hidden="true" className="size-4 text-primary" />
          Interface sounds
          <input
            type="checkbox"
            className="size-5 accent-primary"
            checked={preference.enabled}
            onChange={(event) => {
              const next = { ...preference, enabled: event.target.checked };
              save(next);
              if (next.enabled)
                void unlockInterfaceSound().then((ready) => {
                  if (ready) void playInterfaceSound("page");
                });
            }}
          />
        </label>
      </div>
      <p className="mt-2 text-xs leading-6 text-muted-foreground">
        Four sounds rotate randomly for page and tab changes, with no back-to-back repeats. Popups use their own
        dedicated sound.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          className="echo-focus-ring min-h-11 rounded-xl border border-border px-3 text-xs font-semibold text-primary"
          onClick={() => preview("page")}
        >
          Preview page
        </button>
        <button
          type="button"
          className="echo-focus-ring min-h-11 rounded-xl border border-border px-3 text-xs font-semibold text-primary"
          onClick={() => preview("popup")}
        >
          Preview popup
        </button>
      </div>
      <p className="mt-2 text-xs leading-6 text-muted-foreground">Off by default; your choice stays on this device.</p>
      <label className="mt-3 flex min-h-11 items-center gap-3 text-xs text-muted-foreground">
        <Volume2 aria-hidden="true" className="size-4 shrink-0" />
        Sound volume
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          className="min-w-0 flex-1 accent-primary"
          value={Math.round(preference.volume * 100)}
          onChange={(event) => save({ ...preference, volume: Number(event.target.value) / 100 })}
        />
        <span className="w-9 tabular-nums">{Math.round(preference.volume * 100)}%</span>
      </label>
      <p role="status" className="mt-1 min-h-5 text-xs text-muted-foreground">
        {message}
      </p>
    </div>
  );
}
