import type { VerificationApplication, VerificationDocumentKind, VerificationSnapshot } from "../model";
import { verificationApi } from "@/shared/services/verification-api";

export type VerificationServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

export interface VerificationService {
  getStatus(): Promise<VerificationServiceResult<VerificationSnapshot>>;
  saveApplication(application: VerificationApplication): Promise<VerificationServiceResult<VerificationSnapshot>>;
  uploadDocument(kind: VerificationDocumentKind, file: File): Promise<VerificationServiceResult<VerificationSnapshot>>;
  submit(): Promise<VerificationServiceResult<VerificationSnapshot>>;
}

function toResult<T>(promise: Promise<T>): Promise<VerificationServiceResult<T>> {
  return promise.then(
    (data) => ({ success: true as const, data }),
    (reason: unknown) => ({
      success: false as const,
      error: {
        code: "VERIFICATION_REQUEST_FAILED",
        message: reason instanceof Error ? reason.message : "Verification request failed",
      },
    }),
  );
}

export const verificationService: VerificationService = {
  getStatus: () => toResult(verificationApi.getStatus()),
  saveApplication: (application) => toResult(verificationApi.saveApplication(application)),
  uploadDocument: (kind, file) => toResult(verificationApi.uploadDocument(kind, file)),
  submit: () => toResult(verificationApi.submit()),
};