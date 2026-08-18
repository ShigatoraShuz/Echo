import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSupabasePublicConfig } from "@/infrastructure/supabase/config";
import { createServerSupabaseClient } from "@/infrastructure/supabase/server-client";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const configured = getSupabasePublicConfig();
  if (!configured) {
    if (process.env.NODE_ENV === "production") redirect("/login?error=auth_not_configured");
    return <>{children}</>;
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <>{children}</>;
}
