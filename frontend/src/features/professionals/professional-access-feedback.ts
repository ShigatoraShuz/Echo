import { normalizeError } from "@/shared/errors/normalize-error";
import type { Membership } from "@/services/professionals/professional-api";
import { professionalReturnPath } from "./professional-return-path";

export type ProfessionalAccessKind = "session" | "mfa" | "reauth" | "denied" | "unavailable" | "rate" | "network" | "server" | "unknown" | "validation" | "pending" | "suspended" | "expired" | "unapproved" | "mfa_unavailable" | "mfa_invalid";
export interface ProfessionalAccessFailure {
  kind: ProfessionalAccessKind; title: string; message: string; retry: boolean; conceal: boolean;
}
const states: Record<Exclude<ProfessionalAccessKind, "validation">, Omit<ProfessionalAccessFailure, "kind">> = {
  session: { title: "Sign in again", message: "Your sign-in session is unavailable or expired. Sign in to continue; professional approval is checked separately.", retry: false, conceal: true },
  mfa: { title: "Authenticator verification required", message: "Complete multi-factor verification before entering this professional workspace.", retry: false, conceal: true },
  reauth: { title: "A fresh sign-in is required", message: "Sign in again before continuing this protected action.", retry: false, conceal: true },
  denied: { title: "Access is not available", message: "Your current role or organization access does not allow this action. Check your access or choose another approved organization. Contact an authorized administrator if access needs review.", retry: false, conceal: true },
  unavailable: { title: "This resource is unavailable", message: "The requested resource cannot be opened with your current access. Return to your approved workspace. No resource details are shown.", retry: false, conceal: true },
  rate: { title: "Please wait before trying again", message: "Too many requests were made. Wait a moment, then retry. Repeated refreshes will not restore access faster.", retry: true, conceal: false },
  network: { title: "Connection interrupted", message: "ECHO could not complete the access check. Check your connection and try again. Protected content stays unavailable until the check succeeds.", retry: true, conceal: false },
  server: { title: "Professional service temporarily unavailable", message: "ECHO could not complete this request. Please try again later. This does not indicate approval or a change to your access.", retry: true, conceal: false },
  unknown: { title: "Professional access could not be checked", message: "The request could not be completed. Please retry; no new access has been granted.", retry: true, conceal: false },
  pending: { title: "Professional approval is pending", message: "Your organization or professional membership still needs administrator approval. Check your application status or contact your organization.", retry: false, conceal: true },
  suspended: { title: "Professional access is suspended", message: "Your organization or membership is suspended. Contact an authorized administrator. Signing in or selecting an organization cannot restore suspended access.", retry: false, conceal: true },
  expired: { title: "Credential renewal is required", message: "Your professional credential is no longer current. A renewed credential and administrator reapproval are needed before case access resumes.", retry: false, conceal: true },
  unapproved: { title: "Professional membership is required", message: "This account has no approved professional membership. Review your application status or contact an authorized administrator; signing in alone does not grant professional privileges.", retry: false, conceal: true },
  mfa_unavailable: { title: "Authenticator verification is unavailable", message: "The authenticator check could not start. Retry or review your account security. Professional content remains protected.", retry: true, conceal: true },
  mfa_invalid: { title: "Authenticator code not verified", message: "The authenticator code could not be verified. Try again with a current six-digit code.", retry: false, conceal: true },
};
export const professionalAccessState = (kind: Exclude<ProfessionalAccessKind, "validation">): ProfessionalAccessFailure => ({ kind, ...states[kind] });

/** Reads the existing AppError/HTTP envelope mapping; does not invent backend codes. */
export function professionalAccessFailure(reason: unknown): ProfessionalAccessFailure {
  const error = normalizeError(reason);
  const code = String(error.code);
  if (error.statusCode === 401 || ["AUTHENTICATION_ERROR", "AUTHENTICATION_REQUIRED", "INVALID_ACCESS_TOKEN"].includes(code)) return professionalAccessState("session");
  if (code === "MFA_REQUIRED") return professionalAccessState("mfa");
  if (code === "REAUTHENTICATION_REQUIRED") return professionalAccessState("reauth");
  if (error.statusCode === 403 || ["RESOURCE_FORBIDDEN", "AUTHORIZATION_ERROR"].includes(code)) return professionalAccessState("denied");
  if (error.statusCode === 404 || code === "NOT_FOUND") return professionalAccessState("unavailable");
  if (error.statusCode === 429 || code === "RATE_LIMITED") return professionalAccessState("rate");
  if (["NETWORK_ERROR", "TIMEOUT"].includes(code)) return professionalAccessState("network");
  if ((error.statusCode ?? 0) >= 500 || code === "DATABASE_UNAVAILABLE" || code === "SERVER_ERROR") return professionalAccessState("server");
  if (error.statusCode === 400 || error.statusCode === 409) return {
    kind: "validation", title: error.statusCode === 409 ? "This action needs review" : "Check this action",
    message: error.statusCode === 409
      ? "The action could not be completed in the current state. Refresh and review the latest information before trying again."
      : "The action was not accepted. Review the information and current workflow requirements before trying again.",
    retry: false, conceal: false,
  };
  return professionalAccessState("unknown");
}

export function membershipAccessFailure(memberships: Membership[]) {
  if (memberships.some((item) => item.accessState.startsWith("suspended"))) return professionalAccessState("suspended");
  if (memberships.some((item) => item.accessState === "credential_expired")) return professionalAccessState("expired");
  if (memberships.some((item) => item.accessState.startsWith("pending"))) return professionalAccessState("pending");
  return professionalAccessState("unapproved");
}
export const professionalAccessDestination = (candidate: string) => `/professional/access?next=${encodeURIComponent(professionalReturnPath(candidate))}`;
export const professionalLoginDestination = (candidate: string) => `/professional/login?error=sign_in_session_expired&next=${encodeURIComponent(professionalReturnPath(candidate))}`;
