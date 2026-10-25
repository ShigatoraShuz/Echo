"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { FileCheck2, LockKeyhole } from "lucide-react";
import type { CredentialSubmission } from "@/services/professionals/professional-api";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { ProfessionalNotice, ProfessionalPanel } from "./professional-ui";
import { credentialPreviewSchema, validateCredentialPreview } from "../professional-onboarding.model";

const fields = { organizationId: "", role: "", credentialLabel: "", expiresAt: "", evidenceReference: "" };

/** Preview never invokes callbacks. Live fields belong only to the mounted applicant scope. */
export function ProfessionalCredentialForm({ preview = false, organizations = [], onSubmit, busy = false }: {
  preview?: boolean; organizations?: Array<{ id: string; name: string }>;
  onSubmit?: (input: CredentialSubmission) => Promise<boolean>; busy?: boolean;
}) {
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const pending = useRef(false);
  const [values, setValues] = useState(fields);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const live = !preview && !!onSubmit;
  const fieldStyle = "echo-focus-ring mt-2 min-h-12 w-full min-w-0 rounded-xl border border-input bg-background px-3 py-3 text-base text-foreground disabled:cursor-not-allowed disabled:opacity-60";
  function update(field: keyof typeof fields, value: string) {
    setValues(previous => ({ ...previous, [field]: value }));
    setErrors(previous => ({ ...previous, [field]: "", _form: "" })); setChecked(false);
  }
  async function check(event: FormEvent) {
    event.preventDefault();
    if ((!preview && !live) || pending.current || busy) return;
    const result = validateCredentialPreview(values);
    if (!result.organizationId && !organizations.some(item => item.id === values.organizationId)) result.organizationId = "Choose an available organization.";
    setErrors(result); setChecked(preview && Object.keys(result).length === 0);
    const first = Object.keys(result)[0];
    if (first) { form.current?.querySelector<HTMLElement>('[name="' + first + '"]')?.focus(); return; }
    if (preview || !onSubmit) return;
    pending.current = true;
    try {
      if (await onSubmit(credentialPreviewSchema.parse(values))) setValues(current => ({ ...current, evidenceReference: "" }));
    } catch { setErrors({ _form: "Submission could not be confirmed. Check application history before trying again." }); }
    finally { pending.current = false; }
  }
  function feedback(field: string) {
    return errors[field] ? <p id={id + "-" + field + "-error"} role="alert" className="mt-2 text-xs leading-5 text-danger">{errors[field]}</p> : null;
  }
  const describedBy = (field: string) => [field === "evidenceReference" ? id + "-evidence-help" : "", errors[field] ? id + "-" + field + "-error" : ""].filter(Boolean).join(" ") || undefined;
  return <ProfessionalPanel title="Credential evidence" icon={FileCheck2} description="A clear record of your qualification and its expiry.">
    <ProfessionalNotice title={live ? "Apply for professional access" : "Credential submission is awaiting integration"}>
      {live ? "Submit a reference for independent review. Choosing a role does not activate membership. Document uploads remain unavailable; use your organization’s approved evidence channel." : preview ? "Use fictional details only to inspect field validation; nothing is sent or saved. Submission and document uploads are unavailable in this preview." : "Secure submission is unavailable until authenticated application access has been checked."}
    </ProfessionalNotice>
    <form ref={form} onSubmit={event => void check(event)} noValidate aria-label={preview ? "Synthetic credential details" : live ? "Professional application" : "Credential submission unavailable"} className="mt-6 space-y-5">
      <fieldset disabled={busy || (!preview && !live)} className="min-w-0 space-y-5">
        <legend className="sr-only">Professional credential details</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <div><label htmlFor={id + "-organizationId"} className="text-sm font-semibold">Organization *</label><select id={id + "-organizationId"} name="organizationId" value={values.organizationId} onChange={event => update("organizationId", event.target.value)} className={fieldStyle} aria-invalid={!!errors.organizationId} aria-describedby={describedBy("organizationId")} required><option value="">Choose an organization</option>{organizations.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{feedback("organizationId")}</div>
          <div><label htmlFor={id + "-role"} className="text-sm font-semibold">Professional role *</label><select id={id + "-role"} name="role" value={values.role} onChange={event => update("role", event.target.value)} className={fieldStyle} aria-invalid={!!errors.role} aria-describedby={describedBy("role")} required><option value="">Choose a clinical role</option><option value="counselor">Counselor</option><option value="psychologist">Psychologist</option><option value="social_worker">Social worker</option></select>{feedback("role")}</div>
        </div>
        <div><label htmlFor={id + "-credentialLabel"} className="text-sm font-semibold">Qualification label *</label><input id={id + "-credentialLabel"} name="credentialLabel" value={values.credentialLabel} onChange={event => update("credentialLabel", event.target.value)} className={fieldStyle} placeholder={preview ? "Synthetic counseling qualification" : "Qualification name"} maxLength={160} autoComplete="off" aria-invalid={!!errors.credentialLabel} aria-describedby={describedBy("credentialLabel")} required /><p className="mt-2 text-xs leading-5 text-muted-foreground">Use a qualification name, not an ID number or sensitive document contents.</p>{feedback("credentialLabel")}</div>
        <div><label htmlFor={id + "-expiresAt"} className="text-sm font-semibold">Credential expiry date *</label><input id={id + "-expiresAt"} name="expiresAt" type="date" value={values.expiresAt} onChange={event => update("expiresAt", event.target.value)} className={fieldStyle} aria-invalid={!!errors.expiresAt} aria-describedby={describedBy("expiresAt")} required />{feedback("expiresAt")}</div>
        <div><label htmlFor={id + "-evidenceReference"} className="text-sm font-semibold">Evidence reference *</label><textarea id={id + "-evidenceReference"} name="evidenceReference" value={values.evidenceReference} onChange={event => update("evidenceReference", event.target.value)} className={fieldStyle + " min-h-32 resize-y"} placeholder={preview ? "Fictional registry reference for layout review only." : "A reference to evidence held through an approved secure channel"} maxLength={4000} autoComplete="off" aria-invalid={!!errors.evidenceReference} aria-describedby={describedBy("evidenceReference")} required /><p id={id + "-evidence-help"} className="mt-2 text-xs leading-5 text-muted-foreground">References are reviewed manually. Do not enter passwords, access tokens, patient information or document contents.</p>{feedback("evidenceReference")}</div>
      </fieldset>
      {feedback("_form")}
      {checked ? <ProfessionalNotice title="Sample details pass validation">No application was submitted. This check uses fictional details in memory only.</ProfessionalNotice> : null}
      <div className="flex flex-wrap items-center gap-3 border-t border-border/70 pt-5">
        {preview ? <EchoButton type="submit" variant="outline">Check sample details</EchoButton> : null}
        <EchoButton type={live ? "submit" : "button"} disabled={!live || busy} isLoading={busy} loadingText="Submitting application">{live ? "Submit application" : "Submit credential"}</EchoButton>
        <EchoButton type="button" variant="outline" disabled aria-describedby={id + "-blocked"}>Upload document</EchoButton>
      </div>
      <p id={id + "-blocked"} className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><LockKeyhole size={14} className="mt-0.5 shrink-0" aria-hidden="true" />{live ? "The backend encrypts evidence references. Binary document uploads remain unavailable." : "These preview actions cannot send data or upload documents."}</p>
    </form>
  </ProfessionalPanel>;
}
