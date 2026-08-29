import { env } from "@/config/environment";
import { createApiClient } from "@/infrastructure/api/api-client";
import { supabaseAuthTokenProvider } from "@/infrastructure/api/supabase-auth-token-provider";

interface ApiEnvelope<T> {
  success: true;
  data: T;
}

export type VerificationStatus =
  | "not_started"
  | "draft"
  | "submitted"
  | "under_review"
  | "needs_changes"
  | "approved"
  | "rejected"
  | "expired";

export type VerificationDocumentKind =
  | "user_government_id"
  | "user_age_document"
  | "guardian_government_id"
  | "guardianship_document";

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

export interface VerificationApplication {
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

export interface VerificationDocument {
  id: string;
  kind: VerificationDocumentKind;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
}

export interface VerificationSnapshot {
  status: VerificationStatus;
  canAccessAi: boolean;
  canReview: boolean;
  isMinor: boolean | null;
  application: VerificationApplication | null;
  documents: VerificationDocument[];
  requiredDocuments: VerificationDocumentKind[];
  submittedAt: string | null;
  reviewedAt: string | null;
  approvedExpiresAt: string | null;
  reasonCode: string | null;
  reviewNote: string | null;
  consentVersion: string;
  minimumAge: number;
  adultAge: number;
}

export interface AdminVerificationSummary {
  id: string;
  userId: string;
  status: Exclude<VerificationStatus, "not_started">;
  isMinor: boolean;
  ageAtSubmission: number;
  submittedAt: string | null;
  reviewedAt: string | null;
  updatedAt: string;
}

export interface AdminVerificationDetail {
  id: string;
  userId: string;
  status: Exclude<VerificationStatus, "not_started">;
  isMinor: boolean;
  ageAtSubmission: number;
  application: VerificationApplication;
  documents: Array<VerificationDocument & { signedUrl: string }>;
  submittedAt: string | null;
  reviewedAt: string | null;
  reasonCode: string | null;
  reviewNote: string | null;
}

const client = createApiClient({
  baseUrl: env.apiBaseUrl,
  tokenProvider: supabaseAuthTokenProvider,
});

export const verificationApi = {
  async getStatus(): Promise<VerificationSnapshot> {
    return (await client.get<ApiEnvelope<VerificationSnapshot>>("/verification")).data;
  },
  async saveApplication(input: VerificationApplication): Promise<VerificationSnapshot> {
    return (
      await client.put<ApiEnvelope<VerificationSnapshot>, VerificationApplication>(
        "/verification/application",
        input,
      )
    ).data;
  },
  async uploadDocument(
    kind: VerificationDocumentKind,
    file: File,
  ): Promise<VerificationSnapshot> {
    return (
      await client.put<ApiEnvelope<VerificationSnapshot>, File>(
        `/verification/documents/${encodeURIComponent(kind)}`,
        file,
        { headers: { "Content-Type": file.type } },
      )
    ).data;
  },
  async submit(): Promise<VerificationSnapshot> {
    return (await client.post<ApiEnvelope<VerificationSnapshot>>("/verification/submit")).data;
  },
  async adminList(status = "all"): Promise<AdminVerificationSummary[]> {
    const query = status === "all" ? "" : `?status=${encodeURIComponent(status)}`;
    return (
      await client.get<ApiEnvelope<AdminVerificationSummary[]>>(
        `/admin/verifications${query}`,
      )
    ).data;
  },
  async adminDetail(verificationId: string): Promise<AdminVerificationDetail> {
    return (
      await client.get<ApiEnvelope<AdminVerificationDetail>>(
        `/admin/verifications/${encodeURIComponent(verificationId)}`,
      )
    ).data;
  },
  async adminClaim(verificationId: string): Promise<AdminVerificationDetail> {
    return (
      await client.post<ApiEnvelope<AdminVerificationDetail>>(
        `/admin/verifications/${encodeURIComponent(verificationId)}/claim`,
      )
    ).data;
  },
  async adminDecide(
    verificationId: string,
    input: {
      decision: "approved" | "rejected" | "needs_changes";
      reasonCode: string | null;
      note: string | null;
    },
  ): Promise<AdminVerificationDetail> {
    return (
      await client.post<ApiEnvelope<AdminVerificationDetail>, typeof input>(
        `/admin/verifications/${encodeURIComponent(verificationId)}/decision`,
        input,
      )
    ).data;
  },
};
