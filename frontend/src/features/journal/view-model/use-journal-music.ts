"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { JOURNAL_MUSIC_URL } from "@/services/audio/journal-music-assets";

let musicBuffer: Promise<AudioBuffer> | null = null;
function loadMusic(context: AudioContext) {
  // Application data avoids IDM intercepting a direct media download.
  musicBuffer ??= fetch(JOURNAL_MUSIC_URL, { cache: "force-cache" })
    .then(async response => {
      if (!response.ok) throw new Error("Journal music unavailable");
      const data = await response.json() as { audio: string };
      const bytes = Uint8Array.from(atob(data.audio), character => character.charCodeAt(0));
      return context.decodeAudioData(bytes.buffer);
    }).catch((error: unknown) => { musicBuffer = null; throw error; });
  return musicBuffer;
}

type MusicSession = { context: AudioContext; source: AudioBufferSourceNode | null; gain: GainNode | null };
type Playback = "idle" | "loading" | "playing" | "paused" | "unavailable";
export function useJournalMusic(disabled: boolean) {
  const [playback, setPlayback] = useState<Playback>("idle");
  const [volume, setVolume] = useState(0.4);
  const volumeRef = useRef(0.4);
  const pausedByUser = useRef(false);
  const requested = useRef(false);
  const blocked = useRef(disabled);
  blocked.current = disabled;
  const session = useRef<MusicSession | null>(null);

  const stop = useCallback(() => {
    const previous = session.current;
    session.current = null;
    requested.current = false;
    pausedByUser.current = false;
    if (previous) void previous.context.close().catch(() => {});
  }, []);

  const start = useCallback(async () => {
    if (blocked.current || pausedByUser.current || document.hidden) return;
    if (session.current) {
      const current = session.current;
      if (current.context.state === "running") return;
      try {
        await current.context.resume();
        if (session.current === current && current.source) setPlayback("playing");
      } catch { /* Writing remains available if browser audio is blocked. */ }
      return;
    }
    if (requested.current) return;
    requested.current = true;
    let loading: MusicSession | null = null;
    try {
      if (!window.AudioContext) throw new Error("Audio unsupported");
      const current: MusicSession = { context: new AudioContext(), source: null, gain: null };
      loading = current;
      session.current = current;
      setPlayback("loading");
      // Resume during the input gesture, before waiting for the asset.
      await current.context.resume();
      const buffer = await loadMusic(current.context);
      if (session.current !== current || blocked.current) return;
      const source = current.context.createBufferSource();
      const gain = current.context.createGain();
      source.buffer = buffer;
      source.loop = true; // Sample-accurate repeat; the asset already has a crossfaded seam.
      source.connect(gain);
      gain.connect(current.context.destination);
      gain.gain.setValueAtTime(0, current.context.currentTime);
      gain.gain.setTargetAtTime(volumeRef.current, current.context.currentTime, 0.2);
      current.source = source;
      current.gain = gain;
      source.start();
      setPlayback(pausedByUser.current || document.hidden ? "paused" : "playing");
    } catch {
      if (session.current === loading) {
        const current = session.current;
        session.current = null;
        if (current) void current.context.close().catch(() => {});
        setPlayback("unavailable");
      }
    }
  }, []);

  const toggle = useCallback(() => {
    const current = session.current;
    if (!current) return;
    pausedByUser.current = playback === "playing";
    if (pausedByUser.current) {
      void current.context.suspend().catch(() => {});
      setPlayback("paused");
    } else void start();
  }, [start, playback]);

  const changeVolume = useCallback((value: number) => {
    const next = Math.max(0, Math.min(1, value));
    volumeRef.current = next;
    setVolume(next);
    const current = session.current;
    if (current?.gain) current.gain.gain.setTargetAtTime(next, current.context.currentTime, 0.04);
  }, []);

  useEffect(() => {
    if (disabled) { stop(); setPlayback("idle"); }
  }, [disabled, stop]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden && session.current) {
        void session.current.context.suspend().catch(() => {});
        setPlayback("paused");
      }
    };
    document.addEventListener("visibilitychange", hide);
    return () => { document.removeEventListener("visibilitychange", hide); stop(); };
  }, [stop]);

  return { playback, volume, start, toggle, changeVolume };
}
