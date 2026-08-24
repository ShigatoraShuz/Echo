"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getSupabasePublicConfig } from "@/infrastructure/supabase/config";
import { signInWithGoogle } from "@/infrastructure/supabase/auth-helpers";
import { safeRedirectPath } from "@/shared/lib/safe-redirect";

type GoogleAuthIntent = "login" | "signup";

interface GoogleAuthButtonProps {
  intent: GoogleAuthIntent;
  next?: string | null;
}

const termsSections = [
  {
    title: "Purpose of ECHO",
    body: "ECHO is a private self-reflection and wellbeing support tool for journaling, grounding exercises, check-ins, settings, and optional AI-assisted reflection. It is designed for personal organization and reflective support only.",
  },
  {
    title: "Not medical care",
    body: "ECHO is not a diagnostic tool, treatment provider, emergency monitor, therapist, doctor, or substitute for professional medical or mental-health advice. If you may be in immediate danger, contact local emergency services or a trusted crisis support line now.",
  },
  {
    title: "Optional AI-assisted features",
    body: "Some ECHO features may provide summaries, mood patterns, or Buddy responses. These outputs can be incomplete or incorrect. They are supportive, non-clinical, and must not be used for medical, safety, legal, or emergency decisions.",
  },
  {
    title: "Your responsibilities",
    body: "You agree to provide accurate account information, keep your account access secure, use the service lawfully, and avoid submitting content that attempts to harm, exploit, or bypass the system or other users.",
  },
  {
    title: "Consent records",
    body: "ECHO records the version and timestamp of required acknowledgements so the service can prove which Terms of Use and Privacy Notice were accepted before private features were used.",
  },
  {
    title: "Service changes",
    body: "ECHO may change features during development. If a material change affects privacy, AI use, account safety, or user rights, ECHO should ask you to review updated terms before continuing.",
  },
];

