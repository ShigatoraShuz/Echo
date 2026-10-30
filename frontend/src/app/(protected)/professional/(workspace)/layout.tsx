import type { ReactNode } from "react";
import { ProfessionalWorkspaceGate } from "@/features/professionals/components/professional-workspace-gate";

// Login/access/onboarding remain outside this persistent verified workspace.
export default function ProfessionalWorkspaceLayout({ children }: { children: ReactNode }) {
  return <ProfessionalWorkspaceGate>{children}</ProfessionalWorkspaceGate>;
}
