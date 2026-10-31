import { z } from "zod";

/** Preview metadata remains fictional. The same strict input validation also serves live applications. */
export interface CredentialReviewPreview {
  id: string;
  organizationName: string;
  credentialLabel: string;
  status: "pending" | "approved" | "rejected" | "expired";
  expiresAt: string;
  submittedAt: string;
  reviewedAt: string | null;
  reasonCode: "invalid_evidence" | "expired_credential" | "unable_to_verify" | null;
}

export const credentialPreviewSchema = z.strictObject({
  organizationId: z.uuid("Choose an organization."),
  role: z.enum(["counselor", "psychologist", "social_worker"], { error: "Choose a clinical role." }),
  credentialLabel: z.string().trim().min(2, "Enter a qualification label of at least 2 characters.").max(160, "Use 160 characters or fewer."),
  expiresAt: z.iso.date("Enter a valid expiry date."),
  evidenceReference: z.string().trim().min(20, "Describe the evidence reference in at least 20 characters.").max(4000, "Use 4,000 characters or fewer."),
});

export function validateCredentialPreview(input: unknown, today = new Date().toISOString().slice(0, 10)) {
  const parsed = credentialPreviewSchema.safeParse(input);
  const errors: Record<string, string> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0]);
      errors[field] ??= issue.message;
    }
  } else if (parsed.data.expiresAt < today) {
    errors.expiresAt = "Choose a current credential. An expired credential cannot be approved.";
  }
  return errors;
}
