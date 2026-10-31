"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { env } from "@/config/environment";
import { supabaseAuthTokenProvider } from "@/infrastructure/api/supabase-auth-token-provider";
import type { BuddyMessage } from "../model/buddy.model";

export const realtimeTalkEnabled = process.env.NEXT_PUBLIC_REALTIME_TALK === "true";
type Options = {
  conversationId: string | null;
  getTemporarySessionId: () => string;
  onMessage: (message: BuddyMessage, conversationId: string | null) => void;
  onDelivery: (id: string, interrupted: boolean) => void;
};
type LocalSession = {
  id: string;
  ws: WebSocket;
  generation: number;
  turnId: string;
  sequence: number;
  expires: number;
  conversationId: string | null;
  stream?: MediaStream;
  ctx: AudioContext;
  node?: AudioWorkletNode;
  source?: MediaStreamAudioSourceNode;
  vad?: import("onnxruntime-web").InferenceSession;
  epoch: number;
  renew?: ReturnType<typeof setInterval>;
  plays: Set<AudioBufferSourceNode>;
  nextPlay: number;
  voiceActive: boolean;
  speechFrames: number;
  silence: number;
  frameCount: number;
  ring: Float32Array[];
  speaking: boolean;
  endSequence?: number;
  played: number;
  closed: boolean;
  vadBusy: boolean;
  h: Float32Array;
  c: Float32Array;
  context: Float32Array;
  approvedIds: Set<string>;
};

function clearPlayback(s: LocalSession) {
  s.speaking = false;
  for (const source of s.plays) {
    source.onended = null;
    try {
      source.stop();
      source.disconnect();
    } catch {}
  }
  s.plays.clear();
  s.nextPlay = 0;
  s.endSequence = undefined;
}

