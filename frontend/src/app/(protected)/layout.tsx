import { PrivateSessionBoundary } from "@/infrastructure/security/private-session-boundary";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSupabasePublicConfig } from "@/infrastructure/supabase/config";
import { createServerSupabaseClient } from "@/infrastructure/supabase/server-client";
import { AnalysisStatusExperience } from "@/features/journal/components/analysis-status-experience";
import { AnalysisCompletionToast } from "@/features/journal/components/analysis-completion-toast";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const configured = getSupabasePublicConfig();
  if (!configured) {
    redirect("/login?error=auth_not_configured");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) redirect("/login?error=login_required");

  return (
    <PrivateSessionBoundary key={claims.sub} userId={claims.sub}>
      {children}
      <AnalysisStatusExperience />
      <AnalysisCompletionToast />
    </PrivateSessionBoundary>
  );
}
