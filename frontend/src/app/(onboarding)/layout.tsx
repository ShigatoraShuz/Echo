import type { ReactNode } from "react";
import { OnboardingShell } from "@/shared/components/layout/echo-shells";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return <OnboardingShell>{children}</OnboardingShell>;
}
