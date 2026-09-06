"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { EchoDialog } from "@/shared/components/ui/echo-dialog";
import { CrisisSupportPlan } from "./crisis-support-plan";
import { TrustedSupport } from "./trusted-support";
import { getFeaturePolicy } from "@/services/verification/feature-policy";
import { type SafetySignal, shouldShowSupport } from "./safety-signal";
import { createApiClient } from "@/infrastructure/api/api-client";
import { supabaseAuthTokenProvider } from "@/infrastructure/api/supabase-auth-token-provider";
import { env } from "@/config/environment";
const client = createApiClient({ baseUrl: env.apiBaseUrl, tokenProvider: supabaseAuthTokenProvider });
export function SafetyResponse({
  signal,
  source = "analysis",
}: {
  signal?: SafetySignal;
  source?: "analysis" | "buddy";
}) {
  const [open, setOpen] = useState(false),
    [buddy, setBuddy] = useState(false);
  const eventId = signal?.eventId,
    kind = signal?.kind;
  useEffect(() => {
    if (!eventId || !kind) return;
    let seen: string | null = null;
    try {
      seen = localStorage.getItem("echo-support:" + eventId);
    } catch {}
    setOpen(shouldShowSupport({ kind, eventId }, seen));
    void getFeaturePolicy()
      .then((policy) => setBuddy(policy.canUseBuddy))
      .catch(() => setBuddy(false));
  }, [eventId, kind]);
  function close() {
    setOpen(false);
    if (eventId) {
      try {
        localStorage.setItem("echo-support:" + eventId, eventId);
      } catch {}
      if (source === "analysis")
        void client.post("/analysis/support/" + encodeURIComponent(eventId) + "/acknowledge").catch(() => {});
    }
  }
  return (
    <EchoDialog
      open={open}
      onClose={close}
      dismissible={kind !== "immediate"}
      title={kind === "immediate" ? "You're not alone" : "You deserve support beyond this page"}
      size="large"
    >
      {kind === "immediate" ? (
        <>
          <p className="mb-4 text-sm">
            ECHO noticed something in your reflection that may need immediate support. An AI signal is not a
            professional assessment.
          </p>
          <CrisisSupportPlan />
          <button onClick={close} className="echo-button-secondary mt-5">
            I have read these support options
          </button>
        </>
      ) : (
        <div className="space-y-5">
          <p>
            Several recent reflections showed ECHO’s highest severity category. This is a product safety signal, not a
            diagnosis. A professional can help you understand what you are experiencing.
          </p>
          <Link href="/support/find-help?type=mental_health_facility" className="echo-button-primary">
            Talk to a professional
          </Link>
          <Link href="/support/find-help" className="block underline">
            View crisis and support resources
          </Link>
          <TrustedSupport />
          {buddy && (
            <Link href="/buddy" className="echo-button-secondary">
              Ask Buddy for grounding
            </Link>
          )}
          <button onClick={close} className="echo-button-secondary">
            Not now
          </button>
        </div>
      )}
    </EchoDialog>
  );
}
