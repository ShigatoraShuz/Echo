"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  Clock3,
  ExternalLink,
  FileCheck2,
  FileUp,
  LockKeyhole,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import { useVerificationViewModel, masked, formatBytes } from "../view-model/use-verification-view-model";
import { SettingsHeader, SettingsSection, SettingsShell } from "@/features/settings";
import { EchoButton } from "@/shared/components/ui";
import type { VerificationAddress, VerificationDocumentKind, VerificationSnapshot } from "../model";
import { cn } from "@/lib/utils";

const steps = [
  { label: "Identity & age", icon: UserRoundCheck },
  { label: "Guardian & consent", icon: ShieldCheck },
  { label: "Documents", icon: FileUp },
  { label: "Review", icon: BadgeCheck },
];

const documentLabels: Record<VerificationDocumentKind, string> = {
  user_government_id: "Your government-issued ID",
  user_age_document: "Proof of your age",
  guardian_government_id: "Parent or guardian government-issued ID",
  guardianship_document: "Proof of parent or legal guardianship",
};

function fieldClass(): string {
  return "echo-input h-11 w-full rounded-xl border border-[var(--landing-primary-15)] bg-white/70 px-4 text-sm outline-none transition-[border-color,box-shadow] focus:border-[var(--landing-primary)] focus:ring-4 focus:ring-[var(--landing-primary-10)]";
}

function AddressFields({
  value,
  onChange,
  prefix,
}: {
  value: VerificationAddress;
  onChange: (next: VerificationAddress) => void;
  prefix: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="sm:col-span-2">
        <span className="mb-2 block text-sm font-semibold">Street address</span>
        <input
          className={fieldClass()}
          name={`${prefix}-line1`}
          autoComplete="street-address"
          required
          value={value.line1}
          onChange={(event) => onChange({ ...value, line1: event.target.value })}
        />
      </label>
      <label>
        <span className="mb-2 block text-sm font-semibold">Apartment or unit</span>
        <input
          className={fieldClass()}
          name={`${prefix}-line2`}
          value={value.line2 ?? ""}
          onChange={(event) => onChange({ ...value, line2: event.target.value || null })}
        />
      </label>
      <label>
        <span className="mb-2 block text-sm font-semibold">City / municipality</span>
        <input
          className={fieldClass()}
          name={`${prefix}-city`}
          required
          value={value.city}
          onChange={(event) => onChange({ ...value, city: event.target.value })}
        />
      </label>
      <label>
        <span className="mb-2 block text-sm font-semibold">Province / region</span>
        <input
          className={fieldClass()}
          name={`${prefix}-province`}
          required
          value={value.province}
          onChange={(event) => onChange({ ...value, province: event.target.value })}
        />
      </label>
      <label>
        <span className="mb-2 block text-sm font-semibold">Postal code</span>
        <input
          className={fieldClass()}
          name={`${prefix}-postal`}
          required
          value={value.postalCode}
          onChange={(event) => onChange({ ...value, postalCode: event.target.value })}
        />
      </label>
    </div>
  );
}

