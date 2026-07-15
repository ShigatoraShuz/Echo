import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ConsentCard, EchoCard, EchoImage, PageHeader, PrivacyNotice } from "@/components/echo/shared";

export default function ConsentOnboardingPage() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14 xl:px-10">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="space-y-6">
            <PageHeader
              label="Onboarding"
              title="Consent and disclosures"
              description="Review how ECHO frames reflective support before entering the private app."
            />
            <EchoImage imageKey="plantDeskWarmLight" className="aspect-[4/3]" priority />
            <PrivacyNotice />
          </section>

          <EchoCard title="Before you continue" description="These acknowledgements are shown as static UI for now and are ready for backend consent capture later.">
            <div className="space-y-4">
              <ConsentCard checked title="ECHO is not a diagnostic tool" description="Mood and distress summaries are reflective signals, not medical conclusions." />
              <ConsentCard checked title="Crisis support remains available" description="If you may be in danger, use emergency services or a crisis line instead of waiting for an app response." />
              <ConsentCard title="Data controls are explicit" description="Exports, deletion, and privacy preferences should remain visible as backend storage is connected." />
              <Link href="/onboarding/profile" className="echo-button-primary w-full">
                Continue
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </EchoCard>
        </div>
    </div>
  );
}
