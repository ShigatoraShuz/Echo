import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/infrastructure/supabase/server-client";
import { safeRedirectPath } from "@/shared/lib/safe-redirect";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeRedirectPath(requestUrl.searchParams.get("next"));
  const intent = requestUrl.searchParams.get("intent");

  if (code) {
    try {
      const supabase = await createServerSupabaseClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        if (intent === "signup") {
          const { data: userData } = await supabase.auth.getUser();
          if (userData.user) {
            const { data: profile } = await supabase
              .schema("user_service")
              .from("profiles")
              .select("onboarding_completed")
              .eq("user_id", userData.user.id)
              .maybeSingle();

            if (profile?.onboarding_completed) {
              await supabase.auth.signOut({ scope: "local" });
              const existingLogin = new URL("/login", requestUrl.origin);
              existingLogin.searchParams.set("error", "google_account_exists");
              return NextResponse.redirect(existingLogin);
            }
          }
        }
        return NextResponse.redirect(new URL(next, requestUrl.origin));
      }
    } catch {
      // Configuration failures intentionally fall through to the login screen.
      // Do not expose auth provider details in a redirect query string.
    }
  }

  const failedLogin = new URL(request.url);
  failedLogin.pathname = "/login";
  failedLogin.searchParams.set("error", "sign_in_session_expired");
  return NextResponse.redirect(failedLogin);
}