function StatusView({
  snapshot,
  onEdit,
}: {
  snapshot: VerificationSnapshot;
  onEdit: () => void;
}) {
  const approved = snapshot.status === "approved";
  const pending = snapshot.status === "submitted" || snapshot.status === "under_review";
  const Icon = approved ? BadgeCheck : pending ? Clock3 : ShieldCheck;
  const title = approved
    ? "Your account is verified"
    : pending
      ? snapshot.status === "under_review"
        ? "An administrator is reviewing your application"
        : "Your application is in the review queue"
      : "Your application needs attention";
  const description = approved
    ? "Buddy and AI-supported journal analysis are now available. Your ordinary journal, grounding tools, and support resources remain available regardless of verification."
    : pending
      ? "We will notify you when an administrator completes the review. Your submitted identity details and documents are locked while review is in progress."
      : snapshot.reviewNote ??
        "Review the administrator’s decision, update the requested information, and submit again when ready.";

  return (
    <SettingsSection
      title={title}
      description={description}
      className="overflow-hidden bg-[linear-gradient(135deg,rgba(255,253,247,0.96),rgba(220,232,214,0.78))]"
    >
      <div className="flex flex-col gap-5 rounded-[1.35rem] border border-[var(--landing-primary-10)] bg-white/65 p-5 sm:flex-row sm:items-center">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[var(--landing-primary)] text-white shadow-subtle">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--landing-primary)]">
            Status: {snapshot.status.replaceAll("_", " ")}
          </p>
          {snapshot.submittedAt ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Submitted {new Date(snapshot.submittedAt).toLocaleString()}
            </p>
          ) : null}
          {snapshot.approvedExpiresAt ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Reverification due {new Date(snapshot.approvedExpiresAt).toLocaleDateString()}
            </p>
          ) : null}
          {snapshot.reasonCode ? (
            <p className="mt-2 text-sm font-semibold">Reason: {snapshot.reasonCode.replaceAll("_", " ")}</p>
          ) : null}
        </div>
        {!approved && !pending ? (
          <EchoButton type="button" onClick={onEdit}>Update application</EchoButton>
        ) : null}
      </div>
      {snapshot.canReview ? (
        <Link
          href="/admin/verifications"
          className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
        >
          Open the administrator review workspace
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </Link>
      ) : null}
    </SettingsSection>
  );
}

