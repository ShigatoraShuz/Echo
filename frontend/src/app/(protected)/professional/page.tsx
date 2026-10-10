import { ProfessionalDashboard } from "@/features/professionals/view/professional-dashboard";
import { ProfessionalWorkspaceGate } from "@/features/professionals/components/professional-workspace-gate";

export default function ProfessionalPage() {
  return <ProfessionalWorkspaceGate><ProfessionalDashboard /></ProfessionalWorkspaceGate>;
}
