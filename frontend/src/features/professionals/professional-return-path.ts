import { safeRedirectPath } from "@/shared/lib/safe-redirect";

export function professionalReturnPath(candidate: string | null): string {
  const path = safeRedirectPath(candidate, "/professional");
  const pathname = new URL(path, "https://echo.local").pathname;
  return ["/professional", "/professional/requests", "/professional/my-cases", "/professional/calendar", "/professional/resources", "/professional/settings"].includes(pathname) || /^\/professional\/cases\/[0-9a-f-]{36}$/i.test(pathname)
    ? path
    : "/professional";
}

export function professionalOrganizationDestination(candidate: string, organizationId: string) {
  const destination = new URL(professionalReturnPath(candidate), "https://echo.local");
  destination.searchParams.set("organization", organizationId);
  return `${destination.pathname}${destination.search}${destination.hash}`;
}
