"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SecureGoogleLoginButton } from "../components/secure-google-login-button";
import { useLoginViewModel } from "../view-model/use-login-view-model";
import { verificationApi } from "@/services/verification/verification-api";
import { useState } from "react";
export function LoginView({
  title,
  description,
  admin = false,
}: {
  title: string;
  description: string;
  admin?: boolean;
}) {
  const router = useRouter(),
    params = useSearchParams(),
    vm = useLoginViewModel();
  const [accessError, setAccessError] = useState<string | null>(null);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const session = await vm.submit();
    if (!session) return;
    if (admin) {
      try {
        if (!(await verificationApi.reviewerAccess()).canReview) {
          setAccessError("This account does not have administrator access.");
          return;
        }
      } catch {
        setAccessError("Administrator access could not be checked. Try signing in again.");
        return;
      }
    }
    router.replace(admin ? "/admin/verifications" : "/dashboard");
    router.refresh();
  }
  const busy = vm.status === "submitting";
  return (
    <section className="w-full max-w-md space-y-5 rounded-3xl border bg-card p-7 shadow-lg">
      <header>
        <p className="text-sm text-primary">Your ECHO space</p>
        <h1 className="mt-2 font-serif text-4xl">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{description}</p>
      </header>
      {!admin && <SecureGoogleLoginButton />}
      <p className="text-sm">Sign in securely with a code sent to your email. No password is needed.</p>
      {params.get("confirmed") === "1" && (
        <p role="status">Your email is confirmed. Request a sign-in code below to continue.</p>
      )}
      {params.get("error") && (
        <p role="alert">Please sign in again to continue. If you just registered, confirm your email first.</p>
      )}
      <form onSubmit={submit} className="space-y-4" aria-busy={busy}>
        {(vm.error || accessError) && (
          <p role="alert" className="rounded-xl border p-3 text-sm">
            {accessError || vm.error?.message}
          </p>
        )}
        <label className="block text-sm font-medium">
          {admin ? "Admin email" : "Email address"}
          <input
            type="email"
            autoComplete="email"
            required
            value={vm.email}
            disabled={busy || vm.sent}
            onChange={(e) => vm.setEmail(e.target.value)}
            className="mt-2 block min-h-12 w-full rounded-xl border bg-background px-3"
          />
        </label>
        {vm.sent && (
          <>
            <p role="status" className="text-sm">
              If this account can sign in, a code has been sent. Check your inbox and spam folder.
            </p>
            <label className="block text-sm font-medium">
              Email sign-in code
              <input
                autoFocus
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={vm.code}
                disabled={busy}
                onChange={(e) => vm.setCode(e.target.value.replace(/\D/g, ""))}
                aria-describedby="code-help"
                className="mt-2 block min-h-12 w-full rounded-xl border bg-background px-3 text-xl tracking-widest"
              />
            </label>
            <p id="code-help" className="text-xs">
              Enter all six digits. Codes expire; request a new one if yours no longer works.
            </p>
          </>
        )}
        <button
          type="submit"
          disabled={busy || vm.status === "success"}
          className="echo-button-primary min-h-12 w-full"
        >
          {busy ? "Please wait…" : vm.sent ? "Verify code and sign in" : "Send sign-in code"}
        </button>
        {vm.sent && (
          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              disabled={busy || vm.cooldown > 0}
              onClick={() => void vm.sendCode()}
              className="min-h-11 underline"
            >
              {vm.cooldown > 0 ? "Resend in " + vm.cooldown + "s" : "Resend code"}
            </button>
            <button type="button" disabled={busy} onClick={vm.changeEmail} className="min-h-11 underline">
              Change email
            </button>
          </div>
        )}
      </form>
      <p className="text-xs text-muted-foreground">Private by design. ECHO is not a diagnostic tool.</p>
      <Link href="/signup" className="block underline">
        Create an account
      </Link>
      <Link href="/crisis" className="block underline">
        Get immediate support
      </Link>
    </section>
  );
}
