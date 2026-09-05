import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicConfig } from "@/infrastructure/supabase/config";
import { createMiddlewareSupabaseClient } from "@/infrastructure/supabase/middleware-client";

const authenticatedPrefixes = [
  "/dashboard",
  "/journal",
  "/buddy",
  "/insights",
  "/tools",
  "/settings",
  "/admin",
  "/onboarding",
];

function requiresAuthentication(pathname: string): boolean {
  return authenticatedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
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
    // Google Identity Services injects its own stylesheet when the sign-in
    // prompt is opened. Keep the allow-list scoped to that provider rather
    // than weakening the policy for arbitrary third-party styles.
    "style-src 'self' 'unsafe-inline' https://accounts.google.com",
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

function applySecurityHeaders(response: NextResponse, nonce: string): NextResponse {
  response.headers.set("Content-Security-Policy", contentSecurityPolicy(nonce));
  // Static referrer/popup headers live in next.config.ts so private pages and
  // public Google sign-in pages cannot receive conflicting policies.
  return response;
}

function redirectToLogin(
  request: NextRequest,
  response: NextResponse,
  nonce: string,
  error: "login_required" | "auth_not_configured" | "access_check_unavailable",
): NextResponse {
  const destination = request.nextUrl.clone();
  destination.pathname = "/login";
  destination.search = "";
  destination.searchParams.set("error", error);
  destination.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);

  const redirect = NextResponse.redirect(destination);
  redirect.headers.set("Cache-Control", "private, no-store, max-age=0");
  applySecurityHeaders(redirect, nonce);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export async function proxy(request: NextRequest) {
  const nonce = generateNonce();
  if (process.env.NODE_ENV === "production" && request.nextUrl.pathname === "/design-system") {
    const unavailable = new NextResponse(null, { status: 404 });
    applySecurityHeaders(unavailable, nonce);
    return unavailable;
  }
  request.headers.set("x-nonce", nonce);
  const response = NextResponse.next({ request });
  applySecurityHeaders(response, nonce);

  if (!getSupabasePublicConfig()) {
    // Configuration failures are never allowed to make an authenticated route
    // public, including in development. Public pages remain available so the
    // login surface can explain the problem without creating a redirect loop.
    if (requiresAuthentication(request.nextUrl.pathname)) {
      return redirectToLogin(request, response, nonce, "auth_not_configured");
    }
    return response;
  }

  const supabase = createMiddlewareSupabaseClient(request, response);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && requiresAuthentication(request.nextUrl.pathname)) {
    return redirectToLogin(request, response, nonce, "login_required");
  }

  if (user && requiresAuthentication(request.nextUrl.pathname)) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token || !process.env.NEXT_PUBLIC_API_BASE_URL) throw new Error("Access service unavailable");
      const accessBaseUrl = (process.env.GATEWAY_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL).replace(/\/$/, "");
      const accessResponse = await fetch(new URL(`${accessBaseUrl}/access/status`, request.url), {
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
        if (!request.nextUrl.pathname.startsWith("/onboarding"))
          destination.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
        const redirect = NextResponse.redirect(destination);
        applySecurityHeaders(redirect, nonce);
        response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
        return redirect;
      }
      if (decision === "ACCESS_GRANTED" && request.nextUrl.pathname.startsWith("/onboarding")) {
        const redirect = NextResponse.redirect(new URL("/dashboard", request.url));
        applySecurityHeaders(redirect, nonce);
        response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
        return redirect;
      }
    } catch {
      return redirectToLogin(request, response, nonce, "access_check_unavailable");
    }
  }

  return response;
}

// Backward compatibility alias if needed
export const middleware = proxy;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|webp|gif|ico)$).*)"],
};
