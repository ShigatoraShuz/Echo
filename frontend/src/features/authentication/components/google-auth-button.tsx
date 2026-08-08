"use client";

import { useState } from "react";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { signInWithGoogle } from "@/lib/supabase/auth-helpers";
import { safeRedirectPath } from "@/lib/safe-redirect";

type GoogleAuthIntent = "login" | "signup";

interface GoogleAuthButtonProps {
  intent: GoogleAuthIntent;
  next?: string | null;
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0">
      <path fill="#4285F4" d="M21.35 12.27c0-.7-.06-1.37-.18-2.02H12v3.82h5.24a4.48 4.48 0 0 1-1.94 2.94v2.54h3.15c1.84-1.7 2.9-4.2 2.9-7.28Z" />
      <path fill="#34A853" d="M12 21.75c2.63 0 4.84-.87 6.45-2.36l-3.15-2.54c-.87.58-1.99.92-3.3.92-2.54 0-4.7-1.72-5.47-4.03H3.29v2.62A9.74 9.74 0 0 0 12 21.75Z" />
      <path fill="#FBBC05" d="M6.53 13.74A5.88 5.88 0 0 1 6.22 12c0-.6.11-1.18.31-1.74V7.64H3.29A9.74 9.74 0 0 0 2.25 12c0 1.57.37 3.06 1.04 4.36l3.24-2.62Z" />
      <path fill="#EA4335" d="M12 6.23c1.43 0 2.7.49 3.71 1.45l2.78-2.78C16.83 3.35 14.63 2.25 12 2.25a9.74 9.74 0 0 0-8.71 5.39l3.24 2.62c.77-2.31 2.93-4.03 5.47-4.03Z" />
    </svg>
  );
}

export function GoogleAuthButton({ intent, next }: GoogleAuthButtonProps) {
  const [showSetupMessage, setShowSetupMessage] = useState(false);
  const [busy, setBusy] = useState(false);
  const className = "flex h-10 w-full items-center justify-center gap-3 rounded-full border border-[rgba(83,103,51,0.22)] bg-white/80 px-5 text-sm font-bold text-[var(--landing-ink)] outline-none transition-[transform,background-color,border-color,box-shadow] duration-150 hover:border-[rgba(83,103,51,0.4)] hover:bg-white focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-20)] active:scale-[0.98] disabled:cursor-wait disabled:opacity-70";

  const handleClick = async () => {
    if (!getSupabasePublicConfig()) {
      setShowSetupMessage(true);
      return;
    }
    setBusy(true);
    const redirectTo = `${window.location.origin}/callback?next=${encodeURIComponent(safeRedirectPath(next))}`;
    const { error } = await signInWithGoogle(redirectTo);
    setBusy(false);
    if (error) setShowSetupMessage(true);
  };

  return (
    <div>
      <button type="button" onClick={() => void handleClick()} disabled={busy} className={className}>
        <GoogleMark />
        Continue with Google
      </button>
      {showSetupMessage ? (
        <p className="mt-2 text-center text-xs leading-5 text-[var(--landing-muted)]" role="status">
          {getSupabasePublicConfig()
            ? "Google sign-in could not start right now. Please try again."
            : `Google ${intent === "signup" ? "sign-up" : "sign-in"} will open here once your OAuth endpoint is connected.`}
        </p>
      ) : null}
    </div>
  );
}

export function AuthDivider() {
  return (
    <div className="flex items-center gap-3 py-0" aria-hidden="true">
      <span className="h-px flex-1 bg-[rgba(83,103,51,0.16)]" />
      <span className="text-xs font-medium text-[var(--landing-muted)]">or continue with email</span>
      <span className="h-px flex-1 bg-[rgba(83,103,51,0.16)]" />
    </div>
  );
}