const privacySections = [
  {
    title: "Information ECHO collects",
    body: "ECHO collects account details, your chosen display name, saved journal entries, onboarding choices, notification settings, privacy settings, trusted contacts you add, verification records where required, and limited security/activity logs needed to operate the app.",
  },
  {
    title: "Google sign-in data",
    body: "When you continue with Google, Supabase receives the OAuth response from Google. ECHO may use the Google-provided email and recommended display name to create or find your account and prefill your profile.",
  },
  {
    title: "Private reflections",
    body: "Journal and reflection content is treated as sensitive private data. ECHO uses it to show your entries, dashboard summaries, grounding history, and only the optional AI features you explicitly choose to use.",
  },
  {
    title: "Optional AI processing",
    body: "AI analysis is optional. Declining optional AI analysis does not block journaling or grounding tools. If enabled later, only selected entries are processed for reflective summaries or insights.",
  },
  {
    title: "Storage and access",
    body: "ECHO stores feature data in service-owned database schemas. Access is scoped to the authenticated user, with backend service access used only for application operations, diagnostics, and administrative workflows.",
  },
  {
    title: "Your controls",
    body: "You can update your profile and preferences, change optional AI settings, request data export, request account deletion, and review privacy/security choices from settings. Some consent and security records may be retained when needed for accountability.",
  },
  {
    title: "What ECHO does not do",
    body: "ECHO does not sell private journal content. ECHO is not emergency monitoring. It does not guarantee clinical accuracy, continuous availability, or that every risk signal will be detected.",
  },
];

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
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [activeDocument, setActiveDocument] = useState<"terms" | "privacy" | null>(null);
  const [termsScrolled, setTermsScrolled] = useState(false);
  const [privacyScrolled, setPrivacyScrolled] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const className = "flex h-10 w-full items-center justify-center gap-3 rounded-full border border-[rgba(83,103,51,0.22)] bg-white/80 px-5 text-sm font-bold text-[var(--landing-ink)] outline-none transition-[transform,background-color,border-color,box-shadow] duration-150 hover:border-[rgba(83,103,51,0.4)] hover:bg-white focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-20)] active:scale-[0.98] disabled:cursor-wait disabled:opacity-70";

  const canContinue = termsAccepted && privacyAccepted;

  useEffect(() => {
    if (!showConsentModal) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showConsentModal]);

  const handleDocumentScroll = (documentType: "terms" | "privacy", event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const reachedBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 8;
    if (!reachedBottom) return;
    if (documentType === "terms") setTermsScrolled(true);
    if (documentType === "privacy") setPrivacyScrolled(true);
  };

  const continueWithGoogle = async () => {
    if (!getSupabasePublicConfig()) {
      setShowSetupMessage(true);
      return;
    }
    setBusy(true);
    const fallback = intent === "signup" ? "/onboarding/consent" : "/dashboard";
    const callback = new URL("/callback", window.location.origin);
    callback.searchParams.set("next", safeRedirectPath(next, fallback));
    callback.searchParams.set("intent", intent);
    const redirectTo = callback.toString();
    const { error, didRedirect } = await signInWithGoogle(redirectTo, { forceAccountSelection: true });
    if (didRedirect) return;
    setBusy(false);
    if (error) setShowSetupMessage(true);
  };

  const handleClick = () => {
    if (!getSupabasePublicConfig()) {
      setShowSetupMessage(true);
      return;
    }
    setShowConsentModal(true);
    setActiveDocument("terms");
  };

  const modal = showConsentModal ? (
    <div className="fixed inset-0 z-[500] flex items-center justify-center overflow-y-auto bg-[#14251d]/60 px-3 py-4 backdrop-blur-sm sm:px-6 sm:py-8">
      <section
        aria-modal="true"
        role="dialog"
        aria-labelledby={`${intent}-google-consent-title`}
        className="flex max-h-[94svh] w-full max-w-[42rem] flex-col overflow-hidden rounded-[1.75rem] border border-[rgba(83,103,51,0.18)] bg-[#fffdf7] text-left text-[var(--landing-ink)] shadow-[0_30px_90px_rgba(20,37,29,0.34)] lg:max-w-[58rem] lg:rounded-[2rem]"
      >
        <header className="shrink-0 border-b border-[rgba(83,103,51,0.14)] px-5 py-4 sm:px-6">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--landing-primary)]">
            Required before Google {intent === "signup" ? "sign-up" : "sign-in"}
          </p>
          <h2 id={`${intent}-google-consent-title`} className="mt-1 text-2xl font-medium tracking-[-0.04em] [font-family:var(--font-echo-display)]">
            Review Terms and Privacy Notice
          </h2>
          <p className="mt-1 text-xs leading-5 text-[var(--landing-muted)]">
            Open each document, scroll to the bottom, then check the confirmation boxes to continue to Google.
          </p>
        </header>

        <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[17rem_1fr]">
          <aside className="shrink-0 border-b border-[rgba(83,103,51,0.12)] p-4 lg:border-b-0 lg:border-r">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <button
                type="button"
                onClick={() => setActiveDocument("terms")}
                className={`rounded-2xl border px-4 py-3 text-left text-sm font-bold transition ${
                  activeDocument === "terms"
                    ? "border-[var(--landing-primary)] bg-[var(--landing-primary)] text-white"
                    : "border-[rgba(83,103,51,0.18)] bg-white/70 text-[var(--landing-ink)]"
                }`}
              >
                Terms of Use
                <span className="mt-1 block text-[10px] font-medium opacity-80">
                  {termsScrolled ? "Scrolled to bottom" : "Click and read first"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveDocument("privacy")}
                className={`rounded-2xl border px-4 py-3 text-left text-sm font-bold transition ${
                  activeDocument === "privacy"
                    ? "border-[var(--landing-primary)] bg-[var(--landing-primary)] text-white"
                    : "border-[rgba(83,103,51,0.18)] bg-white/70 text-[var(--landing-ink)]"
                }`}
              >
                Privacy Notice
                <span className="mt-1 block text-[10px] font-medium opacity-80">
                  {privacyScrolled ? "Scrolled to bottom" : "Click and read first"}
                </span>
              </button>
            </div>
            <div className="mt-4 space-y-2 text-[11px] leading-4 text-[var(--landing-muted)]">
              <p>
                Full pages:
                {" "}
                <Link href="/terms" target="_blank" className="font-bold text-[var(--landing-primary)] underline">
                  Terms of Use
                </Link>
                {" "}
                and
                {" "}
                <Link href="/privacy-policy" target="_blank" className="font-bold text-[var(--landing-primary)] underline">
                  Privacy Notice
                </Link>
              </p>
            </div>
          </aside>

          <div className="flex min-h-0 flex-col overflow-hidden">
            <div
              key={activeDocument ?? "empty"}
              onScroll={(event) => activeDocument && handleDocumentScroll(activeDocument, event)}
              className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6"
            >
              {activeDocument === "terms" ? (
                <div className="space-y-4">
                  <h3 className="text-xl font-bold">Terms of Use</h3>
                  {termsSections.map((section) => (
                    <section key={section.title} className="rounded-2xl border border-[rgba(83,103,51,0.12)] bg-white/70 p-4">
                      <h4 className="text-sm font-bold text-[var(--landing-ink)]">{section.title}</h4>
                      <p className="mt-2 text-xs leading-5 text-[var(--landing-muted)]">{section.body}</p>
                    </section>
                  ))}
                  <p className="rounded-2xl bg-[rgba(83,103,51,0.08)] p-4 text-xs leading-5 text-[var(--landing-muted)]">
                    End of Terms of Use. You may now check the Terms confirmation below.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-xl font-bold">Privacy Notice</h3>
                  {privacySections.map((section) => (
                    <section key={section.title} className="rounded-2xl border border-[rgba(83,103,51,0.12)] bg-white/70 p-4">
                      <h4 className="text-sm font-bold text-[var(--landing-ink)]">{section.title}</h4>
                      <p className="mt-2 text-xs leading-5 text-[var(--landing-muted)]">{section.body}</p>
                    </section>
                  ))}
                  <p className="rounded-2xl bg-[rgba(83,103,51,0.08)] p-4 text-xs leading-5 text-[var(--landing-muted)]">
                    End of Privacy Notice. You may now check the Privacy confirmation below.
                  </p>
                </div>
              )}
            </div>

            <footer className="shrink-0 space-y-3 border-t border-[rgba(83,103,51,0.14)] bg-[#fffaf0] px-5 py-4 sm:px-6">
              <label className={`flex gap-3 text-xs leading-5 ${termsScrolled ? "text-[var(--landing-ink)]" : "text-[var(--landing-muted)]"}`}>
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  disabled={!termsScrolled}
                  onChange={(event) => setTermsAccepted(event.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-[rgba(83,103,51,0.28)] accent-[var(--landing-primary)] disabled:opacity-40"
                />
                <span>I accept the Terms of Use as versioned today.</span>
              </label>
              <label className={`flex gap-3 text-xs leading-5 ${privacyScrolled ? "text-[var(--landing-ink)]" : "text-[var(--landing-muted)]"}`}>
                <input
                  type="checkbox"
                  checked={privacyAccepted}
                  disabled={!privacyScrolled}
                  onChange={(event) => setPrivacyAccepted(event.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-[rgba(83,103,51,0.28)] accent-[var(--landing-primary)] disabled:opacity-40"
                />
                <span>I have read the Privacy Notice and understand what ECHO collects.</span>
              </label>
              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowConsentModal(false)}
                  className="h-10 rounded-full border border-[rgba(83,103,51,0.2)] px-5 text-sm font-bold text-[var(--landing-primary)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!canContinue || busy}
                  onClick={() => void continueWithGoogle()}
                  className="h-10 rounded-full bg-[var(--landing-primary)] px-5 text-sm font-bold text-white shadow-[0_10px_20px_rgba(83,103,51,0.22)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Continue with Google
                </button>
              </div>
            </footer>
          </div>
        </div>
      </section>
    </div>
  ) : null;

  return (
    <div>
      <button type="button" onClick={handleClick} disabled={busy} className={className}>
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
      {modal ? createPortal(modal, document.body) : null}
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
