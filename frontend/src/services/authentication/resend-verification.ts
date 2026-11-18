import { createBrowserSupabaseClient } from "@/infrastructure/supabase/browser-client";

export async function resendVerificationEmail(email: string): Promise<{ success: boolean; message: string }> {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return { success: false, message: "Enter your email address first." };
  }
  try {
    const callback = new URL("/callback", window.location.origin);
    callback.searchParams.set("next", "/onboarding");
    const { error } = await createBrowserSupabaseClient().auth.resend({
      type: "signup", email: email.trim().toLowerCase(),
      options: { emailRedirectTo: callback.toString() },
    });
    if (error) {
      const limited = error.status === 429 || error.code?.includes("rate_limit");
      return { success: false, message: limited
        ? "Please wait a minute before requesting another verification email."
        : error.code === "email_address_not_authorized"
          ? "Email delivery is not configured for this address. Contact ECHO support."
          : "The verification email could not be requested. Please try again." };
    }
    return { success: true, message: "Verification email requested. Check your Inbox and Spam folders, then open the latest verification link." };
  } catch {
    return { success: false, message: "Email verification could not be reached. Check your connection and try again." };
  }
}
