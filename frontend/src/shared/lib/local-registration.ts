const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Only a configured loopback API may use the development auth proxy. */
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

export function registrationBaseUrl(apiBaseUrl: string, isDevelopment: boolean): string {
  // Same-origin requests keep HttpOnly and CSRF cookies on the page's host,
  // including when the developer switches between localhost and 127.0.0.1.
  return localRegistrationTarget(apiBaseUrl, isDevelopment)
    ? "/api/v1/registration"
    : `${apiBaseUrl.replace(/\/$/, "")}/registration`;
}
