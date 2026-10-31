import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptText, encryptText, type EncryptionService } from "../../infrastructure/encryption/encryption.service.js";
import { AuthorizationError, ConflictError, ExternalServiceError, NotFoundError, ValidationError } from "../../shared/errors/app-error.js";

type Row = Record<string, unknown>;
export type ClinicalRole = "counselor" | "psychologist" | "social_worker";
export interface CredentialSubmission {
  organizationId: string;
  role: ClinicalRole;
  credentialLabel: string;
  expiresAt: string;
  evidenceReference: string;
}
export interface CredentialDecision {
  decision: "approved" | "rejected";
  reasonCode: "invalid_evidence" | "expired_credential" | "unable_to_verify" | null;
}

const METADATA = "id,organization_id,user_id,role,credential_label,expires_at,status,submitted_at,reviewed_at,reviewed_by,reason_code";
function metadata(row: Row) {
  return {
    id: row.id, organizationId: row.organization_id, userId: row.user_id, role: row.role,
    credentialLabel: row.credential_label, expiresAt: row.expires_at,
    status: row.status !== "rejected" && String(row.expires_at) < new Date().toISOString().slice(0, 10) ? "expired" : row.status,
    reviewStatus: row.status, submittedAt: row.submitted_at, reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by, reasonCode: row.reason_code,
  };
}

function fail(error: { message: string }): never {
  // Match only our fixed SQL exceptions. Never surface or log database text,
  // details, submitted references, ciphertext, or reviewer input.
  switch (error.message) {
    case "CREDENTIAL_FORBIDDEN":
    case "CREDENTIAL_SELF_REVIEW": throw new AuthorizationError("Another authorized administrator must review this credential.");
    case "CREDENTIAL_UNAVAILABLE": throw new NotFoundError("The credential is unavailable.");
    case "CREDENTIAL_EXPIRED": throw new ConflictError("CREDENTIAL_EXPIRED", "Submit a current credential before approval.");
    case "CREDENTIAL_ALREADY_REVIEWED": throw new ConflictError("CREDENTIAL_ALREADY_REVIEWED", "This credential has already been reviewed.");
    case "CREDENTIAL_INVALID": throw new ValidationError();
    default: throw new ExternalServiceError("DATABASE_UNAVAILABLE", "The credential operation could not be completed.");
  }
}

export class ProfessionalCredentialService {
  constructor(private readonly database: SupabaseClient, private readonly encryption: EncryptionService) {}

  async submit(actorId: string, input: CredentialSubmission) {
    if (input.expiresAt < new Date().toISOString().slice(0, 10)) {
      throw new ConflictError("CREDENTIAL_EXPIRED", "Submit a current credential before approval.");
    }
    const { data, error } = await this.database.schema("professional_service").rpc("submit_credential", {
      p_actor: actorId, p_organization_id: input.organizationId, p_role: input.role,
      p_label: input.credentialLabel, p_expires_at: input.expiresAt,
      p_evidence_encrypted: encryptText(input.evidenceReference, this.encryption),
    });
    if (error) fail(error);
    return { credential: metadata(data as Row) };
  }

  async correct(actorId: string, credentialId: string, input: { credentialLabel: string; expiresAt: string }) {
    if (input.expiresAt < new Date().toISOString().slice(0, 10)) throw new ConflictError("CREDENTIAL_EXPIRED", "Choose a current expiry before correction.");
    const { data, error } = await this.database.schema("professional_service").rpc("correct_pending_credential", {
      p_actor: actorId, p_credential_id: credentialId, p_label: input.credentialLabel, p_expires_at: input.expiresAt,
    });
    if (error) fail(error);
    return { credential: metadata(data as Row) };
  }

  async listOwn(actorId: string) {
    const { data, error } = await this.database.schema("professional_service").from("credential_reviews")
      .select(METADATA).eq("user_id", actorId).order("submitted_at", { ascending: false }).limit(100);
    if (error) fail(error);
    return { credentials: ((data ?? []) as Row[]).map(metadata) };
  }

  // The router's existing VerificationService.assertAdmin gate protects the
  // metadata list. Evidence reads/decisions also recheck that authority in SQL.
  async listForAdmin(organizationId: string) {
    const { data, error } = await this.database.schema("professional_service").from("credential_reviews")
      .select(METADATA).eq("organization_id", organizationId).order("submitted_at", { ascending: false }).limit(100);
    if (error) fail(error);
    return { credentials: ((data ?? []) as Row[]).map(metadata) };
  }

  async readForAdmin(actorId: string, organizationId: string, credentialId: string) {
    const { data, error } = await this.database.schema("professional_service").rpc("read_credential_for_review", {
      p_actor: actorId, p_organization_id: organizationId, p_credential_id: credentialId,
    });
    if (error) fail(error);
    const row = data as Row;
    let evidenceReference: string;
    try {
      evidenceReference = decryptText(row.evidence_reference_encrypted, this.encryption);
    } catch {
      throw new ExternalServiceError("CREDENTIAL_EVIDENCE_UNAVAILABLE", "Credential evidence could not be opened.");
    }
    return { credential: { ...metadata(row), evidenceReference } };
  }

  async review(actorId: string, organizationId: string, credentialId: string, input: CredentialDecision) {
    const { data, error } = await this.database.schema("professional_service").rpc("review_credential", {
      p_actor: actorId, p_organization_id: organizationId, p_credential_id: credentialId,
      p_decision: input.decision, p_reason_code: input.reasonCode,
    });
    if (error) fail(error);
    return { credential: metadata(data as Row) };
  }

  async requireApproved(input: {
    credentialId?: string; organizationId: string; userId: string; role: string;
    credentialLabel: string | null; credentialExpiresAt: string | null;
  }) {
    if (!input.credentialId) throw new AuthorizationError("An approved credential review is required.");
    const { data, error } = await this.database.schema("professional_service").from("credential_reviews")
      .select("id,status,expires_at,credential_label,reviewed_by")
      .eq("id", input.credentialId).eq("organization_id", input.organizationId)
      .eq("user_id", input.userId).eq("role", input.role).maybeSingle();
    if (error) fail(error);
    if (!data || data.status !== "approved" || !data.reviewed_by || data.reviewed_by === input.userId ||
      data.expires_at < new Date().toISOString().slice(0, 10) || data.expires_at !== input.credentialExpiresAt ||
      data.credential_label !== input.credentialLabel) {
      throw new AuthorizationError("An approved, matching, unexpired credential review is required.");
    }
  }
}
