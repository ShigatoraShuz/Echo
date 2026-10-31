"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseAuthTokenProvider } from "@/infrastructure/api/supabase-auth-token-provider";
import { env } from "@/config/environment";
export function useBuddyVoiceControls() {
  const recorder = useRef<MediaRecorder | null>(null),
    tracks = useRef<MediaStream | null>(null),
    audio = useRef<HTMLAudioElement | null>(null),
    url = useRef<string | null>(null),
    abort = useRef<AbortController | null>(null),
    generation = useRef(0),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isListening, setListening] = useState(false),
    [isSpeaking, setSpeaking] = useState(false),
    [isTranscribing, setTranscribing] = useState(false),
    [voiceError, setError] = useState<string | null>(null),
    [interimTranscript, setTranscript] = useState("");
  const supported =
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined";
  const stopSpeaking = useCallback(() => {
    generation.current++;
    abort.current?.abort();
    if (audio.current) {
      audio.current.onended = null;
      audio.current.onerror = null;
      audio.current.pause();
      audio.current.src = "";
      audio.current.load?.();
    }
    audio.current = null;
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = null;
    setSpeaking(false);
  }, []);
  const cancel = useCallback(() => {
    setError(null);
    generation.current++;
    abort.current?.abort();
    if (timer.current) clearTimeout(timer.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
    tracks.current?.getTracks().forEach((t) => t.stop());
    setListening(false);
    setTranscribing(false);
    stopSpeaking();
  }, [stopSpeaking]);
  const stopListening = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
    tracks.current?.getTracks().forEach((t) => t.stop());
    setListening(false);
  }, []);
  async function request(path: string, body: BodyInit, type: string) {
    const epoch = generation.current;
    const token = await supabaseAuthTokenProvider.getAccessToken();
    if (epoch !== generation.current) throw new DOMException("Cancelled", "AbortError");
    abort.current = new AbortController();
    const response = await fetch(env.apiBaseUrl + "/buddy/voice/" + path, {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": type },
      body,
      signal: AbortSignal.any([abort.current.signal, AbortSignal.timeout(315000)]),
    });
    if (!response.ok) throw Error("Local speech unavailable. Please retry.");
    return response;
  }
  const startListening = useCallback(
    async (callback: (text: string) => void) => {
      cancel();
      setError(null);
      setTranscript("");
      const id = generation.current;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (id !== generation.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        tracks.current = stream;
        const chunks: BlobPart[] = [];
        const rec = new MediaRecorder(stream);
        recorder.current = rec;
        let bytes = 0;
        rec.onerror = () => {
          if (id !== generation.current) return;
          cancel();
          setError("Recording failed. Please try again.");
        };
        rec.ondataavailable = (e) => {
          bytes += e.data.size;
          if (bytes > 10 * 1024 * 1024) {
            cancel();
            setError("Recording exceeds 10 MiB.");
          } else chunks.push(e.data);
        };
        rec.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          if (id !== generation.current) {
            chunks.length = 0;
            rec.onstop = null;
            rec.ondataavailable = null;
            return;
          }
          setListening(false);
          setTranscribing(true);
          try {
            const response = await request(
              "transcribe",
              new Blob(chunks, { type: rec.mimeType }),
              "application/octet-stream",
            );
            const result = await response.json();
            if (id !== generation.current) return;
            const text = String(result.data.text ?? "").trim();
            setTranscript(text);
            if (text) callback(text);
            else setError("No speech detected. Try again.");
          } catch (e) {
            if (id === generation.current) setError(e instanceof Error ? e.message : "Transcription failed.");
          } finally {
            chunks.length = 0;
            rec.onstop = null;
            rec.ondataavailable = null;
            if (recorder.current === rec) recorder.current = null;
            if (id === generation.current) setTranscribing(false);
          }
        };
        rec.start(1000);
        setListening(true);
        timer.current = setTimeout(stopListening, 59000);
      } catch {
        tracks.current?.getTracks().forEach((t) => t.stop());
        setListening(false);
        setError("Microphone permission or recording is unavailable.");
      }
    },
    [cancel, stopListening],
  );
  const speak = useCallback(
    async (text: string) => {
      cancel();
      const id = generation.current;
      setError(null);
      setSpeaking(true);
      try {
        const response = await request("speak", JSON.stringify({ text }), "application/json");
        const blob = await response.blob();
        if (id !== generation.current) return;
        url.current = URL.createObjectURL(blob);
        const player = new Audio(url.current);
        audio.current = player;
        player.onended = stopSpeaking;
        player.onerror = () => {
          stopSpeaking();
          setError("Playback failed.");
        };
        await player.play();
        if (id !== generation.current) return;
        setSpeaking(true);
      } catch {
        if (id === generation.current) {
          stopSpeaking();
          setError("Speech unavailable or playback blocked. Use Play to retry.");
        }
      }
    },
    [cancel, stopSpeaking],
  );
  useEffect(
    () => () => {
      generation.current++;
      abort.current?.abort();
      if (timer.current) clearTimeout(timer.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
      tracks.current?.getTracks().forEach((t) => t.stop());
      audio.current?.pause();
      if (url.current) URL.revokeObjectURL(url.current);
    },
    [],
  );
  return {
    voiceSupported: supported,
    speechSupported: true,
    isListening,
    isSpeaking,
    isTranscribing,
    interimTranscript,
    voiceError,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    cancel,
  };
}
