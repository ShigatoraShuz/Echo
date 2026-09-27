// Remove obsolete draft caches without reading their plaintext. Current drafts
// are encrypted on the server. Do not clear theme or accessibility preferences.
export function clearSensitiveBrowserState(): void {
  if (typeof window === "undefined") return;
  for (const storageName of ["localStorage", "sessionStorage"] as const) {
    try {
      const storage = window[storageName];
      const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i));
      for (const key of keys) {
        if (key && (key === "journal-draft" || key.startsWith("echo:active-analysis") || /^(?:echo[:.-])?journal[:.-](?:draft|autosave)/.test(key))) storage.removeItem(key);
      }
    } catch { /* Browser policy can disable storage. */ }
  }
  window.dispatchEvent(new Event("echo:sensitive-state-cleared"));
}
