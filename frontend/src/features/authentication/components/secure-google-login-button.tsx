"use client";

import { useSearchParams } from "next/navigation";
import { SecureGoogleButton } from "./secure-google-button";

export function SecureGoogleLoginButton({ successPath }: { successPath?: string }) {
  const searchParams = useSearchParams();
  return <SecureGoogleButton intent="login" successPath={successPath ?? searchParams.get("next")} />;
}