async function api(path: string, method: string, body?: unknown, signal?: AbortSignal) {
  const token = await supabaseAuthTokenProvider.getAccessToken();
  const res = await fetch(env.apiBaseUrl + path, {
    method,
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!res.ok)
    throw Error(
      res.status === 409
        ? "Talk is busy on this installation. Try again shortly."
        : res.status === 401
          ? "Sign in again to continue Talk."
          : "Local Talk is unavailable. Text chat is still available.",
    );
  return (await res.json()).data;
}

function frame(s: LocalSession, values: Float32Array) {
  const bytes = new ArrayBuffer(8 + values.length * 2),
    view = new DataView(bytes);
  view.setUint32(0, s.generation, true);
  view.setUint32(4, s.sequence++, true);
  for (let i = 0; i < values.length; i++)
    view.setInt16(8 + i * 2, Math.max(-32768, Math.min(32767, Math.round(values[i] * 32767))), true);
  if (s.ws.bufferedAmount > 128 * 1024) throw Error("Audio connection is too slow.");
  s.ws.send(bytes);
  s.frameCount++;
}

export function useRealtimeTalk(options: Options) {
  const callbacks = useRef(options);
  callbacks.current = options;
  const session = useRef<LocalSession | null>(null),
    epoch = useRef(0),
    request = useRef<AbortController | null>(null);
  const [state, setState] = useState("idle"),
    [error, setError] = useState(""),
    [transcript, setTranscript] = useState(""),
    [active, setActive] = useState(false),
    [voiceInterruption, setVoiceInterruption] = useState(true);
  const interruption = useRef(true);
  interruption.current = voiceInterruption;
  const isCurrent = useCallback((s: LocalSession) => !s.closed && s.epoch === epoch.current, []);
  const send = useCallback(
    (s: LocalSession, event: Record<string, unknown>) => {
      if (!isCurrent(s) || s.ws.readyState !== WebSocket.OPEN) return;
      if (s.ws.bufferedAmount > 128 * 1024) throw Error("Audio connection is too slow. Stop and retry Talk.");
      s.ws.send(JSON.stringify(event));
    },
    [isCurrent],
  );
  const stop = useCallback(() => {
    epoch.current++;
    request.current?.abort();
    request.current = null;
    const s = session.current;
    session.current = null;
    if (s) {
      try {
        if (s.ws.readyState === WebSocket.OPEN) s.ws.send(JSON.stringify({ type: "stop" }));
      } catch {
        // Capture cleanup is required even if the final network message fails.
      }
      s.closed = true;
      s.ws.close();
      if (s.renew) clearInterval(s.renew);
      clearPlayback(s);
      s.node?.disconnect();
      if (s.node) s.node.port.onmessage = null;
      s.source?.disconnect();
      s.stream?.getTracks().forEach((t) => t.stop());
      void s.ctx.close().catch(() => {});
      void s.vad?.release().catch(() => {});
      s.ring = [];
    }
    setActive(false);
    setState("idle");
  }, []);
  const fail = useCallback(
    (message: string) => {
      stop();
      setError(message);
      setState("unavailable");
    },
    [stop],
  );
  const interrupt = useCallback(() => {
    const s = session.current;
    if (!s) return;
    clearPlayback(s);
    s.voiceActive = false;
    s.speechFrames = 0;
    s.silence = 0;
    s.ring = [];
    s.frameCount = 0;
    try {
      send(s, { type: "cancel", generation: s.generation });
    } catch {
      fail("The audio connection stalled. Restart Talk or use Chat.");
      return;
    }
    setState("listening");
  }, [send, fail]);
  const microphone = useCallback(
    async (s: LocalSession) => {
      const ort = await import("onnxruntime-web/wasm");
      ort.env.wasm.wasmPaths = window.location.origin + "/vendor/buddy-vad/";
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.proxy = false;
      const vad = await ort.InferenceSession.create("/vendor/buddy-vad/silero.onnx", { executionProviders: ["wasm"] });
      if (!isCurrent(s)) {
        await vad.release();
        return;
      }
      s.vad = vad;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      if (!isCurrent(s)) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      s.stream = stream;
      await s.ctx.audioWorklet.addModule("/vendor/buddy-vad/pcm-worklet.js");
      if (!isCurrent(s)) return;
      const source = s.ctx.createMediaStreamSource(stream),
        node = new AudioWorkletNode(s.ctx, "buddy-pcm");
      s.source = source;
      s.node = node;
      const queuedFrames: Float32Array[] = [];
      node.port.onmessage = async (event: MessageEvent<Float32Array>) => {
        if (!isCurrent(s)) return;
        if (s.vadBusy) {
          if (queuedFrames.length >= 16)
            fail("This device cannot process microphone audio fast enough. Try text chat.");
          else queuedFrames.push(event.data);
          return;
        }
        s.vadBusy = true;
        try {
          const values = event.data;
          if (values.length !== 512) return;
          const input = new Float32Array(576);
          input.set(s.context);
          input.set(values, 64);
          s.context = values.slice(-64);
          const result = await vad.run({
            input: new ort.Tensor("float32", input, [1, 576]),
            h: new ort.Tensor("float32", s.h, [1, 1, 128]),
            c: new ort.Tensor("float32", s.c, [1, 1, 128]),
          });
          if (!isCurrent(s)) return;
          s.h = new Float32Array(result.hn.data as Float32Array);
          s.c = new Float32Array(result.cn.data as Float32Array);
          const probability = Number(result.speech_probs.data[0]);
          if (!Number.isFinite(probability)) throw Error("Voice detector returned an invalid result.");
          if (s.speaking && !interruption.current) return;
          s.ring.push(values);
          if (s.ring.length > 10) s.ring.shift();
          if (!s.voiceActive) {
            s.speechFrames = probability > (s.speaking ? 0.75 : 0.5) ? s.speechFrames + 1 : 0;
            if (s.speechFrames < (s.speaking ? 10 : 7)) return;
            clearPlayback(s);
            if (s.generation) send(s, { type: "cancel", generation: s.generation });
            s.generation++;
            s.turnId = crypto.randomUUID();
            s.sequence = 0;
            s.frameCount = 0;
            s.voiceActive = true;
            s.silence = 0;
            s.speechFrames = 0;
            s.played = 0;
            send(s, { type: "begin", turnId: s.turnId, generation: s.generation });
            for (const buffered of s.ring) frame(s, buffered);
            s.ring = [];
            setTranscript("");
            setState("listening");
            return;
          }
          frame(s, values);
          s.silence = probability < 0.35 ? s.silence + 1 : 0;
          if (s.silence >= 29 || s.frameCount >= 1875) {
            s.voiceActive = false;
            s.speechFrames = 0;
            s.ring = [];
            send(s, { type: "finish", turnId: s.turnId, generation: s.generation });
            setState("transcribing");
            if (s.frameCount >= 1875) setError("The 60-second turn limit was reached. Your turn was submitted.");
          }
        } catch (e) {
          if (isCurrent(s)) fail(e instanceof Error ? e.message : "Voice capture failed.");
        } finally {
          s.vadBusy = false;
          if (!isCurrent(s)) queuedFrames.length = 0;
          const next = queuedFrames.shift();
          if (next && isCurrent(s))
            queueMicrotask(() => {
              void node.port.onmessage?.({ data: next } as MessageEvent<Float32Array>);
            });
        }
      };
      source.connect(node);
      node.connect(s.ctx.destination);
      setState("listening");
    },
    [fail, isCurrent, send],
  );
  const play = useCallback(
    (
      s: LocalSession,
      event: { generation: number; turnId: string; audio: string; sampleRate: number; sequence: number },
    ) => {
      if (event.generation !== s.generation || event.turnId !== s.turnId) return;
      if (
        typeof event.audio !== "string" ||
        event.audio.length > 12000 ||
        event.sampleRate !== 16000 ||
        event.sequence !== s.played++
      )
        throw Error("Invalid audio sequence");
      const raw = atob(event.audio);
      if (!raw.length || raw.length % 2 || s.plays.size >= 9) throw Error("Invalid playback buffer");
      const view = new DataView(Uint8Array.from(raw, (x) => x.charCodeAt(0)).buffer),
        samples = new Float32Array(raw.length / 2);
      for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true) / 32768;
      const buffer = s.ctx.createBuffer(1, samples.length, 16000);
      buffer.copyToChannel(samples, 0);
      const player = s.ctx.createBufferSource();
      player.buffer = buffer;
      player.connect(s.ctx.destination);
      s.plays.add(player);
      s.speaking = true;
      setState("speaking");
      const generation = s.generation;
      player.onended = () => {
        s.plays.delete(player);
        player.disconnect();
        if (!isCurrent(s) || generation !== s.generation) return;
        try {
          send(s, { type: "played", generation, turnId: s.turnId, sequence: event.sequence, samples: samples.length });
        } catch {
          fail("The audio connection stalled. Restart Talk or use Chat.");
          return;
        }
        if (!s.plays.size && s.endSequence === s.played) {
          s.speaking = false;
          setState("listening");
        }
      };
      const when = Math.max(s.ctx.currentTime + 0.03, s.nextPlay);
      player.start(when);
      s.nextPlay = when + samples.length / 16000;
    },
    [isCurrent, send, fail],
  );
  const start = useCallback(async () => {
    stop();
    setError("");
    setTranscript("");
    setState("preparing");
    setActive(true);
    const current = epoch.current;
    const abort = new AbortController();
    request.current = abort;
    let ctx: AudioContext | undefined;
    try {
      if (!realtimeTalkEnabled) throw Error("Experimental Talk is disabled.");
      ctx = new AudioContext({ sampleRate: 16000 });
      await ctx.resume();
      const data = await api(
        "/buddy/voice/sessions",
        "POST",
        {
          ...(callbacks.current.conversationId ? { conversationId: callbacks.current.conversationId } : {}),
          temporarySessionId: callbacks.current.getTemporarySessionId(),
        },
        abort.signal,
      );
      if (current !== epoch.current) {
        await ctx.close();
        return;
      }
      const url = new URL(env.apiBaseUrl);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      url.pathname = data.webSocketPath;
      url.search = "";
      const ws = new WebSocket(url);
      const s: LocalSession = {
        id: data.sessionId,
        ws,
        ctx,
        expires: Date.parse(data.expiresAt),
        conversationId: callbacks.current.conversationId,
        generation: 0,
        turnId: "",
        sequence: 0,
        epoch: current,
        plays: new Set(),
        nextPlay: 0,
        voiceActive: false,
        speechFrames: 0,
        silence: 0,
        frameCount: 0,
        ring: [],
        speaking: false,
        played: 0,
        closed: false,
        vadBusy: false,
        h: new Float32Array(128),
        c: new Float32Array(128),
        context: new Float32Array(64),
        approvedIds: new Set(),
      };
      session.current = s;
      setActive(true);
      ws.onopen = () => send(s, { type: "authenticate", ticket: data.ticket });
      ws.onerror = () => {
        if (isCurrent(s)) fail("Local Talk connection failed. Text chat is still available.");
      };
      ws.onclose = () => {
        if (isCurrent(s)) {
          stop();
          setState("paused");
          setError("Talk ended. Start Talk again when you are ready.");
        }
      };
      ws.onmessage = (message) => {
        if (!isCurrent(s)) return;
        try {
          const event = JSON.parse(String(message.data));
          if (event.protocol !== "echo-buddy-talk-v1" || event.sessionId !== s.id) throw Error("Invalid Talk protocol");
          if (event.generation !== s.generation && !["ready", "pong", "delivery"].includes(event.type)) return;
          if (event.type === "ready") {
            void microphone(s).catch((e) => {
              if (isCurrent(s)) fail(e instanceof Error ? e.message : "Microphone unavailable.");
            });
            return;
          }
          if (event.type === "state") {
            if (["paused", "unavailable", "auth_required"].includes(event.state)) {
              fail(
                event.state === "auth_required"
                  ? "Sign in again to continue Talk."
                  : "Talk paused or became unavailable. Start Talk to retry.",
              );
              return;
            }
            if (["preparing", "transcribing", "thinking"].includes(event.state)) setState(event.state);
            return;
          }
          if (event.type === "partial") {
            setTranscript(String(event.text));
            return;
          }
          if (event.type === "final_transcript" || event.type === "approved_reply") {
            const m = event.message;
            if (
              !m ||
              typeof m.id !== "string" ||
              !["user", "buddy"].includes(m.role) ||
              typeof m.content !== "string" ||
              m.content.length > 12000
            )
              throw Error("Invalid message");
            s.conversationId = event.conversationId ?? null;
            callbacks.current.onMessage(
              {
                ...m,
                conversationId: s.conversationId ?? "temporary",
                timestamp: new Date(m.timestamp).toLocaleTimeString(),
              },
              s.conversationId,
            );
            if (event.type === "final_transcript") setTranscript(m.content);
            else s.approvedIds.add(m.id);
            return;
          }
          if (event.type === "audio") {
            play(s, event);
            if (s.ctx.state !== "running") fail("Playback was blocked. Restart Talk with the Start Talk button.");
            return;
          }
          if (event.type === "audio_end") {
            s.endSequence = event.sequence;
            if (!s.plays.size) {
              s.speaking = false;
              setState("listening");
            }
            return;
          }
          if (event.type === "delivery") {
            if (s.approvedIds.has(event.messageId) && ["played", "interrupted"].includes(event.state))
              callbacks.current.onDelivery(event.messageId, event.state === "interrupted");
            return;
          }
          if (event.type === "turn_end") {
            if (!s.voiceActive && !s.plays.size) setState("listening");
            return;
          }
          if (event.type === "error")
            fail(
              event.code === "SPEECH_UNAVAILABLE"
                ? "Buddy’s text reply is available, but local speech failed. Continue in Chat or restart Talk."
                : "This turn could not finish. Your accepted text remains available; restart Talk to retry.",
            );
        } catch (e) {
          if (isCurrent(s)) fail(e instanceof Error ? e.message : "Talk protocol failed.");
        }
      };
      s.renew = setInterval(() => {
        if (!isCurrent(s)) return;
        try {
          send(s, { type: "ping" });
        } catch {
          fail("The audio connection stalled. Restart Talk or use Chat.");
          return;
        }
        if (s.expires - Date.now() < 90000)
          void api("/buddy/voice/sessions/" + s.id + "/refresh", "POST", {}, abort.signal)
            .then((value) => {
              s.expires = Date.parse(value.expiresAt);
            })
            .catch(() => {
              if (isCurrent(s)) fail("Session renewal failed. Sign in again to continue.");
            });
      }, 15000);
    } catch (e) {
      if (ctx && session.current?.ctx !== ctx && ctx.state !== "closed") await ctx.close();
      if (current === epoch.current) fail(e instanceof Error ? e.message : "Talk could not start.");
    }
  }, [stop, fail, isCurrent, microphone, play, send]);
  useEffect(() => () => stop(), [stop]);
  useEffect(() => {
    const s = session.current;
    if (s && options.conversationId !== s.conversationId) stop();
  }, [options.conversationId, stop]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, [stop]);
  return {
    enabled: realtimeTalkEnabled,
    active,
    state,
    error,
    transcript,
    start,
    stop,
    interrupt,
    voiceInterruption,
    setVoiceInterruption,
  };
}
