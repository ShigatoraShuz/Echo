import Link from "next/link";
import { MessageSquareText, PhoneCall, ShieldAlert } from "lucide-react";

export default function CrisisPage() {
  return (
    <main className="min-h-screen bg-crisis-soft text-foreground">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-4 py-10 sm:px-6">
        <div className="rounded-[2rem] border border-danger/30 bg-card p-6 shadow-soft sm:p-8 lg:p-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-crisis text-danger-foreground">
            <ShieldAlert className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="mt-6 font-serif text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">
            You&apos;re not alone.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            If you might hurt yourself or someone else, call emergency services now. ECHO is not a diagnostic tool or crisis monitor.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <a href="tel:988" className="echo-button-primary bg-crisis text-danger-foreground hover:bg-crisis/90">
              <PhoneCall className="h-4 w-4" aria-hidden="true" />
              Call 988
            </a>
            <a href="sms:741741&body=HOME" className="echo-button-secondary">
              <MessageSquareText className="h-4 w-4" aria-hidden="true" />
              Text HOME to 741741
            </a>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Link href="/crisis-help" className="echo-button-secondary">
              View more resources
            </Link>
            <Link href="/dashboard" className="echo-button-ghost">
              Return to ECHO
            </Link>
          </div>

          <p className="mt-8 rounded-2xl border border-danger/30 bg-crisis-soft p-4 text-sm leading-6 text-muted-foreground">
            Emergency disclaimer: if there is immediate danger, call local emergency services. Crisis lines may vary by country and availability.
          </p>
        </div>
      </div>
    </main>
  );
}
