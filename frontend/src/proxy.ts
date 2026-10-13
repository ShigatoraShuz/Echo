import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicConfig } from "@/infrastructure/supabase/config";
import { createMiddlewareSupabaseClient } from "@/infrastructure/supabase/middleware-client";
import { professionalReturnPath } from "@/features/professionals/professional-return-path";

const authenticatedPrefixes = [
  "/dashboard",
  "/journal",
  "/calendar",
  "/buddy",
  "/insights",
  "/tools",
  "/settings",
  "/admin",
  "/professional",
  "/professional-support",
  "/onboarding",
];

function requiresAuthentication(pathname: string): boolean {
  if (pathname === "/professional/login") return false;
  return authenticatedPrefixes.some(
    (prefix) =>
      pathname === prefix ||
      pathname.startsWith(`${prefix}/`),
  );
}

const accessDestinations: Record<string, string> = {
  ACCOUNT_UNAVAILABLE:
    "/login?error=account_unavailable",
  EMAIL_VERIFICATION_REQUIRED:
    "/login?error=email_verification_required",
  AGE_VERIFICATION_REQUIRED:
    "/onboarding/age",
  POLICY_REVIEW_REQUIRED:
    "/onboarding/policies",
  ONBOARDING_REQUIRED:
    "/onboarding",
};

