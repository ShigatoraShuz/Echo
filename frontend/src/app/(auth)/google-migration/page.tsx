import Link from "next/link";
import { SecureGoogleLoginButton } from "@/features/authentication/components/secure-google-login-button";

export const metadata = { title: "Move your Google account to email — ECHO" };

export default function GoogleMigrationPage() {
  return (
    <section className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-soft sm:p-8">
      <p className="text-xs font-bold uppercase tracking-widest text-primary">Existing accounts only</p>
      <h1 className="mt-3 text-3xl font-semibold text-foreground">Move your account to email</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Sign in to your existing Google-linked ECHO account once. Then open Security settings to set and verify email access. Your profile and data will stay on the same account.
      </p>
      <div className="mt-6">
        <SecureGoogleLoginButton successPath="/settings/security" />
      </div>
      <Link href="/login" className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-4">
        Back to email sign-in
      </Link>
    </section>
  );
}
