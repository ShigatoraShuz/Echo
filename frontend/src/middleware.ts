import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createMiddlewareSupabaseClient } from "@/lib/supabase/middleware-client";

const protectedPrefixes = [
  "/dashboard",
  "/journal",
  "/buddy",
  "/insights",
  "/tools",
  "/settings",
  "/admin",
];

function isProtected(pathname: string): boolean {
  return protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function middleware(request: NextRequest) {
  if (!getSupabasePublicConfig()) {
    if (process.env.NODE_ENV !== "production") return NextResponse.next();

    // A missing identity-provider configuration must never expose a protected
    // production route. Redirect to the login surface, whose auth adapter will
    // show a configuration-safe error instead of creating a mock session.
    const destination = request.nextUrl.clone();
    destination.pathname = "/login";
    destination.search = "";
    destination.searchParams.set("error", "auth_not_configured");
    return NextResponse.redirect(destination);
  }

  const response = NextResponse.next({ request });
  const supabase = createMiddlewareSupabaseClient(request, response);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtected(request.nextUrl.pathname)) {
    const destination = request.nextUrl.clone();
    destination.pathname = "/login";
    destination.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    const redirect = NextResponse.redirect(destination);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/journal/:path*",
    "/buddy/:path*",
    "/insights/:path*",
    "/tools/:path*",
    "/settings/:path*",
    "/admin/:path*",
  ],
};
