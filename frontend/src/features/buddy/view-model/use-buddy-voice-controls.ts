"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface EchoSpeechRecognitionAlternative {
  transcript: string;
}

interface EchoSpeechRecognitionResult {
  isFinal: boolean;
  0: EchoSpeechRecognitionAlternative;
}

interface EchoSpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: EchoSpeechRecognitionResult;
  };
}

interface EchoSpeechRecognitionErrorEvent {
  error?: string;
}

interface EchoSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: EchoSpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: EchoSpeechRecognitionEvent) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type EchoSpeechRecognitionConstructor = new () => EchoSpeechRecognition;

declare global {
  interface Window {
    webkitSpeechRecognition?: EchoSpeechRecognitionConstructor;
    SpeechRecognition?: EchoSpeechRecognitionConstructor;
  }
}

function getRecognitionConstructor(): EchoSpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export function useBuddyVoiceControls() {
  const recognitionRef = useRef<EchoSpeechRecognition | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speechStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [inputPhase, setInputPhase] = useState<"idle" | "starting" | "listening" | "stopping">("idle");
  const [playbackPhase, setPlaybackPhase] = useState<"idle" | "starting" | "speaking">("idle");
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const voiceSupported = useMemo(() => getRecognitionConstructor() !== null, []);
  const speechSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    if (!speechSupported) return;
    const synthesis = window.speechSynthesis;
    const updateVoices = () => {
      const voices = synthesis.getVoices();
      const conversationVoices = voices.filter((voice) => /^(en|fil|tl)(-|$)/i.test(voice.lang));
      setAvailableVoices((conversationVoices.length ? conversationVoices : voices).sort((a, b) => {
        const rank = (voice: SpeechSynthesisVoice) => voice.localService ? (/natural|neural/i.test(voice.name) ? 0 : 1) : 2;
        return rank(a) - rank(b) || a.name.localeCompare(b.name);
      }));
    };
    updateVoices();
    synthesis.addEventListener("voiceschanged", updateVoices);
    return () => synthesis.removeEventListener("voiceschanged", updateVoices);
  }, [speechSupported]);

  const stopListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (inputPhase === "starting") {
      recognitionRef.current = null;
      recognition.abort();
      setInputPhase("idle");
      setInterimTranscript("");
      return;
    }
    setInputPhase("stopping");
    recognition.stop();
  }, [inputPhase]);

  const startListening = useCallback(
    (onTranscript: (transcript: string) => void) => {
      const Recognition = getRecognitionConstructor();
      if (!Recognition) {
        setVoiceError("Voice input is not supported in this browser.");
        return;
      }

      recognitionRef.current?.abort();
      const recognition = new Recognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.onstart = () => {
        if (recognitionRef.current === recognition) setInputPhase("listening");
      };
      recognition.onend = () => {
        if (recognitionRef.current !== recognition) return;
        recognitionRef.current = null;
        setInputPhase("idle");
        setInterimTranscript("");
      };
      recognition.onerror = (event) => {
        if (recognitionRef.current !== recognition) return;
        recognitionRef.current = null;
        setInputPhase("idle");
        setInterimTranscript("");
        setVoiceError(
          event.error === "not-allowed"
            ? "The browser could not start voice input. Check microphone access and try again."
            : "Voice input stopped. Please try again.",
        );
      };
      recognition.onresult = (event) => {
        if (recognitionRef.current !== recognition) return;
        let finalText = "";
        let interimText = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          const transcript = result[0]?.transcript ?? "";
          if (result.isFinal) finalText += transcript;
          else interimText += transcript;
        }
        if (finalText.trim()) onTranscript(finalText.trim());
        setInterimTranscript(interimText.trim());
      };

      recognitionRef.current = recognition;
      setVoiceError(null);
      setInterimTranscript("");
      setInputPhase("starting");
      try {
        recognition.start();
      } catch {
        recognitionRef.current = null;
        setVoiceError("Voice input could not start. Please try again.");
        setInputPhase("idle");
      }
    },
    [],
  );

  const stopSpeaking = useCallback(() => {
    if (!speechSupported) return;
    const hadUtterance = utteranceRef.current !== null;
    utteranceRef.current = null;
    if (speechStartTimerRef.current) clearTimeout(speechStartTimerRef.current);
    speechStartTimerRef.current = null;
    if (hadUtterance) window.speechSynthesis.cancel();
    setPlaybackPhase("idle");
  }, [speechSupported]);

  const speak = useCallback(
    (text: string, voiceURI = selectedVoiceURI) => {
      if (!speechSupported) {
        setVoiceError("Text-to-speech is not supported in this browser.");
        return;
      }
      const content = text.trim();
      if (!content) return;

      stopSpeaking();
      const synthesis = window.speechSynthesis;
      const voices = synthesis.getVoices();
      const localEnglishVoices = voices.filter((voice) => voice.localService && /^en(-|$)/i.test(voice.lang));
      const selectedVoice = voices.find((voice) => voice.voiceURI === voiceURI)
        ?? localEnglishVoices.find((voice) => /natural|neural/i.test(voice.name))
        ?? localEnglishVoices.find((voice) => voice.default)
        ?? localEnglishVoices[0]
        ?? voices.find((voice) => voice.localService && /^(fil|tl)(-|$)/i.test(voice.lang));
      const utterance = new SpeechSynthesisUtterance(content);
      if (selectedVoice) utterance.voice = selectedVoice;
      utterance.lang = selectedVoice?.lang ?? "en-US";
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;
      let started = false;
      utterance.onstart = () => {
        if (utteranceRef.current !== utterance) return;
        started = true;
        if (speechStartTimerRef.current) clearTimeout(speechStartTimerRef.current);
        speechStartTimerRef.current = null;
        setPlaybackPhase("speaking");
      };
      utterance.onend = () => {
        if (utteranceRef.current !== utterance) return;
        utteranceRef.current = null;
        if (speechStartTimerRef.current) clearTimeout(speechStartTimerRef.current);
        speechStartTimerRef.current = null;
        setPlaybackPhase("idle");
        if (!started) setVoiceError("Browser speech ended without playing. Try another voice or browser.");
      };
      utterance.onerror = () => {
        if (utteranceRef.current !== utterance) return;
        utteranceRef.current = null;
        if (speechStartTimerRef.current) clearTimeout(speechStartTimerRef.current);
        speechStartTimerRef.current = null;
        setPlaybackPhase("idle");
        setVoiceError("Voice playback failed. Try another browser voice.");
      };
      utteranceRef.current = utterance;
      setVoiceError(null);
      setPlaybackPhase("starting");
      speechStartTimerRef.current = setTimeout(() => {
        if (utteranceRef.current !== utterance) return;
        stopSpeaking();
        setVoiceError("Voice playback did not start. Try another browser voice.");
      }, 8000);
      try {
        if (synthesis.paused) synthesis.resume();
        synthesis.speak(utterance);
      } catch {
        stopSpeaking();
        setVoiceError("Voice playback could not start. Try another browser voice.");
      }
    },
    [selectedVoiceURI, speechSupported, stopSpeaking],
  );

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      utteranceRef.current = null;
      if (speechStartTimerRef.current) clearTimeout(speechStartTimerRef.current);
      if (speechSupported) window.speechSynthesis.cancel();
    };
  }, [speechSupported]);

  return {
    voiceSupported,
    speechSupported,
    inputPhase,
    isListening: inputPhase === "listening",
    playbackPhase,
    isSpeaking: playbackPhase !== "idle",
    availableVoices,
    selectedVoiceURI,
    setSelectedVoiceURI,
    interimTranscript,
    voiceError,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  };
}
