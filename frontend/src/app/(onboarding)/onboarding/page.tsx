"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Leaf,
  Loader2,
  LogOut,
  MessageCircle,
  ShieldCheck,
  Wind,
} from "lucide-react";
import { getOnboardingService } from "@/services/onboarding/onboarding-service.factory";
import { createBrowserSupabaseClient } from "@/infrastructure/supabase/browser-client";

type Gender = "woman" | "man" | "non_binary" | "self_describe" | "prefer_not_to_say" | null;
type Pronouns = "she_her" | "he_him" | "they_them" | "use_my_name" | "self_describe" | "prefer_not_to_say" | null;
const genderOptions: Array<[Exclude<Gender, null>, string]> = [
  ["woman", "Woman"],
  ["man", "Man"],
  ["non_binary", "Non-binary"],
  ["self_describe", "Self-describe"],
  ["prefer_not_to_say", "Prefer not to say"],
];
const pronounOptions: Array<[Exclude<Pronouns, null>, string]> = [
  ["she_her", "She/her"],
  ["he_him", "He/him"],
  ["they_them", "They/them"],
  ["use_my_name", "Use my name"],
  ["self_describe", "Self-describe"],
  ["prefer_not_to_say", "Prefer not to say"],
];

export default function OnboardingPage() {
  const router = useRouter();
  const service = getOnboardingService();
  const [step, setStep] = useState(0);
  const [preferredName, setPreferredName] = useState("");
  const [gender, setGender] = useState<Gender>(null);
  const [genderText, setGenderText] = useState("");
  const [pronouns, setPronouns] = useState<Pronouns>(null);
  const [pronounText, setPronounText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    service.getStatus().then((result) => {
      if (!result.success) return;
      if (result.data.onboardingCompleted) return router.replace("/dashboard");
      setStep(Math.min(result.data.onboardingStep ?? 0, 2));
      setPreferredName(result.data.preferredName ?? result.data.displayName ?? "");
      setGender((result.data.genderIdentity as Gender) ?? null);
      setGenderText(result.data.genderSelfDescription ?? "");
      setPronouns((result.data.pronouns as Pronouns) ?? null);
      setPronounText(result.data.pronounsSelfDescription ?? "");
    });
  }, [router, service]);
  async function saveName() {
    setBusy(true);
    setError(null);
    const result = await service.saveProfile({
      displayName: preferredName.trim(),
      preferredName: preferredName.trim(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      goals: "",
      buddyTone: "gentle",
    });
    setBusy(false);
    if (!result.success) return setError(result.error.message);
    setStep(1);
  }
  async function saveIdentity() {
    setBusy(true);
    setError(null);
    const result = await service.saveSetup({
      theme: "system",
      notifications: false,
      genderIdentity: gender,
      genderSelfDescription: gender === "self_describe" ? genderText : null,
      pronouns,
      pronounsSelfDescription: pronouns === "self_describe" ? pronounText : null,
    });
    setBusy(false);
    if (!result.success) return setError(result.error.message);
    setStep(2);
  }
  async function finish() {
    setBusy(true);
    const result = await service.completeOnboarding();
    setBusy(false);
    if (!result.success) return setError(result.error.message);
    router.replace("/dashboard");
    router.refresh();
  }
  async function signOut() {
    await createBrowserSupabaseClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }
  const progress = ((step + 1) / 3) * 100;
  return (
    <main className="grid min-h-[100svh] place-items-center bg-[radial-gradient(circle_at_top_left,#eff5e7,#fbf8f1_45%,#e4ead9)] p-3 sm:p-6">
      <section
        aria-labelledby="onboarding-title"
        className="flex max-h-[94svh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border border-[#526f3525] bg-[#fffdf8] shadow-[0_32px_100px_rgba(30,50,35,.18)]"
      >
        <header className="border-b border-[#526f3520] px-5 py-5 sm:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-[#526f35] text-white">
                <Leaf className="size-5" />
              </span>
              <strong className="tracking-[.14em]">ECHO</strong>
            </div>
            <button
              onClick={signOut}
              className="flex h-11 items-center gap-2 rounded-full border border-[#526f3530] px-4 text-sm font-bold text-[#526f35]"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </div>
          <div className="mt-5 h-1.5 rounded-full bg-[#e2e7d9]">
            <div
              className="h-full rounded-full bg-[#526f35] transition-[width] duration-200 motion-reduce:transition-none"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-xs font-bold text-[#677062]">Step {step + 1} of 3</p>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-7 sm:px-8 sm:py-9">
          {error && (
            <p role="alert" className="mb-5 rounded-2xl bg-red-50 p-4 text-sm text-red-800">
              {error}
            </p>
          )}
          {step === 0 && (
            <div className="mx-auto max-w-xl">
              <p className="eyebrow">A personal welcome</p>
              <h1
                id="onboarding-title"
                className="mt-2 text-4xl tracking-[-.03em] [font-family:var(--font-echo-display)]"
              >
                How should ECHO address you?
              </h1>
              <p className="mt-3 text-sm leading-7 text-[#667064]">
                This can be your first name, nickname, or any name you would like ECHO to use.
              </p>
              <label className="mt-7 block text-sm font-bold">
                Preferred name
                <input
                  autoFocus
                  value={preferredName}
                  onChange={(e) => setPreferredName(e.target.value)}
                  maxLength={80}
                  className="auth-wizard-input mt-2"
                  placeholder="The name that feels right"
                />
              </label>
              <button onClick={saveName} disabled={!preferredName.trim() || busy} className="auth-primary w-full">
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    Continue <ArrowRight className="size-4" />
                  </>
                )}
              </button>
            </div>
          )}
          {step === 1 && (
            <div className="mx-auto max-w-2xl">
              <p className="eyebrow">Optional · About you</p>
              <h1 id="onboarding-title" className="mt-2 text-4xl [font-family:var(--font-echo-display)]">
                Help ECHO address you respectfully
              </h1>
              <p className="mt-3 text-sm leading-7 text-[#667064]">
                These details are optional and can be changed later in Settings. ECHO never infers them from your name
                or Google account.
              </p>
              <fieldset className="mt-7">
                <legend className="text-sm font-bold">
                  Gender identity <span className="font-normal text-[#7b8278]">(optional)</span>
                </legend>
                <div className="mt-3 flex flex-wrap gap-2">
                  {genderOptions.map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={gender === value}
                      onClick={() => setGender(value)}
                      className={`min-h-11 rounded-full border px-4 text-sm font-bold ${gender === value ? "border-[#526f35] bg-[#526f35] text-white" : "border-[#526f3530]"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {gender === "self_describe" && (
                  <input
                    value={genderText}
                    onChange={(e) => setGenderText(e.target.value)}
                    maxLength={80}
                    className="auth-wizard-input mt-3"
                    aria-label="Describe your gender identity"
                  />
                )}
              </fieldset>
              <fieldset className="mt-7">
                <legend className="text-sm font-bold">
                  Pronouns <span className="font-normal text-[#7b8278]">(optional)</span>
                </legend>
                <div className="mt-3 flex flex-wrap gap-2">
                  {pronounOptions.map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={pronouns === value}
                      onClick={() => setPronouns(value)}
                      className={`min-h-11 rounded-full border px-4 text-sm font-bold ${pronouns === value ? "border-[#526f35] bg-[#526f35] text-white" : "border-[#526f3530]"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {pronouns === "self_describe" && (
                  <input
                    value={pronounText}
                    onChange={(e) => setPronounText(e.target.value)}
                    maxLength={80}
                    className="auth-wizard-input mt-3"
                    aria-label="Describe your pronouns"
                  />
                )}
              </fieldset>
              <p className="mt-7 flex gap-2 rounded-2xl bg-[#edf2e7] p-4 text-xs leading-6 text-[#596255]">
                <ShieldCheck className="mt-1 size-4 shrink-0 text-[#526f35]" />
                These details help ECHO address you respectfully. You can change them later in Settings.
              </p>
              <div className="mt-6 flex gap-3">
                <button onClick={() => setStep(0)} className="auth-back">
                  <ArrowLeft className="size-4" />
                </button>
                <button onClick={saveIdentity} disabled={busy} className="auth-primary mt-0">
                  {gender === null && pronouns === null ? "Skip for now" : "Continue"}
                  <ArrowRight className="size-4" />
                </button>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="mx-auto max-w-3xl text-center">
              <p className="eyebrow">Welcome to ECHO</p>
              <h1 id="onboarding-title" className="mt-2 text-5xl [font-family:var(--font-echo-display)]">
                A quieter space for reflection
              </h1>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[#667064]">
                Begin wherever feels useful. Every feature stays grounded in your choices.
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {[
                  [BookOpen, "Journal", "Privately write and reflect."],
                  [MessageCircle, "Buddy", "Receive supportive conversation."],
                  [Wind, "Grounding", "Access calming check-ins and exercises."],
                ].map(([Icon, title, copy]) => (
                  <article
                    key={String(title)}
                    className="rounded-[1.5rem] border border-[#526f3525] bg-white p-5 text-left"
                  >
                    <span className="grid size-11 place-items-center rounded-xl bg-[#eaf0e2] text-[#526f35]">
                      <Icon className="size-5" />
                    </span>
                    <h2 className="mt-5 text-xl font-bold">{title as string}</h2>
                    <p className="mt-2 text-sm leading-6 text-[#697168]">{copy as string}</p>
                  </article>
                ))}
              </div>
              <button onClick={finish} disabled={busy} className="auth-primary mx-auto mt-8 max-w-sm">
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <Check className="size-4" />
                    Enter my ECHO space
                  </>
                )}
              </button>
              <button onClick={() => setStep(1)} className="mt-4 text-sm font-bold text-[#526f35] underline">
                Back
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
