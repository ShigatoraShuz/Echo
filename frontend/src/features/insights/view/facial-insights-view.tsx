"use client";

import { Shield } from "lucide-react";
import { PrivacyNotice } from "@/shared/components/echo";
import { EchoCard, PageHeader } from "@/shared/components/layout";
import { VerifiedFeatureGate } from "@/features/verification";

export function FacialInsightsView() {
  return (
    <VerifiedFeatureGate featureName="Facial trend analysis">
      <div className="space-y-6">
        <PageHeader label="Insights" title="Facial trend privacy" description="Facial capture is optional and starts only when you choose it for a reflection." />
        <EchoCard title="No facial trend available" description="ECHO has not produced an aggregate facial analysis for this account.">
          <div className="flex gap-3 text-sm leading-6 text-muted-foreground">
            <Shield className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <p>Camera access is never started from this page. You can choose facial capture while writing a reflection, and its availability depends on the analysis service.</p>
          </div>
        </EchoCard>
        <PrivacyNotice />
      </div>
    </VerifiedFeatureGate>
  );
}
