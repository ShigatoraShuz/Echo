"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { LoginView } from "@/features/authentication/view/login-view";
import { getAuthService } from "@/services/authentication/auth-service.factory";
import { professionalReturnPath } from "../professional-return-path";

export function ProfessionalLoginView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = professionalReturnPath(searchParams.get("next"));
  const destination = `/professional/access?next=${encodeURIComponent(next)}`;
  useEffect(() => {
    let active = true;
    void getAuthService().getCurrentSession().then((result) => {
      if (active && result.success && result.data && !result.data.isMockSession) router.replace(destination);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [destination, router]);
  return (
    <LoginView
      title="Professional sign in"
      description="Use your ECHO account to enter your approved professional workspace."
      destination={destination}
    />
  );
}
