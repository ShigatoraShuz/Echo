export interface ReferralInput { resourceName: string; resourceUrl: string | null }

export function safeReferralUrl(value: string | null): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function referralValidation(resourceName: string, resourceUrl: string) {
  const name = resourceName.trim();
  return {
    name: name.length < 2 || name.length > 160 ? "Enter a resource name between 2 and 160 characters." : "",
    url: resourceUrl.trim() && !safeReferralUrl(resourceUrl) ? "Enter a valid HTTPS website without embedded sign-in credentials, or leave it blank." : "",
  };
}
