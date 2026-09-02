import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { OnboardingShell } from "@/shared/components/layout/echo-shells";
import { getSupabasePublicConfig } from "@/infrastructure/supabase/config";
import { createServerSupabaseClient } from "@/infrastructure/supabase/server-client";

export const dynamic = "force-dynamic";

export default async function OnboardingLayout({ children }: { children: ReactNode }) {
  if (!getSupabasePublicConfig()) redirect("/login?error=auth_not_configured");

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=login_required");

  return <OnboardingShell>{children}</OnboardingShell>;
}
