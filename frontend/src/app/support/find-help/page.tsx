import { getSupabasePublicConfig } from "@/infrastructure/supabase/config";
import { createServerSupabaseClient } from "@/infrastructure/supabase/server-client";
import FindHelpView from "./find-help-view";

export const dynamic = "force-dynamic";

export default async function FindHelpPage() {
  let signedIn = false;
  if (getSupabasePublicConfig()) {
    try {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase.auth.getClaims();
      signedIn = !error && typeof data?.claims?.sub === "string" && Boolean(data.claims.sub);
    } catch {
      // The reviewed directory remains public when session verification fails.
    }
  }
  return <FindHelpView signedIn={signedIn} />;
}
