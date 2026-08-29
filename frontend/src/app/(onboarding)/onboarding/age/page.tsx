"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Loader2 } from "lucide-react";
import { createBrowserSupabaseClient } from "@/infrastructure/supabase/browser-client";
import { env } from "@/config/environment";
export default function LegacyAgePage() {
  const router = useRouter();
  const [birthday, setBirthday] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    setError("");
    const { data } = await createBrowserSupabaseClient().auth.getSession();
    const response = await fetch(`${env.apiBaseUrl}/access/age`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` },
      body: JSON.stringify({ birthday }),
    });
    setBusy(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      return setError(body?.error?.message ?? "Age verification could not be completed.");
    }
    router.replace("/onboarding/policies");
    router.refresh();
  }
  return (
    <main className="grid min-h-[100svh] place-items-center bg-[#fbf8f1] p-4">
      <section className="w-full max-w-lg rounded-[2rem] border border-[#526f3525] bg-white p-7 shadow-xl sm:p-10">
        <p className="eyebrow">Required for legacy accounts</p>
        <h1 className="mt-2 text-4xl [font-family:var(--font-echo-display)]">Confirm you&apos;re 18 or older</h1>
        <p className="mt-3 text-sm leading-7 text-[#697168]">
          Your birthday is used for this check and immediately discarded. ECHO stores only the eligibility result,
          timestamp, and rule version.
        </p>
        {error && (
          <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        )}
        <label className="mt-7 block text-sm font-bold">
          Birthday
          <div className="relative mt-2">
            <CalendarDays className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#526f35]" />
            <input
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              className="auth-wizard-input pl-12"
            />
          </div>
        </label>
        <button disabled={!birthday || busy} onClick={submit} className="auth-primary w-full">
          {busy ? <Loader2 className="size-4 animate-spin" /> : "Continue"}
        </button>
      </section>
    </main>
  );
}
