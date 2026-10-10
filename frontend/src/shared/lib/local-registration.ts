const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Only a configured loopback API may use local registration cookie transport. */
export function localRegistrationTarget(apiBaseUrl: string, isDevelopment: boolean): string | null {
  if (!isDevelopment) return null;
  try {
    const url = new URL(apiBaseUrl);
    if (
      !LOOPBACK_HOSTS.has(url.hostname) ||
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return null;
    return `${url.href.replace(/\/$/, "")}/registration`;
  } catch {
    return null;
  }
}

export function registrationBaseUrl(apiBaseUrl: string, isDevelopment: boolean, pageHostname?: string): string {
  const configured = `${apiBaseUrl.replace(/\/$/, "")}/registration`;
  const localTarget = localRegistrationTarget(apiBaseUrl, isDevelopment);
  const hostname = pageHostname ?? (typeof window === "undefined" ? undefined : window.location.hostname);
  if (!localTarget || !hostname || !LOOPBACK_HOSTS.has(hostname)) return configured;

  // Ports do not affect cookie host matching. Keep the API on the page's
  // loopback host so HttpOnly signup cookies survive localhost/127 switches.
  const target = new URL(localTarget);
  target.hostname = hostname;
  return target.href.replace(/\/$/, "");
}
