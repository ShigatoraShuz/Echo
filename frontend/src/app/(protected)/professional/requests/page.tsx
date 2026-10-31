import { ProfessionalRequestsView } from "@/features/professionals/view/professional-requests-view";
import { ProfessionalWorkspaceGate } from "@/features/professionals/components/professional-workspace-gate";

export const metadata = { title: "Professional support requests — ECHO" };
export default function ProfessionalRequestsPage() {
  return <ProfessionalWorkspaceGate><ProfessionalRequestsView /></ProfessionalWorkspaceGate>;
}
