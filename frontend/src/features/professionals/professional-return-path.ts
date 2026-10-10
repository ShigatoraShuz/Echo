import { safeRedirectPath } from "@/shared/lib/safe-redirect";

export function professionalReturnPath(candidate: string | null): string {
  const path = safeRedirectPath(candidate, "/professional");
  const pathname = new URL(path, "https://echo.local").pathname;
  return pathname === "/professional" || /^\/professional\/cases\/[0-9a-f-]{36}$/i.test(pathname)
    ? path
    : "/professional";
}
