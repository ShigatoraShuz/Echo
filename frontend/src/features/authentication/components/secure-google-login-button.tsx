"use client";

import { useSearchParams } from "next/navigation";
import { SecureGoogleButton } from "./secure-google-button";

export function SecureGoogleLoginButton() {
  const searchParams = useSearchParams();
  return <SecureGoogleButton intent="login" successPath={searchParams.get("next")} />;
}
