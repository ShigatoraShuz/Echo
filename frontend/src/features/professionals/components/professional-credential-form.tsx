"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { FileCheck2, LockKeyhole } from "lucide-react";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { ProfessionalNotice, ProfessionalPanel } from "./professional-ui";
import { validateCredentialPreview } from "../professional-onboarding.model";

const fields = { organizationId: "", role: "", credentialLabel: "", expiresAt: "", evidenceReference: "" };

/** Presentation only. There is deliberately no API callback, upload or persistence. */
export function ProfessionalCredentialForm({ preview = false, organizations = [] }: {
  preview?: boolean; organizations?: Array<{ id: string; name: string }>;
}) {
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState(fields);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const fieldStyle = "echo-focus-ring mt-2 min-h-12 w-full min-w-0 rounded-xl border border-input bg-background px-3 py-3 text-base text-foreground disabled:cursor-not-allowed disabled:opacity-60";
  function update(field: keyof typeof fields, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: "" }));
    setChecked(false);
  }
  function check(event: FormEvent) {
    event.preventDefault();
    if (!preview) return;
    const result = validateCredentialPreview(values);
    setErrors(result);
    setChecked(Object.keys(result).length === 0);
    const first = Object.keys(result)[0];
    if (first) form.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
  }
  function feedback(field: string) {
    return errors[field] ? <p id={`${id}-${field}-error`} role="alert" className="mt-2 text-xs leading-5 text-danger">{errors[field]}</p> : null;
  }
  const describedBy = (field: string) => [field === "evidenceReference" ? `${id}-evidence-help` : "", errors[field] ? `${id}-${field}-error` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <ProfessionalPanel title="Credential evidence" icon={FileCheck2} description="A clear record of your qualification and its expiry.">
      <ProfessionalNotice title="Credential submission is awaiting integration">
        The credential review service is not deployed. Submission and document uploads are unavailable. {preview ? "Use fictional details only to inspect field validation; nothing is sent or saved." : "To protect your information, this form stays read-only until secure submission is available."}
      </ProfessionalNotice>
      <form ref={form} onSubmit={check} noValidate aria-label={preview ? "Synthetic credential details" : "Credential submission unavailable"} className="mt-6 space-y-5">
        <fieldset disabled={!preview} className="min-w-0 space-y-5">
          <legend className="sr-only">Professional credential details</legend>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor={`${id}-organizationId`} className="text-sm font-semibold">Organization <span className="text-danger" aria-hidden="true">*</span></label>
              <select id={`${id}-organizationId`} name="organizationId" value={values.organizationId} onChange={(event) => update("organizationId", event.target.value)} className={fieldStyle} aria-invalid={!!errors.organizationId} aria-describedby={describedBy("organizationId")} required>
                <option value="">Choose an organization</option>
                {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
              </select>{feedback("organizationId")}
            </div>
            <div>
              <label htmlFor={`${id}-role`} className="text-sm font-semibold">Professional role <span className="text-danger" aria-hidden="true">*</span></label>
              <select id={`${id}-role`} name="role" value={values.role} onChange={(event) => update("role", event.target.value)} className={fieldStyle} aria-invalid={!!errors.role} aria-describedby={describedBy("role")} required>
                <option value="">Choose a clinical role</option><option value="counselor">Counselor</option><option value="psychologist">Psychologist</option><option value="social_worker">Social worker</option>
              </select>{feedback("role")}
            </div>
          </div>
          <div>
            <label htmlFor={`${id}-credentialLabel`} className="text-sm font-semibold">Qualification label <span className="text-danger" aria-hidden="true">*</span></label>
            <input id={`${id}-credentialLabel`} name="credentialLabel" value={values.credentialLabel} onChange={(event) => update("credentialLabel", event.target.value)} className={fieldStyle} placeholder={preview ? "Synthetic counseling qualification" : "Qualification name"} maxLength={160} autoComplete="off" aria-invalid={!!errors.credentialLabel} aria-describedby={describedBy("credentialLabel")} required />{feedback("credentialLabel")}
            <p className="mt-2 text-xs leading-5 text-muted-foreground">Use a qualification name, not an ID number or sensitive document contents.</p>
          </div>
          <div>
            <label htmlFor={`${id}-expiresAt`} className="text-sm font-semibold">Credential expiry date <span className="text-danger" aria-hidden="true">*</span></label>
            <input id={`${id}-expiresAt`} name="expiresAt" type="date" value={values.expiresAt} onChange={(event) => update("expiresAt", event.target.value)} className={fieldStyle} aria-invalid={!!errors.expiresAt} aria-describedby={describedBy("expiresAt")} required />{feedback("expiresAt")}
          </div>
          <div>
            <label htmlFor={`${id}-evidenceReference`} className="text-sm font-semibold">Evidence reference <span className="text-danger" aria-hidden="true">*</span></label>
            <textarea id={`${id}-evidenceReference`} name="evidenceReference" value={values.evidenceReference} onChange={(event) => update("evidenceReference", event.target.value)} className={`${fieldStyle} min-h-32 resize-y`} placeholder={preview ? "Fictional registry reference for layout review only." : "A reference to evidence held through an approved secure channel"} maxLength={4000} autoComplete="off" aria-invalid={!!errors.evidenceReference} aria-describedby={describedBy("evidenceReference")} required />
            <p id={`${id}-evidence-help`} className="mt-2 text-xs leading-5 text-muted-foreground">References are reviewed manually. Do not enter passwords, access tokens, patient information or document contents.</p>{feedback("evidenceReference")}
          </div>
        </fieldset>
        {checked ? <ProfessionalNotice title="Sample details pass validation">No application was submitted. This check uses fictional details in memory only.</ProfessionalNotice> : null}
        <div className="flex flex-wrap items-center gap-3 border-t border-border/70 pt-5">
          {preview ? <EchoButton type="submit" variant="outline">Check sample details</EchoButton> : null}
          <EchoButton type="button" disabled aria-describedby={`${id}-blocked`}>Submit credential</EchoButton>
          <EchoButton type="button" variant="outline" disabled aria-describedby={`${id}-blocked`}>Upload document</EchoButton>
        </div>
        <p id={`${id}-blocked`} className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><LockKeyhole size={14} className="mt-0.5 shrink-0" aria-hidden="true" />Secure submission and uploads require backend integration. These actions cannot send data.</p>
      </form>
    </ProfessionalPanel>
  );
}
