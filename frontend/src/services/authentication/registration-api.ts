import { env } from "@/config/environment";
import { registrationBaseUrl } from "@/shared/lib/local-registration";

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
  const baseUrl = registrationBaseUrl(env.apiBaseUrl, process.env.NODE_ENV === "development");
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      credentials: "include",
      headers: { "content-type": "application/json", "x-echo-csrf": csrfCookie(), ...(init?.headers ?? {}) },
    });
  } catch {
    throw new Error("Could not connect to ECHO. Check your connection and try again.");
  }
  const body = (await response.json().catch(() => null)) as { data?: T; error?: { code?: string; message?: string } } | null;
  if (response.status === 429) {
    throw new Error("Too many signup requests. Please wait before trying again.");
  }
  if (response.status >= 500) {
    if (body?.error?.code === "EMAIL_DELIVERY_NOT_CONFIGURED") {
      throw new Error("Email registration is unavailable until email delivery is configured.");
    }
    throw new Error("Registration is temporarily unavailable. Please try again later.");
  }
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
};
