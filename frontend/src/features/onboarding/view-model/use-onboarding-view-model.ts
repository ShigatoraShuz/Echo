"use client";
import { useState, useCallback } from "react";
import type { OnboardingData } from "../model/onboarding.model";

const STEPS = [
  { id: 0, label: "Consent" },
  { id: 1, label: "Profile" },
  { id: 2, label: "Setup" },
  { id: 3, label: "Complete" },
];

export function useOnboardingViewModel() {
  const [data, setData] = useState<OnboardingData>({
    consent: { terms: false, privacy: false, dataProcessing: false, aiInformation: false, journalAnalysis: false },
    profile: { displayName: "", timezone: "UTC", goals: "", buddyTone: "gentle" },
    setup: { theme: "system", notifications: true },
    currentStep: 0,
  });

  const nextStep = useCallback(() => {
    setData((prev) => ({ ...prev, currentStep: Math.min(prev.currentStep + 1, STEPS.length - 1) }));
  }, []);

  const prevStep = useCallback(() => {
    setData((prev) => ({ ...prev, currentStep: Math.max(prev.currentStep - 1, 0) }));
  }, []);

  const updateConsent = useCallback((key: string, value: boolean) => {
    setData((prev) => ({ ...prev, consent: { ...prev.consent, [key]: value } }));
  }, []);

  const updateProfile = useCallback((updates: Partial<OnboardingData["profile"]>) => {
    setData((prev) => ({ ...prev, profile: { ...prev.profile, ...updates } }));
  }, []);

  const updateSetup = useCallback((updates: Partial<OnboardingData["setup"]>) => {
    setData((prev) => ({ ...prev, setup: { ...prev.setup, ...updates } }));
  }, []);

  return { ...data, steps: STEPS, nextStep, prevStep, updateConsent, updateProfile, updateSetup };
}
