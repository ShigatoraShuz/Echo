/** Exit targets are always a real local workspace path; no arbitrary return URL. */
export function professionalPreviewExit(organization: string | null | undefined) {
  return organization && /^[a-zA-Z0-9_-]{1,128}$/.test(organization)
    ? "/professional?organization=" + encodeURIComponent(organization) : "/professional";
}
