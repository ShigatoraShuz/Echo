"use client";
import { useMemo, type ReactNode } from "react";
import { Mic, Square, SlidersHorizontal, Pause, Play, RotateCcw, ShieldCheck } from "lucide-react";
import VoiceOrb from "@/shared/components/voice-orb/VoiceOrb";
import { AnalyserLevels } from "@/shared/components/voice-orb/audio";
import type { OrbState } from "@/shared/components/voice-orb/orb-data";
import type { useRealtimeTalk } from "../view-model/use-realtime-talk";
import type { BuddyMessage } from "../model/buddy.model";
import styles from "./buddy-voice-studio.module.css";

type Talk = ReturnType<typeof useRealtimeTalk>;
export function buddyOrbState(state: string): OrbState {
  if (state === "speaking") return "talking";
  if (state === "listening") return "listening";
  if (["preparing", "preparing_speech", "thinking", "transcribing", "buffering", "recovering"].includes(state)) return "connecting";
  if (["paused", "playback_blocked", "speech_failed", "unavailable"].includes(state)) return "settled";
  return "ready";
}
const copy: Record<string, [string, string]> = {
  idle: ["A little space to be heard", "Start when you feel ready. There is no rush."],
  preparing: ["Getting ready for you", "Preparing your voice session. This can take a moment."],
  listening: ["I'm listening", "Speak naturally. A short pause sends your turn."],
  transcribing: ["Taking in your words", "Your microphone pauses while Buddy prepares a reply."],
  thinking: ["A moment to reflect", "Buddy is putting a thoughtful response together."],
  preparing_speech: ["Preparing your reply", "Your microphone is paused until Buddy finishes speaking."],
  buffering: ["Your reply is on its way", "Preparing the next part of Buddy's response."],
  speaking: ["Buddy is speaking", "Take your time. You can interrupt whenever you need."],
  paused: ["Your conversation is paused", "Resume when you are ready to continue."],
  playback_blocked: ["Your reply is ready", "Tap Play reply to allow audio playback."],
  speech_failed: ["The voice reply needs a retry", "Your conversation remains available in the transcript."],
  recovering: ["Reconnecting your conversation", "Hold on while the voice connection recovers."],
  unavailable: ["Talk is unavailable right now", "You can keep writing to Buddy in Chat."],
};
export function BuddyVoiceStudio({ talk, disabled, onStart, speechProvider, messages }: {
  talk: Talk; disabled: boolean; onStart: () => void; speechProvider: ReactNode; messages: BuddyMessage[];
}) {
  const voice = useMemo(() => talk.analyser ? new AnalyserLevels(talk.analyser) : null, [talk.analyser]);
  const caller = useMemo(() => talk.callerAnalyser ? new AnalyserLevels(talk.callerAnalyser) : null, [talk.callerAnalyser]);
  const [title, description] = copy[talk.state] || ["A moment with Buddy", "Your conversation moves at your pace."];
  return <section className={styles.studio} aria-label="Buddy voice conversation">
    <div className={styles.hero}>
      <p className={styles.eyebrow}><span /> ECHO · VOICE SPACE</p>
      <h2 className={styles.heading}>Talk with Buddy</h2>
      <div className={styles.orbStage}>
        <div className={styles.halo} aria-hidden="true" />
        <VoiceOrb palette="forest" variant="silk" size="clamp(210px, 26vw, 310px)" state={buddyOrbState(talk.state)} voice={voice} caller={caller} label="Buddy voice orb" params={{ grain: .08, highlight: .65, fluid: .65 }} />
      </div>
      <div className={styles.status} role="status" aria-live="polite"><h3>{title}</h3><p>{description}</p></div>
      <div className={styles.actions}>
        <button type="button" onClick={talk.active ? talk.stop : onStart} disabled={!talk.active && disabled} className={`${styles.primary} ${talk.active ? styles.stop : ""}`}>
          {talk.active ? <Square size={16} aria-hidden="true" /> : <Mic size={18} aria-hidden="true" />}{talk.active ? "Stop Talk" : "Start Talk"}
        </button>
        {talk.active && talk.state === "speaking" && <button type="button" className={styles.secondary} onClick={talk.interrupt}><Pause size={16} aria-hidden="true" />Interrupt Buddy</button>}
        {talk.active && talk.state === "paused" && <button type="button" className={styles.secondary} onClick={() => void talk.resumeTalk()}><Play size={16} aria-hidden="true" />Resume Talk</button>}
        {talk.state === "playback_blocked" && <button type="button" className={styles.secondary} onClick={() => void talk.resumePlayback()}><Play size={16} aria-hidden="true" />Play reply</button>}
        {talk.state === "speech_failed" && <button type="button" className={styles.secondary} onClick={talk.retrySpeech}><RotateCcw size={16} aria-hidden="true" />Retry speech</button>}
      </div>
      {talk.error && <p role="alert" className={styles.error}>{talk.error}</p>}
      <p className={styles.privacy}><ShieldCheck size={13} aria-hidden="true" />Audio is temporary · Microphone pauses during replies</p>
    </div>
    <div className={styles.panels}>
      <details className={styles.panel}>
        <summary><SlidersHorizontal size={16} aria-hidden="true" />Voice settings<span>{talk.language} · {talk.voiceMode === "fast" ? "Balanced" : "Expressive"}</span></summary>
        <div className={styles.settings}>
          <label>Voice style<select value={talk.voiceMode} disabled={talk.active} onChange={event => talk.setVoiceMode(event.target.value as "fast" | "expressive")}><option value="fast">Balanced</option><option value="expressive">Expressive · slower preparation</option></select></label>
          <label>Microphone sensitivity<select value={talk.sensitivity} disabled={talk.active} onChange={event => talk.setSensitivity(event.target.value as "normal" | "sensitive")}><option value="normal">Normal</option><option value="sensitive">Sensitive · quieter speech</option></select></label>
          <label>Reply delivery<select value={talk.speechMode} disabled={talk.active} onChange={event => talk.setSpeechMode(event.target.value as "sentences_2_then_3" | "buffered")}><option value="sentences_2_then_3">Start speaking sooner</option><option value="buffered">Wait for the complete reply</option></select></label>
          <label>Language<select value={talk.language} disabled={talk.active} onChange={event => talk.setLanguage(event.target.value as "English" | "Filipino" | "Taglish")}><option value="English">English</option>{talk.experimentalLanguages && <><option value="Filipino">Filipino · experimental</option><option value="Taglish">Taglish · experimental</option></>}</select></label>
          <div className={styles.provider}>{speechProvider}</div>
          <label className={styles.experimental}><input type="checkbox" checked={talk.experimentalLanguages} disabled={talk.active} onChange={event => { talk.setExperimentalLanguages(event.target.checked); if (!event.target.checked) talk.setLanguage("English"); }} /><span>Enable experimental languages<small>Filipino and Taglish are unsupported and unverified.</small></span></label>
          {talk.active && <p className={styles.settingsNote}>Stop Talk before changing voice or language settings.</p>}
        </div>
      </details>
      {(messages.length > 0 || talk.transcript) && <details className={styles.panel}>
        <summary>Conversation transcript<span>{messages.length} messages</span></summary>
        <div className={styles.transcript}>
          {messages.length ? messages.map(message => <div key={message.id}><p>{message.role === "user" ? "You" : "Buddy"}</p><div>{message.content}</div></div>) : <p>{talk.transcript}</p>}
        </div>
      </details>}
    </div>
  </section>;
}
