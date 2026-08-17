import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { requireSupabasePublicConfig } from "./config";

function secureCookieOptions() {
  return {
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export function createMiddlewareSupabaseClient(request: NextRequest, response: NextResponse) {
  const { url, publishableKey } = requireSupabasePublicConfig();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          // SameSite=Lax mitigates cross-site request forgery and Secure keeps
          // session cookies off plaintext transports in production. httpOnly
          // is intentionally left to @supabase/ssr defaults: the browser
          // client must be able to read the session cookies.
          response.cookies.set(name, value, { ...options, ...secureCookieOptions() });
        });
      },
    },
  });
}
