"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Activity, BookOpen, HeartHandshake, ShieldCheck } from "lucide-react";
import { ROUTES } from "@/config/routes.config";
import { AppShell } from "@/shared/components/layout/echo-shells";
import { ProfessionalSupportHeader } from "../components/professional-support-header";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { EchoSkeleton } from "@/shared/components/ui/echo-skeleton";
import { normalizeError } from "@/shared/errors/normalize-error";
import { professionalApi, type Organization } from "@/services/professionals/professional-api";
import { experienceApi } from "@/services/experience/experience-api";
import type { Phq8Assessment } from "@echo/contracts";
import { ProfessionalSupportNav } from "../components/professional-support-nav";

interface JournalChoice {
  id: string;
  title: string;
  createdAt: string;
}

export function SupportRequestView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const submissionId = useRef<string | null>(null);
  const [organizations, setOrganizations] = useState<Organization[] | null>(null);
  const [journals, setJournals] = useState<JournalChoice[] | null>(null);
  const [journalError, setJournalError] = useState(false);
  const [organizationId, setOrganizationId] = useState("");
  const [summary, setSummary] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [journalIds, setJournalIds] = useState<string[]>([]);
  const [phq8, setPhq8] = useState<Phq8Assessment[]>([]);
  const [phq8Ids, setPhq8Ids] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void professionalApi
      .organizations()
      .then(({ organizations: items }) => {
        if (!active) return;
        setOrganizations(items);
        const requested = searchParams.get("organization");
        setOrganizationId(items.some((item) => item.id === requested) ? requested! : items[0]?.id ?? "");
      })
      .catch((reason) => {
        if (active) {
          setOrganizations([]);
          setError(normalizeError(reason).userMessage);
        }
      });
    void professionalApi
      .journalChoices()
      .then((items) => {
        if (active) setJournals(items);
      })
      .catch(() => {
        if (active) {
          setJournals([]);
          setJournalError(true);
        }
      });
    void experienceApi.getWellnessStatus().then((status) => { if (active) setPhq8(status.assessment.history); }).catch(() => { if (active) setPhq8([]); });
    return () => {
      active = false;
    };
  }, [searchParams]);

  function toggleJournal(id: string) {
    setJournalIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : current.length < 3 ? [...current, id] : current,
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId || !consent || summary.trim().length < 20) return;
    setBusy(true);
    setError("");
    try {
      const result = await professionalApi.createRequest({
        submissionId: submissionId.current ??= crypto.randomUUID(),
        organizationId,
        preferredProfileId: searchParams.get("organization") === organizationId ? searchParams.get("practitioner") : null,
        summary: summary.trim(),
        preferredTime: preferredTime.trim(),
        journalIds,
        phq8Ids,
        consent: true,
      });
      router.push(ROUTES.professionalSupport.request(result.request.id));
    } catch (reason) {
      setError(normalizeError(reason).userMessage);
      setBusy(false);
    }
  }

  const selected = organizations?.find((item) => item.id === organizationId);
  return (
    <AppShell>
      <ProfessionalSupportNav />
      <ProfessionalSupportHeader
        title="Reach a professional"
        description="Choose an approved organization, write your own request, and decide what to share. This is for scheduled support, not emergency response."
        action={
          <Link href={ROUTES.professionalSupport.requests} className="text-sm font-semibold text-primary underline">
            My requests
          </Link>
        }
      />
      {organizations === null ? (
        <div role="status" aria-busy="true" className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_310px]">
          <span className="sr-only">Loading organizations</span>
          <EchoSkeleton variant="rectangular" className="h-[620px] w-full" />
          <EchoSkeleton variant="rectangular" className="h-56 w-full" />
        </div>
      ) : organizations.length === 0 ? (
        <div className="rounded-3xl border border-border bg-card p-8">
          <HeartHandshake className="mb-4 text-primary" />
          <h2 className="text-2xl [font-family:var(--font-echo-display)]">
            No partner organizations are accepting requests yet
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You can still use ECHO&apos;s reviewed support directory.
          </p>
          <Link href="/support/find-help" className="mt-4 inline-block font-semibold text-primary underline">
            Find other support
          </Link>
        </div>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_310px]">
          <form
            onSubmit={(event) => void submit(event)}
            className="space-y-6 rounded-3xl border border-border/70 bg-card p-5 shadow-subtle sm:p-8"
          >
            <div>
              <label htmlFor="support-organization" className="block text-sm font-semibold">
                1. Choose an organization
              </label>
              <select
                id="support-organization"
                required
                className="echo-input mt-2"
                value={organizationId}
                onChange={(event) => setOrganizationId(event.target.value)}
              >
                {organizations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              {selected ? (
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {selected.description}{" "}
                  {selected.serviceHours
                    ? `Service hours: ${selected.serviceHours}`
                    : "Check availability with the organization."}
                </p>
              ) : null}
            </div>
            <div>
              <label htmlFor="support-summary" className="block text-sm font-semibold">
                2. What would you like help with?
              </label>
              <textarea
                id="support-summary"
                required
                minLength={20}
                maxLength={4000}
                rows={7}
                className="echo-input mt-2 resize-y"
                placeholder="Write only what you feel ready to share with this organization."
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
              />
              <p className="mt-1 text-right text-xs text-muted-foreground">{summary.length}/4000</p>
            </div>
            <div>
              <label htmlFor="support-time" className="block text-sm font-semibold">
                3. When are you available? <span className="font-normal text-muted-foreground">Optional</span>
              </label>
              <input
                id="support-time"
                maxLength={240}
                className="echo-input mt-2"
                placeholder="For example, weekday afternoons"
                value={preferredTime}
                onChange={(event) => setPreferredTime(event.target.value)}
              />
            </div>
            <fieldset className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <legend className="px-1 text-sm font-semibold">4. Share journal entries? Optional</legend>
              <p className="mb-3 text-xs leading-5 text-muted-foreground">
                Your journal stays private by default. If you choose entries, ECHO shares an encrypted snapshot of those
                entries as they are now. Choose up to three.
              </p>
              {journals === null ? (
                <div role="status" aria-busy="true" className="space-y-2">
                  <span className="sr-only">Loading journal choices</span>
                  <EchoSkeleton variant="rectangular" className="h-11 w-full" />
                  <EchoSkeleton variant="rectangular" className="h-11 w-full" />
                </div>
              ) : journalError ? (
                <p className="text-xs text-muted-foreground">
                  Journal choices could not be loaded. You can continue without them.
                </p>
              ) : journals.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No saved entries available to select. You can continue without them.
                </p>
              ) : (
                <div className="max-h-44 space-y-2 overflow-y-auto">
                  {journals.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-start gap-3 rounded-xl border border-border/70 bg-card p-3 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="mt-1 accent-primary"
                        checked={journalIds.includes(item.id)}
                        disabled={!journalIds.includes(item.id) && journalIds.length >= 3}
                        onChange={() => toggleJournal(item.id)}
                      />
                      <span>
                        <BookOpen size={14} className="mr-1 inline text-primary" aria-hidden="true" />
                        {item.title || "Untitled reflection"}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
            <fieldset className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <legend className="px-1 text-sm font-semibold">5. Share PHQ-8 check-ins? Optional</legend>
              <p className="mb-3 text-xs leading-5 text-muted-foreground">Only the score, severity band, and completion date are copied. Raw answers are never included. Choose up to three.</p>
              {phq8.length === 0 ? <p className="text-xs text-muted-foreground">No completed check-ins are available.</p> : <div className="space-y-2">{phq8.slice(0, 8).map((item) => <label key={item.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-sm"><input type="checkbox" className="accent-primary" checked={phq8Ids.includes(item.id)} disabled={!phq8Ids.includes(item.id) && phq8Ids.length >= 3} onChange={() => setPhq8Ids((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : current.length < 3 ? [...current, item.id] : current)} /><Activity size={15} className="text-primary" /><span>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(item.completedAt))} · {item.severity.replaceAll("_", " ")}</span></label>)}</div>}
            </fieldset>
            <label className="flex items-start gap-3 rounded-2xl bg-secondary/50 p-4 text-sm leading-6">
              <input
                type="checkbox"
                required
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                className="mt-1.5 accent-primary"
              />
              <span>
                I agree to share this request, {journalIds.length} journal {journalIds.length === 1 ? "snapshot" : "snapshots"}, and {phq8Ids.length} minimized PHQ-8 {phq8Ids.length === 1 ? "result" : "results"} with <strong>{selected?.name}</strong> for support.
                Sharing ends after 30 days or when I stop it. Buddy conversations, facial data, and AI analysis are not
                included.
              </span>
            </label>
            {error ? (
              <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm">
                {error}
              </p>
            ) : null}
            <EchoButton
              type="submit"
              isLoading={busy}
              loadingText="Sending request"
              disabled={!organizationId || !consent || summary.trim().length < 20}
            >
              Send support request
            </EchoButton>
          </form>
          <aside className="rounded-3xl border border-primary/15 bg-secondary/60 p-5 text-sm leading-6 text-foreground">
            <ShieldCheck className="mb-3 text-primary" aria-hidden="true" />
            <h2 className="text-xl [font-family:var(--font-echo-display)]">You control what is shared</h2>
            <p className="mt-2 text-muted-foreground">
              Only a professional assigned to your case can open the message or selected journal snapshots. You can stop
              future access to them from your request page. Professional notes may be kept under the organization&apos;s
              approved record policy.
            </p>
            <Link href="/crisis" className="mt-4 inline-block font-semibold text-primary underline">
              Need urgent help now?
            </Link>
          </aside>
        </div>
      )}
    </AppShell>
  );
}
