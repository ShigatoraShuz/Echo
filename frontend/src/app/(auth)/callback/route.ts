import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/infrastructure/supabase/server-client";
import { safeRedirectPath } from "@/shared/lib/safe-redirect";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeRedirectPath(requestUrl.searchParams.get("next"));

  if (code) {
    try {
      const supabase = await createServerSupabaseClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(next, requestUrl.origin));
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
