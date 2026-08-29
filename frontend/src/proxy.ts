import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicConfig } from "@/infrastructure/supabase/config";
import { createMiddlewareSupabaseClient } from "@/infrastructure/supabase/middleware-client";

const protectedPrefixes = ["/dashboard", "/journal", "/buddy", "/insights", "/tools", "/settings", "/admin"];

function isProtected(pathname: string): boolean {
  return protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

const accessDestinations: Record<string, string> = {
  ACCOUNT_UNAVAILABLE: "/login?error=account_unavailable",
  EMAIL_VERIFICATION_REQUIRED: "/login?error=email_verification_required",
  AGE_VERIFICATION_REQUIRED: "/onboarding/age",
  POLICY_REVIEW_REQUIRED: "/onboarding/policies",
  ONBOARDING_REQUIRED: "/onboarding",
};

function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function origin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

const supabaseOrigin = origin(process.env.NEXT_PUBLIC_SUPABASE_URL);
const apiOrigin = origin(process.env.NEXT_PUBLIC_API_BASE_URL);

function contentSecurityPolicy(nonce: string): string {
  const isDevelopment = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    // In production the nonce authenticates Next.js bootstrap and flight
    // scripts (applied automatically via the x-nonce request header) and the
    // inline theme-init script. Development keeps 'unsafe-inline' for HMR
    // bootstrapping; the local dev server is not a production surface.
    `script-src 'self' 'nonce-${nonce}' https://accounts.google.com${isDevelopment ? " 'unsafe-inline' 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://images.unsplash.com https://plus.unsplash.com",
    "font-src 'self' data:",
    `connect-src 'self' https://accounts.google.com${supabaseOrigin ? ` ${supabaseOrigin} ${supabaseOrigin.replace("https:", "wss:")}` : ""}${apiOrigin ? ` ${apiOrigin}` : ""}`,
    "frame-src https://accounts.google.com",
    "media-src 'self' blob: data:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = generateNonce();
  request.headers.set("x-nonce", nonce);
  const response = NextResponse.next({ request });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy(nonce));

  if (!getSupabasePublicConfig()) {
    if (process.env.NODE_ENV !== "production") return response;

    // A missing identity-provider configuration must never expose a protected
    // production route. Redirect to the login surface, whose auth adapter will
    // show a configuration-safe error instead of creating a mock session.
    // Already on the login surface (e.g. after the redirect) -> let it render.
    if (request.nextUrl.pathname === "/login") return response;
    const destination = request.nextUrl.clone();
    destination.pathname = "/login";
    destination.search = "";
    destination.searchParams.set("error", "auth_not_configured");
    const redirect = NextResponse.redirect(destination);
    redirect.headers.set("Content-Security-Policy", contentSecurityPolicy(nonce));
    return redirect;
  }

  const supabase = createMiddlewareSupabaseClient(request, response);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtected(request.nextUrl.pathname)) {
    const destination = request.nextUrl.clone();
    destination.pathname = "/login";
    destination.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    const redirect = NextResponse.redirect(destination);
    redirect.headers.set("Content-Security-Policy", contentSecurityPolicy(nonce));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  if (user && (isProtected(request.nextUrl.pathname) || request.nextUrl.pathname.startsWith("/onboarding"))) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token || !process.env.NEXT_PUBLIC_API_BASE_URL) throw new Error("Access service unavailable");
      const accessResponse = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/access/status`, {
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!accessResponse.ok) throw new Error("Access service rejected the session");
      const payload = (await accessResponse.json()) as { data?: { decision?: string } };
      const decision = payload.data?.decision ?? "ACCOUNT_UNAVAILABLE";
      const destinationPath = accessDestinations[decision];
      const alreadyAtDestination = destinationPath && request.nextUrl.pathname === destinationPath.split("?")[0];
      if (destinationPath && !alreadyAtDestination) {
        const destination = new URL(destinationPath, request.url);
        if (isProtected(request.nextUrl.pathname))
          destination.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
        const redirect = NextResponse.redirect(destination);
        redirect.headers.set("Content-Security-Policy", contentSecurityPolicy(nonce));
        response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
        return redirect;
      }
      if (decision === "ACCESS_GRANTED" && request.nextUrl.pathname.startsWith("/onboarding")) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    } catch {
      if (isProtected(request.nextUrl.pathname)) {
        const destination = new URL("/login?error=access_check_unavailable", request.url);
        const redirect = NextResponse.redirect(destination);
        redirect.headers.set("Content-Security-Policy", contentSecurityPolicy(nonce));
        return redirect;
      }
    }
  }

  return response;
}

// Backward compatibility alias if needed
export const middleware = proxy;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|webp|gif|ico)$).*)"],
};
