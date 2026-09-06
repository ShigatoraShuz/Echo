import { LoginExperience } from "@/features/dashboard/components/login-experience";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSupabasePublicConfig } from "@/infrastructure/supabase/config";
import { createServerSupabaseClient } from "@/infrastructure/supabase/server-client";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const configured = getSupabasePublicConfig();
  if (!configured) {
    redirect("/login?error=auth_not_configured");
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=login_required");

  const { data: sessionData } = await supabase.auth.getSession();
  let sessionId = user.last_sign_in_at ?? user.id;
  try {
    sessionId =
      JSON.parse(Buffer.from(sessionData.session!.access_token.split(".")[1], "base64url").toString("utf8"))
        .session_id ?? sessionId;
  } catch {}
  return (
    <>
      <LoginExperience sessionKey={user.id + ":" + sessionId} />
      {children}
    </>
  );
}
