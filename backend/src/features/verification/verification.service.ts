import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EncryptionService, EncryptedPayload } from "../../infrastructure/encryption/encryption.service.js";
import {
  AuthorizationError,
  ConflictError,
  ExternalServiceError,
  NotFoundError,
  ValidationError,
  VerificationRequiredError,
} from "../../shared/errors/app-error.js";

export const VERIFICATION_CONSENT_VERSION = "identity-verification-v1";
export const MINIMUM_ACCOUNT_AGE = 13;
export const ADULT_AGE = 18;
export const VERIFICATION_BUCKET = "verification-documents";

export const documentKinds = [
  "user_government_id",
  "user_age_document",
  "guardian_government_id",
  "guardianship_document",
] as const;

export type VerificationDocumentKind = (typeof documentKinds)[number];
export type VerificationStatus =
  | "not_started"
  | "draft"
  | "submitted"
  | "under_review"
  | "needs_changes"
  | "approved"
  | "rejected"
  | "expired";

export interface VerificationAddress {
  line1: string;
  line2: string | null;
  city: string;
  province: string;
  postalCode: string;
  countryCode: string;
}

export interface GuardianDetails {
  legalName: string;
  relationship: string;
  phoneNumber: string;
  email: string | null;
  address: VerificationAddress;
  governmentIdType: string;
  governmentIdNumber: string;
}

export interface VerificationApplicationInput {
  legalName: string;
  dateOfBirth: string;
  phoneNumber: string;
  address: VerificationAddress;
  governmentIdType: string;
  governmentIdNumber: string;
  guardian: GuardianDetails | null;
  privacyNoticeAccepted: true;
  identityVerificationConsent: true;
  guardianConsent: boolean;
}

export interface VerificationDecisionInput {
  decision: "approved" | "rejected" | "needs_changes";
  reasonCode: string | null;
  note: string | null;
}

type Row = Record<string, unknown>;

function databaseError(message: string): ExternalServiceError {
  return new ExternalServiceError("DATABASE_UNAVAILABLE", message);
}

function bytea(value: string): string {
  return `\\x${Buffer.from(value, "base64").toString("hex")}`;
}

function base64FromBytea(value: unknown): string {
  if (typeof value !== "string") throw databaseError("Encrypted verification data is unavailable.");
  return value.startsWith("\\x")
    ? Buffer.from(value.slice(2), "hex").toString("base64")
    : Buffer.from(value, "base64").toString("base64");
}

function encryptedColumns(payload: EncryptedPayload, prefix = ""): Record<string, unknown> {
  return {
    [`${prefix}ciphertext`]: bytea(payload.ciphertext),
    [`${prefix}iv`]: bytea(payload.iv),
    [`${prefix}auth_tag`]: bytea(payload.authenticationTag),
    [`${prefix}key_version`]: payload.keyVersion,
  };
}

function decryptColumns(
  encryption: EncryptionService,
  row: Row,
  prefix = "",
): string | null {
  const ciphertext = row[`${prefix}ciphertext`];
  if (ciphertext == null) return null;
  return encryption.decrypt({
    ciphertext: base64FromBytea(ciphertext),
    iv: base64FromBytea(row[`${prefix}iv`]),
    authenticationTag: base64FromBytea(row[`${prefix}auth_tag`]),
    keyVersion: Number(row[`${prefix}key_version`]),
  });
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return date;
}

export function calculateAge(dateOfBirth: string, now = new Date()): number {
  const birth = parseDateOnly(dateOfBirth);
  if (!birth) throw new ValidationError({ dateOfBirth: ["Enter a valid date of birth."] });
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const monthDifference = now.getUTCMonth() - birth.getUTCMonth();
  if (
    monthDifference < 0 ||
    (monthDifference === 0 && now.getUTCDate() < birth.getUTCDate())
  ) {
    age -= 1;
  }
  return age;
}

export function requiredDocumentKinds(isMinor: boolean): VerificationDocumentKind[] {
  return isMinor
    ? ["user_age_document", "guardian_government_id", "guardianship_document"]
    : ["user_government_id"];
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "application/pdf") return "pdf";
  throw new ValidationError({ document: ["Upload a JPG, PNG, or PDF document."] });
}

export class VerificationService {
  constructor(
    private readonly database: SupabaseClient,
    private readonly encryption: EncryptionService,
  ) {}

