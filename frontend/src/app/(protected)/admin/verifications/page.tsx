"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  LockKeyhole,
  RefreshCw,
  ShieldAlert,
  UserRoundCheck,
  XCircle,
} from "lucide-react";
import { AppShell } from "@/shared/components/layout/echo-shells";
import { EchoButton } from "@/shared/components/ui";
import { normalizeError } from "@/shared/errors/normalize-error";
import {
  verificationApi,
  type AdminVerificationDetail,
  type AdminVerificationSummary,
  type VerificationStatus,
} from "@/shared/services/verification-api";
import { cn } from "@/lib/utils";

const filters: Array<{ value: string; label: string }> = [
  { value: "all", label: "All" },
  { value: "submitted", label: "Awaiting review" },
  { value: "under_review", label: "In review" },
  { value: "needs_changes", label: "Changes requested" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const statusStyles: Record<string, string> = {
  draft: "bg-secondary text-muted-foreground",
  submitted: "bg-[#fff0d9] text-[#7c4e13]",
  under_review: "bg-[#e1efe9] text-[#205b45]",
  needs_changes: "bg-[#fff0d9] text-[#7c4e13]",
  approved: "bg-[#dcebd7] text-[#245638]",
  rejected: "bg-crisis-soft text-danger",
  expired: "bg-secondary text-muted-foreground",
};

function statusLabel(status: VerificationStatus | string): string {
  return status.replaceAll("_", " ");
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-2xl border border-[var(--landing-primary-10)] bg-white/65 p-4">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-[var(--landing-primary)]">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold text-[var(--landing-ink)]">{value || "Not provided"}</p>
    </div>
  );
}

export default function AdminVerificationsPage() {
  const [filter, setFilter] = useState("submitted");
  const [items, setItems] = useState<AdminVerificationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminVerificationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<"approved" | "needs_changes" | "rejected">("approved");
  const [reasonCode, setReasonCode] = useState("");
  const [note, setNote] = useState("");

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await verificationApi.adminList(filter);
      setItems(next);
      setSelectedId((current) =>
        current && next.some((item) => item.id === current) ? current : next[0]?.id ?? null,
      );
    } catch (reason) {
      const normalized = normalizeError(reason);
      setForbidden(normalized.statusCode === 403 || normalized.code === "AUTHORIZATION_ERROR");
      setError(normalized.userMessage);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let active = true;
    setError(null);
    void verificationApi
      .adminDetail(selectedId)
      .then((next) => {
        if (active) setDetail(next);
      })
      .catch((reason) => {
        if (active) setError(normalizeError(reason).userMessage);
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  async function claim() {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      setDetail(await verificationApi.adminClaim(selectedId));
      await loadList();
    } catch (reason) {
      setError(normalizeError(reason).userMessage);
    } finally {
      setBusy(false);
    }
  }

  async function recordDecision() {
    if (!selectedId) return;
    if (decision !== "approved" && (!reasonCode.trim() || !note.trim())) {
      setError("Select a reason and write a helpful note for changes or rejection.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setDetail(
        await verificationApi.adminDecide(selectedId, {
          decision,
          reasonCode: decision === "approved" ? reasonCode.trim() || null : reasonCode.trim(),
          note: note.trim() || null,
        }),
      );
      setReasonCode("");
      setNote("");
      await loadList();
    } catch (reason) {
      setError(normalizeError(reason).userMessage);
    } finally {
      setBusy(false);
    }
  }

  if (forbidden) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl rounded-[2rem] border border-danger/20 bg-card p-8 text-center shadow-card">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-crisis-soft text-danger">
            <ShieldAlert className="h-7 w-7" aria-hidden="true" />
          </span>
          <h1 className="mt-5 font-serif text-3xl">Administrator access required</h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
            Verification records contain sensitive identity and guardian information. Access is granted explicitly in the database and is never inferred from browser state.
          </p>
          <Link href="/settings/verification" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" /> Return to account verification
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <header className="mb-5 overflow-hidden rounded-[2rem] border border-[var(--landing-primary-10)] bg-[linear-gradient(115deg,rgba(251,247,238,0.97),rgba(220,232,214,0.78))] p-6 shadow-card sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--landing-primary)]">Restricted administrator workspace</p>
            <h1 className="mt-2 font-serif text-4xl tracking-[-0.04em] text-[var(--landing-ink)]">Identity verification reviews</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--landing-muted)]">Review the minimum evidence needed for age and identity assurance, document the decision, and keep a clear audit trail.</p>
          </div>
          <div className="flex gap-2">
            <EchoButton type="button" variant="outline" onClick={() => void loadList()}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </EchoButton>
            <Link href="/settings/verification" className="inline-flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground">
              My verification
            </Link>
          </div>
        </div>
      </header>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1" aria-label="Application filters">
        {filters.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-xs font-bold outline-none transition-[background-color,color,transform] duration-150 focus-visible:ring-4 focus-visible:ring-primary/15 active:scale-[0.97]",
              filter === item.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-secondary",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <section className="self-start overflow-hidden rounded-[1.6rem] border border-border/65 bg-card/90 shadow-card xl:sticky xl:top-[108px]">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-semibold">Review queue</h2>
            <p className="mt-1 text-xs text-muted-foreground">{loading ? "Loading…" : `${items.length} application${items.length === 1 ? "" : "s"}`}</p>
          </div>
          <div className="max-h-[680px] overflow-y-auto p-2">
            {!loading && items.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-muted-foreground">No applications match this filter.</div>
            ) : null}
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={cn(
                  "mb-1 w-full rounded-2xl border p-4 text-left outline-none transition-[background-color,border-color,transform] duration-150 hover:bg-secondary/70 focus-visible:ring-4 focus-visible:ring-primary/15 active:scale-[0.99]",
                  selectedId === item.id ? "border-primary/30 bg-secondary" : "border-transparent",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                    <UserRoundCheck className="h-4 w-4" />
                  </span>
                  <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold capitalize", statusStyles[item.status])}>
                    {statusLabel(item.status)}
                  </span>
                </div>
                <p className="mt-3 truncate text-sm font-semibold">Applicant {item.userId.slice(0, 8)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.isMinor ? `Minor · age ${item.ageAtSubmission}` : `Adult · age ${item.ageAtSubmission}`}</p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {item.submittedAt ? new Date(item.submittedAt).toLocaleString() : "Draft application"}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="min-w-0 rounded-[1.6rem] border border-border/65 bg-card/90 p-5 shadow-card sm:p-6">
          {!detail ? (
            <div className="grid min-h-[440px] place-items-center text-center">
              <div>
                <LockKeyhole className="mx-auto h-8 w-8 text-primary" />
                <p className="mt-4 font-semibold">Select an application to begin.</p>
                <p className="mt-1 text-sm text-muted-foreground">Sensitive details are only decrypted for authorized reviewers.</p>
              </div>
            </div>
          ) : (
            <div key={detail.id} className="animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={cn("rounded-full px-3 py-1 text-[10px] font-bold capitalize", statusStyles[detail.status])}>{statusLabel(detail.status)}</span>
                    <span className="text-xs text-muted-foreground">{detail.isMinor ? "Minor path" : "Adult path"}</span>
                  </div>
                  <h2 className="mt-3 font-serif text-3xl tracking-[-0.035em]">{detail.application.legalName}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Application {detail.id}</p>
                </div>
                {detail.status === "submitted" ? (
                  <EchoButton type="button" isLoading={busy} loadingText="Claiming…" onClick={() => void claim()}>
                    <Clock3 className="h-4 w-4" /> Start review
                  </EchoButton>
                ) : null}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <DetailField label="Date of birth" value={detail.application.dateOfBirth} />
                <DetailField label="Age at submission" value={String(detail.ageAtSubmission)} />
                <DetailField label="Mobile number" value={detail.application.phoneNumber} />
                <DetailField label="Government ID type" value={detail.application.governmentIdType} />
                <DetailField label="Government ID number" value={detail.application.governmentIdNumber} />
                <DetailField label="Address" value={`${detail.application.address.line1}, ${detail.application.address.city}, ${detail.application.address.province} ${detail.application.address.postalCode}`} />
              </div>

              {detail.application.guardian ? (
                <div className="mt-5 rounded-[1.35rem] border border-primary/15 bg-secondary/50 p-5">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold">Parent or legal guardian</h3>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <DetailField label="Legal name" value={detail.application.guardian.legalName} />
                    <DetailField label="Relationship" value={detail.application.guardian.relationship} />
                    <DetailField label="Mobile number" value={detail.application.guardian.phoneNumber} />
                    <DetailField label="Email" value={detail.application.guardian.email} />
                    <DetailField label="ID type" value={detail.application.guardian.governmentIdType} />
                    <DetailField label="ID number" value={detail.application.guardian.governmentIdNumber} />
                  </div>
                </div>
              ) : null}

              <div className="mt-5">
                <h3 className="font-semibold">Protected evidence</h3>
                <p className="mt-1 text-xs text-muted-foreground">Links expire after five minutes. Do not download or copy documents unless an approved review procedure requires it.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {detail.documents.map((document) => (
                    <a
                      key={document.id}
                      href={document.signedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex items-center gap-3 rounded-2xl border border-border bg-background/70 p-4 outline-none transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-white focus-visible:ring-4 focus-visible:ring-primary/15"
                    >
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary"><FileText className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold capitalize">{document.kind.replaceAll("_", " ")}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{document.mimeType}</span>
                      </span>
                      <ExternalLink className="h-4 w-4 text-primary" />
                    </a>
                  ))}
                </div>
              </div>

              {["submitted", "under_review"].includes(detail.status) ? (
                <div className="mt-6 rounded-[1.35rem] border border-[var(--landing-primary-15)] bg-[linear-gradient(135deg,rgba(251,247,238,0.95),rgba(220,232,214,0.65))] p-5">
                  <h3 className="font-semibold">Record the decision</h3>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    {[
                      { value: "approved" as const, label: "Approve", icon: CheckCircle2 },
                      { value: "needs_changes" as const, label: "Request changes", icon: RefreshCw },
                      { value: "rejected" as const, label: "Reject", icon: XCircle },
                    ].map((option) => {
                      const Icon = option.icon;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setDecision(option.value)}
                          className={cn(
                            "flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-bold transition-[background-color,color,transform] active:scale-[0.97]",
                            decision === option.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-white/70",
                          )}
                        >
                          <Icon className="h-4 w-4" /> {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label>
                      <span className="mb-2 block text-sm font-semibold">Reason code {decision !== "approved" ? "*" : ""}</span>
                      <select className="echo-input h-11 w-full rounded-xl border border-border bg-white/75 px-3 text-sm" value={reasonCode} onChange={(event) => setReasonCode(event.target.value)}>
                        <option value="">Select a reason</option>
                        <option value="identity_confirmed">Identity confirmed</option>
                        <option value="age_confirmed">Age confirmed</option>
                        <option value="document_unclear">Document is unclear</option>
                        <option value="details_mismatch">Details do not match</option>
                        <option value="guardian_evidence_missing">Guardian evidence is insufficient</option>
                        <option value="unable_to_verify">Unable to verify</option>
                      </select>
                    </label>
                    <label>
                      <span className="mb-2 block text-sm font-semibold">Applicant note {decision !== "approved" ? "*" : ""}</span>
                      <textarea className="echo-input min-h-24 w-full resize-y rounded-xl border border-border bg-white/75 p-3 text-sm" maxLength={2000} placeholder="Give specific, respectful next steps." value={note} onChange={(event) => setNote(event.target.value)} />
                    </label>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <EchoButton type="button" isLoading={busy} loadingText="Recording…" onClick={() => void recordDecision()}>
                      <BadgeCheck className="h-4 w-4" /> Confirm decision
                    </EchoButton>
                  </div>
                </div>
              ) : null}
            </div>
          )}
          {error ? <p role="alert" className="mt-4 rounded-2xl border border-danger/20 bg-crisis-soft/70 p-4 text-sm font-semibold text-danger">{error}</p> : null}
        </section>
      </div>
    </AppShell>
  );
}
