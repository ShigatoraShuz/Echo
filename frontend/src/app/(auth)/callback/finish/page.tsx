"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/infrastructure/supabase/browser-client";
import { configureSessionPersistence } from "@/services/authentication/auth.supabase-adapter";
import { safeRedirectPath } from "@/shared/lib/safe-redirect";

export default function FinishEmailConfirmationPage() {
  const router = useRouter();
  const [error, setError] = useState(false);
  const confirmation = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    let active = true;
    const next = safeRedirectPath(new URLSearchParams(window.location.search).get("next"));

    if (!confirmation.current) {
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = fragment.get("access_token");
      const refreshToken = fragment.get("refresh_token");

      // Never leave session tokens in browser history while the exchange runs.
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);

      if (!accessToken || !refreshToken) {
        setError(true);
        return;
      }

      confirmation.current = Promise.resolve()
        .then(() => {
          configureSessionPersistence(true);
          return createBrowserSupabaseClient().auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        })
        .then(({ data, error: sessionError }) => !sessionError && !!data.session && !!data.user)
        .catch(() => false);
    }

    void confirmation.current
      .then((confirmed) => {
        if (!active) return;
        if (!confirmed) {
          setError(true);
          return;
        }
        router.replace(next);
        router.refresh();
      });

    return () => { active = false; };
  }, [router]);

  return (
    <section className="w-full max-w-md rounded-3xl border border-border bg-card p-6 text-center shadow-soft sm:p-8">
      <h1 className="text-2xl font-semibold">Finishing email confirmation</h1>
      {error ? (
        <div role="alert" className="mt-4 text-sm text-destructive">
          This confirmation link could not finish sign-in. If your email was confirmed, try logging in with your password.
        </div>
      ) : (
        <p role="status" className="mt-4 text-sm text-muted-foreground">Checking your confirmation link…</p>
      )}
      {error ? <Link href="/login" className="mt-5 inline-block text-sm font-semibold text-primary underline">Go to login</Link> : null}
    </section>
  );
}
