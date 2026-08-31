"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { EchoCard, PageHeader } from "@/shared/components/layout";
import { EchoImage } from "@/shared/components/ui";
import { PrivacyNotice } from "@/shared/components/echo";
import { getOnboardingService } from "@/services/onboarding/onboarding-service.factory";

interface ConsentItem {
  key: string;
  title: string;
  description: string;
  required: boolean;
}

const CONSENTS: ConsentItem[] = [
  {
    key: "terms",
    title: "Terms of Service",
    description: "I understand ECHO is a self-guided reflection tool and agree to the platform Terms of Use.",
    required: true,
  },
  {
    key: "privacy",
    title: "Privacy Policy",
    description: "I acknowledge how my personal reflections are encrypted and held under private storage.",
    required: true,
  },
  {
    key: "dataProcessing",
    title: "Data Processing Notice",
    description: "I consent to the private processing of my check-ins and reflection rhythm data.",
    required: true,
  },
  {
    key: "aiInformation",
    title: "AI Feature Notice (CBT Buddy)",
    description: "I acknowledge that AI reflections and CBT Buddy are supportive, non-diagnostic, and non-emergency.",
    required: true,
  },
  {
    key: "journalAnalysis",
    title: "Journal AI Analysis (Recommended)",
    description: "Allow AI-assisted perspective analysis and emotion insights for my written reflections.",
    required: false,
  },
];

export default function ConsentOnboardingPage() {
  const router = useRouter();
  const [consentValues, setConsentValues] = useState<Record<string, boolean>>({
    terms: true,
    privacy: true,
    dataProcessing: true,
    aiInformation: true,
    journalAnalysis: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleConsent = (key: string) => {
    setConsentValues((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const allRequiredAccepted = CONSENTS.filter((c) => c.required).every((c) => Boolean(consentValues[c.key]));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allRequiredAccepted) {
      setError("Please review and accept all required policy declarations to continue.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const service = getOnboardingService();
    const result = await service.saveConsent(consentValues);

    if (result.success) {
      router.push("/onboarding/profile");
    } else {
      setError(result.error.message || "Could not save your consent preferences. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14 xl:px-10">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="space-y-6">
          <PageHeader
            label="Onboarding · Step 1 of 3"
            title="Consent and disclosures"
            description="Review how ECHO frames reflective support and AI assistance before entering the private app."
          />
          <EchoImage imageKey="plantDeskWarmLight" className="aspect-[4/3]" priority />
          <PrivacyNotice />
        </section>

        <form onSubmit={handleSubmit}>
          <EchoCard
            title="Before you continue"
            description="Please review and confirm these foundational privacy notices and AI disclosures."
          >
            <div className="space-y-4">
              {CONSENTS.map((item) => {
                const isChecked = Boolean(consentValues[item.key]);
                return (
                  <div
                    key={item.key}
                    onClick={() => toggleConsent(item.key)}
                    className={`flex cursor-pointer items-start justify-between gap-4 rounded-2xl border p-4 transition-all duration-150 ${
                      isChecked
                        ? "border-[var(--landing-primary)]/30 bg-[var(--landing-primary)]/[0.03]"
                        : "border-border/70 bg-card hover:border-border"
                    }`}
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{item.title}</p>
                        {item.required ? (
                          <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                            Required
                          </span>
                        ) : (
                          <span className="rounded-md bg-[var(--landing-primary)]/10 px-2 py-0.5 text-[10px] font-bold text-[var(--landing-primary)]">
                            Optional
                          </span>
                        )}
                      </div>
                      <p className="text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                    </div>

                    <div
                      role="checkbox"
                      aria-checked={isChecked}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === " " || e.key === "Enter") {
                          e.preventDefault();
                          toggleConsent(item.key);
                        }
                      }}
                      className={`relative mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                        isChecked
                          ? "border-[var(--landing-primary)] bg-[var(--landing-primary)] text-white shadow-xs"
                          : "border-muted-foreground/30 bg-background"
                      }`}
                    >
                      {isChecked && <CheckCircle2 className="h-4 w-4" />}
                    </div>
                  </div>
                );
              })}

              {error && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs font-medium text-destructive">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!allRequiredAccepted || isSubmitting}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--landing-primary)] px-6 text-sm font-bold text-white shadow-sm outline-none transition-all hover:bg-[var(--landing-primary-hover)] focus-visible:ring-4 focus-visible:ring-emerald-600/30 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving declarations...</span>
                  </>
                ) : (
                  <>
                    <span>Continue to profile</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </>
                )}
              </button>
            </div>
          </EchoCard>
        </form>
      </div>
    </div>
  );
}
