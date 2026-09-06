import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/infrastructure/supabase/server-client";
import { safeRedirectPath } from "@/shared/lib/safe-redirect";
export async function GET(request: Request) {
  const url = new URL(request.url),
    code = url.searchParams.get("code"),
    tokenHash = url.searchParams.get("token_hash"),
    type = url.searchParams.get("type");
  try {
    if (tokenHash && type === "email") {
      const supabase = await createServerSupabaseClient();
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
      if (!error) {
        // Confirmation proves ownership; normal email sign-in still requires a fresh code.
        await supabase.auth.signOut({ scope: "local" });
        return NextResponse.redirect(new URL("/login?confirmed=1", url.origin));
      }
    } else if (code) {
      const supabase = await createServerSupabaseClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(safeRedirectPath(url.searchParams.get("next")), url.origin));
    }
  } catch {
    /* Fail closed without forwarding credentials into redirect URLs. */
  }
  return NextResponse.redirect(new URL("/login?error=sign_in_session_expired", url.origin));
}
