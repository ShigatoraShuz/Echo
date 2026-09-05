import { env } from "@/config/environment";

export interface PolicyDocument {
  id: string;
  document_type: "terms_of_use" | "privacy_notice" | "ai_analysis_notice";
  version: string;
  title: string;
  summary: string;
  sanitized_markdown: string;
  effective_at: string;
}
function csrfCookie(): string {
  if (typeof document === "undefined") return "";
  return decodeURIComponent(
    document.cookie
      .split("; ")
      .find((item) => item.startsWith("echo_signup_csrf="))
      ?.split("=")[1] ?? "",
  );
}
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = `${env.apiBaseUrl.replace(/\/$/, "")}/registration`;
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json", "x-echo-csrf": csrfCookie(), ...(init?.headers ?? {}) },
  });
  const body = (await response.json().catch(() => null)) as { data?: T; error?: { message?: string } } | null;
  if (!response.ok) throw new Error(body?.error?.message ?? "Registration could not continue.");
  return body?.data as T;
}
export const registrationApi = {
  policies: () => request<PolicyDocument[]>("/policies"),
  eligibility: (birthday: string) =>
    request<{ eligible: boolean }>("/eligibility", { method: "POST", body: JSON.stringify({ birthday }) }),
  agreements: (input: {
    reviewedDocumentIds: string[];
    termsAccepted: true;
    privacyAccepted: true;
    aiNoticeAccepted: true;
    optionalAiAnalysis: boolean;
  }) => request<{ nextStep: string }>("/agreements", { method: "POST", body: JSON.stringify(input) }),
  email: (input: { email: string; password: string; confirmPassword: string }) =>
    request<{ verificationPending: boolean }>("/email", { method: "POST", body: JSON.stringify(input) }),
  status: () =>
    request<{ verificationPending: boolean; resendAvailableAt: string | null; expiresAt: string }>("/status"),
  resend: () => request<{ sent: boolean }>("/resend", { method: "POST", body: "{}" }),
  googleNonce: () => request<{ nonce: string; hashedNonce: string }>("/google/nonce", { method: "POST", body: "{}" }),
  bindGoogle: (idToken: string, nonce: string) =>
    request<{ reservation: string; email: string }>("/google/bind", {
      method: "POST",
      body: JSON.stringify({ idToken, nonce }),
    }),
  googleLoginNonce: async () => {
    const challenge = await request<{ nonce: string; hashedNonce: string }>("/google/login-nonce", {
      method: "POST",
      body: "{}",
    });
    // Prove the browser accepted and returned the HttpOnly challenge cookie
    // before asking the user to select a Google account. Never bypass proof.
    await request<{ ready: true }>("/google/login-challenge", {
      method: "POST",
      body: JSON.stringify({ nonce: challenge.nonce }),
    });
    return challenge;
  },
  googleLoginStatus: (idToken: string, nonce: string) =>
    request<{ status: "existing_google_identity" | "password_account_requires_link" | "no_existing_account" }>(
      "/google/login-status",
      { method: "POST", body: JSON.stringify({ idToken, nonce }) },
    ),
};
