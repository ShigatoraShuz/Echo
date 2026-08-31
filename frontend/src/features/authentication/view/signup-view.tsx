"use client";

import { useEffect, useState } from "react";
import { PolicyReviewDialog } from "../components/policy-review-dialog";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Eye,
  EyeOff,
  FileText,
  Leaf,
  Loader2,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { registrationApi, type PolicyDocument } from "@/services/authentication/registration-api";
import { EchoReveal } from "@/shared/components/react-bits/echo-reveal";
import { SecureGoogleSignupButton } from "../components/secure-google-signup-button";

interface SignupViewProps {
  title: string;
  description: string;
}
const steps = ["Eligibility", "Agreements", "Account", "Verify & finish"];

export function SignupView({ title, description }: SignupViewProps) {
  const [step, setStep] = useState(0);
  const [birthday, setBirthday] = useState("");
  const [policies, setPolicies] = useState<PolicyDocument[]>([]);
  const [reviewed, setReviewed] = useState<string[]>([]);
  const [activePolicy, setActivePolicy] = useState<PolicyDocument | null>(null);
  const [optionalAi, setOptionalAi] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const passwordValid = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password);
  const allReviewed = policies.length === 3 && policies.every((policy) => reviewed.includes(policy.id));

  useEffect(() => {
    if (step === 1 && policies.length === 0)
      registrationApi
        .policies()
        .then(setPolicies)
        .catch((reason) => setError(reason.message));
  }, [step, policies.length]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  const continueEligibility = () =>
    run(async () => {
      const result = await registrationApi.eligibility(birthday);
      if (!result.eligible) {
        setError("ECHO accounts are available only to people aged 18 or older.");
        return;
      }
      setStep(1);
    });
  const continueAgreements = () =>
    run(async () => {
      if (!allReviewed) throw new Error("Review all three documents before continuing.");
      await registrationApi.agreements({
        reviewedDocumentIds: reviewed,
        termsAccepted: true,
        privacyAccepted: true,
        aiNoticeAccepted: true,
        optionalAiAnalysis: optionalAi,
      });
      setStep(2);
    });
  const createAccount = () =>
    run(async () => {
      if (!passwordValid) throw new Error("Use at least 8 characters with lowercase, uppercase, and a number.");
      if (password !== confirmPassword) throw new Error("Passwords do not match.");
      await registrationApi.email({ email, password, confirmPassword });
      setPassword("");
      setConfirmPassword("");
      setStep(3);
    });

  return (
    <EchoReveal direction="down" duration={260}>
      <div className="w-full max-w-[42rem] py-4 text-[#263226] [font-family:var(--font-echo-sans)] sm:py-6">
        <header className="mb-7">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-2xl bg-[#526f35] text-white shadow-[0_12px_30px_rgba(48,75,35,.24)]">
              <Leaf className="size-5" />
            </span>
            <span className="text-sm font-black tracking-[0.16em]">ECHO</span>
          </div>
          <h1 className="mt-6 text-[clamp(2.25rem,5vw,3.7rem)] leading-[.95] tracking-[-.045em] [font-family:var(--font-echo-display)]">
            {title}
          </h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-[#697168]">{description}</p>
        </header>
        <nav
          aria-label="Signup progress"
          className="mb-8 rounded-[1.35rem] border border-[#526f3514] bg-white/45 p-4 shadow-[0_12px_34px_rgba(38,50,38,.055)] backdrop-blur-sm"
        >
          <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-[#dfe4d5]">
            <div
              className="h-full rounded-full bg-[#526f35] transition-[width] duration-200 ease-[cubic-bezier(.23,1,.32,1)] motion-reduce:transition-none"
              style={{ width: `${((step + 1) / 4) * 100}%` }}
            />
          </div>
          <ol className="grid grid-cols-4 gap-2">
            {steps.map((label, index) => (
              <li
                key={label}
                className={`text-[11px] font-bold sm:text-xs ${index <= step ? "text-[#43602d]" : "text-[#92988e]"}`}
              >
                <span className="mr-1.5">{index + 1}</span>
                <span className="hidden sm:inline">{label}</span>
              </li>
            ))}
          </ol>
        </nav>
        <section
          aria-live="polite"
          className="rounded-[2rem] border border-[#526f3524] bg-white/82 p-5 shadow-[0_28px_80px_rgba(38,50,38,.14),0_3px_12px_rgba(38,50,38,.06)] backdrop-blur-xl sm:p-8"
        >
          {error && (
            <div
              role="alert"
              className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {error}
            </div>
          )}
          {step === 0 && (
            <div>
              <p className="eyebrow">Step 1 · Eligibility</p>
              <h2 className="mt-2 text-3xl [font-family:var(--font-echo-display)]">First, confirm your age</h2>
              <p className="mt-2 text-sm leading-6 text-[#697168]">
                ECHO is for adults aged 18 and over. Your birthday is used only for this check and is not retained after
                verification.
              </p>
              <label className="mt-7 block text-sm font-bold">
                Birthday
                <div className="relative mt-2">
                  <CalendarDays className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#58743b]" />
                  <input
                    type="date"
                    required
                    value={birthday}
                    onChange={(event) => setBirthday(event.target.value)}
                    className="auth-wizard-input pl-12"
                  />
                </div>
              </label>
              <button onClick={continueEligibility} disabled={!birthday || busy} className="auth-primary">
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
            <div>
              <p className="eyebrow">Step 2 · Agreements</p>
              <h2 className="mt-2 text-3xl [font-family:var(--font-echo-display)]">
                Know what you&apos;re agreeing to
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#697168]">
                Open each document and reach the end before acknowledging it.
              </p>
              <div className="mt-6 grid gap-3">
                {policies.map((policy) => {
                  const done = reviewed.includes(policy.id);
                  return (
                    <article
                      key={policy.id}
                      className="flex items-center gap-4 rounded-2xl border border-[#526f3525] bg-[#fffdf8] p-4 shadow-[0_10px_28px_rgba(38,50,38,.065)] transition-[transform,box-shadow,border-color] duration-200 ease-[cubic-bezier(.23,1,.32,1)] hover:-translate-y-0.5 hover:border-[#526f3540] hover:shadow-[0_16px_38px_rgba(38,50,38,.10)]"
                    >
                      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#edf2e4] text-[#526f35]">
                        <FileText className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold">{policy.title}</h3>
                        <p className="mt-1 text-xs leading-5 text-[#697168]">{policy.summary}</p>
                        <p className="mt-1 text-[11px] text-[#7c8378]">
                          Version {policy.version} · {new Date(policy.effective_at).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => setActivePolicy(policy)}
                        className="h-11 shrink-0 rounded-full border border-[#526f3540] px-4 text-sm font-bold text-[#526f35] active:scale-[.97]"
                      >
                        {done ? "Reviewed" : "Review"}
                      </button>
                    </article>
                  );
                })}
              </div>
              <label className="mt-5 flex cursor-pointer gap-3 rounded-2xl bg-[#eef3e7] p-4 text-sm leading-6">
                <input
                  type="checkbox"
                  checked={optionalAi}
                  onChange={(event) => setOptionalAi(event.target.checked)}
                  className="mt-1 size-5 accent-[#526f35]"
                />
                <span>
                  <strong>Optional:</strong> Enable AI analysis for journal entries I explicitly choose to analyze.
                  <span className="block text-xs text-[#697168]">
                    Declining does not prevent account creation or normal journaling.
                  </span>
                </span>
              </label>
              <div className="mt-6 flex gap-3">
                <button onClick={() => setStep(0)} className="auth-back">
                  <ArrowLeft className="size-4" />
                </button>
                <button onClick={continueAgreements} disabled={!allReviewed || busy} className="auth-primary mt-0">
                  Continue <ArrowRight className="size-4" />
                </button>
              </div>
            </div>
          )}
          {step === 2 && (
            <div>
              <p className="eyebrow">Step 3 · Account</p>
              <h2 className="mt-2 text-3xl [font-family:var(--font-echo-display)]">Create your private account</h2>
              <p className="mt-2 text-sm text-[#697168]">Choose Google or create an account with email.</p>
              <SecureGoogleSignupButton />
              <div className="my-5 flex items-center gap-3 text-xs text-[#7b8278]">
                <span className="h-px flex-1 bg-[#526f3520]" />
                or continue with email
                <span className="h-px flex-1 bg-[#526f3520]" />
              </div>
              <label className="mt-6 block text-sm font-bold">
                Email address
                <div className="relative mt-2">
                  <Mail className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#58743b]" />
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="auth-wizard-input pl-12"
                  />
                </div>
              </label>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-bold">
                  Password
                  <div className="relative mt-2">
                    <input
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="auth-wizard-input pr-12"
                    />
                    <button
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword(!showPassword)}
                      type="button"
                      className="absolute right-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center"
                    >
                      {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                    </button>
                  </div>
                </label>
                <label className="text-sm font-bold">
                  Confirm password
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="auth-wizard-input mt-2"
                  />
                </label>
              </div>
              <ul className="mt-4 grid gap-1 text-xs text-[#697168] sm:grid-cols-2">
                <li>• At least 8 characters</li>
                <li>• One lowercase letter</li>
                <li>• One uppercase letter</li>
                <li>• One number</li>
              </ul>
              <div className="mt-6 flex gap-3">
                <button onClick={() => setStep(1)} className="auth-back">
                  <ArrowLeft className="size-4" />
                </button>
                <button
                  onClick={createAccount}
                  disabled={!email || !passwordValid || password !== confirmPassword || busy}
                  className="auth-primary mt-0"
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      Create account <ArrowRight className="size-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="py-5 text-center">
              <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#e7efdc] text-[#526f35]">
                <Mail className="size-7" />
              </span>
              <p className="eyebrow mt-5">Step 4 · Verify & finish</p>
              <h2 className="mt-2 text-4xl [font-family:var(--font-echo-display)]">Check your inbox</h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-[#697168]">
                We sent a verification link to <strong>{email}</strong>. Verify your email, then log in to continue to
                your preferred name and private onboarding.
              </p>
              <Link
                href="/login"
                className="mt-7 inline-flex h-12 items-center gap-2 rounded-full bg-[#526f35] px-7 font-bold text-white"
              >
                Go to log in <ArrowRight className="size-4" />
              </Link>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await registrationApi.resend();
                    setNotice("A fresh verification link has been sent.");
                  })
                }
                className="mx-auto mt-3 flex h-11 items-center justify-center rounded-full px-5 text-sm font-bold text-[#526f35] underline disabled:opacity-50"
              >
                Resend verification email
              </button>
              {notice && (
                <p role="status" className="mt-2 text-sm font-semibold text-[#526f35]">
                  {notice}
                </p>
              )}
            </div>
          )}
        </section>
        <p className="mt-5 text-center text-sm text-[#697168]">
          Already have an account?{" "}
          <Link href="/login" className="font-bold text-[#526f35] underline">
            Log in
          </Link>
        </p>
        <Link
          href="/admin-login"
          className="mx-auto mt-4 flex min-h-12 w-full max-w-sm items-center justify-center gap-2 rounded-full border border-[#526f3540] bg-white/60 px-5 text-sm font-bold text-[#526f35] transition-colors hover:bg-[#edf2e4] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#526f3530] active:scale-[.98]"
        >
          <ShieldCheck className="size-4" aria-hidden="true" />
          Sign as an admin
        </Link>
        {activePolicy && (
          <PolicyReviewDialog
            key={activePolicy.id}
            policy={activePolicy}
            onAcknowledge={(id) => setReviewed((current) => (current.includes(id) ? current : [...current, id]))}
            onClose={() => setActivePolicy(null)}
          />
        )}
      </div>
    </EchoReveal>
  );
}
