"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { BadgeCheck, LockKeyhole } from "lucide-react";
import { getVerificationService } from "@/services/verification/verification-service.factory";

export function VerifiedFeatureGate({
  children,
  featureName,
}: {
  children: ReactNode;
  featureName: string;
}) {
  const [access, setAccess] = useState<"loading" | "allowed" | "verification" | "trusted_contact" | "error">("loading");

  useEffect(() => {
    let active = true;
    void getVerificationService()
      .getStatus()
      .then((result) => {
        if (active) setAccess(result.success
          ? result.data.canAccessAi ? "allowed" : result.data.accessRequirement === "trusted_contact" ? "trusted_contact" : "verification"
          : "error");
      });
    return () => {
      active = false;
    };
  }, []);

  if (access === "loading") {
    return <div className="h-72 animate-pulse rounded-[2rem] bg-card/70 motion-reduce:animate-none" />;
  }

  if (access !== "allowed") {
    const needsContact = access === "trusted_contact";
    const failed = access === "error";
    return (
      <div className="mx-auto max-w-2xl rounded-[2rem] border border-[var(--landing-primary-10)] bg-[linear-gradient(130deg,rgba(251,247,238,0.97),rgba(220,232,214,0.78))] p-8 text-center shadow-card">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground">
          <LockKeyhole className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="mt-5 font-serif text-3xl">{failed ? `${featureName} is temporarily unavailable` : needsContact ? "Add a trusted support contact" : `${featureName} requires verification`}</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
          {failed ? "Your access status could not be checked. Please try again shortly." : needsContact ? "Your account is verified. Add a valid trusted support contact and confirm their permission before using AI-supported features." : "This feature uses AI-supported processing. It unlocks after an administrator approves your identity and age verification and you add a permitted trusted support contact."}
        </p>
        <Link href={needsContact ? "/settings/trusted-contacts" : failed ? "/settings" : "/settings/verification"} className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground transition-transform active:scale-[0.97]">
          <BadgeCheck className="h-4 w-4" aria-hidden="true" /> {needsContact ? "Manage trusted contacts" : failed ? "Open settings" : "Open verification"}
        </Link>
      </div>
    );
  }

  return children;
}
