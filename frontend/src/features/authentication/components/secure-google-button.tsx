"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { registrationApi } from "@/services/authentication/registration-api";
import { createBrowserSupabaseClient } from "@/infrastructure/supabase/browser-client";
import { safeRedirectPath } from "@/shared/lib/safe-redirect";
import { loadGoogleIdentity, type GoogleCredential } from "./google-identity";

export function SecureGoogleButton({ intent, successPath }: { intent: "login" | "signup"; successPath?: string | null }) {
  const router = useRouter();
  const host = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "verifying" | "error">("loading");
  const [error, setError] = useState("");
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    const element = host.current;
    if (!element || !clientId) return;
    let active = true;
    let processing = false;
    let expiry: ReturnType<typeof setTimeout> | undefined;

    async function prepare() {
      try {
        const google = await loadGoogleIdentity();
        if (!active) return;
        // Prepare before Google's own button is clicked, so the popup opens
        // directly on a user gesture rather than after an asynchronous fetch.
        const challenge = await (intent === "login"
          ? registrationApi.googleLoginNonce()
          : registrationApi.googleNonce());
        if (!active || !element || !clientId) return;

        async function complete(response: GoogleCredential) {
          if (!active || processing) return;
          processing = true;
          clearTimeout(expiry);
          setStatus("verifying");
          try {
            if (intent === "login") {
              const check = await registrationApi.googleLoginStatus(response.credential, challenge.nonce);
              if (check.status === "password_account_requires_link")
                throw new Error("This email uses password login. Log in with email, then link Google from Settings.");
              if (check.status !== "existing_google_identity")
                throw new Error("No Google-linked ECHO account exists. Choose Create account first.");
            } else {
              await registrationApi.bindGoogle(response.credential, challenge.nonce);
            }
            if (!active) return;
            const result = await createBrowserSupabaseClient().auth.signInWithIdToken({
              provider: "google",
              token: response.credential,
              nonce: challenge.nonce,
            });
            if (result.error) throw result.error;
            if (!active) return;
            router.replace(intent === "login" ? safeRedirectPath(successPath) : "/onboarding");
            router.refresh();
          } catch (reason) {
            if (!active) return;
            setError(reason instanceof Error ? reason.message : "Google sign-in could not be completed.");
            setStatus("error");
            // A retry must prepare a fresh challenge instead of reusing one.
            active = false;
          }
        }

        google.initialize({
          client_id: clientId,
          nonce: challenge.hashedNonce,
          callback: complete,
          ux_mode: "popup",
          // FedCM button UX is optional and Brave may reject it as unsupported.
          // The popup flow keeps the same one-time nonce verification.
          use_fedcm_for_button: false,
          auto_select: false,
        });
        element.replaceChildren();
        google.renderButton(element, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "pill",
          locale: "en",
          width: Math.min(400, element.parentElement?.getBoundingClientRect().width || 400),
        });
        setStatus("ready");
        // The backend login proof expires after five minutes. Request an
        // explicit refresh before that, without silently rotating a popup's nonce.
        expiry = setTimeout(() => {
          if (!active || processing) return;
          active = false;
          setError("Google sign-in has expired. Refresh it to continue.");
          setStatus("error");
        }, 4 * 60_000);
      } catch (reason) {
        if (!active) return;
        setError(
          reason instanceof TypeError
            ? "ECHO could not reach its sign-in service. Check that the backend is running, then retry."
            : reason instanceof Error
              ? reason.message
              : "Google sign-in could not start.",
        );
        setStatus("error");
      }
    }

    void prepare();
    return () => {
      active = false;
      clearTimeout(expiry);
      element.replaceChildren();
    };
  }, [attempt, clientId, intent, router, successPath]);

  return (
    <div className={intent === "signup" ? "mt-6" : undefined}>
      <div
        className="grid min-h-12 w-full place-items-center"
        aria-busy={!!clientId && (status === "loading" || status === "verifying")}
      >
        <div ref={host} hidden={status === "error" || status === "verifying"} />
        {!clientId ? (
          <p role="status" className="text-center text-sm">
            Google sign-in is not configured.
          </p>
        ) : status === "loading" || status === "verifying" ? (
          <p role="status" className="text-center text-sm">
            {status === "loading" ? "Loading Google sign-in…" : "Verifying your account…"}
          </p>
        ) : status === "error" ? (
          <button
            type="button"
            onClick={() => {
              setError("");
              setStatus("loading");
              setAttempt((value) => value + 1);
            }}
            className="h-12 w-full rounded-full border border-[#526f3540] bg-white font-bold text-[#263226]"
          >
            Retry Google sign-in
          </button>
        ) : null}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-center text-xs leading-5 text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