export function VerificationView() {
  const vm = useVerificationViewModel();
  const [formError, setFormError] = useState<string | null>(null);

  const goNext = useCallback(
    (event: { preventDefault: () => void }) => {
      setFormError(null);
      vm.goNext(event);
    },
    [vm],
  );

  if (vm.loading) {
    return (
      <SettingsShell>
        <SettingsHeader title="Account verification" description="Loading your protected verification status…" />
        <div className="h-72 animate-pulse rounded-[1.6rem] bg-card/70" />
      </SettingsShell>
    );
  }

  const terminalStatus =
    vm.snapshot &&
    ["submitted", "under_review", "approved"].includes(vm.snapshot.status);

  const displayError = vm.error ?? formError;

  return (
    <SettingsShell>
      <SettingsHeader
        title="Account verification"
        description="A secure, administrator-reviewed identity and age check. Approval is required before Buddy and AI-supported analysis can be used."
      />

      {terminalStatus && vm.snapshot ? (
        <StatusView snapshot={vm.snapshot} onEdit={() => vm.setStep(0)} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <SettingsSection
            title={steps[vm.step]?.label ?? "Verification"}
            description={`Step ${vm.step + 1} of ${steps.length}. Only authorized administrators can review the protected information you submit.`}
          >
            <ol className="grid grid-cols-4 gap-2" aria-label="Verification progress">
              {steps.map((item, index) => {
                const Icon = item.icon;
                return (
                  <li key={item.label}>
                    <button
                      type="button"
                      onClick={() => index < vm.step && vm.setStep(index)}
                      className={cn(
                        "flex w-full flex-col items-center gap-2 rounded-2xl border px-2 py-3 text-center text-[10px] font-bold transition-[background-color,color,transform] duration-200 active:scale-[0.97] sm:text-xs",
                        index === vm.step
                          ? "border-primary bg-primary text-primary-foreground"
                          : index < vm.step
                            ? "border-primary/20 bg-secondary text-primary"
                            : "border-border bg-background/65 text-muted-foreground",
                      )}
                      aria-current={index === vm.step ? "step" : undefined}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      <span>{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ol>

            <div key={vm.step} className="animate-in fade-in slide-in-from-bottom-2 duration-200">
              {vm.step === 0 ? (
                <form onSubmit={goNext} className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="sm:col-span-2">
                      <span className="mb-2 block text-sm font-semibold">Full legal name</span>
                      <input className={fieldClass()} required autoComplete="name" value={vm.form.legalName} onChange={(event) => vm.setForm({ ...vm.form, legalName: event.target.value })} />
                    </label>
                    <label>
                      <span className="mb-2 block text-sm font-semibold">Date of birth</span>
                      <input className={fieldClass()} required type="date" value={vm.form.dateOfBirth} onChange={(event) => vm.setForm({ ...vm.form, dateOfBirth: event.target.value })} />
                    </label>
                    <label>
                      <span className="mb-2 block text-sm font-semibold">Mobile number</span>
                      <input className={fieldClass()} required type="tel" autoComplete="tel" value={vm.form.phoneNumber} onChange={(event) => vm.setForm({ ...vm.form, phoneNumber: event.target.value })} />
                    </label>
                    <label>
                      <span className="mb-2 block text-sm font-semibold">Government ID type</span>
                      <input className={fieldClass()} required placeholder="e.g. National ID, passport" value={vm.form.governmentIdType} onChange={(event) => vm.setForm({ ...vm.form, governmentIdType: event.target.value })} />
                    </label>
                    <label>
                      <span className="mb-2 block text-sm font-semibold">Government ID number</span>
                      <input className={fieldClass()} required autoComplete="off" value={vm.form.governmentIdNumber} onChange={(event) => vm.setForm({ ...vm.form, governmentIdNumber: event.target.value })} />
                    </label>
                  </div>
                  <AddressFields value={vm.form.address} onChange={(address) => vm.setForm({ ...vm.form, address })} prefix="user" />
                  <div className="flex justify-end"><EchoButton type="submit">Continue <ArrowRight className="h-4 w-4" /></EchoButton></div>
                </form>
              ) : null}

              {vm.step === 1 ? (
                <form onSubmit={goNext} className="space-y-5">
                  {vm.isMinor ? (
                    <div className="space-y-5 rounded-[1.35rem] border border-[var(--landing-primary-15)] bg-[var(--landing-sage-soft)]/40 p-4 sm:p-5">
                      <div>
                        <p className="font-semibold text-foreground">Parent or legal guardian</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">Required because the date of birth indicates the account holder is under 18.</p>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label><span className="mb-2 block text-sm font-semibold">Guardian legal name</span><input className={fieldClass()} required value={vm.form.guardian?.legalName ?? ""} onChange={(event) => vm.updateGuardian({ ...(vm.form.guardian ?? { legalName: "", relationship: "", phoneNumber: "", email: null, address: { line1: "", line2: null, city: "", province: "", postalCode: "", countryCode: "PH" }, governmentIdType: "", governmentIdNumber: "" }), legalName: event.target.value })} /></label>
                        <label><span className="mb-2 block text-sm font-semibold">Relationship</span><input className={fieldClass()} required placeholder="Parent or legal guardian" value={vm.form.guardian?.relationship ?? ""} onChange={(event) => vm.updateGuardian({ ...(vm.form.guardian ?? { legalName: "", relationship: "", phoneNumber: "", email: null, address: { line1: "", line2: null, city: "", province: "", postalCode: "", countryCode: "PH" }, governmentIdType: "", governmentIdNumber: "" }), relationship: event.target.value })} /></label>
                        <label><span className="mb-2 block text-sm font-semibold">Guardian mobile number</span><input className={fieldClass()} required type="tel" value={vm.form.guardian?.phoneNumber ?? ""} onChange={(event) => vm.updateGuardian({ ...(vm.form.guardian ?? { legalName: "", relationship: "", phoneNumber: "", email: null, address: { line1: "", line2: null, city: "", province: "", postalCode: "", countryCode: "PH" }, governmentIdType: "", governmentIdNumber: "" }), phoneNumber: event.target.value })} /></label>
                        <label><span className="mb-2 block text-sm font-semibold">Guardian email</span><input className={fieldClass()} type="email" value={vm.form.guardian?.email ?? ""} onChange={(event) => vm.updateGuardian({ ...(vm.form.guardian ?? { legalName: "", relationship: "", phoneNumber: "", email: null, address: { line1: "", line2: null, city: "", province: "", postalCode: "", countryCode: "PH" }, governmentIdType: "", governmentIdNumber: "" }), email: event.target.value || null })} /></label>
                        <label><span className="mb-2 block text-sm font-semibold">Guardian ID type</span><input className={fieldClass()} required value={vm.form.guardian?.governmentIdType ?? ""} onChange={(event) => vm.updateGuardian({ ...(vm.form.guardian ?? { legalName: "", relationship: "", phoneNumber: "", email: null, address: { line1: "", line2: null, city: "", province: "", postalCode: "", countryCode: "PH" }, governmentIdType: "", governmentIdNumber: "" }), governmentIdType: event.target.value })} /></label>
                        <label><span className="mb-2 block text-sm font-semibold">Guardian ID number</span><input className={fieldClass()} required autoComplete="off" value={vm.form.guardian?.governmentIdNumber ?? ""} onChange={(event) => vm.updateGuardian({ ...(vm.form.guardian ?? { legalName: "", relationship: "", phoneNumber: "", email: null, address: { line1: "", line2: null, city: "", province: "", postalCode: "", countryCode: "PH" }, governmentIdType: "", governmentIdNumber: "" }), governmentIdNumber: event.target.value })} /></label>
                      </div>
                      <AddressFields
                        value={vm.form.guardian?.address ?? { line1: "", line2: null, city: "", province: "", postalCode: "", countryCode: "PH" }}
                        onChange={(address) => vm.updateGuardian({ ...(vm.form.guardian ?? { legalName: "", relationship: "", phoneNumber: "", email: null, address: { line1: "", line2: null, city: "", province: "", postalCode: "", countryCode: "PH" }, governmentIdType: "", governmentIdNumber: "" }), address })}
                        prefix="guardian"
                      />
                    </div>
                  ) : (
                    <div className="rounded-[1.35rem] border border-[var(--landing-primary-10)] bg-secondary/55 p-5">
                      <p className="font-semibold">Adult verification path</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">Guardian details are not required for users aged 18 or older.</p>
                    </div>
                  )}
                  <div className="space-y-3 rounded-[1.35rem] border border-border bg-background/70 p-5">
                    <label className="flex items-start gap-3 text-sm leading-6">
                      <input type="checkbox" required className="mt-1 h-4 w-4 accent-[var(--landing-primary)]" checked={vm.form.privacyNoticeAccepted} onChange={(event) => vm.setForm({ ...vm.form, privacyNoticeAccepted: event.target.checked as true })} />
                      <span>I understand that my identity, age, contact details, and documents are collected only for account verification, access control, safety review, and required audit records.</span>
                    </label>
                    <label className="flex items-start gap-3 text-sm leading-6">
                      <input type="checkbox" required className="mt-1 h-4 w-4 accent-[var(--landing-primary)]" checked={vm.form.identityVerificationConsent} onChange={(event) => vm.setForm({ ...vm.form, identityVerificationConsent: event.target.checked as true })} />
                      <span>I consent to an authorized ECHO administrator reviewing the submitted information and documents.</span>
                    </label>
                    {vm.isMinor ? (
                      <label className="flex items-start gap-3 text-sm leading-6">
                        <input type="checkbox" required className="mt-1 h-4 w-4 accent-[var(--landing-primary)]" checked={vm.form.guardianConsent} onChange={(event) => vm.setForm({ ...vm.form, guardianConsent: event.target.checked })} />
                        <span>The named parent or legal guardian confirms consent for this verification request and the account’s use of Buddy and AI-supported features after approval.</span>
                      </label>
                    ) : null}
                  </div>
                  <div className="flex justify-between"><EchoButton type="button" variant="outline" onClick={() => vm.setStep(0)}><ArrowLeft className="h-4 w-4" /> Back</EchoButton><EchoButton type="submit" isLoading={vm.busy} loadingText="Protecting details…">Save and continue <ArrowRight className="h-4 w-4" /></EchoButton></div>
                </form>
              ) : null}

              {vm.step === 2 && vm.snapshot ? (
                <form onSubmit={goNext} className="space-y-4">
                  <div className="rounded-2xl bg-secondary/55 p-4 text-sm leading-6 text-muted-foreground">
                    Upload clear, complete documents. Files must be JPG, PNG, or PDF and no larger than 8 MB. Documents are kept in private storage and opened by reviewers through short-lived links.
                  </div>
                  {vm.snapshot.requiredDocuments.map((kind) => {
                    const uploaded = vm.snapshot?.documents.find((document) => document.kind === kind);
                    return (
                      <label key={kind} className="group flex cursor-pointer flex-col gap-4 rounded-[1.35rem] border border-border bg-background/70 p-5 transition-[border-color,background-color,transform] hover:-translate-y-0.5 hover:border-primary/35 hover:bg-white sm:flex-row sm:items-center">
                        <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-2xl", uploaded ? "bg-primary text-primary-foreground" : "bg-secondary text-primary")}>
                          {uploaded ? <FileCheck2 className="h-5 w-5" /> : <FileUp className="h-5 w-5" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">{documentLabels[kind]}</span>
                          <span className="mt-1 block text-xs text-muted-foreground">{uploaded ? `Uploaded · ${formatBytes(uploaded.sizeBytes)}` : vm.uploading === kind ? "Uploading securely…" : "Choose a file"}</span>
                        </span>
                        <span className="rounded-full border border-primary/20 px-4 py-2 text-xs font-bold text-primary">{uploaded ? "Replace" : "Upload"}</span>
                        <input className="sr-only" type="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" disabled={vm.uploading !== null} onChange={(event) => void vm.upload(kind, event.target.files?.[0])} />
                      </label>
                    );
                  })}
                  <div className="flex justify-between"><EchoButton type="button" variant="outline" onClick={() => vm.setStep(1)}><ArrowLeft className="h-4 w-4" /> Back</EchoButton><EchoButton type="submit" disabled={vm.snapshot.requiredDocuments.some((kind) => !vm.snapshot?.documents.some((document) => document.kind === kind))}>Review application <ArrowRight className="h-4 w-4" /></EchoButton></div>
                </form>
              ) : null}

              {vm.step === 3 && vm.snapshot ? (
                <div className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      ["Applicant", vm.form.legalName],
                      ["Date of birth", vm.form.dateOfBirth],
                      ["Age path", vm.isMinor ? "Minor with guardian" : "Adult"],
                      ["ID reference", masked(vm.form.governmentIdNumber)],
                      ["Address", `${vm.form.address.city}, ${vm.form.address.province}`],
                      ["Documents", `${vm.snapshot.documents.length} protected file${vm.snapshot.documents.length === 1 ? "" : "s"}`],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-border bg-background/70 p-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-primary">{label}</p>
                        <p className="mt-2 text-sm font-semibold">{value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3 rounded-[1.35rem] border border-primary/15 bg-secondary/55 p-5">
                    <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <p className="text-sm leading-6 text-muted-foreground">Submitting locks the application while it waits for an authorized administrator. Approval is not automatic, and access to Buddy and AI-supported analysis remains locked until the decision is recorded.</p>
                  </div>
                  <div className="flex justify-between"><EchoButton type="button" variant="outline" onClick={() => vm.setStep(2)}><ArrowLeft className="h-4 w-4" /> Back</EchoButton><EchoButton type="button" isLoading={vm.busy} loadingText="Submitting…" onClick={() => void vm.submit()}>Submit for admin review <Check className="h-4 w-4" /></EchoButton></div>
                </div>
              ) : null}
            </div>

            {displayError ? <p role="alert" className="rounded-2xl border border-danger/20 bg-crisis-soft/70 p-4 text-sm font-semibold text-danger">{displayError}</p> : null}
          </SettingsSection>

          <aside className="self-start rounded-[1.6rem] bg-[var(--landing-footer)] p-6 text-[var(--landing-inverse)] shadow-card xl:sticky xl:top-[108px]">
            <LockKeyhole className="h-6 w-6 text-[#a9d0a2]" aria-hidden="true" />
            <p className="mt-5 text-[10px] font-extrabold uppercase tracking-[0.15em] text-white/55">Why verification?</p>
            <h2 className="mt-2 font-serif text-2xl">Safer access to sensitive features.</h2>
            <ul className="mt-5 space-y-4 text-sm leading-6 text-[var(--landing-inverse-80)]">
              <li>Identity and age are reviewed by an authorized administrator.</li>
              <li>Users under 18 need a parent or legal guardian.</li>
              <li>Buddy and AI-supported analysis stay locked until approval.</li>
              <li>Grounding and public support remain available.</li>
            </ul>
            <Link href="/privacy-policy" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-white hover:underline">
              Read the privacy notice <ExternalLink className="h-4 w-4" />
            </Link>
          </aside>
        </div>
      )}
    </SettingsShell>
  );
}