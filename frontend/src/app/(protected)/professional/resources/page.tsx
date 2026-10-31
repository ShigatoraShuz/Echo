import { ProfessionalWorkspaceGate } from "@/features/professionals/components/professional-workspace-gate";
import { ProfessionalResourcesView } from "@/features/professionals/view/professional-resources-view";

export const metadata = { title: "Professional resources — ECHO" };
export default function ProfessionalResourcesPage() {
  return <ProfessionalWorkspaceGate><ProfessionalResourcesView /></ProfessionalWorkspaceGate>;
}
