import { ProfessionalMyCasesView } from "@/features/professionals/view/professional-requests-view";
import { ProfessionalWorkspaceGate } from "@/features/professionals/components/professional-workspace-gate";

export const metadata = { title: "My professional cases — ECHO" };
export default function ProfessionalMyCasesPage() {
  return <ProfessionalWorkspaceGate><ProfessionalMyCasesView /></ProfessionalWorkspaceGate>;
}
