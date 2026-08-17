import type { VerificationService } from "@/services/verification/verification.service";
import { verificationService } from "@/services/verification/verification.service";

let instance: VerificationService | null = null;

export function getVerificationService(): VerificationService {
  if (instance) return instance;
  instance = verificationService;
  return instance;
}

export function resetVerificationService(): void {
  instance = null;
}