  async isAdmin(userId: string): Promise<boolean> {
    const { data, error } = await this.database
      .from("verification_admins")
      .select("user_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw databaseError("Administrator access could not be checked.");
    return Boolean(data);
  }

  async assertAdmin(userId: string): Promise<void> {
    if (!(await this.isAdmin(userId))) {
      throw new AuthorizationError("Verification administrator access is required.");
    }
  }

  private async applicationRowForUser(userId: string): Promise<Row | null> {
    const { data, error } = await this.database
      .from("identity_verifications")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw databaseError("Your verification status could not be loaded.");
    return data as Row | null;
  }

  private async documentsForVerification(verificationId: string): Promise<Row[]> {
    const { data, error } = await this.database
      .from("verification_documents")
      .select("id, document_kind, mime_type, size_bytes, uploaded_at, storage_path")
      .eq("verification_id", verificationId)
      .order("uploaded_at", { ascending: true });
    if (error) throw databaseError("Verification documents could not be loaded.");
    return (data ?? []) as Row[];
  }

  private applicationDetails(row: Row): VerificationApplicationInput | null {
    const plaintext = decryptColumns(this.encryption, row, "details_");
    if (!plaintext) return null;
    try {
      return JSON.parse(plaintext) as VerificationApplicationInput;
    } catch {
      throw databaseError("Encrypted verification details could not be read.");
    }
  }

  private async normalizeExpired(row: Row): Promise<Row> {
    if (
      row.verification_status === "approved" &&
      typeof row.approved_expires_at === "string" &&
      new Date(row.approved_expires_at).getTime() <= Date.now()
    ) {
      const { data, error } = await this.database
        .from("identity_verifications")
        .update({ verification_status: "expired" })
        .eq("id", row.id)
        .eq("verification_status", "approved")
        .select("*")
        .single();
      if (error) throw databaseError("Your verification expiry could not be updated.");
      return data as Row;
    }
    return row;
  }

  private documentResponse(row: Row) {
    return {
      id: stringValue(row.id),
      kind: stringValue(row.document_kind) as VerificationDocumentKind,
      mimeType: stringValue(row.mime_type),
      sizeBytes: Number(row.size_bytes),
      uploadedAt: stringValue(row.uploaded_at),
    };
  }

  async getStatus(userId: string) {
    const admin = await this.isAdmin(userId);
    const existing = await this.applicationRowForUser(userId);
    if (!existing) {
      return {
        status: "not_started" as const,
        canAccessAi: false,
        canReview: admin,
        isMinor: null,
        application: null,
        documents: [],
        requiredDocuments: [],
        submittedAt: null,
        reviewedAt: null,
        approvedExpiresAt: null,
        reasonCode: null,
        reviewNote: null,
        consentVersion: VERIFICATION_CONSENT_VERSION,
        minimumAge: MINIMUM_ACCOUNT_AGE,
        adultAge: ADULT_AGE,
      };
    }

    const row = await this.normalizeExpired(existing);
    const documents = await this.documentsForVerification(stringValue(row.id));
    const isMinor = typeof row.is_minor === "boolean" ? row.is_minor : null;
    const status = stringValue(row.verification_status) as Exclude<VerificationStatus, "not_started">;
    return {
      status,
      canAccessAi: status === "approved",
      canReview: admin,
      isMinor,
      application: this.applicationDetails(row),
      documents: documents.map((document) => this.documentResponse(document)),
      requiredDocuments: isMinor == null ? [] : requiredDocumentKinds(isMinor),
      submittedAt: nullableString(row.submitted_at),
      reviewedAt: nullableString(row.reviewed_at),
      approvedExpiresAt: nullableString(row.approved_expires_at),
      reasonCode: nullableString(row.decision_reason_code),
      reviewNote: decryptColumns(this.encryption, row, "review_note_"),
      consentVersion: VERIFICATION_CONSENT_VERSION,
      minimumAge: MINIMUM_ACCOUNT_AGE,
      adultAge: ADULT_AGE,
    };
  }

  async saveApplication(userId: string, input: VerificationApplicationInput) {
    const age = calculateAge(input.dateOfBirth);
    if (age < MINIMUM_ACCOUNT_AGE) {
      throw new ValidationError({
        dateOfBirth: [
          `ECHO accounts are currently available from age ${MINIMUM_ACCOUNT_AGE}. Crisis and public support resources remain available.`,
        ],
      });
    }
    if (age > 120) {
      throw new ValidationError({ dateOfBirth: ["Check the date of birth and try again."] });
    }
    const isMinor = age < ADULT_AGE;
    if (isMinor && (!input.guardian || !input.guardianConsent)) {
      throw new ValidationError({
        guardian: ["A parent or legal guardian and their consent are required for users under 18."],
      });
    }
    if (!isMinor && input.guardian) {
      input = { ...input, guardian: null, guardianConsent: false };
    }

    const existing = await this.applicationRowForUser(userId);
    if (existing && ["submitted", "under_review", "approved"].includes(stringValue(existing.verification_status))) {
      throw new ConflictError(
        "VERIFICATION_LOCKED",
        "This verification application cannot be edited while it is submitted, under review, or approved.",
      );
    }

    const encrypted = this.encryption.encrypt(JSON.stringify(input));
    const now = new Date().toISOString();
    const payload = {
      user_id: userId,
      verification_status: "draft",
      is_minor: isMinor,
      age_at_submission: age,
      ...encryptedColumns(encrypted, "details_"),
      consent_version: VERIFICATION_CONSENT_VERSION,
      privacy_notice_acknowledged_at: now,
      guardian_consent_acknowledged_at: isMinor ? now : null,
      submitted_at: null,
      reviewed_at: null,
      reviewed_by: null,
      decision_reason_code: null,
      review_note_ciphertext: null,
      review_note_iv: null,
      review_note_auth_tag: null,
      review_note_key_version: null,
      approved_expires_at: null,
    };

    const query = existing
      ? this.database
          .from("identity_verifications")
          .update(payload)
          .eq("id", existing.id)
      : this.database.from("identity_verifications").insert(payload);
    const { error } = await query;
    if (error) throw databaseError("Your verification application could not be saved.");
    return this.getStatus(userId);
  }

  async uploadDocument(
    userId: string,
    kind: VerificationDocumentKind,
    mimeType: string,
    contents: Buffer,
  ) {
    const extension = extensionForMimeType(mimeType);
    if (contents.byteLength < 1 || contents.byteLength > 8 * 1024 * 1024) {
      throw new ValidationError({ document: ["Upload a document no larger than 8 MB."] });
    }
    const application = await this.applicationRowForUser(userId);
    if (!application) throw new ConflictError("VERIFICATION_APPLICATION_REQUIRED", "Complete your details before uploading documents.");
    const status = stringValue(application.verification_status);
    if (!["draft", "needs_changes", "rejected"].includes(status)) {
      throw new ConflictError("VERIFICATION_LOCKED", "Documents cannot be changed in the current verification state.");
    }
    const isMinor = application.is_minor === true;
    const allowedKinds = new Set<VerificationDocumentKind>([
      ...requiredDocumentKinds(isMinor),
      ...(isMinor ? (["user_government_id"] as VerificationDocumentKind[]) : []),
    ]);
    if (!allowedKinds.has(kind)) {
      throw new ValidationError({ documentKind: ["This document is not required for the account's age group."] });
    }

    const verificationId = stringValue(application.id);
    const storagePath = `${userId}/${verificationId}/${kind}-${randomUUID()}.${extension}`;
    const upload = await this.database.storage
      .from(VERIFICATION_BUCKET)
      .upload(storagePath, contents, { contentType: mimeType, upsert: false });
    if (upload.error) throw new ExternalServiceError("STORAGE_UNAVAILABLE", "The verification document could not be uploaded.");

    const { data: previous, error: previousError } = await this.database
      .from("verification_documents")
      .select("storage_path")
      .eq("verification_id", verificationId)
      .eq("document_kind", kind)
      .maybeSingle();
    if (previousError) {
      await this.database.storage.from(VERIFICATION_BUCKET).remove([storagePath]);
      throw databaseError("The previous verification document could not be checked.");
    }

    const sha256 = createHash("sha256").update(contents).digest("hex");
    const { error } = await this.database.from("verification_documents").upsert(
      {
        verification_id: verificationId,
        user_id: userId,
        document_kind: kind,
        storage_path: storagePath,
        mime_type: mimeType,
        size_bytes: contents.byteLength,
        sha256_hex: sha256,
        uploaded_at: new Date().toISOString(),
      },
      { onConflict: "verification_id,document_kind" },
    );
    if (error) {
      await this.database.storage.from(VERIFICATION_BUCKET).remove([storagePath]);
      throw databaseError("The verification document could not be recorded.");
    }
    const previousPath = previous ? stringValue((previous as Row).storage_path) : "";
    if (previousPath && previousPath !== storagePath) {
      await this.database.storage.from(VERIFICATION_BUCKET).remove([previousPath]);
    }
    return this.getStatus(userId);
  }

  async submit(userId: string) {
    const application = await this.applicationRowForUser(userId);
    if (!application || !application.details_ciphertext) {
      throw new ConflictError("VERIFICATION_APPLICATION_REQUIRED", "Complete your verification details first.");
    }
    if (!["draft", "needs_changes", "rejected"].includes(stringValue(application.verification_status))) {
      throw new ConflictError("VERIFICATION_LOCKED", "This application has already been submitted.");
    }
    const isMinor = application.is_minor === true;
    const documents = await this.documentsForVerification(stringValue(application.id));
    const uploadedKinds = new Set(documents.map((document) => stringValue(document.document_kind)));
    const missing = requiredDocumentKinds(isMinor).filter((kind) => !uploadedKinds.has(kind));
    if (missing.length > 0) {
      throw new ValidationError({ documents: missing.map((kind) => `Upload ${kind.replaceAll("_", " ")}.`) });
    }
    const now = new Date().toISOString();
    const { error } = await this.database
      .from("identity_verifications")
      .update({
        verification_status: "submitted",
        submitted_at: now,
        reviewed_at: null,
        reviewed_by: null,
        decision_reason_code: null,
        review_note_ciphertext: null,
        review_note_iv: null,
        review_note_auth_tag: null,
        review_note_key_version: null,
        approved_expires_at: null,
      })
      .eq("id", application.id);
    if (error) throw databaseError("Your verification application could not be submitted.");
    await this.database.from("audit_events").insert({
      user_id: userId,
      actor_user_id: userId,
      event_type: "verification.submitted",
      resource_type: "identity_verification",
      resource_id: application.id,
      request_id: randomUUID(),
      metadata: { is_minor: isMinor, document_count: documents.length },
    });
    return this.getStatus(userId);
  }

  async assertAiAccess(userId: string): Promise<void> {
    const application = await this.applicationRowForUser(userId);
    if (!application) throw new VerificationRequiredError("not_started");
    const row = await this.normalizeExpired(application);
    if (row.verification_status !== "approved") {
      throw new VerificationRequiredError(stringValue(row.verification_status));
    }
  }

  async listForAdmin(adminUserId: string, status?: string) {
    await this.assertAdmin(adminUserId);
    let query = this.database
      .from("identity_verifications")
      .select("id, user_id, verification_status, is_minor, age_at_submission, submitted_at, reviewed_at, reviewed_by, created_at, updated_at")
      .order("submitted_at", { ascending: true, nullsFirst: false })
      .limit(100);
    if (status && status !== "all") query = query.eq("verification_status", status);
    const { data, error } = await query;
    if (error) throw databaseError("Verification applications could not be loaded.");
    return (data ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      status: row.verification_status,
      isMinor: row.is_minor,
      ageAtSubmission: row.age_at_submission,
      submittedAt: row.submitted_at,
      reviewedAt: row.reviewed_at,
      updatedAt: row.updated_at,
    }));
  }

  async getForAdmin(adminUserId: string, verificationId: string) {
    await this.assertAdmin(adminUserId);
    const { data, error } = await this.database
      .from("identity_verifications")
      .select("*")
      .eq("id", verificationId)
      .maybeSingle();
    if (error) throw databaseError("The verification application could not be loaded.");
    if (!data) throw new NotFoundError("The verification application was not found.");
    const row = data as Row;
    const documents = await this.documentsForVerification(verificationId);
    const reviewedDocuments = await Promise.all(
      documents.map(async (document) => {
        const path = stringValue(document.storage_path);
        const signed = await this.database.storage.from(VERIFICATION_BUCKET).createSignedUrl(path, 300);
        if (signed.error) throw new ExternalServiceError("STORAGE_UNAVAILABLE", "A verification document could not be opened.");
        return {
          ...this.documentResponse(document),
          signedUrl: signed.data.signedUrl,
        };
      }),
    );
    return {
      id: verificationId,
      userId: stringValue(row.user_id),
      status: stringValue(row.verification_status),
      isMinor: row.is_minor === true,
      ageAtSubmission: Number(row.age_at_submission),
      application: this.applicationDetails(row),
      documents: reviewedDocuments,
      submittedAt: nullableString(row.submitted_at),
      reviewedAt: nullableString(row.reviewed_at),
      reasonCode: nullableString(row.decision_reason_code),
      reviewNote: decryptColumns(this.encryption, row, "review_note_"),
    };
  }

  async claimForReview(adminUserId: string, verificationId: string) {
    await this.assertAdmin(adminUserId);
    const { data, error } = await this.database
      .from("identity_verifications")
      .update({ verification_status: "under_review" })
      .eq("id", verificationId)
      .eq("verification_status", "submitted")
      .select("id")
      .maybeSingle();
    if (error) throw databaseError("The verification application could not be claimed.");
    if (!data) {
      const detail = await this.getForAdmin(adminUserId, verificationId);
      if (detail.status !== "under_review") {
        throw new ConflictError("VERIFICATION_ALREADY_REVIEWED", "This application is no longer awaiting review.");
      }
    }
    return this.getForAdmin(adminUserId, verificationId);
  }

  async decide(adminUserId: string, verificationId: string, input: VerificationDecisionInput) {
    await this.assertAdmin(adminUserId);
    if (input.decision !== "approved" && (!input.reasonCode || !input.note)) {
      throw new ValidationError({
        review: ["A reason and a helpful note are required when requesting changes or rejecting an application."],
      });
    }
    const { data: current, error: currentError } = await this.database
      .from("identity_verifications")
      .select("*")
      .eq("id", verificationId)
      .maybeSingle();
    if (currentError) throw databaseError("The verification application could not be loaded.");
    if (!current) throw new NotFoundError("The verification application was not found.");
    if (!["submitted", "under_review"].includes(current.verification_status)) {
      throw new ConflictError("VERIFICATION_ALREADY_REVIEWED", "This application is no longer awaiting review.");
    }

    const now = new Date();
    const note = input.note ? this.encryption.encrypt(input.note) : null;
    const update = {
      verification_status: input.decision,
      reviewed_at: now.toISOString(),
      reviewed_by: adminUserId,
      decision_reason_code: input.reasonCode,
      review_note_ciphertext: note ? bytea(note.ciphertext) : null,
      review_note_iv: note ? bytea(note.iv) : null,
      review_note_auth_tag: note ? bytea(note.authenticationTag) : null,
      review_note_key_version: note?.keyVersion ?? null,
      approved_expires_at:
        input.decision === "approved"
          ? new Date(now.getTime() + 730 * 24 * 60 * 60 * 1000).toISOString()
          : null,
    };
    const { data: updated, error } = await this.database
      .from("identity_verifications")
      .update(update)
      .eq("id", verificationId)
      .in("verification_status", ["submitted", "under_review"])
      .select("id")
      .maybeSingle();
    if (error) throw databaseError("The verification decision could not be saved.");
    if (!updated) {
      throw new ConflictError(
        "VERIFICATION_ALREADY_REVIEWED",
        "Another administrator has already completed this review.",
      );
    }

    const reviewNote = input.note ? this.encryption.encrypt(input.note) : null;
    const { error: reviewError } = await this.database.from("verification_reviews").insert({
      verification_id: verificationId,
      admin_user_id: adminUserId,
      decision: input.decision,
      reason_code: input.reasonCode,
      note_ciphertext: reviewNote ? bytea(reviewNote.ciphertext) : null,
      note_iv: reviewNote ? bytea(reviewNote.iv) : null,
      note_auth_tag: reviewNote ? bytea(reviewNote.authenticationTag) : null,
      note_key_version: reviewNote?.keyVersion ?? null,
    });
    if (reviewError) {
      await this.database
        .from("identity_verifications")
        .update({
          verification_status: current.verification_status,
          reviewed_at: current.reviewed_at,
          reviewed_by: current.reviewed_by,
          decision_reason_code: current.decision_reason_code,
          review_note_ciphertext: current.review_note_ciphertext,
          review_note_iv: current.review_note_iv,
          review_note_auth_tag: current.review_note_auth_tag,
          review_note_key_version: current.review_note_key_version,
          approved_expires_at: current.approved_expires_at,
        })
        .eq("id", verificationId);
      throw databaseError("The verification review audit record could not be saved.");
    }

    const userId = stringValue(current.user_id);
    await Promise.all([
      this.database.from("notifications").insert({
        user_id: userId,
        notification_type: "verification_status",
        title: input.decision === "approved" ? "Your account is verified" : "Verification update",
        message:
          input.decision === "approved"
            ? "Buddy and AI-supported features are now available."
            : input.decision === "needs_changes"
              ? "An administrator requested changes to your verification application."
              : "Your verification application was not approved. Review the reason before resubmitting.",
      }),
      this.database.from("audit_events").insert({
        user_id: userId,
        actor_user_id: adminUserId,
        event_type: `verification.${input.decision}`,
        resource_type: "identity_verification",
        resource_id: verificationId,
        request_id: randomUUID(),
        metadata: { decision: input.decision, reason_code: input.reasonCode },
      }),
    ]);
    return this.getForAdmin(adminUserId, verificationId);
  }
}