function generateNonce(): string {
  const bytes = crypto.getRandomValues(
    new Uint8Array(16),
  );

  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function origin(
  value: string | undefined,
): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

const supabaseOrigin = origin(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
);

const apiOrigin = origin(
  process.env.NEXT_PUBLIC_API_BASE_URL,
);

// Local registration follows the page's loopback host so its cookies return.
const alternateLocalApiOrigin =
  process.env.NODE_ENV === "development" && apiOrigin?.startsWith("http://127.0.0.1:")
    ? apiOrigin.replace("127.0.0.1", "localhost")
    : process.env.NODE_ENV === "development" && apiOrigin?.startsWith("http://localhost:")
      ? apiOrigin.replace("localhost", "127.0.0.1")
      : null;

function contentSecurityPolicy(
  nonce: string,
): string {
  const isDevelopment =
    process.env.NODE_ENV !== "production";

  return [
    "default-src 'self'",

    `script-src 'self' 'nonce-${nonce}' https://accounts.google.com${
      isDevelopment
        ? " 'unsafe-inline' 'unsafe-eval'"
        : ""
    }`,

    "style-src 'self' 'unsafe-inline' https://accounts.google.com",

    "img-src 'self' data: blob: https://images.unsplash.com https://plus.unsplash.com",

    "font-src 'self' data:",

    `connect-src 'self' https://accounts.google.com${
      supabaseOrigin
        ? ` ${supabaseOrigin} ${supabaseOrigin.replace(
            "https:",
            "wss:",
          )}`
        : ""
    }${apiOrigin ? ` ${apiOrigin}` : ""}${alternateLocalApiOrigin ? ` ${alternateLocalApiOrigin}` : ""}`,

    "frame-src https://accounts.google.com",

    "media-src 'self' blob: data:",

    "worker-src 'self' blob:",

    "object-src 'none'",

    "base-uri 'self'",

    "form-action 'self'",

    "frame-ancestors 'none'",

    ...(isDevelopment
      ? []
      : ["upgrade-insecure-requests"]),
  ].join("; ");
}

function applySecurityHeaders(
  response: NextResponse,
  nonce: string,
): NextResponse {
  response.headers.set(
    "Content-Security-Policy",
    contentSecurityPolicy(nonce),
  );

  return response;
}

function redirectToLogin(
  request: NextRequest,
  response: NextResponse,
  nonce: string,
  error:
    | "login_required"
    | "auth_not_configured"
    | "access_check_unavailable",
): NextResponse {
  const destination =
    request.nextUrl.clone();

  destination.pathname =
    request.nextUrl.pathname === "/professional" ||
    request.nextUrl.pathname === "/professional/access" ||
    request.nextUrl.pathname.startsWith("/professional/cases/")
      ? "/professional/login"
      : "/login";
  destination.search = "";

  destination.searchParams.set(
    "error",
    error,
  );

  destination.searchParams.set(
    "next",
    request.nextUrl.pathname === "/professional/access"
      ? professionalReturnPath(request.nextUrl.searchParams.get("next"))
      : `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );

  const redirect =
    NextResponse.redirect(
      destination,
    );

  redirect.headers.set(
    "Cache-Control",
    "private, no-store, max-age=0",
  );

  applySecurityHeaders(
    redirect,
    nonce,
  );

  response.cookies
    .getAll()
    .forEach((cookie) => {
      redirect.cookies.set(
        cookie,
      );
    });

  return redirect;
}

export async function proxy(
  request: NextRequest,
) {
  const nonce = generateNonce();

  request.headers.set(
    "x-nonce",
    nonce,
  );

  request.headers.set(
    "Content-Security-Policy",
    contentSecurityPolicy(
      nonce,
    ),
  );

  const response =
    NextResponse.next({
      request,
    });

  applySecurityHeaders(
    response,
    nonce,
  );

  const pathname =
    request.nextUrl.pathname;

  const requiresAuth =
    requiresAuthentication(
      pathname,
    );

  /*
   * Public routes must never wait for
   * Supabase Auth just to render.
   *
   * Authentication checks are only needed
   * for protected application routes.
   *
   * This prevents slow/failing Supabase
   * auth refresh requests from blocking:
   * - /
   * - /login
   * - /signup
   * - other public routes
   */
  if (!requiresAuth) {
    return response;
  }

  if (!getSupabasePublicConfig()) {
    /*
     * Configuration failures are never allowed
     * to make an authenticated route public.
     */
    return redirectToLogin(
      request,
      response,
      nonce,
      "auth_not_configured",
    );
  }

  const supabase =
    createMiddlewareSupabaseClient(
      request,
      response,
    );

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims?.sub) {
    return redirectToLogin(
      request,
      response,
      nonce,
      "login_required",
    );
  }

  try {
    const {
      data: sessionData,
    } = await supabase.auth.getSession();

    const token =
      sessionData.session
        ?.access_token;

    if (
      !token ||
      !process.env
        .NEXT_PUBLIC_API_BASE_URL
    ) {
      throw new Error(
        "Access service unavailable",
      );
    }

    const accessResponse =
      await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/access/status`,
        {
          headers: {
            authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        },
      );

    if (!accessResponse.ok) {
      throw new Error(
        "Access service rejected the session",
      );
    }

    const payload =
      (await accessResponse.json()) as {
        data?: {
          decision?: string;
        };
      };

    const decision =
      payload.data?.decision ??
      "ACCOUNT_UNAVAILABLE";

    const destinationPath =
      accessDestinations[
        decision
      ];

    const alreadyAtDestination =
      destinationPath &&
      pathname ===
        destinationPath.split(
          "?",
        )[0];

    if (
      destinationPath &&
      !alreadyAtDestination
    ) {
      const destination =
        new URL(
          destinationPath,
          request.url,
        );

      if (
        !pathname.startsWith(
          "/onboarding",
        )
      ) {
        destination.searchParams.set(
          "next",
          `${pathname}${request.nextUrl.search}`,
        );
      }

      const redirect =
        NextResponse.redirect(
          destination,
        );

      applySecurityHeaders(
        redirect,
        nonce,
      );

      response.cookies
        .getAll()
        .forEach((cookie) => {
          redirect.cookies.set(
            cookie,
          );
        });

      return redirect;
    }

    if (
      decision ===
        "ACCESS_GRANTED" &&
      pathname.startsWith(
        "/onboarding",
      )
    ) {
      const redirect =
        NextResponse.redirect(
          new URL(
            "/dashboard",
            request.url,
          ),
        );

      applySecurityHeaders(
        redirect,
        nonce,
      );

      response.cookies
        .getAll()
        .forEach((cookie) => {
          redirect.cookies.set(
            cookie,
          );
        });

      return redirect;
    }
  } catch {
    return redirectToLogin(
      request,
      response,
      nonce,
      "access_check_unavailable",
    );
  }

  return response;
}

export const middleware = proxy;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|webp|gif|ico)$).*)",
  ],
};
