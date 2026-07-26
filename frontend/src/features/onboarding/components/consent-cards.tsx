"use client";
import { useState } from "react";

interface ConsentOption {
  key: string;
  title: string;
  description: string;
  required: boolean;
  defaultValue: boolean;
}

const CONSENT_OPTIONS: ConsentOption[] = [
  { key: "terms", title: "Terms of Service", description: "I agree to the Terms of Service", required: true, defaultValue: false },
  { key: "privacy", title: "Privacy Policy", description: "I acknowledge the Privacy Policy", required: true, defaultValue: false },
  { key: "dataProcessing", title: "Data Processing", description: "I consent to data processing for app functionality", required: true, defaultValue: false },
  { key: "aiInformation", title: "AI Feature Notice", description: "I understand AI features are non-diagnostic and non-emergency", required: true, defaultValue: false },
  { key: "journalAnalysis", title: "Journal Analysis (Optional)", description: "Allow optional AI analysis of my journal entries", required: false, defaultValue: false },
];

interface ConsentCardsProps {
  onConsentChange: (key: string, value: boolean) => void;
  consentValues: Record<string, boolean>;
}

export function ConsentCards({ onConsentChange, consentValues }: ConsentCardsProps) {
  return (
    <div className="space-y-3">
      {CONSENT_OPTIONS.map((opt) => (
        <div key={opt.key} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">{opt.title}</p>
            <p className="text-xs text-muted-foreground">{opt.description}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={consentValues[opt.key] ?? false}
            onClick={() => !opt.required && onConsentChange(opt.key, !(consentValues[opt.key] ?? false))}
            className={elative h-6 w-11 shrink-0 rounded-full transition-colors }
          >
            <span className={bsolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform } />
          </button>
        </div>
      ))}
    </div>
  );
}
