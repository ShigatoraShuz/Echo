"use client";

import { useEffect, useRef, useState } from "react";
import { resendVerificationEmail } from "@/services/authentication/resend-verification";

export function EmailVerificationHelp({ email }: { email: string }) {
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const inFlight = useRef(false);
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function resend() {
    if (inFlight.current || cooldown) return;
    inFlight.current = true;
    setPending(true);
    try {
      const response = await resendVerificationEmail(email);
      setResult(response);
      if (response.success) setCooldown(60);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return <div className="rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm">
    <p className="text-muted-foreground">Still waiting for your verification email?</p>
    <button type="button" onClick={resend} disabled={pending || cooldown > 0 || !email.trim()}
      className="mt-1 min-h-11 font-semibold text-primary underline underline-offset-4 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {pending ? "Requesting email..." : cooldown ? `Resend available in ${cooldown}s` : "Resend verification email"}
    </button>
    {result && <p className="mt-2 text-xs leading-5 text-muted-foreground" role={result.success ? "status" : "alert"}>{result.message}</p>}
  </div>;
}
