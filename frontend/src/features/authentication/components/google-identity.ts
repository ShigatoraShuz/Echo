export interface GoogleCredential {
  credential: string;
}

export interface GoogleIdentity {
  initialize(options: {
    client_id: string;
    nonce: string;
    callback: (response: GoogleCredential) => void;
    ux_mode: "popup";
    use_fedcm_for_button: false;
    auto_select: false;
  }): void;
  renderButton(
    element: HTMLElement,
    options: {
      type: "standard";
      theme: "outline";
      size: "large";
      text: "continue_with";
      shape: "pill";
      locale: "en";
      width: number;
    },
  ): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentity } };
  }
}

let loading: Promise<GoogleIdentity> | undefined;

export function loadGoogleIdentity(): Promise<GoogleIdentity> {
  if (window.google?.accounts.id) return Promise.resolve(window.google.accounts.id);
  if (loading) return loading;
  loading = new Promise<GoogleIdentity>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-echo-google]");
    const script = existing ?? document.createElement("script");
    const cleanup = () => {
      clearTimeout(timeout);
      script.removeEventListener("load", loaded);
      script.removeEventListener("error", failed);
    };
    const failed = () => {
      cleanup();
      script.remove();
      reject(new Error("Google sign-in could not load. Check your connection or content blocker, then retry."));
    };
    const loaded = () => {
      if (!window.google?.accounts.id) return failed();
      cleanup();
      resolve(window.google.accounts.id);
    };
    const timeout = setTimeout(failed, 15_000);
    script.addEventListener("load", loaded);
    script.addEventListener("error", failed);
    if (!existing) {
      script.src = "https://accounts.google.com/gsi/client?hl=en";
      script.async = true;
      script.dataset.echoGoogle = "true";
      document.head.appendChild(script);
    }
  }).catch((error: unknown) => {
    loading = undefined;
    throw error;
  });
  return loading;
}
