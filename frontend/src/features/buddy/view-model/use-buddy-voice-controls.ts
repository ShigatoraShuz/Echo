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
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const voiceSupported = useMemo(() => getRecognitionConstructor() !== null, []);
  const speechSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    setInterimTranscript("");
  }, []);

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
        setVoiceError(null);
        setInterimTranscript("");
        setIsListening(true);
      };
      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript("");
      };
      recognition.onerror = (event) => {
        setIsListening(false);
        setInterimTranscript("");
        setVoiceError(
          event.error === "not-allowed"
            ? "Microphone permission was blocked."
            : "Voice input stopped. Please try again.",
        );
      };
      recognition.onresult = (event) => {
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
      try {
        recognition.start();
      } catch {
        setVoiceError("Voice input could not start. Please try again.");
        setIsListening(false);
      }
    },
    [],
  );

  const stopSpeaking = useCallback(() => {
    if (!speechSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [speechSupported]);

  const speak = useCallback(
    (text: string) => {
      if (!speechSupported) {
        setVoiceError("Text-to-speech is not supported in this browser.");
        return;
      }
      const content = text.trim();
      if (!content) return;

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(content);
      utterance.rate = 0.92;
      utterance.pitch = 0.96;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => {
        setIsSpeaking(false);
        setVoiceError("Speech playback stopped. Please try again.");
      };
      setVoiceError(null);
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    },
    [speechSupported],
  );

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      if (speechSupported) window.speechSynthesis.cancel();
    };
  }, [speechSupported]);

  return {
    voiceSupported,
    speechSupported,
    isListening,
    isSpeaking,
    interimTranscript,
    voiceError,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  };
}
