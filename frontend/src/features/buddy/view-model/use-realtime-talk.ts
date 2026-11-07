"use client";
import { speechErrorMessage } from "./speech-errors";
import { modelPageLeaseSchema, talkModelReadinessSchema, talkSegmentReadySchema } from "@echo/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { TALK_PROTOCOL, talkAudioEventSchema, type TalkSpeechMode, type TalkLanguage } from "@echo/contracts";
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
  suspended?:boolean;
  modelReady?:boolean;
  stream?: MediaStream;
  microphoneReady?: Promise<MediaStream|null>;
  microphoneStarting?: boolean;
  ctx: AudioContext;
  analyser: AnalyserNode;
  busy: boolean;
  submittedAt: number;
  firstPlayback: boolean;
  nextSegmentIndex: number;
  node?: AudioWorkletNode;
  source?: MediaStreamAudioSourceNode;
  epoch: number;
  renew?: ReturnType<typeof setInterval>;
  refreshing?: boolean;
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
  approvedIds: Set<string>;
};

function pauseCapture(s: LocalSession, busy: boolean) {
  busy=busy||s.suspended===true;
  s.busy = busy;
  s.stream?.getAudioTracks().forEach((track) => {
    track.enabled = !busy;
  });
  s.ring = [];
  s.voiceActive = false;
  s.speechFrames = 0;
  s.silence = 0;
}

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
    keepalive: path === "/buddy/runtime/unload" || (method==='DELETE'&&path.startsWith('/ai/runtime/leases/')),
  });
  if (!res.ok) {
    const failure = await res.json().catch(() => null);
    const code = failure?.error?.code;
    if(typeof code==='string'&&(code.startsWith('AI_TRANSPORT_')||code.startsWith('BUDDY_NANO_')))
      throw Error(speechErrorMessage(code));
    throw Error(
      res.status === 409
        ? "Talk is busy on this installation. Try again shortly."
        : res.status === 401
          ? "Sign in again to continue Talk."
          : "Local Talk is unavailable. Text chat is still available.",
    );
  }
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
  const suspended=useRef(false);
  const pendingStream=useRef<MediaStream|null>(null);
  const pendingContext=useRef<AudioContext|null>(null);
  const sensitivityRef=useRef<'normal'|'sensitive'>('normal');
  const [sensitivity,setSensitivityState]=useState<'normal'|'sensitive'>('normal');
  const setSensitivity=useCallback((value:'normal'|'sensitive')=>{sensitivityRef.current=value;setSensitivityState(value);},[]);
  const [state, setState] = useState("idle"),
    [error, setError] = useState(""),
    [transcript, setTranscript] = useState(""),
    [active, setActive] = useState(false),
    [voiceMode, setVoiceMode] = useState<"fast" | "expressive">("fast"),
    [speechMode, setSpeechMode] = useState<TalkSpeechMode>("sentences_2_then_3"),
    [language, setLanguage] = useState<TalkLanguage>("English"),
    [experimentalLanguages, setExperimentalLanguages] = useState(false),
    [analyser, setAnalyser] = useState<AnalyserNode | null>(null),
    [readiness, setReadiness] = useState<{ freeGpuBytes?: number; loadAndWarmSeconds?: number } | null>(null);

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
    suspended.current=false;
    epoch.current++;
    request.current?.abort();
    request.current = null;
    pendingStream.current?.getTracks().forEach(track=>track.stop());pendingStream.current=null;
    if(pendingContext.current){void pendingContext.current.close().catch(()=>{});pendingContext.current=null;}
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
      s.ring = [];
    }
    setAnalyser(null);
    setReadiness(null);
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
    pauseCapture(s, true);
    setState("recovering");
  }, [send, fail]);
  const microphone = useCallback(
    async (s: LocalSession) => {
      if(s.suspended||s.node||s.microphoneStarting)return;
      s.microphoneStarting=true;
      const stream = s.stream??await s.microphoneReady;
      if(!stream)return;
      if (!isCurrent(s)) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      if(stream.getAudioTracks().some(track=>track.readyState==='ended'))throw Error('The microphone disconnected. Reconnect it and start Talk again.');
      s.stream = stream;
      if(pendingStream.current===stream)pendingStream.current=null;
      for (const track of stream.getTracks())
        track.onended = () => {
          if (isCurrent(s)) fail("The microphone disconnected. Reconnect it and start Talk again.");
        };
      await s.ctx.audioWorklet.addModule("/vendor/buddy-vad/pcm-worklet.js");
      if (!isCurrent(s)) return;
      if(s.suspended){s.microphoneStarting=false;return;}
      const source = s.ctx.createMediaStreamSource(stream),
        node = new AudioWorkletNode(s.ctx, "buddy-pcm");
      s.source = source;
      s.node = node;
      node.port.onmessage = (event: MessageEvent<Float32Array>) => {
        if (!isCurrent(s) || s.busy) return;
        try {
          const values = event.data;
          if (values.length !== 512) throw Error("Invalid microphone frame");
          const energy = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length);
          if (!Number.isFinite(energy)) throw Error("Invalid microphone energy");
          if (!s.voiceActive) {
            s.ring.push(values);
            if (s.ring.length > 18) s.ring.shift();
            const threshold=sensitivityRef.current==='sensitive'?.008:.012;
            s.speechFrames = energy >= threshold ? s.speechFrames + 1 : 0;
            if (s.speechFrames < 15) return; // 480 ms minimum audible utterance.
            s.generation++;
            s.turnId = crypto.randomUUID();
            s.sequence = 0;
            s.frameCount = 0;
            s.voiceActive = true;
            s.silence = 0;
            s.speechFrames = 0;
            s.played = 0;
            s.nextSegmentIndex = 0;
            s.firstPlayback = false;
            s.submittedAt = 0;
            send(s, { type: "begin", turnId: s.turnId, generation: s.generation });
            for (const buffered of s.ring) frame(s, buffered);
            s.ring = [];
            setTranscript("");
            setState("listening");
            return;
          }
          frame(s, values);
          s.silence = energy < 0.009 ? s.silence + 1 : 0;
          if (s.silence >= 32 || s.frameCount >= 1875) {
            s.submittedAt = performance.now();
            pauseCapture(s, true);
            send(s, { type: "finish", turnId: s.turnId, generation: s.generation });
            setState("transcribing");
            if (s.frameCount >= 1875) setError("The 60-second turn limit was reached. Your turn was submitted.");
          }
        } catch (error) {
          if (isCurrent(s)) fail(error instanceof Error ? error.message : "Voice capture failed.");
        }
      };
      source.connect(node);
      node.connect(s.ctx.destination);
      if (s.ctx.state === "running") {
        pauseCapture(s, false);
        setState("listening");
      } else {
        pauseCapture(s, true);
        setState("playback_blocked");
      }
    },
    [fail, isCurrent, send],
  );

  const resumeTalk=useCallback(async()=>{
    const s=session.current;if(!s||!isCurrent(s)||document.hidden)return;
    suspended.current=false;s.suspended=false;
    try{
      await s.ctx.resume();if(!isCurrent(s)||s.suspended)return;
      if(!s.modelReady){setState('preparing');return;}
      await microphone(s);if(!isCurrent(s)||s.suspended)return;
      s.submittedAt=0;
      if(s.node&&s.ctx.state==='running'){pauseCapture(s,false);setError('');setState('listening');}
      else setState('playback_blocked');
    }catch(error){if(isCurrent(s))fail(error instanceof Error?error.message:'Microphone unavailable.');}
  },[isCurrent,microphone,fail]);

  const play = useCallback(
    (
      s: LocalSession,
      event: {
        generation: number;
        turnId: string;
        audio: string;
        sampleRate: number;
        channels: number;
        sequence: number;
      },
    ) => {
      if (event.generation !== s.generation || event.turnId !== s.turnId) return;
      talkAudioEventSchema.parse(event);
      if (event.sequence !== s.played++) throw Error("Invalid audio sequence");
      const raw = atob(event.audio);
      if (!raw.length || raw.length % 4 || s.plays.size >= 9) throw Error("Invalid stereo playback buffer");
      const view = new DataView(Uint8Array.from(raw, (x) => x.charCodeAt(0)).buffer);
      const frames = raw.length / 4,
        buffer = s.ctx.createBuffer(2, frames, 48000);
      for (let channel = 0; channel < 2; channel++) {
        const samples = new Float32Array(frames);
        for (let i = 0; i < frames; i++) samples[i] = view.getInt16((i * 2 + channel) * 2, true) / 32768;
        buffer.copyToChannel(samples, channel);
      }
      const player = s.ctx.createBufferSource();
      player.buffer = buffer;
      player.connect(s.analyser);
      s.plays.add(player);
      s.speaking = true;
      pauseCapture(s, true);
      setState(s.ctx.state === "running" ? "speaking" : "playback_blocked");
      const generation = s.generation,
        turnId = s.turnId;
      player.onended = () => {
        s.plays.delete(player);
        player.disconnect();
        if (!isCurrent(s) || generation !== s.generation || turnId !== s.turnId) return;
        try {
          send(s, { type: "played", generation, turnId, sequence: event.sequence, samples: frames * 2 });
        } catch {
          fail("The audio connection stalled. Restart Talk or use Chat.");
          return;
        }
        if (!s.plays.size) {
          s.speaking = false;
          if (s.endSequence === s.played) {
            pauseCapture(s, false);
            setState("listening");
          } else setState("buffering");
        }
      };
      const when = Math.max(s.ctx.currentTime + 0.03, s.nextPlay);
      player.start(when);
      s.nextPlay = when + frames / 48000;
      if (s.ctx.state === "running" && !s.firstPlayback) {
        s.firstPlayback = true;
        send(s, {
          type: "playback_started",
          generation,
          turnId,
          elapsedMs: Math.max(0, performance.now() - s.submittedAt + (when - s.ctx.currentTime) * 1000),
        });
      }
    },
    [isCurrent, send, fail],
  );
  const resumePlayback = useCallback(async () => {
    const s = session.current;
    if (!s || !isCurrent(s)||s.suspended) return;
    try {
      await s.ctx.resume();
      if (isCurrent(s) && s.ctx.state === "running") {
        setError("");
        if (!s.plays.size && !s.submittedAt) {
          pauseCapture(s, false);
          setState("listening");
          return;
        }
        setState("speaking");
        if (!s.firstPlayback) {
          s.firstPlayback = true;
          send(s, {
            type: "playback_started",
            generation: s.generation,
            turnId: s.turnId,
            elapsedMs: Math.max(0, performance.now() - s.submittedAt),
          });
        }
      }
    } catch {
      setError("Playback is blocked. Press Play again or stop Talk.");
    }
  }, [isCurrent, send]);
  const retrySpeech = useCallback(() => {
    const s = session.current;
    if (!s || !isCurrent(s)) return;
    clearPlayback(s);
    pauseCapture(s, true);
    setError("");
    setState("preparing_speech");
    send(s, { type: "retry_speech", generation: s.generation, turnId: s.turnId });
  }, [isCurrent, send]);

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
      if(document.hidden)throw Error('Return to Buddy before starting microphone capture.');
      ctx = new AudioContext({ sampleRate: 48000 });
      pendingContext.current=ctx;
      // Request permission from Start Talk; do not capture until the server is ready.
      const microphoneReady=navigator.mediaDevices.getUserMedia({
        audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false,
      }).then(stream=>{
        if(current!==epoch.current){stream.getTracks().forEach(track=>track.stop());return null;}
        stream.getAudioTracks().forEach(track=>{track.enabled=false;});
        pendingStream.current=stream;
        return stream;
      }).catch(()=>{
        if(current===epoch.current)fail('Microphone access was denied or is unavailable. Allow microphone access and start Talk again.');
        return null;
      });
      void ctx.resume().catch(() => undefined);
      if(current!==epoch.current)return;
      const data = await api(
        "/buddy/voice/sessions",
        "POST",
        {
          ...(callbacks.current.conversationId ? { conversationId: callbacks.current.conversationId } : {}),
          temporarySessionId: callbacks.current.getTemporarySessionId(),
          speechMode,
          voiceMode,
          language,
          experimentalLanguages,
        },
        abort.signal,
      );
      if (current !== epoch.current) {
        void api('/buddy/voice/sessions/'+data.sessionId,'DELETE').catch(()=>{});
        await ctx.close().catch(()=>{});
        return;
      }
      const url = new URL(env.apiBaseUrl);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      url.pathname = data.webSocketPath;
      url.search = "";
      const ws = new WebSocket(url);
      const analyserNode = ctx.createAnalyser();
      analyserNode.fftSize = 256;
      analyserNode.connect(ctx.destination);
      setAnalyser(analyserNode);
      const s: LocalSession = {
        analyser: analyserNode,
        microphoneReady,
        suspended:suspended.current,
        modelReady:false,
        busy: true,
        submittedAt: 0,
        firstPlayback: false,
        nextSegmentIndex: 0,
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
        approvedIds: new Set(),
      };
      session.current = s;
      if(pendingContext.current===ctx)pendingContext.current=null;
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
          if (event.protocol !== TALK_PROTOCOL || event.sessionId !== s.id) throw Error("Invalid Talk protocol");
          if(s.suspended&&!['ready','recovered','pong','delivery','error','approved_reply','final_transcript'].includes(event.type))return;
          if (event.type === "speech_restart" && event.previousGeneration === s.generation) {
            clearPlayback(s);
            pauseCapture(s, true);
            s.generation = event.generation;
            s.turnId = event.turnId;
            s.played = 0;
            s.nextSegmentIndex = 0;
            s.firstPlayback = false;
            s.submittedAt = performance.now();
            setState("preparing_speech");
            return;
          }
          if (event.generation !== s.generation && !["ready", "pong", "delivery"].includes(event.type)) return;
          if (event.type === "recovered") {
            s.modelReady=true;
            if(s.suspended){setState('paused');return;}
            void microphone(s).catch(error=>{if(isCurrent(s))fail(error instanceof Error?error.message:'Microphone unavailable.');});
            pauseCapture(s, false);
            setState("listening");
            return;
          }
          if (event.type === "ready") {
            s.modelReady=true;
            if(s.suspended)setState('paused');
            setReadiness(talkModelReadinessSchema.parse(event.runtime ?? {}));
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
            if (
              ["preparing", "transcribing", "thinking", "preparing_speech", "recovering", "speech_failed"].includes(
                event.state,
              )
            ) {
              pauseCapture(s, true);
              setState(event.state);
            }
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
          if (event.type === "segment_ready") {
            const ready = talkSegmentReadySchema.parse(event);
            if (ready.index !== s.nextSegmentIndex++) throw Error("Invalid sentence segment order");
            return;
          }
          if (event.type === "audio") {
            play(s, event);
            if (s.ctx.state !== "running") setState("playback_blocked");
            return;
          }
          if (event.type === "audio_end") {
            s.endSequence = event.sequence;
            if (!s.plays.size) {
              s.speaking = false;
              pauseCapture(s, false);
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
            if (!s.voiceActive && !s.plays.size) {
              pauseCapture(s, false);
              setState("listening");
            }
            return;
          }
          if (event.type === "error") {
            if(event.code==='DELIVERY_UNAVAILABLE'){setError(typeof event.message==='string'?event.message:'Playback metadata could not be saved.');return;}
            if(event.code==='TURN_UNAVAILABLE'||event.code==='TALK_RECOVERY_REQUIRED'){
              clearPlayback(s);pauseCapture(s,true);s.modelReady=false;
              setError(typeof event.message==='string'?event.message:'Recovering Talk. Approved text is retained.');
              setState('recovering');
              send(s,{type:'cancel',generation:s.generation});
              return;
            }
            if (event.code === "SPEECH_UNAVAILABLE") {
              clearPlayback(s);
              pauseCapture(s, true);
              setError(speechErrorMessage(event.causeCode));
              setState("speech_failed");
              return;
            }
            fail(typeof event.message === "string" ? event.message : "Buddy is unavailable.");
          }
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
        if (s.expires - Date.now() < 90000 && !s.refreshing){
          s.refreshing=true;
          void api("/buddy/voice/sessions/" + s.id + "/refresh", "POST", {}, abort.signal)
            .then((value) => {
              if(!isCurrent(s))return;
              s.expires = Date.parse(value.expiresAt);
            })
            .catch(() => {
              if(isCurrent(s)){
                if(Date.now()>=s.expires)fail('Talk authorization expired. Sign in again to continue.');
                else setError('Session refresh is delayed; retrying while the current authorization remains valid.');
              }
            }).finally(()=>{s.refreshing=false;});
        }
      }, 15000);
    } catch (e) {
      if (ctx && session.current?.ctx !== ctx && ctx.state !== "closed") await ctx.close();
      if (current === epoch.current) fail(e instanceof Error ? e.message : "Talk could not start.");
    }
  }, [stop, fail, isCurrent, microphone, play, send, speechMode, voiceMode, language, experimentalLanguages]);
  useEffect(() => () => stop(), [stop]);
  useEffect(() => {
    const s = session.current;
    if (s && options.conversationId !== s.conversationId) stop();
  }, [options.conversationId, stop]);
  useEffect(() => {
    const hide = () => {
      if(!document.hidden)return;
      suspended.current=true;
      const s=session.current;
      if(s&&isCurrent(s)){
        s.suspended=true;pauseCapture(s,true);clearPlayback(s);
        void s.ctx.suspend?.().catch(()=>{});
        if(s.modelReady&&s.generation>0){s.modelReady=false;try{send(s,{type:'cancel',generation:s.generation});}catch{fail('The audio connection stalled. Restart Talk when you return.');return;}}
        setState('paused');
      }else if(request.current){pendingStream.current?.getAudioTracks().forEach(track=>{track.enabled=false;});setState('paused');}
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", stop);
    window.addEventListener("echo:sensitive-state-cleared", stop);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", stop);
      window.removeEventListener("echo:sensitive-state-cleared", stop);
    };
  }, [stop,isCurrent,send,fail]);
  return {
    enabled: realtimeTalkEnabled,
    active,
    state,
    error,
    transcript,
    start,
    stop,
    interrupt,
    speechMode,
    setSpeechMode,
    voiceMode,
    setVoiceMode,
    sensitivity,
    setSensitivity,
    language,
    setLanguage,
    experimentalLanguages,
    setExperimentalLanguages,
    analyser,
    readiness,
    resumePlayback,resumeTalk,
    retrySpeech,
  };
}

export async function unloadBuddyRuntime(){return api('/buddy/runtime/unload','POST',{});}
export async function prepareBuddyRuntime(){return api('/buddy/runtime/prepare','POST',{});}
export async function getBuddyRuntimeStatus(){return api('/buddy/runtime','GET');}

export async function acquireBuddyLease(clientInstanceId:string){return modelPageLeaseSchema.parse(await api('/ai/runtime/leases','POST',{profile:'buddy_chat',clientInstanceId}));}
export async function heartbeatBuddyLease(id:string){return modelPageLeaseSchema.parse(await api('/ai/runtime/leases/'+encodeURIComponent(id),'PUT',{}));}
export async function getBuddyLease(id:string){return modelPageLeaseSchema.parse(await api('/ai/runtime/leases/'+encodeURIComponent(id),'GET'));}
export async function releaseBuddyLease(id:string){return api('/ai/runtime/leases/'+encodeURIComponent(id),'DELETE');}
