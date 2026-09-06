"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { BadgeCheck, LockKeyhole } from "lucide-react";
import { getFeaturePolicy } from "@/services/verification/feature-policy";

export function VerifiedFeatureGate({ children, featureName }: { children: ReactNode; featureName: string }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    void getFeaturePolicy()
      .then((result) => {
        if (active) {
          setAllowed(result.canUseAiFeatures);
          setMissing(result.missingRequirements);
        }
      })
      .catch(() => {
        if (active) {
          setAllowed(false);
          setUnavailable(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  if (allowed === null) {
    return <div className="h-72 animate-pulse rounded-[2rem] bg-card/70 motion-reduce:animate-none" />;
  }

  if (!allowed) {
    return (
      <div className="mx-auto max-w-2xl rounded-[2rem] border border-[var(--landing-primary-10)] bg-[linear-gradient(130deg,rgba(251,247,238,0.97),rgba(220,232,214,0.78))] p-8 text-center shadow-card">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground">
          <LockKeyhole className="h-6 w-6" aria-hidden="true" />
        </span>
        <h2 className="mt-5 font-serif text-3xl">
          {unavailable ? "Access check unavailable" : `Set up ${featureName}`}
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
          {unavailable
            ? "Your requirements could not be checked. Reload to retry."
            : missing
                .map((item) =>
                  item === "verification" ? "Complete account verification." : "Add a valid Trusted Support Contact.",
                )
                .join(" ")}
        </p>
        <Link
          href="/settings/verification"
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground transition-transform active:scale-[0.97]"
        >
          <BadgeCheck className="h-4 w-4" aria-hidden="true" /> Open verification
        </Link>
        <Link href="/settings/trusted-contacts" className="mt-3 block underline">
          Add Trusted Support Contact
        </Link>
      </div>
    );
  }

  return children;
}
