import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabasePublicConfig } from "@/infrastructure/supabase/config";

function secureCookieOptions() {
  return {
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = requireSupabasePublicConfig();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          // SameSite=Lax mitigates cross-site request forgery and Secure keeps
          // session cookies off plaintext transports in production. httpOnly
          // is intentionally left to @supabase/ssr defaults: the browser
          // client must be able to read the session cookies.
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, { ...options, ...secureCookieOptions() }),
          );
        } catch {
          // Server Components cannot always write cookies. The auth proxy refreshes
          // session cookies before rendering protected pages.
        }
      },
    },
  });
}
