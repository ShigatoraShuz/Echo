import type { ReactNode } from "react";
import { OnboardingShell } from "@/components/echo/shells";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return <OnboardingShell>{children}</OnboardingShell>;
}
