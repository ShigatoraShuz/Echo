"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { registrationApi } from "@/services/authentication/registration-api";
import { createBrowserSupabaseClient } from "@/infrastructure/supabase/browser-client";
type Credential = { credential: string };
type Google = {
  accounts: {
    id: {
      initialize: (value: {
        client_id: string;
        nonce: string;
        callback: (response: Credential) => void;
        use_fedcm_for_prompt: boolean;
      }) => void;
      prompt: () => void;
    };
  };
};
declare global {
  interface Window {
    google?: Google;
  }
}
function useGoogleScript() {
  useEffect(() => {
    if (document.querySelector("script[data-echo-google]")) return;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.dataset.echoGoogle = "true";
    document.head.appendChild(script);
  }, []);
}
export function SecureGoogleSignupButton() {
  useGoogleScript();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  async function start() {
    if (!clientId || !window.google) return setError("Google signup is not configured yet.");
    setBusy(true);
    setError("");
    try {
      const challenge = await registrationApi.googleNonce();
      window.google.accounts.id.initialize({
        client_id: clientId,
        nonce: challenge.hashedNonce,
        use_fedcm_for_prompt: true,
        callback: async (response) => {
          try {
            await registrationApi.bindGoogle(response.credential, challenge.nonce);
            const result = await createBrowserSupabaseClient().auth.signInWithIdToken({
              provider: "google",
              token: response.credential,
              nonce: challenge.nonce,
            });
            if (result.error) throw result.error;
            router.replace("/onboarding");
            router.refresh();
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Google signup could not be completed.");
          } finally {
            setBusy(false);
          }
        },
      });
      window.google.accounts.id.prompt();
    } catch (reason) {
      setBusy(false);
      setError(reason instanceof Error ? reason.message : "Google signup could not start.");
    }
  }
  return (
    <>
      <button
        type="button"
        disabled={busy || !clientId}
        onClick={start}
        className="mt-6 flex h-12 w-full items-center justify-center gap-3 rounded-full border border-[#526f3540] bg-white font-bold text-[#263226] disabled:opacity-50"
      >
        <span className="text-lg font-black text-[#4285f4]">G</span>
        {busy ? "Connecting…" : "Continue with Google"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-center text-xs text-red-700">
          {error}
        </p>
      )}
    </>
  );
}
