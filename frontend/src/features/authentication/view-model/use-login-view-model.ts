"use client";
import { useEffect, useRef, useState } from "react";
import type { AuthServiceError } from "../model/auth.model";
import { getAuthService } from "@/services/authentication/auth-service.factory";
export type FormStatus = "idle" | "submitting" | "success" | "error";
export function useLoginViewModel() {
  const [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [sent, setSent] = useState(false),
    [cooldown, setCooldown] = useState(0),
    [status, setStatus] = useState<FormStatus>("idle"),
    [error, setError] = useState<AuthServiceError | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function sendCode() {
    if (lock.current || cooldown > 0) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError({ code: "VALIDATION", message: "Enter a valid email address." });
      setStatus("error");
      return;
    }
    lock.current = true;
    setStatus("submitting");
    setError(null);
    try {
      const result = await getAuthService().requestEmailCode(email.trim());
      if (!result.success) {
        setError(result.error);
        setStatus("error");
        return;
      }
      setSent(true);
      setCooldown(60);
      setStatus("idle");
    } catch {
      setError({ code: "NETWORK", message: "The code could not be sent. Check your connection and try again." });
      setStatus("error");
    } finally {
      lock.current = false;
    }
  }
  async function submit() {
    if (!sent) {
      await sendCode();
      return null;
    }
    if (lock.current) return null;
    if (!/^\d{6}$/.test(code)) {
      setError({ code: "INVALID_TOKEN", message: "Enter the six-digit code from your email." });
      setStatus("error");
      return null;
    }
    lock.current = true;
    setStatus("submitting");
    setError(null);
    try {
      const result = await getAuthService().login({ email: email.trim(), code, password: "", rememberSession: true });
      if (!result.success) {
        setError(result.error);
        setStatus("error");
        return null;
      }
      setStatus("success");
      return result.data;
    } catch {
      setError({ code: "NETWORK", message: "Sign-in could not be completed. Please retry." });
      setStatus("error");
      return null;
    } finally {
      lock.current = false;
    }
  }
  return {
    email,
    setEmail,
    code,
    setCode,
    sent,
    cooldown,
    status,
    error,
    sendCode,
    submit,
    changeEmail: () => {
      setSent(false);
      setCode("");
      setError(null);
      setStatus("idle");
    },
  };
}
